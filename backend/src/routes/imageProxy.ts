import { Router, Request, Response, NextFunction } from 'express';

const router = Router();

// Only proxy images from these trusted CDNs
const ALLOWED_HOSTS = new Set([
  'cdn.modrinth.com',
  'media.forgecdn.net',
  'mediafilez.forgecdn.net',
]);

interface CacheEntry {
  data: Buffer;
  contentType: string;
  cachedAt: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const MAX_CACHE_ENTRIES = 1000;

function evictExpired() {
  const now = Date.now();
  for (const [key, entry] of cache) {
    if (now - entry.cachedAt > CACHE_TTL_MS) cache.delete(key);
  }
}

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const url = (req.query.url as string) ?? '';
    if (!url) return next(Object.assign(new Error('url parameter required'), { status: 400 }));

    let parsed: URL;
    try { parsed = new URL(url); } catch {
      return next(Object.assign(new Error('Invalid URL'), { status: 400 }));
    }
    if (!ALLOWED_HOSTS.has(parsed.hostname)) {
      return next(Object.assign(new Error('Image host not allowed'), { status: 403 }));
    }

    // Serve from cache if fresh
    const cached = cache.get(url);
    if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
      res.setHeader('Content-Type', cached.contentType);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.setHeader('X-Cache', 'HIT');
      return res.send(cached.data);
    }

    const resp = await fetch(url, {
      headers: { 'User-Agent': 'Spawnpoint/1.0 (self-hosted MC manager)' },
    });
    if (!resp.ok) return next(Object.assign(new Error(`Upstream ${resp.status}`), { status: 502 }));

    const contentType = resp.headers.get('content-type') ?? 'image/png';
    if (!contentType.startsWith('image/')) {
      return next(Object.assign(new Error('Not an image'), { status: 400 }));
    }

    const data = Buffer.from(await resp.arrayBuffer());

    // Evict if cache is full
    if (cache.size >= MAX_CACHE_ENTRIES) evictExpired();
    if (cache.size >= MAX_CACHE_ENTRIES) {
      // Delete oldest entry
      const oldest = cache.keys().next().value;
      if (oldest) cache.delete(oldest);
    }
    cache.set(url, { data, contentType, cachedAt: Date.now() });

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.setHeader('X-Cache', 'MISS');
    res.send(data);
  } catch (err) { next(err); }
});

export default router;

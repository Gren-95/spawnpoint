/**
 * Modrinth .mrpack importer.
 *
 * .mrpack is a zip containing:
 *   modrinth.index.json   — metadata, file list with download URLs
 *   overrides/            — files placed directly into the game directory
 *   server-overrides/     — server-specific overrides (also placed into game dir)
 *
 * Mods are NOT bundled — they are downloaded from their CDN URLs.
 * We only download mods where env.server !== "unsupported".
 */

import yauzl from 'yauzl';
import fs from 'fs';
import path from 'path';

export interface MrpackImportResult {
  name: string;
  versionId: string;
  mcVersion: string;
  serverType: 'fabric' | 'forge' | 'neoforge' | 'quilt' | 'vanilla';
  loaderVersion?: string;
  modsDownloaded: number;
  modsSkipped: number;
}

interface MrpackFile {
  path: string;
  downloads: string[];
  env?: { client?: string; server?: string };
  fileSize?: number;
}

interface MrpackIndex {
  name: string;
  versionId: string;
  files: MrpackFile[];
  dependencies: Record<string, string>;
}

const SKIP_OVERRIDE_PREFIXES = [
  'screenshots/',
  'crash-reports/',
  'logs/',
  'saves/',
  'resourcepacks/',
  'shaderpacks/',
  'replay_recordings/',
];

function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on('data', (c: Buffer) => chunks.push(c));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}

function streamToFile(stream: NodeJS.ReadableStream, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const out = fs.createWriteStream(dest);
    stream.pipe(out);
    out.on('finish', resolve);
    out.on('error', reject);
    stream.on('error', reject);
  });
}

async function downloadFile(url: string, dest: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download ${url}: ${res.status}`);
  const buf = await res.arrayBuffer();
  fs.writeFileSync(dest, Buffer.from(buf));
}

export async function importMrpack(mrpackPath: string, targetDir: string): Promise<MrpackImportResult> {
  let indexBuf: Buffer | null = null;

  // First pass: extract overrides and capture the index
  await new Promise<void>((resolve, reject) => {
    yauzl.open(mrpackPath, { lazyEntries: true, autoClose: true }, (err, zipfile) => {
      if (err || !zipfile) return reject(err ?? new Error('Failed to open .mrpack'));

      zipfile.readEntry();

      zipfile.on('entry', (entry: yauzl.Entry) => {
        const filePath: string = entry.fileName;

        if (/\/$/.test(filePath)) { zipfile.readEntry(); return; }

        if (filePath === 'modrinth.index.json') {
          zipfile.openReadStream(entry, (err, stream) => {
            if (err || !stream) { zipfile.readEntry(); return; }
            streamToBuffer(stream)
              .then((buf) => { indexBuf = buf; zipfile.readEntry(); })
              .catch(() => zipfile.readEntry());
          });
          return;
        }

        // Extract overrides/ and server-overrides/ to target dir
        const overridePrefixes = ['overrides/', 'server-overrides/'];
        const matchedPrefix = overridePrefixes.find((p) => filePath.startsWith(p));
        if (matchedPrefix) {
          const relative = filePath.slice(matchedPrefix.length);
          if (!relative || SKIP_OVERRIDE_PREFIXES.some((p) => relative.startsWith(p))) {
            zipfile.readEntry(); return;
          }
          const dest = path.join(targetDir, relative);
          fs.mkdirSync(path.dirname(dest), { recursive: true });
          zipfile.openReadStream(entry, (err, stream) => {
            if (err || !stream) { zipfile.readEntry(); return; }
            streamToFile(stream, dest)
              .then(() => zipfile.readEntry())
              .catch(() => zipfile.readEntry());
          });
          return;
        }

        zipfile.readEntry();
      });

      zipfile.on('end', resolve);
      zipfile.on('error', reject);
    });
  });

  if (!indexBuf) throw new Error('modrinth.index.json not found in .mrpack');

  const index: MrpackIndex = JSON.parse(indexBuf.toString('utf8'));

  // Detect server type from dependencies
  const deps = index.dependencies ?? {};
  let serverType: MrpackImportResult['serverType'] = 'vanilla';
  let loaderVersion: string | undefined;

  if (deps['fabric-loader'])  { serverType = 'fabric';   loaderVersion = deps['fabric-loader']; }
  else if (deps['quilt-loader']) { serverType = 'quilt';  loaderVersion = deps['quilt-loader']; }
  else if (deps['neoforge'])  { serverType = 'neoforge'; loaderVersion = deps['neoforge']; }
  else if (deps['forge'])     { serverType = 'forge';    loaderVersion = deps['forge']; }

  const mcVersion = deps['minecraft'] ?? '1.21';

  // Download server-compatible mods
  let modsDownloaded = 0;
  let modsSkipped = 0;

  for (const file of index.files) {
    const serverEnv = file.env?.server;
    if (serverEnv === 'unsupported') { modsSkipped++; continue; }
    if (!file.downloads?.length) continue;

    const dest = path.join(targetDir, file.path);
    fs.mkdirSync(path.dirname(dest), { recursive: true });

    try {
      await downloadFile(file.downloads[0], dest);
      modsDownloaded++;
    } catch {
      modsSkipped++;
    }
  }

  return {
    name: index.name,
    versionId: index.versionId,
    mcVersion,
    serverType,
    loaderVersion,
    modsDownloaded,
    modsSkipped,
  };
}

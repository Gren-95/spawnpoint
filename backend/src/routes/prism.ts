import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { nanoid } from 'nanoid';
import { importPrismExport } from '../services/PrismImporter';
import { importMrpack } from '../services/MrpackImporter';
import { createServer } from '../models/Server';
import { SERVERS_DIR } from '../config';
import { getHostDataDir } from '../services/hostDataDir';

const router = Router();
const upload = multer({ dest: '/tmp/mc-prism-uploads/' });

router.post('/import', upload.single('export'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const file = req.file;
    if (!file) return next(Object.assign(new Error('No export file uploaded'), { status: 400 }));

    const id = nanoid(10);
    const serverLocalDir = path.join(SERVERS_DIR, id);
    const hostDirectory = path.join(await getHostDataDir(), 'servers', id);

    fs.mkdirSync(serverLocalDir, { recursive: true });

    const result = await importPrismExport(file.path, serverLocalDir);
    fs.unlinkSync(file.path);

    // Override name if user provided one; javaVersion falls back to auto-detected value from instance.cfg
    const name = (req.body.name as string) || result.name;
    const port = parseInt(req.body.port ?? '25565', 10);
    const memoryMb = parseInt(req.body.memoryMb ?? '2048', 10);
    const javaVersion = (req.body.javaVersion as string) || result.javaVersion;

    const server = createServer({
      id,
      name,
      type: result.serverType,
      mcVersion: result.mcVersion,
      port,
      memoryMb,
      jvmFlags: '-XX:+UseG1GC -XX:+ParallelRefProcEnabled -XX:MaxGCPauseMillis=200',
      javaVersion,
      rconPassword: nanoid(24),
      hostDirectory,
    });

    res.status(201).json({
      success: true,
      data: {
        server,
        importInfo: {
          mcVersion: result.mcVersion,
          serverType: result.serverType,
          loaderVersion: result.loaderVersion,
          javaVersion: result.javaVersion,
          mods: result.mods,
          modsFound: result.mods.length,
        },
      },
    });
  } catch (err) { next(err); }
});

router.post('/import-mrpack', upload.single('export'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const file = req.file;
    if (!file) return next(Object.assign(new Error('No file uploaded'), { status: 400 }));
    if (!file.originalname.endsWith('.mrpack')) {
      fs.unlinkSync(file.path);
      return next(Object.assign(new Error('Only .mrpack files are accepted'), { status: 400 }));
    }

    const id = nanoid(10);
    const serverLocalDir = path.join(SERVERS_DIR, id);
    const hostDirectory = path.join(await getHostDataDir(), 'servers', id);

    fs.mkdirSync(serverLocalDir, { recursive: true });

    const result = await importMrpack(file.path, serverLocalDir);
    fs.unlinkSync(file.path);

    const name = (req.body.name as string) || result.name;
    const port = parseInt(req.body.port ?? '25565', 10);
    const memoryMb = parseInt(req.body.memoryMb ?? '2048', 10);
    const javaVersion = (req.body.javaVersion as string) || '21';

    const server = createServer({
      id,
      name,
      type: result.serverType,
      mcVersion: result.mcVersion,
      port,
      memoryMb,
      jvmFlags: '-XX:+UseG1GC -XX:+ParallelRefProcEnabled -XX:MaxGCPauseMillis=200',
      javaVersion,
      rconPassword: nanoid(24),
      hostDirectory,
    });

    res.status(201).json({
      success: true,
      data: {
        server,
        importInfo: {
          name: result.name,
          versionId: result.versionId,
          mcVersion: result.mcVersion,
          serverType: result.serverType,
          loaderVersion: result.loaderVersion,
          modsDownloaded: result.modsDownloaded,
          modsSkipped: result.modsSkipped,
        },
      },
    });
  } catch (err) { next(err); }
});

export default router;

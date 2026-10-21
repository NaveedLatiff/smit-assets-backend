import { Router, Request, Response } from 'express';
import { getDBStatus } from '../config/db';
import { env } from '../config/env';

const router = Router();

/**
 * @route   GET /api/health
 * @desc    Check system health, database connection, uptime, and memory usage
 * @access  Public
 */
router.get('/', (_req: Request, res: Response) => {
  const dbStatus = getDBStatus();
  const memoryUsage = process.memoryUsage();

  const isHealthy = dbStatus.isConnected;

  const responsePayload = {
    success: true,
    status: isHealthy ? 'healthy' : 'degraded',
    message: isHealthy
      ? 'Asset Management Backend is operational and database connected.'
      : 'Asset Management Backend is running but database is not connected.',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    environment: env.NODE_ENV,
    database: dbStatus,
    memory: {
      rssMb: Math.round((memoryUsage.rss / 1024 / 1024) * 100) / 100,
      heapUsedMb: Math.round((memoryUsage.heapUsed / 1024 / 1024) * 100) / 100,
      heapTotalMb: Math.round((memoryUsage.heapTotal / 1024 / 1024) * 100) / 100,
    },
  };

  res.status(isHealthy ? 200 : 503).json(responsePayload);
});

export default router;

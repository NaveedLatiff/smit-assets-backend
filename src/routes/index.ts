import { Router } from 'express';
import healthRoutes from './health.routes';

const apiRouter = Router();

// Mount Health Check endpoint
apiRouter.use('/health', healthRoutes);

// Root API Welcome endpoint
apiRouter.get('/', (_req, res) => {
  res.json({
    name: 'Asset Inventory & IT Helpdesk Management System API',
    version: '1.0.0',
    documentation: '/api/docs',
    endpoints: {
      health: '/api/health',
    },
  });
});

export default apiRouter;

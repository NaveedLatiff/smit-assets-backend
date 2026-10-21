import { Router } from 'express';
import healthRoutes from './health.routes';
import authRoutes from './auth.routes';
import assetRoutes from './asset.routes';

const apiRouter = Router();

// Mount Health Check endpoint
apiRouter.use('/health', healthRoutes);

// Mount Auth & RBAC endpoints
apiRouter.use('/auth', authRoutes);

// Mount Asset Master endpoints
apiRouter.use('/assets', assetRoutes);

// Root API Welcome endpoint
apiRouter.get('/', (_req, res) => {
  res.json({
    name: 'Asset Inventory & IT Helpdesk Management System API',
    version: '1.0.0',
    documentation: '/api/docs',
    endpoints: {
      health: '/api/health',
      auth: {
        register: 'POST /api/auth/register',
        login: 'POST /api/auth/login',
        me: 'GET /api/auth/me',
        testCampusAccess: 'GET /api/auth/test-campus-access/:campusId',
        adminOnly: 'GET /api/auth/admin-only',
      },
      assets: {
        create: 'POST /api/assets',
        list: 'GET /api/assets',
        getById: 'GET /api/assets/:id',
        update: 'PUT /api/assets/:id',
        delete: 'DELETE /api/assets/:id',
        qrResolve: 'GET /api/assets/qr/:token',
        import: 'POST /api/assets/import',
      },
    },
  });
});

export default apiRouter;

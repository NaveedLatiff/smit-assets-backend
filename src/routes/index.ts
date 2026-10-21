import { Router } from 'express';
import healthRoutes from './health.routes';
import authRoutes from './auth.routes';
import assetRoutes from './asset.routes';
import custodyRoutes from './custody.routes';
import transferRoutes from './transfer.routes';

const apiRouter = Router();

// Mount Health Check endpoint
apiRouter.use('/health', healthRoutes);

// Mount Auth & RBAC endpoints
apiRouter.use('/auth', authRoutes);

// Mount Asset Master endpoints
apiRouter.use('/assets', assetRoutes);

// Mount Custody (Check-In / Check-Out) endpoints
apiRouter.use('/custody', custodyRoutes);

// Mount Inter-Branch Transfers endpoints
apiRouter.use('/transfers', transferRoutes);

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
      custody: {
        assign: 'POST /api/custody/assign',
        return: 'POST /api/custody/return',
        myAssets: 'GET /api/custody/my-assets',
      },
      transfers: {
        request: 'POST /api/transfers',
        list: 'GET /api/transfers',
        getById: 'GET /api/transfers/:id',
        approve: 'PUT /api/transfers/:id/approve',
        dispatch: 'PUT /api/transfers/:id/dispatch',
        receive: 'PUT /api/transfers/:id/receive',
      },
    },
  });
});

export default apiRouter;

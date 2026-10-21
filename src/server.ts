import http from 'http';
import mongoose from 'mongoose';
import { createApp } from './app';
import { connectDB } from './config/db';
import { env } from './config/env';
import { ensureDefaultRoles } from './services/role.service';

const startServer = async () => {
  try {
    // 1. Establish MongoDB connection
    await connectDB();

    // 2. Ensure initial system roles exist in DB
    await ensureDefaultRoles();
    console.log('🛡️ System roles verified & seeded');

    // 3. Initialize Express application
    const app = createApp();
    const server = http.createServer(app);

    // 3. Start listening
    server.listen(env.PORT, () => {
      console.log('====================================================');
      console.log(`🚀 SMIT Asset Inventory & IT Helpdesk Management Server`);
      console.log(`🌍 Environment : ${env.NODE_ENV}`);
      console.log(`🔗 Port        : ${env.PORT}`);
      console.log(`🩺 Healthcheck : http://localhost:${env.PORT}/api/health`);
      console.log('====================================================');
    });

    // Graceful Shutdown Handler
    const shutdown = async (signal: string) => {
      console.log(`\n🛑 Received ${signal}. Gracefully shutting down...`);
      server.close(async () => {
        console.log('🔒 HTTP server closed.');
        try {
          await mongoose.connection.close(false);
          console.log('📦 MongoDB connection closed cleanly.');
          process.exit(0);
        } catch (err) {
          console.error('Error closing MongoDB connection:', err);
          process.exit(1);
        }
      });

      // Force shutdown after 10 seconds timeout
      setTimeout(() => {
        console.error('⚠️ Could not close connections in time, forcefully shutting down');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));

    process.on('unhandledRejection', (reason: Error) => {
      console.error('💥 Unhandled Rejection:', reason);
    });

    process.on('uncaughtException', (error: Error) => {
      console.error('💥 Uncaught Exception:', error);
      process.exit(1);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

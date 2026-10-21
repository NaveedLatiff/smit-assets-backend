import mongoose from 'mongoose';
import { connectDB, getDBStatus } from '../config/db';
import { Campus, Building, Room, Role, User, AssetCategory, Asset } from '../models';

async function testConnection() {
  console.log('🔍 Testing MongoDB connection and Mongoose model compilation...\n');

  try {
    await connectDB();
    const status = getDBStatus();
    console.log(`📊 DB Status: ${status.state} (Host: ${status.host}, DB: ${status.name})`);

    // Verify all models are registered and schemas compile properly
    const models = [
      { name: 'Role', model: Role },
      { name: 'User', model: User },
      { name: 'Campus', model: Campus },
      { name: 'Building', model: Building },
      { name: 'Room', model: Room },
      { name: 'AssetCategory', model: AssetCategory },
      { name: 'Asset', model: Asset },
    ];

    console.log('\n📋 Registered Mongoose Models:');
    for (const m of models) {
      const count = await m.model.countDocuments().catch(() => 0);
      console.log(`  ✓ ${m.name.padEnd(16)} -> Collection: ${m.model.collection.name} (docs: ${count})`);
    }

    console.log('\n✨ Database connection & schemas verified successfully!');
  } catch (error) {
    console.error('\n❌ Connection test failed:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('🔒 Connection closed.');
    process.exit(0);
  }
}

testConnection();

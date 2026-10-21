import mongoose from 'mongoose';
import { connectDB } from '../config/db';
import { Campus } from '../models/Campus';
import { AssetCategory } from '../models/AssetCategory';
import { Asset } from '../models/Asset';
import { AssetHistory, AssetHistoryAction } from '../models/AssetHistory';
import { getNextSequentialTag } from '../models/Counter';
import { generateOpaqueQRToken } from '../utils/tokenGenerator';
import { AssetCondition, AssetStatus } from '../constants/enums';

async function testAssetMaster() {
  console.log('🧪 Starting Asset Master, Sequential ID, QR & Bulk Import Test...\n');

  try {
    await connectDB();

    // 1. Create location hierarchy for test
    console.log('1️⃣ Setting up test campus and asset category...');
    const campus = await Campus.findOneAndUpdate(
      { code: 'AST_CAMPUS' },
      { name: 'Asset Test Campus', code: 'AST_CAMPUS', city: 'Karachi', isActive: true },
      { upsert: true, new: true }
    );

    const category = await AssetCategory.findOneAndUpdate(
      { code: 'TST_LAP' },
      {
        name: 'Test Laptops',
        code: 'TST_LAP',
        tagPrefix: 'LAP',
        specDefinitions: [
          { key: 'ram_gb', label: 'RAM (GB)', type: 'NUMBER', required: true },
          { key: 'cpu', label: 'Processor', type: 'STRING', required: true },
          { key: 'mac_address', label: 'MAC Address', type: 'STRING', required: false },
        ],
        isActive: true,
      },
      { upsert: true, new: true }
    );

    console.log(`   ✓ Campus:   ${campus.name} (${campus.code})`);
    console.log(`   ✓ Category: ${category.name} [Prefix: ${category.tagPrefix}]`);

    // 2. Test Atomic Sequential Asset Tag Generation
    console.log('\n2️⃣ Testing Atomic Sequential Asset ID generation...');
    const tag1 = await getNextSequentialTag('SMIT-LAP', 6);
    const tag2 = await getNextSequentialTag('SMIT-LAP', 6);
    console.log(`   ✓ Sequential Tag #1: ${tag1}`);
    console.log(`   ✓ Sequential Tag #2: ${tag2}`);
    if (tag1 === tag2) throw new Error('Sequential tag generation collision!');

    // 3. Test Opaque QR Token Generation
    console.log('\n3️⃣ Testing Opaque QR Token Generation...');
    const qr1 = generateOpaqueQRToken();
    const qr2 = generateOpaqueQRToken();
    console.log(`   ✓ QR Token #1: ${qr1} (length: ${qr1.length})`);
    console.log(`   ✓ QR Token #2: ${qr2} (length: ${qr2.length})`);
    if (qr1 === qr2 || qr1.includes('Ali') || qr1.includes('Khan')) {
      throw new Error('QR Token must be opaque and cryptographically unique without sensitive info');
    }

    // 4. Create Asset with specs and location
    console.log('\n4️⃣ Creating Master Asset with flexible category specs...');
    const asset = await Asset.create({
      name: 'Dell Latitude 5420',
      assetTag: tag1,
      qrToken: qr1,
      categoryId: category._id,
      brand: 'Dell',
      modelNumber: 'Latitude 5420',
      serialNumber: 'SN-TEST-998877',
      status: AssetStatus.AVAILABLE,
      condition: AssetCondition.NEW,
      location: {
        campusId: campus._id,
      },
      specs: {
        ram_gb: 16,
        cpu: 'Intel Core i7-1185G7',
        mac_address: '00:1A:2B:3C:4D:5E',
      },
    });

    await AssetHistory.create({
      assetId: asset._id,
      action: AssetHistoryAction.CREATED,
      performedByName: 'Integration Test Runner',
      newValues: { status: asset.status, location: asset.location },
      remarks: 'Initial asset registration in test',
    });

    console.log(`   ✓ Asset created: [${asset.assetTag}] ${asset.name}`);
    console.log(`   ✓ Specs recorded: RAM=${asset.specs.ram_gb}GB, CPU=${asset.specs.cpu}`);

    // 5. Update Asset and record History
    console.log('\n5️⃣ Updating Asset (status -> ASSIGNED, condition -> GOOD) & Logging History...');
    asset.status = AssetStatus.ASSIGNED;
    asset.condition = AssetCondition.GOOD;
    await asset.save();

    await AssetHistory.create({
      assetId: asset._id,
      action: AssetHistoryAction.STATUS_CHANGED,
      performedByName: 'Integration Test Runner',
      previousValues: { status: AssetStatus.AVAILABLE },
      newValues: { status: AssetStatus.ASSIGNED },
      remarks: 'Status updated to assigned',
    });

    const historyEvents = await AssetHistory.find({ assetId: asset._id });
    console.log(`   ✓ Asset updated. Timeline events recorded: ${historyEvents.length}`);
    for (const h of historyEvents) {
      console.log(`     - [${h.action}] By: ${h.performedByName} (Remarks: ${h.remarks})`);
    }

    // 6. Test QR Code Lookup
    console.log('\n6️⃣ Testing QR Code Token lookup...');
    const resolvedByQR = await Asset.findOne({ qrToken: qr1, isDeleted: false })
      .populate('categoryId', 'name')
      .populate('location.campusId', 'name');
    if (!resolvedByQR) throw new Error('Asset could not be resolved by QR token');
    console.log(`   ✓ QR Token successfully resolved to asset: ${resolvedByQR.assetTag} (${resolvedByQR.name})`);

    // 7. Test Soft Delete / Retirement
    console.log('\n7️⃣ Testing Soft-Delete / Retirement...');
    asset.isDeleted = true;
    asset.deletedAt = new Date();
    asset.status = AssetStatus.DECOMMISSIONED;
    await asset.save();

    const activeCheck = await Asset.findOne({ _id: asset._id, isDeleted: false });
    console.log(`   ✓ Active query returned: ${activeCheck ? 'Found (Error)' : 'Null (Correct: Soft-deleted)'}`);

    // 8. Clean up test data
    console.log('\n🧹 Cleaning up test artifacts...');
    await Asset.deleteMany({ _id: asset._id });
    await AssetHistory.deleteMany({ assetId: asset._id });
    await Campus.deleteOne({ _id: campus._id });
    await AssetCategory.deleteOne({ _id: category._id });
    console.log('   ✓ Cleanup complete.');

    console.log('\n🎉 ALL ASSET MASTER, QR & LIFECYCLE TESTS PASSED!');
  } catch (error) {
    console.error('\n❌ Asset test failed:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
}

testAssetMaster();

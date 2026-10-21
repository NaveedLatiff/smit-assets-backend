import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { connectDB } from '../config/db';
import { Campus, AssetCategory, User, Role, Asset } from '../models';
import { ensureDefaultRoles } from '../services/role.service';
import { AssetCondition, AssetStatus, CustomFieldType, SystemRole } from '../constants/enums';

async function seedData() {
  console.log('🌱 Seeding initial demo data for SMIT Asset Management (Saylani Welfare Trust)...\n');

  try {
    await connectDB();
    await ensureDefaultRoles();

    // 1. Campuses
    const mainCampus = await Campus.findOneAndUpdate(
      { code: 'MAIN' },
      {
        name: 'SMIT Main Campus',
        code: 'MAIN',
        city: 'Karachi',
        address: 'Shahrah-e-Faisal, Karachi',
        isActive: true,
      },
      { upsert: true, new: true }
    );

    const gulshanCampus = await Campus.findOneAndUpdate(
      { code: 'GLS' },
      {
        name: 'SMIT Gulshan Campus',
        code: 'GLS',
        city: 'Karachi',
        address: 'Gulshan-e-Iqbal Block 5, Karachi',
        isActive: true,
      },
      { upsert: true, new: true }
    );

    // 2. Categories
    const laptopCategory = await AssetCategory.findOneAndUpdate(
      { code: 'LAP' },
      {
        name: 'Laptops & Workstations',
        code: 'LAP',
        tagPrefix: 'LAP',
        description: 'Developer, faculty, and employee laptops',
        specDefinitions: [
          { key: 'ram_gb', label: 'RAM (GB)', type: CustomFieldType.NUMBER, required: true },
          { key: 'processor', label: 'Processor', type: CustomFieldType.STRING, required: true },
          { key: 'storage', label: 'Storage', type: CustomFieldType.STRING, required: false },
        ],
        isActive: true,
      },
      { upsert: true, new: true }
    );

    const acCategory = await AssetCategory.findOneAndUpdate(
      { code: 'AC' },
      {
        name: 'Air Conditioners & Cooling',
        code: 'AC',
        tagPrefix: 'AC',
        description: 'Branch AC units and fixtures',
        specDefinitions: [
          { key: 'capacity_tons', label: 'Capacity (Tons)', type: CustomFieldType.NUMBER, required: true },
          { key: 'inverter', label: 'Inverter', type: CustomFieldType.BOOLEAN, required: false },
        ],
        isActive: true,
      },
      { upsert: true, new: true }
    );

    // 3. System Roles & Users
    const superAdminRole = await Role.findOne({ name: SystemRole.SUPER_ADMIN });
    const campusMgrRole = await Role.findOne({ name: SystemRole.CAMPUS_MANAGER });

    const passwordHashAdmin = await bcrypt.hash('AdminSecret2026!', 10);
    const superAdmin = await User.findOneAndUpdate(
      { email: 'superadmin@smit.edu.pk' },
      {
        name: 'System Administrator',
        email: 'superadmin@smit.edu.pk',
        passwordHash: passwordHashAdmin,
        department: 'Central Operations',
        designation: 'Head of IT Infrastructure',
        role: superAdminRole!._id,
        isGlobalScope: true,
        campusScope: [mainCampus._id, gulshanCampus._id],
        isActive: true,
      },
      { upsert: true, new: true }
    );

    const passwordHashMgr = await bcrypt.hash('Password123!', 10);
    const campusManager = await User.findOneAndUpdate(
      { email: 'ali.khan@smit.edu.pk' },
      {
        name: 'Ali Khan',
        email: 'ali.khan@smit.edu.pk',
        passwordHash: passwordHashMgr,
        department: 'IT Support',
        designation: 'Campus Manager',
        role: campusMgrRole!._id,
        isGlobalScope: false,
        campusScope: [mainCampus._id],
        isActive: true,
      },
      { upsert: true, new: true }
    );

    // 4. Initial Demo Assets
    const demoAsset = await Asset.findOneAndUpdate(
      { assetTag: 'SMIT-LAP-000001' },
      {
        name: 'Dell Latitude 5420',
        organization: 'Saylani Welfare Trust',
        assetTag: 'SMIT-LAP-000001',
        categoryId: laptopCategory._id,
        brand: 'Dell',
        modelNumber: 'Latitude 5420',
        serialNumber: 'SN-DELL-5420-SMIT1',
        status: AssetStatus.AVAILABLE,
        condition: AssetCondition.EXCELLENT,
        location: {
          campusId: mainCampus._id,
        },
        specs: {
          ram_gb: 16,
          processor: 'Intel Core i7-1185G7',
          storage: '512GB NVMe SSD',
        },
        createdBy: superAdmin._id,
      },
      { upsert: true, new: true }
    );

    console.log('✅ Seeded Clean Records (No Building, No Room):');
    console.log(`   - Owner Organization         : Saylani Welfare Trust`);
    console.log(`   - Main Campus ID             : ${mainCampus._id}`);
    console.log(`   - Gulshan Campus ID          : ${gulshanCampus._id}`);
    console.log(`   - Laptop Category ID         : ${laptopCategory._id}`);
    console.log(`   - Super Admin User           : superadmin@smit.edu.pk (${superAdmin._id})`);
    console.log(`   - Campus Manager User        : ali.khan@smit.edu.pk (${campusManager._id})`);
    console.log(`   - Sample Asset Tag           : ${demoAsset.assetTag} (${demoAsset._id})`);

    // Update Postman environment file automatically with these real MongoDB IDs
    const envPath = path.resolve(process.cwd(), 'postman/SMIT_Asset_Management.postman_environment.json');
    if (fs.existsSync(envPath)) {
      const envData = JSON.parse(fs.readFileSync(envPath, 'utf8'));
      // Filter out buildingId and roomId
      envData.values = envData.values
        .filter((v: any) => v.key !== 'buildingId' && v.key !== 'roomId')
        .map((v: any) => {
          if (v.key === 'authorizedCampusId') v.value = mainCampus._id.toString();
          if (v.key === 'forbiddenCampusId') v.value = gulshanCampus._id.toString();
          if (v.key === 'categoryId') v.value = laptopCategory._id.toString();
          if (v.key === 'assetId') v.value = demoAsset._id.toString();
          if (v.key === 'assetQrToken') v.value = demoAsset.qrToken;
          return v;
        });

      fs.writeFileSync(envPath, JSON.stringify(envData, null, 2));
      console.log('\n📄 Updated postman_environment.json (Cleaned: No buildingId or roomId)');
    }

    // Update Postman collection variables
    const collPath = path.resolve(process.cwd(), 'postman/SMIT_Asset_Management.postman_collection.json');
    if (fs.existsSync(collPath)) {
      const collData = JSON.parse(fs.readFileSync(collPath, 'utf8'));
      collData.variable = collData.variable
        .filter((v: any) => v.key !== 'buildingId' && v.key !== 'roomId')
        .map((v: any) => {
          if (v.key === 'authorizedCampusId') v.value = mainCampus._id.toString();
          if (v.key === 'forbiddenCampusId') v.value = gulshanCampus._id.toString();
          if (v.key === 'categoryId') v.value = laptopCategory._id.toString();
          if (v.key === 'assetId') v.value = demoAsset._id.toString();
          if (v.key === 'assetQrToken') v.value = demoAsset.qrToken;
          return v;
        });

      fs.writeFileSync(collPath, JSON.stringify(collData, null, 2));
      console.log('📄 Updated postman_collection.json default variables');
    }

    console.log('\n✨ Database seeding completed successfully!');
  } catch (err) {
    console.error('❌ Seeding failed:', err);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
}

seedData();

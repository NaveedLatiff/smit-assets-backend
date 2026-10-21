import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import { connectDB } from '../config/db';
import { Campus, Building, Room, AssetCategory } from '../models';
import { ensureDefaultRoles } from '../services/role.service';
import { CustomFieldType, RoomType } from '../constants/enums';

async function seedData() {
  console.log('🌱 Seeding initial demo data for testing...\n');

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

    // 2. Building
    const building = await Building.findOneAndUpdate(
      { campusId: mainCampus._id, code: 'IT-BLK' },
      {
        campusId: mainCampus._id,
        name: 'IT & Software Block',
        code: 'IT-BLK',
        totalFloors: 3,
        isActive: true,
      },
      { upsert: true, new: true }
    );

    // 3. Room
    const room = await Room.findOneAndUpdate(
      { buildingId: building._id, roomNumber: 'LAB-101' },
      {
        campusId: mainCampus._id,
        buildingId: building._id,
        name: 'Software Engineering Lab 1',
        roomNumber: 'LAB-101',
        floor: 1,
        roomType: RoomType.LAB,
        capacity: 40,
        isActive: true,
      },
      { upsert: true, new: true }
    );

    // 4. Categories
    const laptopCategory = await AssetCategory.findOneAndUpdate(
      { code: 'LAP' },
      {
        name: 'Laptops & Workstations',
        code: 'LAP',
        tagPrefix: 'LAP',
        description: 'Developer and faculty laptops',
        specDefinitions: [
          { key: 'ram_gb', label: 'RAM (GB)', type: CustomFieldType.NUMBER, required: true },
          { key: 'processor', label: 'Processor', type: CustomFieldType.STRING, required: true },
          { key: 'storage', label: 'Storage', type: CustomFieldType.STRING, required: false },
          { key: 'mac_address', label: 'MAC Address', type: CustomFieldType.STRING, required: false },
        ],
        isActive: true,
      },
      { upsert: true, new: true }
    );

    console.log('✅ Seeded Records:');
    console.log(`   - Main Campus (Authorized) ID : ${mainCampus._id}`);
    console.log(`   - Gulshan Campus (Forbidden) ID: ${gulshanCampus._id}`);
    console.log(`   - Building ID                 : ${building._id}`);
    console.log(`   - Room ID                     : ${room._id}`);
    console.log(`   - Category (Laptops) ID       : ${laptopCategory._id}`);

    // Update Postman environment file automatically with these real MongoDB IDs
    const envPath = path.resolve(process.cwd(), 'postman/SMIT_Asset_Management.postman_environment.json');
    if (fs.existsSync(envPath)) {
      const envData = JSON.parse(fs.readFileSync(envPath, 'utf8'));
      envData.values = envData.values.map((v: any) => {
        if (v.key === 'authorizedCampusId') v.value = mainCampus._id.toString();
        if (v.key === 'forbiddenCampusId') v.value = gulshanCampus._id.toString();
        if (v.key === 'buildingId') v.value = building._id.toString();
        if (v.key === 'roomId') v.value = room._id.toString();
        if (v.key === 'categoryId') v.value = laptopCategory._id.toString();
        return v;
      });

      // Ensure buildingId, roomId, categoryId exist in env
      const keys = envData.values.map((v: any) => v.key);
      if (!keys.includes('buildingId')) {
        envData.values.push({ key: 'buildingId', value: building._id.toString(), type: 'default', enabled: true });
      }
      if (!keys.includes('roomId')) {
        envData.values.push({ key: 'roomId', value: room._id.toString(), type: 'default', enabled: true });
      }
      if (!keys.includes('categoryId')) {
        envData.values.push({ key: 'categoryId', value: laptopCategory._id.toString(), type: 'default', enabled: true });
      }

      fs.writeFileSync(envPath, JSON.stringify(envData, null, 2));
      console.log('\n📄 Updated postman_environment.json with real database IDs!');
    }

    // Update Postman collection variables as well
    const collPath = path.resolve(process.cwd(), 'postman/SMIT_Asset_Management.postman_collection.json');
    if (fs.existsSync(collPath)) {
      const collData = JSON.parse(fs.readFileSync(collPath, 'utf8'));
      collData.variable = collData.variable.map((v: any) => {
        if (v.key === 'authorizedCampusId') v.value = mainCampus._id.toString();
        if (v.key === 'forbiddenCampusId') v.value = gulshanCampus._id.toString();
        if (v.key === 'buildingId') v.value = building._id.toString();
        if (v.key === 'roomId') v.value = room._id.toString();
        if (v.key === 'categoryId') v.value = laptopCategory._id.toString();
        return v;
      });
      fs.writeFileSync(collPath, JSON.stringify(collData, null, 2));
      console.log('📄 Updated postman_collection.json default variables with real database IDs!');
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

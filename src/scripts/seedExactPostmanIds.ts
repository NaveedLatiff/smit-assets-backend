import mongoose from 'mongoose';
import { connectDB } from '../config/db';
import { Campus } from '../models/Campus';
import { Building } from '../models/Building';
import { Room } from '../models/Room';
import { AssetCategory } from '../models/AssetCategory';
import { User } from '../models/User';
import { CustomFieldType, RoomType } from '../constants/enums';

async function seedExactPostmanIds() {
  await connectDB();

  // These are the exact IDs currently present in Postman's variables
  const campusId = new mongoose.Types.ObjectId('6ad879c6ec80e1d10b8e45dc');
  const buildingId = new mongoose.Types.ObjectId('6ad879c6ec80e1d10b8e45df');
  const roomId = new mongoose.Types.ObjectId('6ad879c6ec80e1d10b8e45e0');
  const categoryId = new mongoose.Types.ObjectId('6ad879c6ec80e1d10b8e45de');

  await Campus.findByIdAndUpdate(
    campusId,
    { name: 'SMIT Main Campus', code: 'MAIN_POSTMAN', city: 'Karachi', isActive: true },
    { upsert: true }
  );

  await Building.findByIdAndUpdate(
    buildingId,
    { campusId, name: 'IT Block', code: 'IT-POSTMAN', totalFloors: 3, isActive: true },
    { upsert: true }
  );

  await Room.findByIdAndUpdate(
    roomId,
    {
      campusId,
      buildingId,
      name: 'Computer Lab 1',
      roomNumber: 'LAB-POSTMAN',
      floor: 1,
      roomType: RoomType.LAB,
      isActive: true,
    },
    { upsert: true }
  );

  await AssetCategory.findByIdAndUpdate(
    categoryId,
    {
      name: 'Laptops & Computers',
      code: 'LAP_POSTMAN',
      tagPrefix: 'LAP',
      specDefinitions: [
        { key: 'ram_gb', label: 'RAM (GB)', type: CustomFieldType.NUMBER, required: false },
        { key: 'processor', label: 'Processor', type: CustomFieldType.STRING, required: false },
      ],
      isActive: true,
    },
    { upsert: true }
  );

  // Authorize all users for this campus ID as well
  await User.updateMany({}, { $addToSet: { campusScope: campusId } });

  console.log('✅ Exact Postman IDs registered and authorized in MongoDB Atlas!');
  await mongoose.connection.close();
}

seedExactPostmanIds().catch(console.error);

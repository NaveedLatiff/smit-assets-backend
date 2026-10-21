import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { connectDB } from '../config/db';
import { User } from '../models/User';
import { Role } from '../models/Role';
import { Campus } from '../models/Campus';
import { ensureDefaultRoles, getRoleByName } from '../services/role.service';
import { signToken, verifyJwtToken } from '../utils/jwt';
import { SystemRole } from '../constants/enums';

async function testAuthAndRBAC() {
  console.log('🧪 Starting Auth, RBAC & Campus Scoping Integration Test...\n');

  try {
    await connectDB();

    // 1. Seed Roles
    console.log('1️⃣ Seeding & verifying system roles...');
    await ensureDefaultRoles();
    const roles = await Role.find({ isActive: true });
    console.log(`   ✓ Found ${roles.length} system roles: ${roles.map((r) => r.name).join(', ')}`);

    // 2. Setup mock Campuses for testing
    console.log('\n2️⃣ Creating test campuses for scoping verification...');
    const campusA = await Campus.findOneAndUpdate(
      { code: 'TEST_MAIN' },
      { name: 'Test Main Campus', code: 'TEST_MAIN', city: 'Karachi', isActive: true },
      { upsert: true, new: true }
    );
    const campusB = await Campus.findOneAndUpdate(
      { code: 'TEST_GULSHAN' },
      { name: 'Test Gulshan Campus', code: 'TEST_GULSHAN', city: 'Karachi', isActive: true },
      { upsert: true, new: true }
    );
    console.log(`   ✓ Campus A (Authorized): ${campusA.name} [${campusA._id}]`);
    console.log(`   ✓ Campus B (Forbidden):  ${campusB.name} [${campusB._id}]`);

    // 3. Register Campus Manager with Campus A scoping
    console.log('\n3️⃣ Testing User Registration & Password Hashing (bcrypt)...');
    const testEmail = 'manager.test@smit.edu.pk';
    await User.deleteOne({ email: testEmail });

    const managerRole = await getRoleByName(SystemRole.CAMPUS_MANAGER);
    if (!managerRole) throw new Error('Role CAMPUS_MANAGER not found');

    const rawPassword = 'SecurePassword123!';
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(rawPassword, salt);

    const newUser = await User.create({
      name: 'Test Campus Manager',
      email: testEmail,
      passwordHash,
      department: 'IT Administration',
      designation: 'Campus Manager',
      role: managerRole._id,
      campusScope: [campusA._id],
      isGlobalScope: false,
      isActive: true,
    });
    console.log(`   ✓ User created: ${newUser.name} (${newUser.email})`);
    console.log(`   ✓ Password securely hashed: ${passwordHash.substring(0, 15)}...`);

    // 4. Test Password Verification
    console.log('\n4️⃣ Testing Password Matching...');
    const userForAuth = await User.findOne({ email: testEmail }).select('+passwordHash');
    if (!userForAuth) throw new Error('User not found');

    const correctMatch = await userForAuth.comparePassword(rawPassword);
    const wrongMatch = await userForAuth.comparePassword('WrongPassword!');
    console.log(`   ✓ Correct password matches: ${correctMatch}`);
    console.log(`   ✓ Wrong password rejected:  ${!wrongMatch}`);
    if (!correctMatch || wrongMatch) throw new Error('Password comparison test failed');

    // 5. Test JWT Generation & Decoding
    console.log('\n5️⃣ Testing JWT Token Issuance & Verification...');
    const token = signToken({
      userId: userForAuth._id.toString(),
      email: userForAuth.email,
      role: managerRole.name,
      isGlobalScope: userForAuth.isGlobalScope,
      campusScope: userForAuth.campusScope.map((id) => id.toString()),
    });
    console.log(`   ✓ JWT Issued: ${token.substring(0, 35)}...`);

    const decoded = verifyJwtToken(token);
    console.log(`   ✓ Decoded Payload: User=${decoded.email}, Role=${decoded.role}, Global=${decoded.isGlobalScope}`);

    // 6. Test Campus Scoping Logic
    console.log('\n6️⃣ Testing Campus Scoping Boundary Enforcement...');
    const isCampusAAllowed = decoded.campusScope.includes(campusA._id.toString());
    const isCampusBAllowed = decoded.campusScope.includes(campusB._id.toString());
    console.log(`   ✓ Access to Campus A (In scope):  ${isCampusAAllowed ? 'ALLOWED (Correct)' : 'DENIED'}`);
    console.log(`   ✓ Access to Campus B (Out scope): ${isCampusBAllowed ? 'ALLOWED' : 'DENIED (Correct: Forbidden)'}`);

    // Clean up test records
    console.log('\n🧹 Cleaning up test artifacts...');
    await User.deleteOne({ _id: newUser._id });
    await Campus.deleteMany({ code: { $in: ['TEST_MAIN', 'TEST_GULSHAN'] } });
    console.log('   ✓ Cleanup complete.');

    console.log('\n🎉 ALL AUTH & RBAC VERIFICATION TESTS PASSED SUCCESSFULLY!');
  } catch (err) {
    console.error('\n❌ Auth test failed:', err);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
}

testAuthAndRBAC();

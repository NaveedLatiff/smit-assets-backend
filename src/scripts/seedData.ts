import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { connectDB } from '../config/db';
import {
  Campus,
  AssetCategory,
  User,
  Role,
  Asset,
  AssetHistory,
  AssetTransfer,
  Ticket,
} from '../models';
import { ensureDefaultRoles } from '../services/role.service';
import {
  AssetCondition,
  AssetStatus,
  CustomFieldType,
  SystemRole,
  TransferStatus,
  TicketCategory,
  TicketPriority,
  TicketStatus,
} from '../constants/enums';
import { AssetHistoryAction } from '../models/AssetHistory';
import { generateOpaqueQRToken } from '../utils/tokenGenerator';

async function seedData() {
  console.log('🌱 Seeding complete, comprehensive demo dataset for SMIT Asset & Helpdesk System...\n');

  try {
    await connectDB();
    await ensureDefaultRoles();

    // =========================================================================
    // 1. CAMPUSES
    // =========================================================================
    const mainCampus = await Campus.findOneAndUpdate(
      { code: 'MAIN' },
      {
        name: 'SMIT Main Campus (Shahrah-e-Faisal)',
        code: 'MAIN',
        city: 'Karachi',
        address: 'Shahrah-e-Faisal, Block 6 PECHS, Karachi',
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
        address: 'Gulshan-e-Iqbal Block 5, Near NIPA, Karachi',
        isActive: true,
      },
      { upsert: true, new: true }
    );

    const joharCampus = await Campus.findOneAndUpdate(
      { code: 'JHR' },
      {
        name: 'SMIT Johar Campus',
        code: 'JHR',
        city: 'Karachi',
        address: 'Gulistan-e-Johar Block 12, Karachi',
        isActive: true,
      },
      { upsert: true, new: true }
    );

    const hydCampus = await Campus.findOneAndUpdate(
      { code: 'HYD' },
      {
        name: 'SMIT Hyderabad Campus',
        code: 'HYD',
        city: 'Hyderabad',
        address: 'Auto Bhan Road, Latifabad Unit 3, Hyderabad',
        isActive: true,
      },
      { upsert: true, new: true }
    );

    console.log('✓ Campuses initialized (Main, Gulshan, Johar, Hyderabad)');

    // =========================================================================
    // 2. CATEGORIES
    // =========================================================================
    const catLaptop = await AssetCategory.findOneAndUpdate(
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

    const catNetwork = await AssetCategory.findOneAndUpdate(
      { code: 'NET' },
      {
        name: 'Networking & Infrastructure',
        code: 'NET',
        tagPrefix: 'NET',
        description: 'Switches, routers, firewalls, and access points',
        specDefinitions: [
          { key: 'ports', label: 'Port Count', type: CustomFieldType.NUMBER, required: true },
          { key: 'managed', label: 'Managed Switch', type: CustomFieldType.BOOLEAN, required: false },
        ],
        isActive: true,
      },
      { upsert: true, new: true }
    );

    const catDesktop = await AssetCategory.findOneAndUpdate(
      { code: 'DSK' },
      {
        name: 'Desktop Workstations',
        code: 'DSK',
        tagPrefix: 'DSK',
        description: 'Computer lab workstations and admin desktops',
        specDefinitions: [
          { key: 'processor', label: 'CPU', type: CustomFieldType.STRING, required: true },
          { key: 'ram_gb', label: 'RAM (GB)', type: CustomFieldType.NUMBER, required: true },
        ],
        isActive: true,
      },
      { upsert: true, new: true }
    );

    const catAC = await AssetCategory.findOneAndUpdate(
      { code: 'AC' },
      {
        name: 'Air Conditioners & Climate',
        code: 'AC',
        tagPrefix: 'AC',
        description: 'Branch AC units and lab climate fixtures',
        specDefinitions: [
          { key: 'tonnage', label: 'Capacity (Tons)', type: CustomFieldType.NUMBER, required: true },
          { key: 'inverter', label: 'DC Inverter', type: CustomFieldType.BOOLEAN, required: false },
        ],
        isActive: true,
      },
      { upsert: true, new: true }
    );

    const catPrinter = await AssetCategory.findOneAndUpdate(
      { code: 'PRN' },
      {
        name: 'Printers & Peripherals',
        code: 'PRN',
        tagPrefix: 'PRN',
        description: 'Network printers and document scanners',
        specDefinitions: [
          { key: 'network_ready', label: 'Network Ready', type: CustomFieldType.BOOLEAN, required: false },
        ],
        isActive: true,
      },
      { upsert: true, new: true }
    );

    console.log('✓ Categories initialized (Laptops, Network, Desktops, AC, Printers)');

    // =========================================================================
    // 3. ROLES & USERS
    // =========================================================================
    const superAdminRole = await Role.findOne({ name: SystemRole.SUPER_ADMIN });
    const campusMgrRole = await Role.findOne({ name: SystemRole.CAMPUS_MANAGER });
    const techRole = await Role.findOne({ name: SystemRole.CAMPUS_IT_TECHNICIAN });
    const empRole = await Role.findOne({ name: SystemRole.EMPLOYEE });

    const passwordHashAdmin = await bcrypt.hash('AdminSecret2026!', 10);
    const passwordHashStandard = await bcrypt.hash('Password123!', 10);

    // 1. Super Admin (Global scope)
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
        campusScope: [mainCampus._id, gulshanCampus._id, joharCampus._id],
        isActive: true,
      },
      { upsert: true, new: true }
    );

    // 2. Campus Manager (Gulshan scope)
    const campusManager = await User.findOneAndUpdate(
      { email: 'ali.khan@smit.edu.pk' },
      {
        name: 'Ali Khan',
        email: 'ali.khan@smit.edu.pk',
        passwordHash: passwordHashStandard,
        department: 'Branch Operations',
        designation: 'Gulshan Branch Manager',
        role: campusMgrRole!._id,
        isGlobalScope: false,
        campusScope: [gulshanCampus._id],
        isActive: true,
      },
      { upsert: true, new: true }
    );

    // 2b. Hyderabad Campus Manager
    const hyderabadManager = await User.findOneAndUpdate(
      { email: 'hyderabad.manager@smit.edu.pk' },
      {
        name: 'Rashid Tariq',
        email: 'hyderabad.manager@smit.edu.pk',
        passwordHash: passwordHashStandard,
        department: 'Branch Operations',
        designation: 'Hyderabad Branch Manager',
        role: campusMgrRole!._id,
        isGlobalScope: false,
        campusScope: [hydCampus._id],
        isActive: true,
      },
      { upsert: true, new: true }
    );

    // 2c. Johar Campus Manager
    const joharManager = await User.findOneAndUpdate(
      { email: 'johar.manager@smit.edu.pk' },
      {
        name: 'Zubair Ahmed',
        email: 'johar.manager@smit.edu.pk',
        passwordHash: passwordHashStandard,
        department: 'Branch Operations',
        designation: 'Johar Branch Manager',
        role: campusMgrRole!._id,
        isGlobalScope: false,
        campusScope: [joharCampus._id],
        isActive: true,
      },
      { upsert: true, new: true }
    );

    // 3. IT Technician (Assigned to Main & Gulshan)
    const technician = await User.findOneAndUpdate(
      { email: 'usman.tech@smit.edu.pk' },
      {
        name: 'Usman Farooq',
        email: 'usman.tech@smit.edu.pk',
        passwordHash: passwordHashStandard,
        department: 'IT Hardware & Support',
        designation: 'Senior Network & Hardware Technician',
        role: techRole!._id,
        isGlobalScope: false,
        campusScope: [mainCampus._id, gulshanCampus._id],
        isActive: true,
      },
      { upsert: true, new: true }
    );

    // 4. Employee 1 (Assigned laptop)
    const employee1 = await User.findOneAndUpdate(
      { email: 'bilal.ahmed@smit.edu.pk' },
      {
        name: 'Bilal Ahmed',
        email: 'bilal.ahmed@smit.edu.pk',
        passwordHash: passwordHashStandard,
        department: 'Web & Mobile App Development',
        designation: 'Lead Instructor (Flutter / React)',
        role: empRole!._id,
        isGlobalScope: false,
        campusScope: [mainCampus._id],
        isActive: true,
      },
      { upsert: true, new: true }
    );

    // 5. Employee 2 (Academic Coordinator)
    const employee2 = await User.findOneAndUpdate(
      { email: 'sara.khan@smit.edu.pk' },
      {
        name: 'Sara Khan',
        email: 'sara.khan@smit.edu.pk',
        passwordHash: passwordHashStandard,
        department: 'Administration & Academics',
        designation: 'Academic Coordinator',
        role: empRole!._id,
        isGlobalScope: false,
        campusScope: [gulshanCampus._id],
        isActive: true,
      },
      { upsert: true, new: true }
    );

    // 6. Employee 3 (Lab Systems Engineer)
    const employee3 = await User.findOneAndUpdate(
      { email: 'farhan.eng@smit.edu.pk' },
      {
        name: 'Engr. Farhan Siddiqui',
        email: 'farhan.eng@smit.edu.pk',
        passwordHash: passwordHashStandard,
        department: 'Lab Engineering & Hardware',
        designation: 'Senior Lab Systems Engineer',
        role: empRole!._id,
        isGlobalScope: false,
        campusScope: [gulshanCampus._id],
        isActive: true,
      },
      { upsert: true, new: true }
    );

    // 7. Employee 4 (HR & Faculty Officer)
    const employee4 = await User.findOneAndUpdate(
      { email: 'zainab.hr@smit.edu.pk' },
      {
        name: 'Zainab Fatima',
        email: 'zainab.hr@smit.edu.pk',
        passwordHash: passwordHashStandard,
        department: 'Human Resources',
        designation: 'HR & Faculty Officer',
        role: empRole!._id,
        isGlobalScope: false,
        campusScope: [mainCampus._id, gulshanCampus._id],
        isActive: true,
      },
      { upsert: true, new: true }
    );

    console.log('✓ Users initialized (Super Admin, 3 Campus Managers, IT Tech, 4 Saylani Employees)');

    // =========================================================================
    // 4. ASSETS (Movable & Branch Fixtures)
    // =========================================================================

    // Asset 1: Dell Latitude (Assigned Movable Equipment to Bilal Ahmed)
    const asset1 = await Asset.findOneAndUpdate(
      { assetTag: 'SMIT-LAP-000001' },
      {
        name: 'Dell Latitude 5420 Developer Laptop',
        organization: 'Saylani Welfare Trust',
        assetTag: 'SMIT-LAP-000001',
        qrToken: generateOpaqueQRToken(),
        categoryId: catLaptop._id,
        brand: 'Dell',
        modelNumber: 'Latitude 5420',
        serialNumber: 'CN-0H758G-12963',
        status: AssetStatus.ASSIGNED,
        condition: AssetCondition.EXCELLENT,
        location: { campusId: mainCampus._id },
        assignedTo: {
          userId: employee1._id,
          assignedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 15), // 15 days ago
          remarks: 'Issued for SMIT Mobile App Bootcamp Instruction',
        },
        specs: {
          processor: 'Intel Core i7-1185G7 @ 3.0GHz',
          ram_gb: 16,
          storage: '512GB NVMe M.2 SSD',
          display: '14-inch FHD IPS Anti-Glare',
        },
        createdBy: superAdmin._id,
      },
      { upsert: true, new: true }
    );

    // Asset 2: HP EliteBook (Available in Stock at Main Campus, Movable)
    const asset2 = await Asset.findOneAndUpdate(
      { assetTag: 'SMIT-LAP-000002' },
      {
        name: 'HP EliteBook 840 G8',
        organization: 'Saylani Welfare Trust',
        assetTag: 'SMIT-LAP-000002',
        qrToken: generateOpaqueQRToken(),
        categoryId: catLaptop._id,
        brand: 'HP',
        modelNumber: 'EliteBook 840 G8',
        serialNumber: '5CG1234ABC',
        status: AssetStatus.AVAILABLE,
        condition: AssetCondition.EXCELLENT,
        location: { campusId: mainCampus._id },
        specs: {
          processor: 'Intel Core i5-1135G7',
          ram_gb: 16,
          storage: '256GB NVMe SSD',
        },
        createdBy: superAdmin._id,
      },
      { upsert: true, new: true }
    );

    // Asset 3: Lenovo ThinkPad (Under Repair at Gulshan Campus)
    const asset3 = await Asset.findOneAndUpdate(
      { assetTag: 'SMIT-LAP-000003' },
      {
        name: 'Lenovo ThinkPad T14 Gen 2',
        organization: 'Saylani Welfare Trust',
        assetTag: 'SMIT-LAP-000003',
        qrToken: generateOpaqueQRToken(),
        categoryId: catLaptop._id,
        brand: 'Lenovo',
        modelNumber: 'ThinkPad T14',
        serialNumber: 'PF2ABCDE',
        status: AssetStatus.AVAILABLE,
        condition: AssetCondition.GOOD,
        location: { campusId: gulshanCampus._id },
        specs: {
          processor: 'AMD Ryzen 7 PRO 5850U',
          ram_gb: 32,
          storage: '1TB SSD',
        },
        createdBy: superAdmin._id,
      },
      { upsert: true, new: true }
    );

    // Asset 4: Cisco Core Switch (Branch Fixture at Main Campus)
    const asset4 = await Asset.findOneAndUpdate(
      { assetTag: 'SMIT-NET-000001' },
      {
        name: 'Cisco Catalyst 2960-X 48-Port PoE+ Gigabit Switch',
        organization: 'Saylani Welfare Trust',
        assetTag: 'SMIT-NET-000001',
        qrToken: generateOpaqueQRToken(),
        categoryId: catNetwork._id,
        brand: 'Cisco',
        modelNumber: 'WS-C2960X-48FPS-L',
        serialNumber: 'FOC2134Y5ZZ',
        status: AssetStatus.AVAILABLE,
        condition: AssetCondition.EXCELLENT,
        location: { campusId: mainCampus._id },
        specs: {
          ports: 48,
          poe_budget_watts: 740,
          managed: true,
          rack_unit: '1U Server Rack 1',
        },
        createdBy: superAdmin._id,
      },
      { upsert: true, new: true }
    );

    // Asset 5: MikroTik Core Router (Branch Fixture at Gulshan Campus)
    const asset5 = await Asset.findOneAndUpdate(
      { assetTag: 'SMIT-NET-000002' },
      {
        name: 'MikroTik CCR1036 Cloud Core Router',
        organization: 'Saylani Welfare Trust',
        assetTag: 'SMIT-NET-000002',
        qrToken: generateOpaqueQRToken(),
        categoryId: catNetwork._id,
        brand: 'MikroTik',
        modelNumber: 'CCR1036-8G-2S+',
        serialNumber: 'MK-CCR-98124',
        status: AssetStatus.AVAILABLE,
        condition: AssetCondition.EXCELLENT,
        location: { campusId: gulshanCampus._id },
        specs: {
          ports: 10,
          sfp_plus: '2x 10G SFP+',
          managed: true,
        },
        createdBy: superAdmin._id,
      },
      { upsert: true, new: true }
    );

    // Asset 6: HP ProDesk Lab Computer (Branch Fixture at Main Campus)
    const asset6 = await Asset.findOneAndUpdate(
      { assetTag: 'SMIT-DSK-000001' },
      {
        name: 'HP ProDesk 600 G6 AI Lab Workstation',
        organization: 'Saylani Welfare Trust',
        assetTag: 'SMIT-DSK-000001',
        qrToken: generateOpaqueQRToken(),
        categoryId: catDesktop._id,
        brand: 'HP',
        modelNumber: 'ProDesk 600 G6 Microtower',
        serialNumber: 'CZC9482LMN',
        status: AssetStatus.AVAILABLE,
        condition: AssetCondition.EXCELLENT,
        location: { campusId: mainCampus._id },
        specs: {
          processor: 'Intel Core i7-10700',
          ram_gb: 32,
          gpu: 'NVIDIA RTX 3060 12GB',
          lab_station: 'AI Lab 1 - Station 04',
        },
        createdBy: superAdmin._id,
      },
      { upsert: true, new: true }
    );

    // Asset 7: Haier Inverter AC (Branch Fixture at Gulshan Campus)
    const asset7 = await Asset.findOneAndUpdate(
      { assetTag: 'SMIT-AC-000001' },
      {
        name: 'Haier 1.5 Ton DC Inverter Air Conditioner',
        organization: 'Saylani Welfare Trust',
        assetTag: 'SMIT-AC-000001',
        qrToken: generateOpaqueQRToken(),
        categoryId: catAC._id,
        brand: 'Haier',
        modelNumber: 'HSU-18HFM',
        serialNumber: 'HR-AC-2025-0981',
        status: AssetStatus.AVAILABLE,
        condition: AssetCondition.GOOD,
        location: { campusId: gulshanCampus._id },
        specs: {
          tonnage: 1.5,
          inverter: true,
          refrigerant: 'R410A',
          mounted_room: 'Gulshan Faculty Hall 2',
        },
        createdBy: superAdmin._id,
      },
      { upsert: true, new: true }
    );

    // Asset 8: HP LaserJet Network Printer (Branch Fixture at Main Campus)
    const asset8 = await Asset.findOneAndUpdate(
      { assetTag: 'SMIT-PRN-000001' },
      {
        name: 'HP LaserJet Pro M404dn High-Speed Network Printer',
        organization: 'Saylani Welfare Trust',
        assetTag: 'SMIT-PRN-000001',
        qrToken: generateOpaqueQRToken(),
        categoryId: catPrinter._id,
        brand: 'HP',
        modelNumber: 'LaserJet Pro M404dn',
        serialNumber: 'VNB3B09123',
        status: AssetStatus.AVAILABLE,
        condition: AssetCondition.GOOD,
        location: { campusId: mainCampus._id },
        specs: {
          network_ready: true,
          ppm: 40,
          ip_address: '192.168.10.25',
        },
        createdBy: superAdmin._id,
      },
      { upsert: true, new: true }
    );

    console.log('✓ Assets initialized (8 items across Laptops, Switches, Lab Workstation, AC, Printer)');

    // =========================================================================
    // 5. AUDIT TIMELINE (AssetHistory)
    // =========================================================================
    await AssetHistory.deleteMany({ assetId: { $in: [asset1._id, asset2._id, asset3._id] } });

    await AssetHistory.create([
      {
        assetId: asset1._id,
        action: AssetHistoryAction.CREATED,
        performedBy: superAdmin._id,
        performedByName: superAdmin.name,
        newValues: { status: AssetStatus.AVAILABLE, campusId: mainCampus._id },
        remarks: 'Asset received from central procurement and tagged.',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30),
      },
      {
        assetId: asset1._id,
        action: AssetHistoryAction.ASSIGNED,
        performedBy: campusManager._id,
        performedByName: campusManager.name,
        newValues: { status: AssetStatus.ASSIGNED, userId: employee1._id },
        remarks: 'Checked out to Bilal Ahmed for mobile application development classes.',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 15),
      },
      {
        assetId: asset3._id,
        action: AssetHistoryAction.CREATED,
        performedBy: superAdmin._id,
        performedByName: superAdmin.name,
        newValues: { status: AssetStatus.AVAILABLE },
        remarks: 'Registered into master catalog.',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 60),
      },
      {
        assetId: asset3._id,
        action: AssetHistoryAction.STATUS_CHANGED,
        performedBy: technician._id,
        performedByName: technician.name,
        previousValues: { status: AssetStatus.AVAILABLE },
        newValues: { status: AssetStatus.AVAILABLE },
        remarks: 'Routine campus inventory audit and physical verification completed.',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2),
      },
    ]);

    console.log('✓ Audit history ledger entries populated.');

    // =========================================================================
    // 6. INTER-BRANCH TRANSFERS
    // =========================================================================
    await AssetTransfer.deleteMany({});

    await AssetTransfer.create([
      {
        transferNumber: 'SMIT-TRF-000001',
        assetId: asset2._id,
        fromCampusId: mainCampus._id,
        toCampusId: gulshanCampus._id,
        status: TransferStatus.PENDING,
        reason: 'Relocating laptop for newly inducted instructor at Gulshan branch',
        requestedBy: campusManager._id,
        requestedAt: new Date(Date.now() - 1000 * 60 * 60 * 12),
      },
      {
        transferNumber: 'SMIT-TRF-000002',
        assetId: asset5._id,
        fromCampusId: gulshanCampus._id,
        toCampusId: mainCampus._id,
        status: TransferStatus.DISPATCHED,
        reason: 'Temporary deployment for annual hackathon core network distribution',
        requestedBy: superAdmin._id,
        requestedAt: new Date(Date.now() - 1000 * 60 * 60 * 48),
        approvedBy: superAdmin._id,
        approvedAt: new Date(Date.now() - 1000 * 60 * 60 * 24),
        dispatchedBy: campusManager._id,
        dispatchedAt: new Date(Date.now() - 1000 * 60 * 60 * 4),
        dispatchNotes: 'Dispatched via SMIT Internal Van driver (Akram Khan, Van # LEB-4819)',
      },
    ]);

    console.log('✓ Inter-branch transfers seeded (1 Pending Approval, 1 In-Transit Dispatched)');

    // =========================================================================
    // 7. IT HELPDESK TICKETS & SLA
    // =========================================================================
    await Ticket.deleteMany({});

    await Ticket.create([
      {
        ticketNumber: 'SMIT-IT-2026-000001',
        requester: employee1._id,
        campusId: mainCampus._id,
        category: TicketCategory.NETWORK,
        priority: TicketPriority.P1_CRITICAL,
        status: TicketStatus.IN_PROGRESS,
        assignedTechnicianId: technician._id,
        linkedAssetId: asset4._id,
        subject: 'Main Lab 1 Core Switch Dropping Packets & Overheating',
        description: 'During morning React Native practical exam, 24 students lost connectivity to the local dev server. Switch fans are making loud noise and amber LEDs are flashing.',
        firstResponseDeadline: new Date(Date.now() - 1000 * 60 * 30),
        firstRespondedAt: new Date(Date.now() - 1000 * 60 * 45),
        targetResolutionDeadline: new Date(Date.now() + 1000 * 60 * 60 * 2), // 2 hours from now
        isSlaBreached: false,
        comments: [
          {
            sender: employee1._id,
            senderName: employee1.name,
            senderRole: 'EMPLOYEE',
            message: 'Classroom students are currently waiting. Please check urgently.',
            isInternal: false,
            createdAt: new Date(Date.now() - 1000 * 60 * 50),
          },
          {
            sender: technician._id,
            senderName: technician.name,
            senderRole: 'CAMPUS_IT_TECHNICIAN',
            message: 'On-site in Server Room PECHS. Checked console log: Fan tray #2 failure. Bypassing load to redundant backup switch WS-C2960.',
            isInternal: false,
            createdAt: new Date(Date.now() - 1000 * 60 * 35),
          },
          {
            sender: technician._id,
            senderName: technician.name,
            senderRole: 'CAMPUS_IT_TECHNICIAN',
            message: '[DIAGNOSTIC] Power supply #1 capacitor showing slight bulge. Ordered replacement fan module from local vendor. Estimated repair completion 16:30.',
            isInternal: true,
            createdAt: new Date(Date.now() - 1000 * 60 * 30),
          },
        ],
      },
      {
        ticketNumber: 'SMIT-IT-2026-000002',
        requester: employee1._id,
        campusId: mainCampus._id,
        category: TicketCategory.HARDWARE,
        priority: TicketPriority.P2_HIGH,
        status: TicketStatus.OPEN,
        linkedAssetId: asset1._id,
        subject: 'Dell Latitude Battery Draining within 20 Minutes',
        description: 'My assigned work laptop shuts down immediately without AC charger connected. Battery health report shows 38% degraded capacity.',
        firstResponseDeadline: new Date(Date.now() + 1000 * 60 * 60 * 1), // 1 hour remaining
        targetResolutionDeadline: new Date(Date.now() + 1000 * 60 * 60 * 8), // 8 hours remaining
        isSlaBreached: false,
        comments: [],
      },
      {
        ticketNumber: 'SMIT-IT-2026-000003',
        requester: employee2._id,
        campusId: gulshanCampus._id,
        category: TicketCategory.SOFTWARE,
        priority: TicketPriority.P3_MEDIUM,
        status: TicketStatus.ASSIGNED,
        assignedTechnicianId: technician._id,
        linkedAssetId: asset3._id,
        subject: 'Docker Desktop Hyper-V Virtualization Conflict on Lab Windows 11',
        description: 'Students in the Gulshan AI cohort cannot launch Docker containers due to WSL2 kernel update error.',
        firstResponseDeadline: new Date(Date.now() - 1000 * 60 * 60 * 3),
        firstRespondedAt: new Date(Date.now() - 1000 * 60 * 60 * 2),
        targetResolutionDeadline: new Date(Date.now() + 1000 * 60 * 60 * 20),
        isSlaBreached: false,
        comments: [
          {
            sender: technician._id,
            senderName: technician.name,
            senderRole: 'CAMPUS_IT_TECHNICIAN',
            message: 'Pushed PowerShell script via Active Directory GPO to install the latest wsl_update64.msi across all lab nodes.',
            isInternal: false,
            createdAt: new Date(Date.now() - 1000 * 60 * 60 * 1),
          },
        ],
      },
      {
        ticketNumber: 'SMIT-IT-2026-000004',
        requester: employee2._id,
        campusId: mainCampus._id,
        category: TicketCategory.PRINTER,
        priority: TicketPriority.P4_LOW,
        status: TicketStatus.RESOLVED,
        assignedTechnicianId: technician._id,
        linkedAssetId: asset8._id,
        subject: 'Black Toner Low on Admin Office Network Printer',
        description: 'Printer LCD panel warning: Replace Toner Cartridge HP 58A.',
        firstResponseDeadline: new Date(Date.now() - 1000 * 60 * 60 * 48),
        firstRespondedAt: new Date(Date.now() - 1000 * 60 * 60 * 47),
        targetResolutionDeadline: new Date(Date.now() - 1000 * 60 * 60 * 24),
        isSlaBreached: false,
        resolutionNotes: 'Replaced with brand new genuine HP 58X high-yield black toner cartridge. Print test page OK.',
        resolvedAt: new Date(Date.now() - 1000 * 60 * 60 * 12),
        resolvedBy: technician._id,
        comments: [],
      },
    ]);

    console.log('✓ IT Helpdesk tickets seeded (4 tickets: P1 Critical In-Progress, P2 High Open, P3 Medium Assigned, P4 Low Resolved)');

    console.log('\n============================================================');
    console.log('✨ DEMO DATA READY FOR FRONTEND TESTING:');
    console.log('============================================================');
    console.log('Accounts:');
    console.log('  1. Super Admin   : superadmin@smit.edu.pk / AdminSecret2026!  (All Campuses, All Controls)');
    console.log('  2. Campus Manager: ali.khan@smit.edu.pk   / Password123!      (Gulshan & Main Scope)');
    console.log('  3. IT Technician : usman.tech@smit.edu.pk / Password123!      (Main & Gulshan Tech Queue)');
    console.log('  4. Faculty Staff : bilal.ahmed@smit.edu.pk/ Password123!      (Assigned Laptop & Tickets)');
    console.log('\nModules Populated:');
    console.log('  - Assets Catalog  : 8 assets (Laptops, Cisco Switches, Lab Desktops, ACs, Printers)');
    console.log('  - Custody Module  : 1 Active Staff Checkout (Bilal Ahmed), Available Stock');
    console.log('  - Transfers Module: 1 Pending Request (Main -> Gulshan), 1 In-Transit Dispatched');
    console.log('  - IT Helpdesk     : 4 Tickets (P1 Critical with diagnostic thread, P2 High, P3, P4)');
    console.log('============================================================\n');

  } catch (err) {
    console.error('❌ Seeding failed:', err);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
}

seedData();

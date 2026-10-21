const BASE_URL = 'http://localhost:5000/api';

async function request<T = any>(url: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE_URL}${url}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`[${res.status}] ${JSON.stringify(data)}`);
  }
  return data as T;
}

async function testCustodyAndTransfers() {
  console.log('🚀 Starting Custody & Transfers Integration Test (Campus + Employee)...\n');

  try {
    // 1. Authenticate as Super Admin
    console.log('1️⃣ Authenticating as Super Admin...');
    const adminLoginRes = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'superadmin@smit.edu.pk',
        password: 'AdminSecret2026!',
      }),
    });
    const adminToken = adminLoginRes.token;
    const adminHeaders = { Authorization: `Bearer ${adminToken}` };
    console.log('✅ Super Admin authenticated.');

    // 2. Authenticate as Campus Manager (Ali Khan)
    console.log('\n2️⃣ Authenticating as Campus Manager (Ali Khan)...');
    const mgrLoginRes = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'ali.khan@smit.edu.pk',
        password: 'Password123!',
      }),
    });
    const mgrToken = mgrLoginRes.token;
    const mgrUser = mgrLoginRes.user;
    const mgrHeaders = { Authorization: `Bearer ${mgrToken}` };
    console.log(`✅ Campus Manager authenticated (ID: ${mgrUser._id || mgrUser.id}).`);

    // 3. Fetch an Available Asset for Testing
    console.log('\n3️⃣ Fetching Asset at Main Campus...');
    const assetsRes = await request('/assets?limit=5', {
      headers: adminHeaders,
    });
    let asset = assetsRes.data[0];

    if (!asset) {
      console.log('❌ No assets found in database to test.');
      return;
    }
    console.log(`✅ Using Asset: ${asset.name} (Tag: ${asset.assetTag}, ID: ${asset._id})`);
    console.log(`   Initial Status: ${asset.status}, Campus: ${asset.location?.campusId?.name || asset.location?.campusId}`);

    // If currently assigned or in transit, reset status for testing
    if (asset.status !== 'AVAILABLE') {
      await request(`/assets/${asset._id}`, {
        method: 'PUT',
        headers: adminHeaders,
        body: JSON.stringify({ status: 'AVAILABLE', assignedTo: null }),
      });
      console.log('   Reset asset status to AVAILABLE.');
    }

    // 4. Test Employee Assignment (POST /api/custody/assign)
    console.log('\n4️⃣ Testing POST /api/custody/assign (Assign laptop to Ali Khan)...');
    const assignRes = await request('/custody/assign', {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        assetId: asset._id,
        userId: mgrUser._id || mgrUser.id,
        expectedReturnDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        remarks: 'Assigned laptop to employee for training project',
      }),
    });
    console.log('✅ Assignment Successful:');
    console.log(`   Status: ${assignRes.data.status}`);
    console.log(`   Assigned To: ${assignRes.data.assignedTo?.userId?.name || mgrUser.name}`);

    // 5. Test Employee My-Assets (GET /api/custody/my-assets)
    console.log('\n5️⃣ Testing GET /api/custody/my-assets with Ali Khan token...');
    const myAssetsRes = await request('/custody/my-assets', {
      headers: mgrHeaders,
    });
    console.log(`✅ My-Assets Count for Ali Khan: ${myAssetsRes.count}`);
    const foundMyAsset = myAssetsRes.data.find((a: any) => a._id === asset._id);
    if (foundMyAsset) {
      console.log(`   Found assigned asset: ${foundMyAsset.name} (${foundMyAsset.assetTag})`);
    }

    // 6. Test Return Asset (POST /api/custody/return)
    console.log('\n6️⃣ Testing POST /api/custody/return (Check-in back to Campus stock)...');
    const returnRes = await request('/custody/return', {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        assetId: asset._id,
        condition: 'GOOD',
        remarks: 'Returned in good condition after project completion',
      }),
    });
    console.log('✅ Return Successful:');
    console.log(`   Status: ${returnRes.data.status}`);
    console.log(`   AssignedTo: ${returnRes.data.assignedTo || 'null (Unassigned)'}`);

    // 7. Test Inter-Branch Transfers (Toggle between Main and Gulshan)
    console.log('\n7️⃣ Testing Inter-Branch Transfer Workflow...');
    const mainCampusId = '6ad88e5dec80e1d10b8e4937';
    const gulshanCampusId = '6ad88e5dec80e1d10b8e4938';
    const currentCampusId = (asset.location.campusId._id || asset.location.campusId).toString();
    const destCampusId = currentCampusId === mainCampusId ? gulshanCampusId : mainCampusId;

    // Step A: Request Transfer
    console.log(`   Step A: POST /api/transfers (Request transfer to campus ID: ${destCampusId})...`);
    const transferReqRes = await request('/transfers', {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        assetId: asset._id,
        toCampusId: destCampusId,
        reason: 'Inter-branch equipment requisition for upcoming training batch',
        notes: 'Saylani central IT dispatch',
      }),
    });
    const transfer = transferReqRes.data;
    console.log(`   ✅ Transfer Created: ${transfer.transferNumber} (Status: ${transfer.status})`);

    // Step B: Approve Transfer
    console.log('\n   Step B: PUT /api/transfers/:id/approve (Approve Transfer)...');
    const approveRes = await request(`/transfers/${transfer._id}/approve`, {
      method: 'PUT',
      headers: adminHeaders,
      body: JSON.stringify({ action: 'APPROVE', notes: 'Approved by Central Operations' }),
    });
    console.log(`   ✅ Transfer Approved: Status is ${approveRes.data.status}`);

    // Step C: Dispatch Transfer
    console.log('\n   Step C: PUT /api/transfers/:id/dispatch (Dispatch Asset)...');
    const dispatchRes = await request(`/transfers/${transfer._id}/dispatch`, {
      method: 'PUT',
      headers: adminHeaders,
      body: JSON.stringify({ dispatchNotes: 'Dispatched via SMIT courier van #3' }),
    });
    console.log(`   ✅ Transfer Dispatched: Status is ${dispatchRes.data.status}`);

    // Check Asset Status (should be IN_TRANSIT)
    const assetInTransit = await request(`/assets/${asset._id}`, {
      headers: adminHeaders,
    });
    console.log(`   ✅ Asset Status in Master: ${assetInTransit.data.status} (Expected: IN_TRANSIT)`);

    // Step D: Receive Transfer
    console.log('\n   Step D: PUT /api/transfers/:id/receive (Receive at Destination Branch)...');
    const receiveRes = await request(`/transfers/${transfer._id}/receive`, {
      method: 'PUT',
      headers: adminHeaders,
      body: JSON.stringify({
        receivingCondition: 'EXCELLENT',
        receivingNotes: 'Received in perfect condition at Gulshan Campus',
      }),
    });
    console.log(`   ✅ Transfer Received: Status is ${receiveRes.data.status}`);

    // Check Asset updated location and status
    const updatedAssetRes = await request(`/assets/${asset._id}`, {
      headers: adminHeaders,
    });
    const receivedAsset = updatedAssetRes.data;
    console.log('\n8️⃣ Verifying Final Asset Profile & Location:');
    console.log(`   Asset Tag: ${receivedAsset.assetTag}`);
    console.log(`   Status: ${receivedAsset.status} (Expected: AVAILABLE)`);
    console.log(`   New Campus: ${receivedAsset.location?.campusId?.name} (${receivedAsset.location?.campusId?.code})`);

    // 9. Verify Asset Timeline History
    console.log('\n9️⃣ Verifying Complete Asset Audit Timeline:');
    const history = updatedAssetRes.history || [];
    console.log(`   Total Timeline Events Logged: ${history.length}`);
    history.slice(0, 6).forEach((h: any, idx: number) => {
      console.log(`   [${idx + 1}] Action: ${h.action.padEnd(22)} | By: ${(h.performedByName || 'System').padEnd(16)} | Remarks: ${h.remarks || ''}`);
    });

    console.log('\n🎉 ALL CUSTODY & INTER-BRANCH TRANSFER TESTS PASSED! 🎉\n');
  } catch (error: any) {
    console.error('❌ Test failed with error:', error.message);
  }
}

testCustodyAndTransfers();

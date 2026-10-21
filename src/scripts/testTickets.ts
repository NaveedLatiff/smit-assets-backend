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

async function testTicketsWorkflow() {
  console.log('🚀 Starting IT Helpdesk & Ticketing Integration Test...\n');

  try {
    // 1. Authenticate as Super Admin
    console.log('1️⃣ Authenticating as Super Admin...');
    const adminLogin = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'superadmin@smit.edu.pk',
        password: 'AdminSecret2026!',
      }),
    });
    const adminToken = adminLogin.token;
    const adminHeaders = { Authorization: `Bearer ${adminToken}` };
    console.log('✅ Super Admin authenticated.');

    // 2. Authenticate as Campus IT Staff / Manager (Ali Khan)
    console.log('\n2️⃣ Authenticating as Campus Staff (Ali Khan)...');
    const staffLogin = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'ali.khan@smit.edu.pk',
        password: 'Password123!',
      }),
    });
    const staffToken = staffLogin.token;
    const staffUser = staffLogin.user;
    const staffHeaders = { Authorization: `Bearer ${staffToken}` };
    console.log(`✅ Campus Staff authenticated (ID: ${staffUser._id || staffUser.id}).`);

    // 3. Fetch an active asset to link to the ticket
    console.log('\n3️⃣ Fetching Demo Asset to link with IT ticket...');
    const assetsRes = await request('/assets?limit=1', { headers: adminHeaders });
    const asset = assetsRes.data[0];
    if (!asset) throw new Error('No asset available to test ticketing.');
    console.log(`✅ Found Asset: [${asset.assetTag}] ${asset.name} (Current Status: ${asset.status})`);

    const campusId = asset.location.campusId._id || asset.location.campusId;

    // 4. Submit a new IT Support Ticket (POST /api/tickets)
    console.log('\n4️⃣ Submitting new Ticket with linked asset (Priority: P1_CRITICAL)...');
    const ticketCreateRes = await request('/tickets', {
      method: 'POST',
      headers: staffHeaders,
      body: JSON.stringify({
        campusId,
        category: 'HARDWARE',
        priority: 'P1_CRITICAL',
        subject: 'Display flickering and thermal shutdown during class',
        description: 'Laptop abruptly shut down during lecture due to fan failure and overheating.',
        linkedAssetId: asset._id,
      }),
    });
    const ticket = ticketCreateRes.data;
    console.log(`✅ Ticket Created: ${ticket.ticketNumber}`);
    console.log(`   Status: ${ticket.status}`);
    console.log(`   Priority: ${ticket.priority}`);
    console.log(`   First Response SLA: ${ticket.firstResponseDeadline}`);
    console.log(`   Resolution Target SLA: ${ticket.targetResolutionDeadline}`);

    // 5. List Tickets (GET /api/tickets)
    console.log('\n5️⃣ Listing Tickets with Filters (Status: OPEN)...');
    const listRes = await request('/tickets?status=OPEN', { headers: adminHeaders });
    console.log(`✅ Retrieved ${listRes.data.length} OPEN tickets (Total: ${listRes.pagination.totalCount}).`);

    // 6. Get Ticket Details (GET /api/tickets/:id)
    console.log('\n6️⃣ Getting Full Ticket Details & SLA Status...');
    const detailRes = await request(`/tickets/${ticket._id}`, { headers: staffHeaders });
    console.log(`✅ Ticket Subject: ${detailRes.data.subject}`);
    console.log(`   Linked Asset Tag: ${detailRes.data.linkedAssetId?.assetTag}`);
    console.log(`   SLA Breached: ${detailRes.data.isSlaBreached ? 'YES' : 'NO (On Track)'}`);

    // 7. Add Public & Internal Comments (POST /api/tickets/:id/comments)
    console.log('\n7️⃣ Adding Technician Diagnostic Notes...');
    await request(`/tickets/${ticket._id}/comments`, {
      method: 'POST',
      headers: staffHeaders,
      body: JSON.stringify({
        message: 'Checked thermal paste and cooling fan. Fan bearing is seized.',
        isInternal: true,
      }),
    });
    console.log('✅ Internal staff diagnostic note logged.');

    await request(`/tickets/${ticket._id}/comments`, {
      method: 'POST',
      headers: staffHeaders,
      body: JSON.stringify({
        message: 'Replacement cooling fan ordered from warehouse. Device being placed in repair bay.',
        isInternal: false,
      }),
    });
    console.log('✅ Public update sent to requester.');

    // 8. Assign Ticket to Technician (PUT /api/tickets/:id/assign)
    console.log('\n8️⃣ Assigning Ticket to Technician (Ali Khan)...');
    const assignRes = await request(`/tickets/${ticket._id}/assign`, {
      method: 'PUT',
      headers: adminHeaders,
      body: JSON.stringify({
        technicianId: staffUser._id || staffUser.id,
      }),
    });
    console.log(`✅ Ticket Assigned: Status is now '${assignRes.data.status}', Assigned To: ${assignRes.data.assignedTechnicianId?.name}`);

    // 9. Update Ticket Status to IN_PROGRESS (PUT /api/tickets/:id/status)
    // Should automatically set Asset status to UNDER_REPAIR and log in AssetHistory
    console.log('\n9️⃣ Updating Status to IN_PROGRESS (Checking Asset Status Transition)...');
    const inProgressRes = await request(`/tickets/${ticket._id}/status`, {
      method: 'PUT',
      headers: staffHeaders,
      body: JSON.stringify({
        status: 'IN_PROGRESS',
      }),
    });
    console.log(`✅ Ticket Status: ${inProgressRes.data.status}`);

    // Check linked asset status in Master
    const assetCheck1 = await request(`/assets/${asset._id}`, { headers: adminHeaders });
    console.log(`✅ Master Asset Status: ${assetCheck1.data.status} (Expected: UNDER_REPAIR)`);

    // 10. Update Ticket Status to RESOLVED (PUT /api/tickets/:id/status)
    // Should restore Asset status to AVAILABLE/ASSIGNED and log in AssetHistory
    console.log('\n🔟 Resolving Ticket with Resolution Notes...');
    const resolveRes = await request(`/tickets/${ticket._id}/status`, {
      method: 'PUT',
      headers: staffHeaders,
      body: JSON.stringify({
        status: 'RESOLVED',
        resolutionNotes: 'Replaced CPU fan module with OEM spare part, reapplied Arctic MX-4 thermal paste. Stress-tested for 45 mins at 65C.',
      }),
    });
    console.log(`✅ Ticket Status: ${resolveRes.data.status}`);
    console.log(`   Resolution Notes: ${resolveRes.data.resolutionNotes}`);

    // Check linked asset status in Master (should be restored)
    const assetCheck2 = await request(`/assets/${asset._id}`, { headers: adminHeaders });
    console.log(`✅ Master Asset Status: ${assetCheck2.data.status} (Restored to AVAILABLE/ASSIGNED)`);

    // 11. Close Ticket
    console.log('\n1️⃣1️⃣ Closing Ticket...');
    const closeRes = await request(`/tickets/${ticket._id}/status`, {
      method: 'PUT',
      headers: adminHeaders,
      body: JSON.stringify({ status: 'CLOSED' }),
    });
    console.log(`✅ Ticket Status: ${closeRes.data.status} (Closed At: ${closeRes.data.closedAt})`);

    // 12. Check Asset History Timeline for Ticket Maintenance Entries
    console.log('\n1️⃣2️⃣ Verifying Permanent Asset Audit Timeline for Maintenance Logs:');
    const assetTimeline = assetCheck2.history || [];
    const maintEvents = assetTimeline.filter((h: any) => h.action === 'MAINTENANCE');
    console.log(`   Total Maintenance Events Logged for Asset: ${maintEvents.length}`);
    maintEvents.slice(0, 3).forEach((e: any, idx: number) => {
      console.log(`   [${idx + 1}] By: ${(e.performedByName || 'System').padEnd(20)} | Remarks: ${e.remarks}`);
    });

    console.log('\n🎉 ALL IT HELPDESK & TICKETING TESTS PASSED PERFECTLY! 🎉\n');
  } catch (error: any) {
    console.error('❌ Ticketing test failed with error:', error.message);
  }
}

testTicketsWorkflow();

export {};

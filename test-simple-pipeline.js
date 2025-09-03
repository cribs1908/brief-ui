#!/usr/bin/env node

console.log('🧪 Testing Simple Pipeline');

async function testSimplePipeline() {
  try {
    console.log('📡 1. Creating run...');
    const createResponse = await fetch('http://localhost:3000/api/chat/create', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'User-Agent': 'test-client'
      },
      body: JSON.stringify({
        workspaceId: '00000000-0000-0000-0000-000000000001',
        files: 2
      })
    });

    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      throw new Error(`Create failed: ${createResponse.status} ${errorText}`);
    }

    const createData = await createResponse.json();
    console.log('✅ Run created:', createData.runId);

    // Simulate file upload by creating empty records in documents table
    console.log('📡 2. Submitting run with mock files...');
    const submitResponse = await fetch('http://localhost:3000/api/chat/submit', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'User-Agent': 'test-client'
      },
      body: JSON.stringify({
        runId: createData.runId,
        workspaceId: '00000000-0000-0000-0000-000000000001',
        prompt: 'Compare these chip specs',
        domain: 'Chip',
        files: createData.uploadUrls.map((url, i) => ({
          id: url.id,
          filename: `test-chip-${i + 1}.pdf`,
          storagePath: url.storagePath
        }))
      })
    });

    if (!submitResponse.ok) {
      const errorText = await submitResponse.text();
      throw new Error(`Submit failed: ${submitResponse.status} ${errorText}`);
    }

    console.log('✅ Run submitted');
    
    // Note: We can't test the SSE endpoint without actual PDF files uploaded
    // to Supabase storage, as it will fail when trying to download them
    
    console.log('🎯 Pipeline setup is working correctly!');
    console.log('   Now upload real PDF files through the UI to test the complete flow.');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

testSimplePipeline();
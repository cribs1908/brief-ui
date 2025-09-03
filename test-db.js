#!/usr/bin/env node

console.log('🔍 Testing Brief AI Database Setup');

async function testDatabase() {
  try {
    // Test workspace creation
    console.log('📡 Testing workspace creation...');
    
    const createResponse = await fetch('http://localhost:3000/api/chat/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workspaceId: '00000000-0000-0000-0000-000000000001',
        files: 1
      })
    });
    
    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      throw new Error(`Create failed: ${createResponse.status} ${errorText}`);
    }
    
    const createData = await createResponse.json();
    console.log('✅ Run created successfully:', createData.runId);
    
    // Test run submission (without actual files)
    console.log('📡 Testing run submission...');
    
    const submitResponse = await fetch('http://localhost:3000/api/chat/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        runId: createData.runId,
        workspaceId: '00000000-0000-0000-0000-000000000001',
        prompt: 'Test prompt',
        domain: 'Chip',
        files: createData.uploadUrls.map(url => ({
          id: url.id,
          filename: 'test.pdf',
          storagePath: url.storagePath
        }))
      })
    });
    
    if (!submitResponse.ok) {
      const errorText = await submitResponse.text();
      throw new Error(`Submit failed: ${submitResponse.status} ${errorText}`);
    }
    
    const submitData = await submitResponse.json();
    console.log('✅ Run submitted successfully:', submitData);
    
    console.log('🎉 Database setup is working correctly!');
    console.log('\nNext: Try uploading real PDFs through the UI');
    
  } catch (error) {
    console.error('❌ Database test failed:', error.message);
    console.log('\n🔧 To fix this:');
    console.log('1. Run the create-demo-workspace.sql in Supabase SQL Editor');
    console.log('2. Verify environment variables are set correctly');
    console.log('3. Check Supabase connection');
    process.exit(1);
  }
}

testDatabase();
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Generate proper UUID
function generateUUID() {
  return crypto.randomUUID();
}

async function testWorkerJob() {
  console.log('🧪 Testing worker job processing...');
  
  try {
    // Check if worker is running
    console.log('🔍 Checking worker health...');
    const healthResponse = await axios.get('http://localhost:3005/health');
    console.log('✅ Worker health:', healthResponse.data);
    
    // Create a fake job payload with proper UUIDs
    const fakeJob = {
      runId: generateUUID(),
      prompt: 'Test comparison of chip specifications',
      domain: 'CHIP',
      files: [
        {
          id: generateUUID(),
          filename: 'test-chip1.pdf',
          storage_path: 'fake/path/test-chip1.pdf'
        },
        {
          id: generateUUID(), 
          filename: 'test-chip2.pdf',
          storage_path: 'fake/path/test-chip2.pdf'
        }
      ]
    };
    
    console.log('📋 Sending test job to worker...');
    console.log('Job payload:', JSON.stringify(fakeJob, null, 2));
    
    // Send job to worker
    const jobResponse = await axios.post('http://localhost:3005/jobs/compare', fakeJob, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Worker accepted job:', jobResponse.data);
    console.log('🏁 Test completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

// Run test
testWorkerJob();
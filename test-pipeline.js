#!/usr/bin/env node

<<<<<<< HEAD
/**
 * Test rapido della pipeline completa
 */

require('dotenv').config({ path: '.env.local' });

async function testPipeline() {
    console.log('🧪 Testing complete pipeline...\n');
    
    const baseUrl = 'http://localhost:3000';
    
    try {
        // Test create run
        console.log('1️⃣ Testing /api/chat/create...');
        const createRes = await fetch(`${baseUrl}/api/chat/create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ workspaceId: 'ws-demo', files: 2 })
        });
        
        if (!createRes.ok) {
            throw new Error(`Create failed: ${createRes.status}`);
        }
        
        const createData = await createRes.json();
        console.log(`✅ Run created: ${createData.runId}`);
        
        // Test submit (simulated)
        console.log('\n2️⃣ Testing /api/chat/submit...');
        const submitRes = await fetch(`${baseUrl}/api/chat/submit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                runId: createData.runId,
                workspaceId: 'ws-demo',
                prompt: 'Compare these two microcontroller datasheets',
                domain: 'Chip',
                files: [
                    { id: createData.uploadUrls[0].id, storagePath: createData.uploadUrls[0].storagePath, filename: 'chip1.pdf' },
                    { id: createData.uploadUrls[1].id, storagePath: createData.uploadUrls[1].storagePath, filename: 'chip2.pdf' }
                ],
                useOcr: true
            })
        });
        
        if (!submitRes.ok) {
            throw new Error(`Submit failed: ${submitRes.status}`);
        }
        
        console.log('✅ Submit successful');
        
        // Test events stream
        console.log('\n3️⃣ Testing /api/chat/events...');
        const eventsUrl = `${baseUrl}/api/chat/events?runId=${createData.runId}`;
        
        const eventSource = new EventSource(eventsUrl);
        let eventCount = 0;
        let finalResult = null;
        
        const timeout = setTimeout(() => {
            eventSource.close();
            console.log('⏰ Events test timeout (30s)');
        }, 30000);
        
        eventSource.onmessage = (event) => {
            const data = JSON.parse(event.data);
            eventCount++;
            
            console.log(`📡 Event ${eventCount}: ${data.type} - ${data.status || data.message || 'heartbeat'}`);
            
            if (data.type === 'finalResult') {
                finalResult = data;
                clearTimeout(timeout);
                eventSource.close();
                
                console.log('\n✅ Pipeline completed successfully!');
                console.log('🎯 Ready to test with real PDFs!');
            } else if (data.type === 'error') {
                console.error('❌ Pipeline error:', data.error);
                clearTimeout(timeout);
                eventSource.close();
            }
        };
        
        eventSource.onerror = (error) => {
            console.error('❌ EventSource error:', error);
            clearTimeout(timeout);
            eventSource.close();
        };
        
    } catch (error) {
        console.error('❌ Pipeline test failed:', error.message);
    }
}

// Use a polyfill for EventSource in Node.js
if (typeof EventSource === 'undefined') {
    global.EventSource = require('eventsource');
}

testPipeline();
=======
const fs = require('fs');
const path = require('path');

console.log('🧪 Brief AI Pipeline Test');

// Test configuration
const TEST_CONFIG = {
  baseUrl: 'http://localhost:3000',
  workspaceId: '00000000-0000-0000-0000-000000000001',
  testFiles: [
    // We'll create these files with mock PDF content
    { name: 'chip1.pdf', content: 'Mock PDF content for chip 1' },
    { name: 'chip2.pdf', content: 'Mock PDF content for chip 2' }
  ]
};

async function testPipeline() {
  try {
    console.log('📡 Testing API endpoints...');
    
    // 1. Test health endpoints
    console.log('1. Testing services health...');
    
    // Test Tabula
    try {
      const tabulaResponse = await fetch('http://localhost:3004/health');
      const tabulaData = await tabulaResponse.json();
      console.log('✅ Tabula service healthy:', tabulaData.status);
    } catch (e) {
      console.log('❌ Tabula service failed:', e.message);
    }
    
    // Test OCR service
    try {
      const ocrResponse = await fetch('http://localhost:3002/health');
      const ocrData = await ocrResponse.json();
      console.log('✅ OCR service healthy:', ocrData.status);
    } catch (e) {
      console.log('❌ OCR service failed:', e.message);
    }
    
    // 2. Test create run
    console.log('\n2. Creating run...');
    const createResponse = await fetch(`${TEST_CONFIG.baseUrl}/api/chat/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workspaceId: TEST_CONFIG.workspaceId,
        files: TEST_CONFIG.testFiles.map(f => ({ filename: f.name }))
      })
    });
    
    if (!createResponse.ok) {
      throw new Error(`Create failed: ${createResponse.status} ${await createResponse.text()}`);
    }
    
    const createData = await createResponse.json();
    console.log('✅ Run created:', createData.runId);
    
    // 3. Upload mock files (skip actual file upload for this test)
    console.log('\n3. Skipping file upload (would upload to signed URLs)');
    
    // 4. Submit run
    console.log('\n4. Submitting run...');
    const submitResponse = await fetch(`${TEST_CONFIG.baseUrl}/api/chat/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        runId: createData.runId,
        workspaceId: TEST_CONFIG.workspaceId,
        prompt: 'Compare these two chips',
        domain: 'Chip',
        files: createData.uploadUrls.map(url => ({
          id: url.id,
          filename: TEST_CONFIG.testFiles.find(f => url.storagePath.includes(f.name))?.name,
          storagePath: url.storagePath
        }))
      })
    });
    
    if (!submitResponse.ok) {
      throw new Error(`Submit failed: ${submitResponse.status} ${await submitResponse.text()}`);
    }
    
    const submitData = await submitResponse.json();
    console.log('✅ Run submitted:', submitData);
    
    // 5. Monitor SSE events (simplified test)
    console.log('\n5. Testing SSE endpoint...');
    console.log(`Would monitor: ${TEST_CONFIG.baseUrl}/api/chat/events?runId=${createData.runId}`);
    console.log('Note: SSE testing requires actual file upload and processing');
    
    console.log('\n🎉 Pipeline endpoints are functional!');
    console.log('\nNext steps:');
    console.log('1. Upload actual PDF files through the UI');
    console.log('2. Monitor processing via browser console');
    console.log('3. Verify table generation works correctly');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

testPipeline();
>>>>>>> 4e740de (Initial commit: Brief AI complete system with enhanced CHIP extraction)

#!/usr/bin/env node

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

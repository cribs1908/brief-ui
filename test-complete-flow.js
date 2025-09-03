#!/usr/bin/env node

const fs = require('fs');

async function testCompleteFlow() {
    console.log('🧪 Testing Complete Brief AI Flow');
    
    try {
        // Step 1: Create run
        console.log('\n1️⃣ Creating run...');
        const createResponse = await fetch('http://localhost:3000/api/chat/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                workspaceId: '00000000-0000-0000-0000-000000000001', 
                files: 2 
            })
        });
        
        if (!createResponse.ok) {
            throw new Error(`Create failed: ${createResponse.status} ${createResponse.statusText}`);
        }
        
        const createData = await createResponse.json();
        console.log(`✅ Run created: ${createData.runId}`);
        
        // Step 2: Upload PDFs
        console.log('\n2️⃣ Uploading test PDFs...');
        const uploadedFiles = [];
        
        // Upload first PDF
        const pdf1Data = fs.readFileSync('./test-chip1.pdf');
        const upload1Response = await fetch(createData.uploadUrls[0].signedUrl, {
            method: 'PUT',
            body: pdf1Data,
            headers: { 'Content-Type': 'application/pdf' }
        });
        
        if (!upload1Response.ok) {
            throw new Error(`Upload 1 failed: ${upload1Response.status}`);
        }
        console.log('✅ PDF 1 uploaded');
        
        uploadedFiles.push({
            id: createData.uploadUrls[0].id,
            filename: 'test-chip1.pdf',
            storagePath: createData.uploadUrls[0].storagePath
        });
        
        // Upload second PDF
        const pdf2Data = fs.readFileSync('./test-chip2.pdf');
        const upload2Response = await fetch(createData.uploadUrls[1].signedUrl, {
            method: 'PUT',
            body: pdf2Data,
            headers: { 'Content-Type': 'application/pdf' }
        });
        
        if (!upload2Response.ok) {
            throw new Error(`Upload 2 failed: ${upload2Response.status}`);
        }
        console.log('✅ PDF 2 uploaded');
        
        uploadedFiles.push({
            id: createData.uploadUrls[1].id,
            filename: 'test-chip2.pdf', 
            storagePath: createData.uploadUrls[1].storagePath
        });
        
        // Step 3: Submit for processing
        console.log('\n3️⃣ Submitting for processing...');
        const submitResponse = await fetch('http://localhost:3000/api/chat/submit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                runId: createData.runId,
                files: uploadedFiles,
                prompt: 'Compare these chip specifications',
                domain: 'CHIP'
            })
        });
        
        if (!submitResponse.ok) {
            const errorText = await submitResponse.text();
            throw new Error(`Submit failed: ${submitResponse.status} ${errorText}`);
        }
        
        const submitData = await submitResponse.json();
        console.log('✅ Processing submitted:', submitData);
        
        // Step 4: Monitor progress
        console.log('\n4️⃣ Monitoring processing...');
        
        let completed = false;
        let attempts = 0;
        const maxAttempts = 60; // 5 minutes max
        
        while (!completed && attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
            
            try {
                const eventsUrl = `http://localhost:3000/api/chat/events?runId=${createData.runId}`;
                console.log(`📡 Checking status (attempt ${attempts + 1})...`);
                
                // For now, check the database directly via the result endpoint
                const resultResponse = await fetch(`http://localhost:3000/api/chat/result?runId=${createData.runId}`);
                
                if (resultResponse.ok) {
                    const resultData = await resultResponse.json();
                    console.log('🎉 Processing completed!');
                    console.log('📊 Result preview:', JSON.stringify(resultData, null, 2));
                    completed = true;
                } else if (resultResponse.status === 404) {
                    console.log('⏳ Still processing...');
                } else {
                    console.log(`⚠️ Status check returned: ${resultResponse.status}`);
                }
                
            } catch (statusError) {
                console.log(`⚠️ Status check error: ${statusError.message}`);
            }
            
            attempts++;
        }
        
        if (!completed) {
            console.log('⏰ Timeout reached - processing may still be ongoing');
            console.log(`💡 Check manually with: curl http://localhost:3000/api/chat/result?runId=${createData.runId}`);
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        process.exit(1);
    }
}

// Run test
testCompleteFlow();

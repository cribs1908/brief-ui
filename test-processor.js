#!/usr/bin/env node

/**
 * Test specifico per Document AI Processor
 */

require('dotenv').config({ path: '.env.local' });

async function testProcessor() {
    console.log('🧪 Testing Document AI Processor...\n');
    
    try {
        const { DocumentProcessorServiceClient } = require('@google-cloud/documentai');
        
        // Parse service account
        const credentials = JSON.parse(
            Buffer.from(process.env.GCP_SERVICE_ACCOUNT_JSON_BASE64, 'base64').toString('utf8')
        );
        
        const client = new DocumentProcessorServiceClient({ credentials });
        const projectId = credentials.project_id;
        const location = process.env.GCP_LOCATION || 'us';
        const processorId = process.env.GCP_PROCESSOR_ID;
        
        console.log(`📍 Config:`);
        console.log(`   Project: ${projectId}`);
        console.log(`   Location: ${location}`);
        console.log(`   Processor ID: ${processorId}`);
        
        if (!processorId) {
            console.log('❌ GCP_PROCESSOR_ID not set in .env.local');
            return;
        }
        
        // Test processor path
        const processorPath = client.processorPath(projectId, location, processorId);
        console.log(`\n🎯 Processor path: ${processorPath}`);
        
        // Try to get processor info
        console.log('\n🔍 Testing processor access...');
        const [processor] = await client.getProcessor({ name: processorPath });
        
        console.log(`✅ Processor found:`);
        console.log(`   Name: ${processor.displayName}`);
        console.log(`   Type: ${processor.type}`);
        console.log(`   State: ${processor.state}`);
        
        if (processor.state !== 'ENABLED') {
            console.log(`⚠️  Warning: Processor state is ${processor.state}, should be ENABLED`);
        }
        
        console.log('\n🎯 Ready to process PDFs!');
        
    } catch (error) {
        console.error('❌ Processor test failed:', error.message);
        
        if (error.message.includes('PERMISSION_DENIED')) {
            console.log('\n💡 Fix: Add Document AI permissions to service account');
        } else if (error.message.includes('NOT_FOUND')) {
            console.log('\n💡 Fix: Check processor ID in .env.local');
            console.log('   Run: node setup-docai.js');
        }
    }
}

testProcessor();

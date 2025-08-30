#!/usr/bin/env node

/**
 * Test database connection and basic queries
 */

require('dotenv').config({ path: '.env.local' });

async function testDatabase() {
    console.log('🧪 Testing database connection...\n');
    
    try {
        // Import Supabase client
        const { getSupabaseAdmin } = await import('./src/lib/supabase.ts');
        
        console.log('1️⃣ Creating Supabase admin client...');
        const supa = getSupabaseAdmin();
        
        console.log('2️⃣ Testing basic query (workspaces)...');
        const { data: workspaces, error: wsError } = await supa.from('workspaces').select('*').limit(5);
        
        if (wsError) {
            console.error('❌ Workspaces query error:', wsError);
        } else {
            console.log(`✅ Found ${workspaces?.length || 0} workspaces`);
        }
        
        console.log('3️⃣ Testing runs table...');
        const { data: runs, error: runsError } = await supa.from('runs').select('*').limit(5);
        
        if (runsError) {
            console.error('❌ Runs query error:', runsError);
        } else {
            console.log(`✅ Found ${runs?.length || 0} runs`);
            if (runs && runs.length > 0) {
                console.log('📋 Latest run:', runs[0]);
            }
        }
        
        console.log('4️⃣ Testing documents table...');
        const { data: docs, error: docsError } = await supa.from('documents').select('*').limit(5);
        
        if (docsError) {
            console.error('❌ Documents query error:', docsError);
        } else {
            console.log(`✅ Found ${docs?.length || 0} documents`);
        }
        
        console.log('\n🎯 Database connection test completed!');
        
    } catch (error) {
        console.error('❌ Database test failed:', error.message);
        console.log('\n💡 Check your environment variables:');
        console.log('   SUPABASE_URL:', process.env.SUPABASE_URL ? '✅ Set' : '❌ Missing');
        console.log('   SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? '✅ Set' : '❌ Missing');
    }
}

testDatabase();

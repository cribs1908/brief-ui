#!/usr/bin/env node

/**
 * Setup demo workspace using environment variables
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function setupDemoWorkspace() {
    console.log('🏗️ Setting up demo workspace...\n');
    
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
        console.error('❌ Missing Supabase environment variables');
        console.log('💡 Make sure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env.local');
        process.exit(1);
    }
    
    const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    
    const demoWorkspaceId = '00000000-0000-0000-0000-000000000001';
    
    try {
        console.log(`1️⃣ Checking existing workspace: ${demoWorkspaceId}`);
        
        const { data: existing, error: checkError } = await supabase
            .from('workspaces')
            .select('*')
            .eq('id', demoWorkspaceId)
            .maybeSingle();
        
        if (checkError) {
            console.error('❌ Error checking workspace:', checkError);
            throw checkError;
        }
        
        if (existing) {
            console.log('✅ Demo workspace already exists:', existing.name);
        } else {
            console.log('2️⃣ Creating demo workspace...');
            
                            const { data: created, error: createError } = await supabase
                .from('workspaces')
                .insert({
                    id: demoWorkspaceId,
                    name: 'Demo Workspace',
                    plan: 'free',
                    owner_id: '00000000-0000-0000-0000-000000000002'
                })
                .select('*')
                .maybeSingle();
            
            if (createError) {
                console.error('❌ Error creating workspace:', createError);
                throw createError;
            }
            
            console.log('✅ Demo workspace created:', created);
        }
        
        console.log('\n🎯 Demo workspace setup completed!');
        console.log(`   ID: ${demoWorkspaceId}`);
        console.log('   Ready for testing!');
        
    } catch (error) {
        console.error('❌ Setup failed:', error.message);
        process.exit(1);
    }
}

setupDemoWorkspace();

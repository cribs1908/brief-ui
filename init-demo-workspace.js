#!/usr/bin/env node

/**
 * Initialize demo workspace in database
 */

require('dotenv').config({ path: '.env.local' });

async function initDemoWorkspace() {
    console.log('🏗️ Initializing demo workspace...\n');
    
    try {
        // Import Supabase client
        const { getSupabaseAdmin } = await import('./src/lib/supabase.ts');
        
        console.log('1️⃣ Creating Supabase admin client...');
        const supa = getSupabaseAdmin();
        
        const demoWorkspaceId = '00000000-0000-0000-0000-000000000001';
        
        console.log(`2️⃣ Checking if demo workspace exists: ${demoWorkspaceId}`);
        const { data: existingWorkspace, error: checkError } = await supa
            .from('workspaces')
            .select('*')
            .eq('id', demoWorkspaceId)
            .maybeSingle();
        
        if (checkError) {
            console.error('❌ Error checking workspace:', checkError);
            throw checkError;
        }
        
        if (existingWorkspace) {
            console.log('✅ Demo workspace already exists');
        } else {
            console.log('3️⃣ Creating demo workspace...');
            const { data: newWorkspace, error: createError } = await supa
                .from('workspaces')
                .insert({
                    id: demoWorkspaceId,
                    name: 'Demo Workspace',
                    plan: 'free',
                    owner_id: 'demo-user'
                })
                .select('*')
                .maybeSingle();
            
            if (createError) {
                console.error('❌ Error creating workspace:', createError);
                throw createError;
            }
            
            console.log('✅ Demo workspace created:', newWorkspace);
        }
        
        console.log('\n🎯 Demo workspace initialization completed!');
        console.log(`   Workspace ID: ${demoWorkspaceId}`);
        
    } catch (error) {
        console.error('❌ Demo workspace initialization failed:', error.message);
        console.log('\n💡 Make sure your Supabase environment variables are correct');
        process.exit(1);
    }
}

initDemoWorkspace();

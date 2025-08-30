#!/usr/bin/env node

/**
 * Script di test per verificare il backend
 * 
 * Usage: node test-backend.js
 */

const { spawn } = require('child_process');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

// Controlla che le env siano configurate
function checkEnv() {
    const required = [
        'SUPABASE_URL',
        'SUPABASE_SERVICE_ROLE_KEY', 
        'OPENAI_API_KEY',
        'DOC_AI_ENABLED'
    ];
    
    const missing = required.filter(key => !process.env[key]);
    if (missing.length > 0) {
        console.log('❌ Missing environment variables:');
        missing.forEach(key => console.log(`   - ${key}`));
        process.exit(1);
    }
    
    console.log('✅ Environment variables configured');
}

// Inizializza profili
async function initProfiles() {
    console.log('🔧 Initializing profiles...');
    
    return new Promise((resolve, reject) => {
        const child = spawn('npx', ['tsx', 'src/lib/init-profiles.ts'], {
            cwd: process.cwd(),
            stdio: 'inherit'
        });
        
        child.on('close', (code) => {
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`Profile initialization failed with code ${code}`));
            }
        });
    });
}

// Test compilazione
async function testBuild() {
    console.log('🔨 Testing build...');
    
    return new Promise((resolve, reject) => {
        const child = spawn('npm', ['run', 'build'], {
            cwd: process.cwd(),
            stdio: 'inherit'
        });
        
        child.on('close', (code) => {
            if (code === 0) {
                console.log('✅ Build successful');
                resolve();
            } else {
                reject(new Error(`Build failed with code ${code}`));
            }
        });
    });
}

// Main
async function main() {
    try {
        console.log('🚀 Brief AI Backend Test\n');
        
        checkEnv();
        
        await initProfiles();
        console.log('✅ Profiles initialized\n');
        
        await testBuild();
        console.log('✅ Build test passed\n');
        
        console.log('✅ Backend ready! Start with: npm run dev');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        process.exit(1);
    }
}

main();

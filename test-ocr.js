#!/usr/bin/env node

const { spawn } = require('child_process');
const fs = require('fs');

console.log('🔍 Testing OCRmyPDF Detection');

async function testOcrPath(path) {
  return new Promise((resolve) => {
    const process = spawn(path, ['--version'], { stdio: 'pipe' });
    
    let hasOutput = false;
    process.stdout.on('data', (data) => {
      const output = data.toString();
      console.log(`📊 Output from ${path}: ${output.trim()}`);
      if (output.match(/\d+\.\d+\.\d+/)) {
        hasOutput = true;
      }
    });
    
    process.on('close', (code) => {
      console.log(`📊 Process ${path} exited with code: ${code}`);
      resolve(code === 0 && hasOutput);
    });
    
    process.on('error', (err) => {
      console.log(`❌ Error with ${path}: ${err.message}`);
      resolve(false);
    });
    
    setTimeout(() => {
      process.kill();
      resolve(false);
    }, 5000);
  });
}

async function findOcrMyPdf() {
  const ocrPaths = [
    '/Library/Frameworks/Python.framework/Versions/3.12/bin/ocrmypdf',
    '/Library/Frameworks/Python.framework/Versions/3.11/bin/ocrmypdf',
    '/Library/Frameworks/Python.framework/Versions/3.10/bin/ocrmypdf',
    '/usr/local/bin/ocrmypdf',
    '/opt/homebrew/bin/ocrmypdf',
    'ocrmypdf'
  ];
  
  for (const path of ocrPaths) {
    console.log(`🔍 Testing path: ${path}`);
    
    if (path.startsWith('/')) {
      if (!fs.existsSync(path)) {
        console.log(`❌ File does not exist: ${path}`);
        continue;
      } else {
        console.log(`✅ File exists: ${path}`);
      }
    }
    
    const isValid = await testOcrPath(path);
    if (isValid) {
      console.log(`🎉 Found working OCRmyPDF at: ${path}`);
      return path;
    }
  }
  
  console.log('❌ No working OCRmyPDF found');
  return null;
}

findOcrMyPdf().then(path => {
  if (path) {
    console.log('\n✅ OCRmyPDF is ready for use!');
  } else {
    console.log('\n❌ OCRmyPDF needs to be installed or fixed');
    console.log('Try: pip3 install ocrmypdf');
  }
});
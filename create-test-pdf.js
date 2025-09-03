#!/usr/bin/env node

const fs = require('fs');

// Create a minimal PDF structure for testing
// This creates a basic PDF with text content that can be extracted
const pdfContent = `%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj

2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>
endobj

3 0 obj
<<
/Type /Page
/Parent 2 0 R
/Resources <<
  /Font <<
    /F1 4 0 R
  >>
>>
/MediaBox [0 0 612 792]
/Contents 5 0 R
>>
endobj

4 0 obj
<<
/Type /Font
/Subtype /Type1
/BaseFont /Times-Roman
>>
endobj

5 0 obj
<<
/Length 144
>>
stream
BT
/F1 12 Tf
72 720 Td
(Test Chip Specification) Tj
0 -20 Td
(Supply Voltage: 3.3V) Tj
0 -20 Td
(Supply Current: 50mA) Tj
0 -20 Td
(Operating Temperature: -40 to 85 degrees C) Tj
0 -20 Td
(Package: SOIC-8) Tj
ET
endstream
endobj

xref
0 6
0000000000 65535 f 
0000000010 00000 n 
0000000079 00000 n 
0000000173 00000 n 
0000000301 00000 n 
0000000380 00000 n 
trailer
<<
/Size 6
/Root 1 0 R
>>
startxref
574
%%EOF`;

console.log('📝 Creating test PDF files...');

// Create test chip PDFs
fs.writeFileSync('/Users/leonardocribari/Desktop/Brief/test-chip1.pdf', pdfContent.replace('Test Chip Specification', 'LM358 Op-Amp Specification'));

const chip2Content = pdfContent
  .replace('Test Chip Specification', 'TL072 Op-Amp Specification')
  .replace('Supply Voltage: 3.3V', 'Supply Voltage: 5.0V')
  .replace('Supply Current: 50mA', 'Supply Current: 25mA')
  .replace('Package: SOIC-8', 'Package: DIP-8');

fs.writeFileSync('/Users/leonardocribari/Desktop/Brief/test-chip2.pdf', chip2Content);

console.log('✅ Created test PDFs:');
console.log('   - test-chip1.pdf (LM358 Op-Amp)');
console.log('   - test-chip2.pdf (TL072 Op-Amp)');
console.log('\n🧪 Now you can test the full pipeline:');
console.log('1. Open http://localhost:3000');
console.log('2. Upload these test PDFs');
console.log('3. Enter prompt: "Compare these op-amps"');
console.log('4. Watch the processing pipeline work!');
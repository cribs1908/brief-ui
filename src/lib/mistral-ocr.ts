import { ENV } from './env';

export interface OcrPageText { 
  page: number; 
  text: string; 
}

interface MistralOCRResponse {
  pages: {
    index: number;
    markdown: string;
  }[];
  images?: any[];
  document_dimensions?: any;
}

/**
 * Extract text from PDF using Mistral AI OCR
 * More accurate and reliable than traditional OCR systems
 */
export async function mistralOcrExtract(pdfBytes: ArrayBuffer): Promise<OcrPageText[]> {
  console.log('🔍 Starting Mistral AI OCR extraction...');
  
  if (!ENV.mistralApiKey) {
    throw new Error('MISTRAL_API_KEY is required for OCR processing');
  }
  
  try {
    // Convert PDF bytes to base64 data URL (correct format for Mistral OCR)
    const base64Pdf = Buffer.from(pdfBytes).toString('base64');
    const dataUrl = `data:application/pdf;base64,${base64Pdf}`;
    console.log(`📝 Converted PDF to base64 data URL: ${Math.round(pdfBytes.byteLength / 1024)}KB`);
    
    // Prepare request payload
    const payload = {
      model: "mistral-ocr-latest",
      document: {
        type: "document_url",
        document_url: dataUrl
      },
      include_image_base64: false // We don't need images for text extraction
    };
    
    console.log('🚀 Sending PDF to Mistral AI OCR...');
    
    // Make API request to Mistral OCR
    const response = await fetch('https://api.mistral.ai/v1/ocr', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ENV.mistralApiKey}`
      },
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Mistral OCR API error (${response.status}): ${errorText}`);
    }
    
    const result: MistralOCRResponse = await response.json();
    console.log('📥 Mistral OCR response received');
    
    // Transform response to expected format
    const pages: OcrPageText[] = result.pages.map(page => ({
      page: page.index + 1, // Convert from 0-based to 1-based indexing
      text: page.markdown
    }));
    
    console.log(`✅ Mistral OCR extraction completed: ${pages.length} pages processed`);
    console.log(`📊 Total text extracted: ${pages.reduce((sum, p) => sum + p.text.length, 0)} characters`);
    
    return pages;
    
  } catch (error: any) {
    console.error('❌ Mistral OCR extraction failed:', error.message);
    throw new Error(`OCR processing failed: ${error.message}`);
  }
}

/**
 * Check if Mistral OCR is properly configured
 */
export function checkMistralOcrAvailable(): boolean {
  return !!ENV.mistralApiKey;
}
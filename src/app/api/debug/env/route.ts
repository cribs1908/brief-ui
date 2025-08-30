import { NextResponse } from 'next/server';
import { ENV } from '@/lib/env';

export async function GET() {
  return NextResponse.json({
    OPENAI_API_KEY: ENV.openaiKey ? 'present' : 'missing',
    SUPABASE_URL: ENV.supabaseUrl ? 'present' : 'missing',
    SUPABASE_SERVICE_ROLE_KEY: ENV.supabaseService ? 'present' : 'missing',
    WORKER_BASE_URL: ENV.workerBaseUrl,
    OCR_API_URL: ENV.ocrApiUrl,
    MAX_FILES_PER_RUN: ENV.maxFilesPerRun,
    MAX_PAGES_PER_PDF: ENV.maxPagesPerPdf,
    MAX_MB_PER_PDF: ENV.maxMbPerPdf,
  });
}



import { NextResponse } from 'next/server';

export async function GET() {
  try {
    return NextResponse.json({
      OPENAI_API_KEY: process.env.OPENAI_API_KEY ? 'present' : 'missing',
      SUPABASE_URL: process.env.SUPABASE_URL ? 'present' : 'missing',
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'present' : 'missing',
      WORKER_BASE_URL: process.env.WORKER_BASE_URL || 'http://localhost:3001',
      MISTRAL_API_KEY: process.env.MISTRAL_API_KEY ? 'present' : 'missing',
      MAX_FILES_PER_RUN: parseInt(process.env.MAX_FILES_PER_RUN || '4'),
      MAX_PAGES_PER_PDF: parseInt(process.env.MAX_PAGES_PER_PDF || '120'),
      MAX_MB_PER_PDF: parseInt(process.env.MAX_MB_PER_PDF || '30'),
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to read environment variables' }, { status: 500 });
  }
}



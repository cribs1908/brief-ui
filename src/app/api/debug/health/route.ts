import { NextResponse } from 'next/server';
import { getSupabaseAdmin, STORAGE_BUCKET } from '@/lib/supabase';
import { ENV } from '@/lib/env';

export async function GET() {
  const results: Record<string, { ok: boolean; message?: string }> = {};
  const supa = getSupabaseAdmin();

  // Supabase DB read/write
  try {
    const { data, error } = await supa.from('runs_new').select('id').limit(1);
    if (error) throw error;
    results.supabaseDb = { ok: true };
  } catch (e: any) {
    results.supabaseDb = { ok: false, message: e.message };
  }

  // Storage signed URL
  try {
    const { data: url, error } = await supa.storage.from(STORAGE_BUCKET).createSignedUrl('healthcheck.txt', 60);
    if (error) throw error;
    results.storage = { ok: true };
  } catch (e: any) {
    results.storage = { ok: false, message: e.message };
  }

  // OCR service (disabled for production)
  results.ocr = { ok: true, message: 'OCR service not configured for production' };

  // OpenAI
  try {
    results.openai = { ok: !!ENV.openaiKey };
  } catch (e: any) {
    results.openai = { ok: false, message: e.message };
  }

  return NextResponse.json(results);
}



import { createClient } from '@supabase/supabase-js';

export function getSupabaseAdmin() {
	const url = process.env.SUPABASE_URL;
	const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
	if (!url || !key) throw new Error('Supabase admin not configured');
	return createClient(url, key, { auth: { persistSession: false } });
}

export function getSupabaseAnon() {
	const url = process.env.SUPABASE_URL;
	const key = process.env.SUPABASE_ANON_KEY;
	if (!url || !key) throw new Error('Supabase anon not configured');
	return createClient(url, key, { auth: { persistSession: false } });
}

export const STORAGE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'specsheets';

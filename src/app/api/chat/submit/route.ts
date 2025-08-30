import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { ENV } from '@/lib/env';

export async function POST(req: Request) {
	try {
		const body = await req.json();
		const { runId, files = [], prompt = '', domain = 'AUTO' } = body || {};
		
		// Validazioni
		if (!runId) return NextResponse.json({ error: 'runId required' }, { status: 400 });
		if (!Array.isArray(files) || files.length === 0) return NextResponse.json({ error: 'files required' }, { status: 400 });
		if (files.length > ENV.maxFilesPerRun) return NextResponse.json({ error: `max ${ENV.maxFilesPerRun} files` }, { status: 400 });

		const supa = getSupabaseAdmin();
		
		// Update the run with prompt and domain
		console.log(`📝 Updating run ${runId} with prompt and domain...`);
		const { error: updateError } = await supa.from('runs_new').update({ 
			prompt, 
			domain
		}).eq('id', runId);
		
		if (updateError) {
			console.error('❌ Failed to update run:', updateError);
			throw new Error(`Failed to update run: ${updateError.message}`);
		}
		console.log(`✅ Updated run ${runId} successfully`);
		
		// Insert documents
		for (const f of files) {
			const { error: docError } = await supa.from('documents_new').insert({ 
				id: f.id, 
				run_id: runId, 
				filename: f.filename || 'document.pdf', 
				storage_path: f.storagePath
			});
			
			if (docError) {
				console.error('❌ Failed to insert document:', docError);
			}
		}
		
		// Trigger processing on external worker
		try {
			console.log(`🚀 Triggering worker job at ${ENV.workerBaseUrl}/jobs/compare ...`);
			const resp = await fetch(`${ENV.workerBaseUrl}/jobs/compare`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					runId,
					prompt,
					domain,
					files: files.map((f: any) => ({
						id: f.id,
						filename: f.filename || 'document.pdf',
						storage_path: f.storagePath
					}))
				})
			});
			if (!resp.ok) {
				const txt = await resp.text();
				throw new Error(`Worker error (${resp.status}): ${txt}`);
			}
			console.log(`✅ Worker accepted job for run ${runId}`);
		} catch (workerErr: any) {
			console.error('❌ Failed to trigger worker job:', workerErr);
			return NextResponse.json({ error: 'Failed to trigger processing' }, { status: 502 });
		}

		return NextResponse.json({ ok: true });
	} catch (e: any) {
		return NextResponse.json({ error: e.message || 'Internal error' }, { status: 503 });
	}
}

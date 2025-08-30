import { NextResponse } from 'next/server';
import { getSupabaseAdmin, STORAGE_BUCKET } from '@/lib/supabase';
import { randomUUID } from 'crypto';
import { ENV } from '@/lib/env';

export async function POST(req: Request) {
	try {
		const body = await req.json();
		const { workspaceId = null, files = 1 } = body || {};
		
		// TODO: Integrare con Clerk per ottenere user_id reale
		const userId = 'temp-user-id'; // Placeholder - da sostituire con auth Clerk
		
		const supa = getSupabaseAdmin();
		const runId = randomUUID();
		
		// Creare il run 
		const { error: runError } = await supa.from('runs_new').insert({ 
			id: runId, 
			user_id: userId,
			workspace_id: workspaceId || '00000000-0000-0000-0000-000000000001', 
			status: 'QUEUED' 
		});
		
		if (runError) {
			console.error('❌ Failed to create run:', runError);
			throw new Error(`Failed to create run: ${runError.message}`);
		}
		console.log(`✅ Created run: ${runId}`);

		// Generare signed URLs per upload (numero basato sui file effettivi)
		const numFiles = Math.min(Math.max(files, 1), ENV.maxFilesPerRun);
		const uploadUrls: { id: string; signedUrl: string; storagePath: string }[] = [];
		for (let i = 0; i < numFiles; i++) {
			const docId = randomUUID();
			const storagePath = `workspace/${workspaceId || 'default'}/runs/${runId}/documents/${docId}.pdf`;
			const { data, error } = await supa.storage.from(STORAGE_BUCKET).createSignedUploadUrl(storagePath);
			if (error) throw error;
			uploadUrls.push({ id: docId, signedUrl: (data as any).signedUrl, storagePath });
		}
		
		return NextResponse.json({ 
			runId, 
			uploadUrls, 
			maxFiles: ENV.maxFilesPerRun,
			maxSizeMb: ENV.maxMbPerPdf
		});
	} catch (e: any) {
		return NextResponse.json({ error: e.message || 'Internal error' }, { status: 503 });
	}
}

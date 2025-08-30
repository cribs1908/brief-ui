import { NextResponse } from 'next/server';
import { getSupabaseAdmin, STORAGE_BUCKET } from '@/lib/supabase';
import { randomUUID } from 'crypto';
import { ENV } from '@/lib/env';
import { auth } from '@clerk/nextjs/server';

export async function POST(req: Request) {
	try {
		const body = await req.json();
		const { workspaceId = null, files = 1 } = body || {};
		
		// Get authenticated user from Clerk
		const { userId } = await auth();
		if (!userId) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}
		
		const supa = getSupabaseAdmin();
		const runId = randomUUID();
		
		// Get or create user workspace
		let { data: workspace } = await supa
			.from('workspaces')
			.select('id')
			.eq('owner_id', userId)
			.single();
		
		if (!workspace) {
			// Create workspace for new user
			const workspaceUuid = randomUUID();
			const { error: workspaceError } = await supa
				.from('workspaces')
				.insert({
					id: workspaceUuid,
					owner_id: userId,
					name: 'Default Workspace',
					created_at: new Date().toISOString()
				});
			
			if (workspaceError) {
				console.error('❌ Failed to create workspace:', workspaceError);
				throw new Error(`Failed to create workspace: ${workspaceError.message}`);
			}
			
			workspace = { id: workspaceUuid };
			console.log(`✅ Created workspace: ${workspaceUuid} for user: ${userId}`);
		}
		
		const actualWorkspaceId = workspaceId || workspace.id;
		
		// Creare il run 
		const { error: runError } = await supa.from('runs_new').insert({ 
			id: runId, 
			user_id: userId,
			workspace_id: actualWorkspaceId, 
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
			const storagePath = `workspace/${actualWorkspaceId}/runs/${runId}/documents/${docId}.pdf`;
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

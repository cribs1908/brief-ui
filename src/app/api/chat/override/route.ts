import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { createSynonymMap } from '@/lib/synonym-map';

export async function POST(req: Request) {
	try {
		const body = await req.json();
		const { runId, fieldId, value, unit, userId = null } = body || {};
		if (!runId || !fieldId) return NextResponse.json({ error: 'runId and fieldId required' }, { status: 400 });
		
		const supa = getSupabaseAdmin();
		
		// Get run info for workspace
		const { data: runData } = await supa.from('runs').select('workspace_id').eq('id', runId).maybeSingle();
		if (!runData) return NextResponse.json({ error: 'Run not found' }, { status: 404 });
		
		// Save override
		const { data, error } = await supa.from('overrides').insert({ 
			run_id: runId, 
			field_id: fieldId, 
			value, 
			unit, 
			user_id: userId 
		}).select('*').maybeSingle();
		if (error) throw error;
		
		// Update synonym map with strong signal
		const synonymMap = await createSynonymMap(runData.workspace_id);
		await synonymMap.recordOverride(fieldId, value);
		
		// Audit log
		await supa.from('audit_logs').insert({ 
			actor: userId || 'system', 
			action: 'override', 
			target: runId, 
			metadata: { fieldId, value, unit, originalValue: body.originalValue } 
		});
		
		return NextResponse.json({ ok: true, override: data });
	} catch (e: any) {
		return NextResponse.json({ error: e.message || 'Internal error' }, { status: 503 });
	}
}

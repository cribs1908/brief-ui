import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function GET(req: Request) {
	const url = new URL(req.url);
	const runId = url.searchParams.get('runId');
	
	if (!runId) {
		return NextResponse.json({ error: 'runId required' }, { status: 400 });
	}

	const supa = getSupabaseAdmin();
	
	try {
		const { data, error } = await supa
			.from('runs_new')
			.select('status, error_message, has_results')
			.eq('id', runId)
			.maybeSingle();
		
		if (error) {
			console.error(`❌ Database error:`, error);
			return NextResponse.json({ error: 'Database error' }, { status: 500 });
		}
		
		if (!data) {
			return NextResponse.json({ error: 'Run not found' }, { status: 404 });
		}
		
		let progress = 0;
		let message = '';
		
		switch (data.status) {
			case 'QUEUED':
				progress = 10;
				message = 'In coda...';
				break;
			case 'PROCESSING':
				progress = 50;
				message = 'Elaborazione in corso...';
				break;
			case 'READY':
				progress = 100;
				message = 'Completato!';
				break;
			case 'ERROR':
				progress = 0;
				message = data.error_message || 'Errore durante il processing';
				break;
			default:
				progress = 5;
				message = 'Inizializzazione...';
		}
		
		return NextResponse.json({
			status: data.status,
			progress,
			message,
			hasResults: data.has_results,
			error: data.status === 'ERROR' ? data.error_message : null
		});
		
	} catch (error: any) {
		console.error('❌ Error checking run status:', error);
		return NextResponse.json({ error: 'Internal error' }, { status: 500 });
	}
}
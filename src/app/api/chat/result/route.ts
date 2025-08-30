import { NextResponse } from 'next/server';
import { getSupabaseAdmin, STORAGE_BUCKET } from '@/lib/supabase';

export async function GET(req: Request) {
	try {
		const { searchParams } = new URL(req.url);
		const runId = searchParams.get('runId');
		if (!runId) return NextResponse.json({ error: 'runId required' }, { status: 400 });
		
		const supa = getSupabaseAdmin();
		
		// Cercare nella tabella results
		console.log(`🔍 Searching for results with run_id: ${runId}`);
		const { data, error } = await supa
			.from('results_new')
			.select('*')
			.eq('run_id', runId)
			.maybeSingle();
			
		console.log('🔍 Database query result:', { data: !!data, error });
		if (data) {
			console.log('📊 Found result data keys:', Object.keys(data));
		}
		
		if (error) {
			console.error('❌ Error fetching result:', error);
			return NextResponse.json({ error: 'Failed to fetch result' }, { status: 500 });
		}
		
		if (data) {
			console.log(`✅ Found result for run: ${runId}`);
			
			// Generare URL firmati per export se esistono
			let exportCsvUrl = null;
			let citationsAvailable = false;
			
			if (data.export_csv_path) {
				const { data: csvUrl } = await supa.storage
					.from(STORAGE_BUCKET)
					.createSignedUrl(data.export_csv_path, 3600);
				exportCsvUrl = csvUrl?.signedUrl || null;
			}
			
			if (data.source_map_path) {
				citationsAvailable = true;
			}
			
			// VALIDAZIONE/ADATTAMENTO CONTRATTO JSON: i dati sono in table_json (results_new.table_json)
			const raw = data.table_json as any;
			let table: any = raw;
			
			// Se il worker ha salvato una matrice del tipo { columns: string[]; rows: string[][] }
			// la convertiamo nel contratto Table atteso dal frontend: { columns: {id,label,unit?}[]; rows: {docId,docLabel,cells}[] }
			const looksLikeMatrix = raw && Array.isArray(raw.columns) && Array.isArray(raw.rows) && Array.isArray(raw.rows[0]);
			if (looksLikeMatrix) {
				const headers: string[] = raw.columns;
				const rowArrays: string[][] = raw.rows;
				
				const fieldNames = rowArrays.map(r => (r && r.length > 0 ? String(r[0]) : ''))
					.filter(n => n && n.trim().length > 0);
				
				const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
				
				// Conversione al formato semplice che si aspetta il frontend
				const docLabels: string[] = headers.slice(1); // salta "Field"
				
				// columns: header originali (Field, Doc1, Doc2, ...)
				const columns = headers;
				
				// rows: mantieni la matrice originale
				const rows = rowArrays;
				
				table = { columns, rows };
			}
			
			console.log('🚨 RESULT API VALIDATION:');
			console.log('📊 Table columns:', table?.columns?.length || 0);
			console.log('📊 Table rows:', table?.rows?.length || 0);
			
			if (!table.columns || table.columns.length === 0) {
				console.error('❌ INVALID TABLE: No columns found');
				return NextResponse.json({ error: 'Invalid table structure: no columns' }, { status: 500 });
			}
			
			if (!table.rows || table.rows.length === 0) {
				console.error('❌ INVALID TABLE: No rows found');
				return NextResponse.json({ error: 'Invalid table structure: no rows' }, { status: 500 });
			}
			
			console.log('✅ Table validation PASSED in API');
			
			return NextResponse.json({
				table,
				exportCsvUrl,
				citationsAvailable
			});
		}
		
		// Nessun risultato trovato - verificare se il run esiste
		const { data: runData } = await supa
			.from('runs_new')
			.select('status')
			.eq('id', runId)
			.maybeSingle();
		
		if (!runData) {
			return NextResponse.json({ error: 'Run not found' }, { status: 404 });
		}
		
		if (runData.status === 'ERROR') {
			return NextResponse.json({ error: 'Run failed to complete' }, { status: 400 });
		}
		
		if (runData.status !== 'READY') {
			return NextResponse.json({ error: 'Result not ready yet' }, { status: 202 });
		}
		
		// Run è READY ma nessun risultato - errore inaspettato
		return NextResponse.json({ error: 'Result missing for completed run' }, { status: 500 });
		
	} catch (e: any) {
		console.error('❌ Result endpoint error:', e);
		return NextResponse.json({ error: e.message || 'Internal error' }, { status: 503 });
	}
}

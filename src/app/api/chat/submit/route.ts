import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { ENV } from '@/lib/env';
import { mistralOcrExtract } from '@/lib/mistral-ocr';
import { extractFields } from '@/lib/extract';
import { normalizeExtractions } from '@/lib/normalizer';
import { buildComparisonTable } from '@/lib/builder';

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
		
		// Trigger processing on external worker or inline
		if (ENV.workerBaseUrl === 'disabled' || ENV.workerBaseUrl.includes('localhost')) {
			console.log('⚠️ External worker disabled or not available, processing inline...');
			
			// Start inline processing pipeline
			try {
				await processFilesInline(runId, files, prompt, domain);
				return NextResponse.json({ 
					success: true, 
					message: 'Processing started (inline mode)', 
					runId 
				});
			} catch (error: any) {
				console.error('❌ Inline processing failed:', error);
				return NextResponse.json({ 
					error: 'Processing failed: ' + error.message 
				}, { status: 500 });
			}
		}
		
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

// Inline processing function for Vercel deployment
async function processFilesInline(runId: string, files: any[], prompt: string, domain: string) {
	const supa = getSupabaseAdmin();
	
	console.log(`🚀 Starting inline processing for run ${runId} with ${files.length} files`);
	
	// Update run status to processing
	await supa.from('runs_new').update({ 
		status: 'processing',
		started_at: new Date().toISOString()
	}).eq('id', runId);
	
	try {
		const processedDocs = [];
		
		// Step 1: OCR Processing for each file
		for (const file of files) {
			console.log(`📄 Processing OCR for ${file.filename}...`);
			
			try {
				// Download PDF from Supabase Storage
				const { data: pdfData, error: downloadError } = await supa.storage
					.from(ENV.bucket)
					.download(file.storagePath);
				
				if (downloadError) throw downloadError;
				
				// Convert to ArrayBuffer for OCR processing
				const arrayBuffer = await pdfData.arrayBuffer();
				
				// OCR with Mistral API
				const ocrPages = await mistralOcrExtract(arrayBuffer);
				const ocrResult = { pages: ocrPages };
				
				// Save OCR result to artifacts table
				const { data: artifact, error: artifactError } = await supa
					.from('artifacts_new')
					.insert({
						run_id: runId,
						document_id: file.id,
						artifact_type: 'ocr_text',
						content: { pages: ocrResult.pages }
					})
					.select()
					.single();
				
				if (artifactError) throw artifactError;
				
				processedDocs.push({
					...file,
					ocrResult,
					artifactId: artifact.id
				});
				
				console.log(`✅ OCR completed for ${file.filename}: ${ocrResult.pages.length} pages`);
				
			} catch (error: any) {
				console.error(`❌ OCR failed for ${file.filename}:`, error);
				throw error;
			}
		}
		
		// Step 2: AI Extraction for each document
		const extractions = [];
		for (const doc of processedDocs) {
			console.log(`🤖 Extracting data from ${doc.filename}...`);
			
			try {
				// Prepare OCR texts for extraction (already in correct format)
				const ocrTexts = doc.ocrResult.pages.map((p: any, index: number) => ({
					page: p.page || index + 1,
					text: p.text,
					documentId: doc.id
				}));
				
				// Extract fields using AI
				const extraction = await extractFields(domain, ocrTexts);
				
				// Save raw extraction
				const { data: rawExtraction, error: rawError } = await supa
					.from('extractions_raw_new')
					.insert({
						run_id: runId,
						document_id: doc.id,
						domain_type: domain,
						raw_data: extraction,
						extraction_prompt: prompt || 'Compare specifications'
					})
					.select()
					.single();
				
				if (rawError) throw rawError;
				
				// Convert FieldExtraction[] to ExtractionRaw[] for normalizer
				const extractionRaw = extraction.map((field, index) => ({
					id: `${doc.id}_${field.fieldId}_${index}`,
					documentId: doc.id,
					fieldId: field.fieldId,
					valueRaw: field.value,
					unitRaw: field.unit,
					source: 'mistral_ocr',
					confidence: field.confidence,
					provenance: field.provenance
				}));
				
				// Normalize extraction
				const normalized = await normalizeExtractions(extractionRaw);
				const normalizedData = normalized;
				
				// Save normalized extraction  
				const { data: normExtraction, error: normError } = await supa
					.from('extractions_norm_new')
					.insert({
						run_id: runId,
						document_id: doc.id,
						domain_type: domain,
						normalized_data: normalizedData
					})
					.select()
					.single();
				
				if (normError) throw normError;
				
				extractions.push({
					documentId: doc.id,
					filename: doc.filename,
					raw: extraction,
					normalized: normalizedData
				});
				
				console.log(`✅ Extraction completed for ${doc.filename}: ${extraction.fields?.length || 0} fields`);
				
			} catch (error: any) {
				console.error(`❌ Extraction failed for ${doc.filename}:`, error);
				throw error;
			}
		}
		
		// Step 3: Build Comparison Results
		console.log(`📊 Building comparison table...`);
		
		const comparisonResult = await buildComparisonTable(extractions, domain);
		
		// Save final results
		const { error: resultError } = await supa
			.from('results_new')
			.insert({
				run_id: runId,
				domain_type: domain,
				comparison_table: comparisonResult.table,
				insights: comparisonResult.insights,
				metadata: {
					totalDocuments: files.length,
					totalFields: comparisonResult.table?.headers?.length || 0,
					processingTime: Date.now()
				}
			});
		
		if (resultError) throw resultError;
		
		// Update run status to completed
		await supa.from('runs_new').update({ 
			status: 'completed',
			completed_at: new Date().toISOString(),
			has_results: true
		}).eq('id', runId);
		
		console.log(`🎉 Processing completed successfully for run ${runId}`);
		
	} catch (error: any) {
		console.error(`❌ Processing failed for run ${runId}:`, error);
		
		// Update run status to failed
		await supa.from('runs_new').update({ 
			status: 'failed',
			completed_at: new Date().toISOString(),
			error_message: error.message
		}).eq('id', runId);
		
		throw error;
	}
}

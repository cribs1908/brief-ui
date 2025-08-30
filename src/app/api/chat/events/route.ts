import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

function sleep(ms: number) {
	return new Promise(resolve => setTimeout(resolve, ms));
}

export async function GET(req: Request) {
	const url = new URL(req.url);
	const runId = url.searchParams.get('runId');
	if (!runId) return NextResponse.json({ error: 'runId required' }, { status: 400 });

	const stream = new ReadableStream({
		start: async (controller) => {
			const enc = new TextEncoder();
			let isControllerClosed = false;
			const send = (o: any) => {
				if (isControllerClosed) {
					console.log(`🚫 Controller already closed, skipping event:`, o);
					return;
				}
				try {
					const jsonStr = JSON.stringify(o);
					console.log(`📡 SSE Event:`, o);
					controller.enqueue(enc.encode(`data: ${jsonStr}\n\n`));
				} catch (jsonError: any) {
					console.error(`❌ JSON serialization error:`, jsonError);
					if (!isControllerClosed) {
						try {
							const fallback = { type: 'error', error: { code: 'SERIALIZATION_ERROR', message: 'Failed to serialize event' } };
							controller.enqueue(enc.encode(`data: ${JSON.stringify(fallback)}\n\n`));
						} catch {
							console.error(`❌ Controller already closed during fallback`);
							isControllerClosed = true;
						}
					}
				}
			};
			
			const hb = setInterval(() => send({ type: 'heartbeat' }), 15000);
			const supa = getSupabaseAdmin();
			
			try {
				console.log(`🚀 Starting SSE stream for run: ${runId}`);
				
				// Simple polling of run status from new table
				let lastStatus = '';
				let attempts = 0;
				const maxAttempts = 720; // 12 minutes (720 * 1s)
				
				while (attempts < maxAttempts) {
					try {
						const { data, error } = await supa
							.from('runs_new')
							.select('status, error')
							.eq('id', runId)
							.maybeSingle();
						
						if (error) {
							console.error(`❌ Database error:`, error);
							throw new Error(`Database error: ${error.message}`);
						}
						
						if (!data) {
							console.error(`❌ Run not found: ${runId}`);
							throw new Error(`Run not found: ${runId}`);
						}
						
						const currentStatus = data.status;
						if (currentStatus !== lastStatus) {
							lastStatus = currentStatus;
							let progress = 0;
							let message = '';
							
							switch (currentStatus) {
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
									send({ type: 'status', status: currentStatus, progress, message });
									// End loop when completed
									return;
								case 'ERROR':
									const errorMsg = data.error || 'Errore durante il processing';
									send({ type: 'error', error: { code: 'PROCESSING_ERROR', message: errorMsg } });
									return;
							}
							
							send({ type: 'status', status: currentStatus, progress, message });
						}
						
						await sleep(1000);
						attempts++;
					} catch (pollError: any) {
						console.error(`❌ Polling error:`, pollError);
						send({ type: 'error', error: { code: 'POLLING_ERROR', message: pollError.message } });
						return;
					}
				}
				
				// Timeout reached
				console.error(`❌ Timeout reached for run: ${runId}`);
				send({ type: 'error', error: { code: 'TIMEOUT', message: 'Processing timeout - please try again' } });
				
			} catch (e: any) {
				console.error(`❌ SSE error for run ${runId}:`, e);
				const errorEvent = { 
					type: 'error', 
					error: { 
						code: 'SSE_ERROR', 
						message: e.message || 'SSE stream error' 
					} 
				};
				send(errorEvent);
			} finally {
				console.log(`🔚 Closing SSE stream for run: ${runId}`);
				isControllerClosed = true;
				clearInterval(hb);
				controller.close();
			}
		}
	});
	
	return new Response(stream, { 
		headers: { 
			'Content-Type': 'text/event-stream', 
			'Cache-Control': 'no-cache', 
			'Connection': 'keep-alive' 
		} 
	});
}
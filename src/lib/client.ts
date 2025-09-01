import { createClient } from '@supabase/supabase-js';

export async function apiCreateRun(filesCount: number, workspaceId?: string) {
	const body = workspaceId ? { workspaceId, files: filesCount } : { files: filesCount };
	const res = await fetch('/api/chat/create', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
	if (!res.ok) throw new Error(await res.text());
	return res.json();
}

export async function uploadSigned(url: string, file: File) {
	const r = await fetch(url, { method: 'PUT', headers: { 'content-type': 'application/octet-stream', 'x-upsert': 'true' as any }, body: file });
	if (!r.ok) throw new Error('upload failed');
}

export async function apiSubmit(body: any) {
	const res = await fetch('/api/chat/submit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
	if (!res.ok) throw new Error(await res.text());
	return res.json();
}

export function listenEvents(runId: string, onEvent: (ev: any)=>void) {
	const es = new EventSource(`/api/chat/events?runId=${encodeURIComponent(runId)}`);
	es.onmessage = (e) => {
		try { 
			console.log(`📡 Raw SSE data received:`, e.data);
			const parsed = JSON.parse(e.data);
			console.log(`📡 Parsed SSE event:`, parsed);
			onEvent(parsed);
		} catch (parseError) {
			console.error(`❌ Failed to parse SSE event:`, parseError);
			console.error(`❌ Raw data that failed:`, e.data);
		}
	};
	es.onerror = (error) => {
		// Only log non-normal disconnection errors
		if (es.readyState === EventSource.CLOSED) {
			console.log(`🔚 EventSource connection closed normally`);
		} else {
			console.error(`❌ EventSource error:`, error);
		}
	};
	return () => es.close();
}

export async function apiResult(runId: string) {
	const res = await fetch(`/api/chat/result?runId=${encodeURIComponent(runId)}`);
	if (!res.ok) throw new Error(await res.text());
	return res.json();
}

export async function apiChatQnA(runId: string, message: string) {
	const res = await fetch('/api/chat/qna', { 
		method: 'POST', 
		headers: { 'Content-Type': 'application/json' }, 
		body: JSON.stringify({ runId, message }) 
	});
	if (!res.ok) throw new Error(await res.text());
	return res.json();
}

export async function apiChatHistory(runId: string) {
	const res = await fetch(`/api/chat/qna?runId=${encodeURIComponent(runId)}`);
	if (!res.ok) throw new Error(await res.text());
	return res.json();
}

export async function apiGetUserFiles() {
	const res = await fetch('/api/files');
	if (!res.ok) throw new Error(await res.text());
	return res.json();
}

export async function apiGetComparisons() {
	const res = await fetch('/api/comparisons');
	if (!res.ok) throw new Error(await res.text());
	return res.json();
}

export async function apiSaveComparison(runId: string, domain: string, title: string, documentCount: number) {
	const res = await fetch('/api/comparisons', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ runId, domain, title, documentCount })
	});
	if (!res.ok) throw new Error(await res.text());
	return res.json();
}

export async function apiRenameComparison(runId: string, title: string) {
	const res = await fetch(`/api/comparisons/${runId}`, {
		method: 'PUT',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ title })
	});
	if (!res.ok) throw new Error(await res.text());
	return res.json();
}

export async function apiDeleteComparison(runId: string) {
	const res = await fetch(`/api/comparisons/${runId}`, {
		method: 'DELETE'
	});
	if (!res.ok) throw new Error(await res.text());
	return res.json();
}

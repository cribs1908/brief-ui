import { NextResponse } from 'next/server';
import { getSupabaseAdmin, STORAGE_BUCKET } from '@/lib/supabase';
import { ENV } from '@/lib/env';
import OpenAI from 'openai';

const openai = new OpenAI({
	apiKey: ENV.openaiKey,
});

// Domain detection from table structure
function detectDomainFromTable(tableData: any): string {
	if (!tableData?.rows) return 'GENERAL';
	
	const allText = JSON.stringify(tableData).toLowerCase();
	
	// CHIP indicators
	const chipKeywords = ['voltage', 'current', 'frequency', 'gpio', 'mhz', 'ghz', 'pin', 'package', 'temperature', 'power consumption', 'core', 'memory', 'flash', 'ram', 'adc', 'pwm'];
	const chipCount = chipKeywords.filter(k => allText.includes(k)).length;
	
	// API indicators  
	const apiKeywords = ['rate limit', 'authentication', 'endpoint', 'request', 'response', 'api key', 'oauth', 'rest', 'json', 'http', 'latency', 'timeout'];
	const apiCount = apiKeywords.filter(k => allText.includes(k)).length;
	
	// SAAS indicators
	const saasKeywords = ['pricing', 'plan', 'user', 'subscription', 'support', 'sla', 'uptime', 'integration', 'feature', 'license', 'billing'];
	const saasCount = saasKeywords.filter(k => allText.includes(k)).length;
	
	if (chipCount >= 3) return 'CHIP';
	if (apiCount >= 3) return 'API';
	if (saasCount >= 3) return 'SAAS';
	
	return 'GENERAL';
}

// Domain-specific reasoning profiles
function getDomainProfile(domain: string) {
	const profiles = {
		CHIP: {
			expertise: "Semiconductor engineering, embedded systems, hardware design, and electronic component selection",
			responsibilities: [
				"Analyze electrical characteristics and performance specifications",
				"Evaluate power consumption and thermal management requirements", 
				"Assess interface compatibility and peripheral integration",
				"Compare cost-effectiveness for different application scenarios",
				"Identify reliability and environmental suitability factors"
			],
			analysisApproach: [
				"Focus on critical specs like power, performance, and temperature ranges",
				"Translate electrical parameters into practical application impacts",
				"Consider supply chain, lifecycle, and cost implications",
				"Evaluate ease of integration and development ecosystem support"
			],
			keyMetrics: [
				"Power consumption (active/standby current, voltage ranges)",
				"Processing capabilities (CPU speed, memory, peripherals)",
				"Environmental specs (temperature range, package type)",
				"Interface compatibility (GPIO, communication protocols)",
				"Commercial factors (pricing, availability, lifecycle status)"
			]
		},
		API: {
			expertise: "API architecture, integration strategies, system design, and developer experience optimization",
			responsibilities: [
				"Evaluate API performance and scalability characteristics",
				"Assess authentication security and implementation complexity",
				"Compare rate limiting policies and usage cost structures",
				"Analyze documentation quality and developer ecosystem support",
				"Identify integration effort and maintenance requirements"
			],
			analysisApproach: [
				"Prioritize developer experience and integration complexity",
				"Evaluate performance under different load scenarios", 
				"Consider long-term costs including overages and scaling",
				"Assess reliability, monitoring, and error handling capabilities"
			],
			keyMetrics: [
				"Performance (response time, throughput, rate limits)",
				"Authentication & Security (OAuth, API keys, access control)",
				"Pricing structure (free tier, per-request costs, overages)",
				"Reliability (uptime SLA, error rates, monitoring)",
				"Developer experience (documentation, SDKs, support quality)"
			]
		},
		SAAS: {
			expertise: "Software-as-a-Service evaluation, business process optimization, and enterprise software procurement",
			responsibilities: [
				"Analyze feature completeness against business requirements",
				"Evaluate total cost of ownership including hidden fees",
				"Assess scalability for growing teams and data volumes",
				"Compare integration capabilities with existing tools",
				"Evaluate vendor stability and long-term strategic fit"
			],
			analysisApproach: [
				"Focus on business value delivery and ROI potential",
				"Consider implementation timeline and change management",
				"Evaluate vendor lock-in risks and data portability",
				"Assess compliance and security posture for enterprise use"
			],
			keyMetrics: [
				"Pricing models (per user, usage-based, feature tiers)",
				"Feature depth (core functionality, advanced capabilities)",
				"Scalability (user limits, storage, performance at scale)",
				"Integrations (native connectors, API quality, ecosystem)",
				"Support & SLA (response times, uptime guarantees, account management)"
			]
		},
		GENERAL: {
			expertise: "Technical product analysis and comparative evaluation across various domains",
			responsibilities: [
				"Provide objective analysis of key differentiating factors",
				"Highlight trade-offs between competing options",
				"Suggest use cases where each option might be preferred",
				"Identify areas where additional information would be valuable"
			],
			analysisApproach: [
				"Focus on the most significant differences in the comparison",
				"Provide context for technical specifications",
				"Consider both immediate and long-term implications",
				"Suggest questions to help narrow down the best choice"
			],
			keyMetrics: [
				"Performance characteristics",
				"Cost considerations", 
				"Feature availability",
				"Reliability and support",
				"Implementation complexity"
			]
		}
	};
	
	return profiles[domain as keyof typeof profiles] || profiles.GENERAL;
}

// Domain-specific response templates
function getResponseTemplate(domain: string): string {
	const templates = {
		CHIP: `**Executive Summary**
➡️ [Product A] is superior for [use case], while [Product B] is better for [use case].

**Power & Efficiency**
• [Product A]: ✅ [voltage/current specs] → [implication]
• [Product B]: ✅ [voltage/current specs] → [implication]

**Performance & Environment**
• [Product A]: ✅ [frequency/temp specs] → [implication]  
• [Product B]: ✅ [frequency/temp specs] → [implication]

**Package & Integration**
• [Product A]: ✅ [package/pins specs] → [implication]
• [Product B]: ✅ [package/pins specs] → [implication]

**Recommendation**
👉 Choose [Product A] for [specific use case/requirement].
👉 Choose [Product B] for [specific use case/requirement].`,

		API: `**Executive Summary**
➡️ [API A] is better for [use case], while [API B] is better for [use case].

**Authentication & Security**
• [API A]: ✅ [auth method] → [security implication]
• [API B]: ✅ [auth method] → [security implication]

**Performance & Limits**
• [API A]: [rate limits/latency] → [performance implication]
• [API B]: ✅ [rate limits/latency] → [performance implication]

**Data & Integration**
• [API A]: ✅ [formats/features] → [integration implication]
• [API B]: ❌ [limitations] → [integration implication]

**Recommendation**
👉 Choose [API A] if [specific requirement/use case].
👉 Choose [API B] if [specific requirement/use case].`,

		SAAS: `**Executive Summary**
➡️ [SaaS A] is stronger for [use case], [SaaS B] is better for [use case].

**Core Features & Integrations**
• [SaaS A]: ✅ [key features] → [business implication]
• [SaaS B]: ✅ [key features] → [business implication]

**Reliability & Security**
• [SaaS A]: ✅ [SLA/compliance] → [reliability implication]
• [SaaS B]: ❌ [limitations] → [risk implication]

**Pricing & Scalability**
• [SaaS A]: [pricing model] → [cost implication]
• [SaaS B]: ✅ [pricing advantage] → [cost implication]

**Recommendation**
👉 [SaaS A] for [target organization/use case].
👉 [SaaS B] for [target organization/use case].`,

		GENERAL: `**Executive Summary**
➡️ [Option A] excels at [strength], while [Option B] is better for [strength].

**Key Differentiators**
• [Option A]: ✅ [key advantage] → [practical implication]
• [Option B]: ✅ [key advantage] → [practical implication]

**Performance Comparison**
• [Option A]: [performance metric] → [business impact]
• [Option B]: ✅ [performance metric] → [business impact]

**Cost & Implementation**
• [Option A]: [cost/complexity factor] → [decision implication]
• [Option B]: ✅ [cost/complexity factor] → [decision implication]

**Recommendation**
👉 Choose [Option A] for [use case scenario].
👉 Choose [Option B] for [use case scenario].`
	};
	
	return templates[domain as keyof typeof templates] || templates.GENERAL;
}

export async function POST(req: Request) {
	try {
		const body = await req.json();
		const { runId, message } = body;
		
		if (!runId) return NextResponse.json({ error: 'runId required' }, { status: 400 });
		if (!message) return NextResponse.json({ error: 'message required' }, { status: 400 });
		
		const supa = getSupabaseAdmin();
		
		// 1. Verificare che il run sia completato e abbia risultati
		const { data: runData, error: runError } = await supa
			.from('runs')
			.select('status')
			.eq('id', runId)
			.maybeSingle();
		
		if (runError || !runData) {
			return NextResponse.json({ error: 'Run not found' }, { status: 404 });
		}
		
		if (runData.status !== 'READY') {
			return NextResponse.json({ error: 'Run not completed yet' }, { status: 400 });
		}
		
		// 2. Recuperare la tabella di risultati
		const { data: resultData, error: resultError } = await supa
			.from('results')
			.select('columns, rows')
			.eq('run_id', runId)
			.maybeSingle();
		
		if (resultError || !resultData) {
			return NextResponse.json({ error: 'Results not found' }, { status: 404 });
		}
		
		// 3. Build table structure from columns and rows
		const tableData = {
			columns: resultData.columns || [],
			rows: resultData.rows || []
		};
		
		// 4. Salvare il messaggio dell'utente
		await supa.from('messages').insert({
			run_id: runId,
			role: 'user',
			content: message
		});
		
		// 5. Detect domain from table data and prepare context
		const tableContext = JSON.stringify(tableData, null, 2);
		
		// Detect domain from table structure
		const domain = detectDomainFromTable(tableData);
		const domainProfile = getDomainProfile(domain);
		
		// 6. Chiamare OpenAI per la risposta con domain-specific intelligence
		const systemPrompt = `You are an expert ${domain} specialist providing concise, professional technical comparisons.

**EXPERTISE**: ${domainProfile.expertise}

**RESPONSE FORMAT** (MANDATORY):
1. **Executive Summary** (1 sentence): Who wins in which scenario
2. **3 Comparison Blocks Max**: Group related specs into logical categories
3. **Professional Terminology**: Use technical language, not casual terms
4. **Clear Recommendations**: End with practical choice guidance

**FORMATTING RULES**:
- Use ✅/❌ indicators for advantages/disadvantages
- Keep bullet points short (max 15 words)
- Include specific technical values from the data
- Use arrows (→) to show implications
- End with 👉 recommendation format

**COMPARISON DATA**:
${tableContext}

**${domain.toUpperCase()} RESPONSE TEMPLATE**:
${getResponseTemplate(domain)}

**CRITICAL**: Be concise, technical, and actionable. No lengthy explanations.`;

		const completion = await openai.chat.completions.create({
			model: ENV.openaiModel,
			messages: [
				{ role: 'system', content: systemPrompt },
				{ role: 'user', content: message }
			],
			temperature: 0.2,
			max_tokens: 800,
			top_p: 0.9
		});
		
		const reply = completion.choices[0]?.message?.content || 'Sorry, I could not generate a response.';
		
		// 7. Salvare la risposta dell'assistente
		await supa.from('messages').insert({
			run_id: runId,
			role: 'assistant',
			content: reply
		});
		
		return NextResponse.json({ reply });
		
	} catch (e: any) {
		console.error('❌ QnA endpoint error:', e);
		return NextResponse.json({ error: e.message || 'Internal error' }, { status: 503 });
	}
}

// Endpoint per recuperare la cronologia dei messaggi
export async function GET(req: Request) {
	try {
		const { searchParams } = new URL(req.url);
		const runId = searchParams.get('runId');
		
		if (!runId) return NextResponse.json({ error: 'runId required' }, { status: 400 });
		
		const supa = getSupabaseAdmin();
		
		const { data, error } = await supa
			.from('messages')
			.select('*')
			.eq('run_id', runId)
			.order('created_at', { ascending: true });
		
		if (error) {
			console.error('❌ Error fetching messages:', error);
			return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 });
		}
		
		return NextResponse.json({ messages: data || [] });
		
	} catch (e: any) {
		console.error('❌ Messages endpoint error:', e);
		return NextResponse.json({ error: e.message || 'Internal error' }, { status: 503 });
	}
}

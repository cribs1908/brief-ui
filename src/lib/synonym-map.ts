import { getSupabaseAdmin } from './supabase';

export interface SynonymEntry {
	id: string;
	fieldId: string;
	variants: string[];
	score: number;
	workspaceId?: string; // null = global
	createdAt: Date;
	updatedAt: Date;
}

export interface SynonymMapSnapshot {
	workspaceId: string;
	version: string;
	entries: Record<string, string[]>; // fieldId -> variants
	timestamp: Date;
}

export class SynonymMap {
	private workspaceId: string;
	private snapshot: Record<string, string[]> = {};
	private version: string;

	constructor(workspaceId: string, version: string = 'latest') {
		this.workspaceId = workspaceId;
		this.version = version;
	}

	// Carica snapshot della synonym map per questo workspace
	async loadSnapshot(): Promise<void> {
		const supa = getSupabaseAdmin();
		
		// Load workspace-specific synonyms
		const { data: workspaceSyns } = await supa
			.from('synonyms_workspace')
			.select('field_id, variants, score')
			.eq('workspace_id', this.workspaceId);

		// Load global synonyms
		const { data: globalSyns } = await supa
			.from('synonyms_global')
			.select('field_id, variants, score');

		this.snapshot = {};

		// Merge global first, then workspace (workspace overrides global)
		for (const syn of globalSyns || []) {
			this.snapshot[syn.field_id] = syn.variants || [];
		}

		for (const syn of workspaceSyns || []) {
			this.snapshot[syn.field_id] = [
				...(this.snapshot[syn.field_id] || []),
				...(syn.variants || [])
			].filter((v, i, arr) => arr.indexOf(v) === i); // dedupe
		}
	}

	// Trova field ID canonico dato un termine
	findCanonicalField(term: string): string | null {
		const termLower = term.toLowerCase().trim();
		
		for (const [fieldId, variants] of Object.entries(this.snapshot)) {
			// Exact match con field ID
			if (fieldId.toLowerCase() === termLower) return fieldId;
			
			// Match con varianti
			if (variants.some(v => v.toLowerCase() === termLower)) return fieldId;
			
			// Fuzzy match (substring)
			if (variants.some(v => v.toLowerCase().includes(termLower) || termLower.includes(v.toLowerCase()))) {
				return fieldId;
			}
		}

		return null;
	}

	// Suggerisci field ID basato su similarità
	suggestFields(term: string, limit: number = 3): Array<{ fieldId: string; score: number }> {
		const termLower = term.toLowerCase().trim();
		const suggestions: Array<{ fieldId: string; score: number }> = [];

		for (const [fieldId, variants] of Object.entries(this.snapshot)) {
			let maxScore = 0;

			// Score per field ID
			maxScore = Math.max(maxScore, this.calculateSimilarity(termLower, fieldId.toLowerCase()));

			// Score per varianti
			for (const variant of variants) {
				maxScore = Math.max(maxScore, this.calculateSimilarity(termLower, variant.toLowerCase()));
			}

			if (maxScore > 0.3) { // Threshold minimo
				suggestions.push({ fieldId, score: maxScore });
			}
		}

		return suggestions
			.sort((a, b) => b.score - a.score)
			.slice(0, limit);
	}

	// Calcola similarità Levenshtein semplificata
	private calculateSimilarity(a: string, b: string): number {
		if (a === b) return 1.0;
		if (a.includes(b) || b.includes(a)) return 0.8;
		
		const maxLen = Math.max(a.length, b.length);
		if (maxLen === 0) return 1.0;
		
		const distance = this.levenshteinDistance(a, b);
		return 1 - (distance / maxLen);
	}

	private levenshteinDistance(a: string, b: string): number {
		const matrix = [];
		for (let i = 0; i <= b.length; i++) {
			matrix[i] = [i];
		}
		for (let j = 0; j <= a.length; j++) {
			matrix[0][j] = j;
		}
		for (let i = 1; i <= b.length; i++) {
			for (let j = 1; j <= a.length; j++) {
				if (b.charAt(i - 1) === a.charAt(j - 1)) {
					matrix[i][j] = matrix[i - 1][j - 1];
				} else {
					matrix[i][j] = Math.min(
						matrix[i - 1][j - 1] + 1,
						matrix[i][j - 1] + 1,
						matrix[i - 1][j] + 1
					);
				}
			}
		}
		return matrix[b.length][a.length];
	}

	// Registra un match di successo (rinforza sinonimo)
	async recordMatchSuccess(fieldId: string, term: string): Promise<void> {
		await this.updateSynonym(fieldId, term, 'match_success');
	}

	// Registra un override applicato (nuovo mapping forte)
	async recordOverride(fieldId: string, term: string): Promise<void> {
		await this.updateSynonym(fieldId, term, 'override_applied');
	}

	// Registra un candidato visto (propone variante debole)
	async recordCandidateSeen(fieldId: string, term: string): Promise<void> {
		await this.updateSynonym(fieldId, term, 'candidate_seen');
	}

	private async updateSynonym(fieldId: string, term: string, action: 'match_success' | 'override_applied' | 'candidate_seen'): Promise<void> {
		const supa = getSupabaseAdmin();
		const termLower = term.toLowerCase().trim();

		// Check if workspace synonym exists
		const { data: existing } = await supa
			.from('synonyms_workspace')
			.select('*')
			.eq('workspace_id', this.workspaceId)
			.eq('field_id', fieldId)
			.maybeSingle();

		let newVariants: string[];
		let newScore: number;

		if (existing) {
			newVariants = [...(existing.variants || [])];
			if (!newVariants.includes(termLower)) {
				newVariants.push(termLower);
			}
			
			// Update score based on action
			switch (action) {
				case 'match_success':
					newScore = Math.min(1.0, existing.score + 0.1);
					break;
				case 'override_applied':
					newScore = Math.min(1.0, existing.score + 0.3);
					break;
				case 'candidate_seen':
					newScore = Math.min(1.0, existing.score + 0.05);
					break;
			}

			await supa
				.from('synonyms_workspace')
				.update({
					variants: newVariants,
					score: newScore,
					updated_at: new Date().toISOString()
				})
				.eq('id', existing.id);
		} else {
			// Create new synonym entry
			newVariants = [termLower];
			switch (action) {
				case 'match_success':
					newScore = 0.7;
					break;
				case 'override_applied':
					newScore = 0.9;
					break;
				case 'candidate_seen':
					newScore = 0.3;
					break;
			}

			await supa
				.from('synonyms_workspace')
				.insert({
					workspace_id: this.workspaceId,
					field_id: fieldId,
					variants: newVariants,
					score: newScore
				});
		}

		// Consider promoting to global if score is high enough and seen across workspaces
		if (newScore >= 0.8) {
			await this.considerGlobalPromotion(fieldId, termLower);
		}
	}

	private async considerGlobalPromotion(fieldId: string, term: string): Promise<void> {
		const supa = getSupabaseAdmin();

		// Check how many workspaces have this synonym
		const { data: workspaceCount } = await supa
			.from('synonyms_workspace')
			.select('workspace_id')
			.eq('field_id', fieldId)
			.contains('variants', [term]);

		// Promote to global if seen in 3+ workspaces
		if (workspaceCount && workspaceCount.length >= 3) {
			const { data: globalEntry } = await supa
				.from('synonyms_global')
				.select('*')
				.eq('field_id', fieldId)
				.maybeSingle();

			if (globalEntry) {
				const variants = [...(globalEntry.variants || [])];
				if (!variants.includes(term)) {
					variants.push(term);
					await supa
						.from('synonyms_global')
						.update({
							variants,
							score: Math.min(1.0, globalEntry.score + 0.2),
							updated_at: new Date().toISOString()
						})
						.eq('id', globalEntry.id);
				}
			} else {
				await supa
					.from('synonyms_global')
					.insert({
						field_id: fieldId,
						variants: [term],
						score: 0.8
					});
			}
		}
	}

	// Ottieni snapshot corrente
	getSnapshot(): SynonymMapSnapshot {
		return {
			workspaceId: this.workspaceId,
			version: this.version,
			entries: { ...this.snapshot },
			timestamp: new Date()
		};
	}
}

// Factory per creare SynonymMap
export async function createSynonymMap(workspaceId: string): Promise<SynonymMap> {
	const map = new SynonymMap(workspaceId);
	await map.loadSnapshot();
	return map;
}

// Seed initial synonyms per domain
export async function seedDomainSynonyms(workspaceId: string, domain: string): Promise<void> {
	const supa = getSupabaseAdmin();

	const domainSeeds: Record<string, Record<string, string[]>> = {
		'SaaS': {
			'pricing': ['price', 'cost', 'fee', 'rate', 'charge'],
			'api_latency': ['latency', 'response_time', 'delay', 'lag'],
			'sla': ['uptime', 'availability', 'service_level'],
			'security': ['security_score', 'security_rating', 'sec_score'],
			'auth_type': ['authentication', 'auth', 'login_method'],
			'onboarding': ['setup_time', 'implementation', 'go_live'],
			'nps': ['nps_score', 'satisfaction', 'customer_satisfaction']
		},
		'API': {
			'rate_limit': ['rate_limiting', 'throttling', 'request_limit'],
			'auth_type': ['authentication', 'auth_method', 'security'],
			'response_format': ['format', 'output_format', 'data_format'],
			'documentation': ['docs', 'api_docs', 'documentation_quality'],
			'sdk_support': ['sdks', 'libraries', 'client_libraries']
		},
		'Chip': {
			'voltage': ['vdd', 'supply_voltage', 'operating_voltage', 'v_supply'],
			'current': ['idd', 'supply_current', 'operating_current', 'i_supply'],
			'frequency': ['freq', 'clock', 'operating_frequency', 'max_freq'],
			'power': ['power_consumption', 'power_draw', 'p_total'],
			'temperature': ['temp_range', 'operating_temp', 'ambient_temp'],
			'package': ['packaging', 'form_factor', 'pin_count']
		}
	};

	const seeds = domainSeeds[domain];
	if (!seeds) return;

	for (const [fieldId, variants] of Object.entries(seeds)) {
		const { data: existing } = await supa
			.from('synonyms_workspace')
			.select('id')
			.eq('workspace_id', workspaceId)
			.eq('field_id', fieldId)
			.maybeSingle();

		if (!existing) {
			await supa
				.from('synonyms_workspace')
				.insert({
					workspace_id: workspaceId,
					field_id: fieldId,
					variants,
					score: 0.6 // Seed score
				});
		}
	}
}

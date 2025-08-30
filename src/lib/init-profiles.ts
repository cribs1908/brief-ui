// Load environment variables
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { getSupabaseAdmin } from './supabase';
import { DOMAIN_PROFILES } from './profiles';

/**
 * Inizializza i profili di dominio nel database
 * Da eseguire una volta per popolare la tabella profiles
 */
export async function initializeProfiles(): Promise<void> {
	const supa = getSupabaseAdmin();

	for (const profile of Object.values(DOMAIN_PROFILES)) {
		// Check if profile already exists
		const { data: existing } = await supa
			.from('profiles')
			.select('id')
			.eq('domain', profile.domain)
			.eq('version', profile.version)
			.maybeSingle();

		if (!existing) {
			await supa
				.from('profiles')
				.insert({
					domain: profile.domain,
					version: profile.version,
					schema: profile.schema,
					units: profile.units,
					rules: profile.rules,
					synonyms_seed: profile.synonymsSeed
				});
			
			console.log(`✅ Profile initialized: ${profile.domain} v${profile.version}`);
		} else {
			console.log(`⏭️  Profile exists: ${profile.domain} v${profile.version}`);
		}
	}
}

/**
 * Crea workspace demo se non esiste
 */
export async function ensureDemoWorkspace(): Promise<string> {
	const supa = getSupabaseAdmin();
	const workspaceId = 'ws-demo';

	const { data: existing } = await supa
		.from('workspaces')
		.select('id')
		.eq('id', workspaceId)
		.maybeSingle();

	if (!existing) {
		await supa
			.from('workspaces')
			.insert({
				id: workspaceId,
				name: 'Demo Workspace',
				plan: 'pro',
				owner_id: null
			});
		
		console.log('✅ Demo workspace created');
	}

	return workspaceId;
}

// Script di inizializzazione
if (require.main === module) {
	(async () => {
		try {
			console.log('🚀 Initializing Brief AI profiles...');
			await ensureDemoWorkspace();
			await initializeProfiles();
			console.log('✅ Initialization complete!');
		} catch (error) {
			console.error('❌ Initialization failed:', error);
			process.exit(1);
		}
	})();
}

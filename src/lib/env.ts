export function requireEnv(name: string): string {
	const v = process.env[name];
	if (!v) throw new Error(`Missing env ${name}`);
	return v;
}

export const ENV = {
	// Supabase (invariato)
	supabaseUrl: process.env.SUPABASE_URL,
	supabaseAnon: process.env.SUPABASE_ANON_KEY,
	supabaseService: process.env.SUPABASE_SERVICE_ROLE_KEY,
	bucket: process.env.SUPABASE_STORAGE_BUCKET || 'specsheets',
	
	// OpenAI (semplificato - solo mini model)
	openaiKey: process.env.OPENAI_API_KEY,
	openaiModel: process.env.OPENAI_MODEL || 'gpt-4o-mini',
	
	// Mistral AI OCR
	mistralApiKey: process.env.MISTRAL_API_KEY,
	
	// Worker esterno per processing
	workerBaseUrl: process.env.WORKER_BASE_URL || 'http://localhost:3001',
	
	// Clerk (invariato)
	clerkPublishableKey: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
	clerkSecretKey: process.env.CLERK_SECRET_KEY,
	
	// Limiti configurabili
	maxFilesPerRun: parseInt(process.env.MAX_FILES_PER_RUN || '4'),
	maxPagesPerPdf: parseInt(process.env.MAX_PAGES_PER_PDF || '120'),
	maxMbPerPdf: parseInt(process.env.MAX_MB_PER_PDF || '30'),
};

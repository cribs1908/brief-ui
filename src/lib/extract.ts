import OpenAI from 'openai';
import { ENV } from './env';

const openai = new OpenAI({ apiKey: ENV.openaiKey });

export interface FieldExtraction {
	fieldId: string;
	value: string;
	unit?: string;
	confidence: number;
	provenance: { page: number; bbox?: number[]; method: 'mistral_ocr'; documentId?: string };
}

export async function extractFields(
	domain: string, 
	ocrTexts: { page: number; text: string; documentId?: string }[],
	synonymSnapshot?: Record<string, string[]>
): Promise<FieldExtraction[]> {
	
	// Build domain-specific system prompt
	const domainFields = getDomainFields(domain);
	const synonymContext = synonymSnapshot ? buildSynonymContext(synonymSnapshot) : '';
	
	const sys = `You are an expert technical specification extractor specializing in ${domain} documents.

TARGET FIELDS TO EXTRACT:
${domainFields}

${synonymContext}

EXTRACTION STRATEGY FOR MARKDOWN-FORMATTED DOCUMENTS:
1. **STRUCTURED ANALYSIS**: The text is in markdown format with tables, headers, and formatted sections
2. **TABLE PRIORITY**: Focus on markdown tables and specification sections
3. **ELECTRICAL CHARACTERISTICS**: Look for "Electrical Characteristics", "Specifications", "Parameters" sections
4. **HANDLE RANGES**: For ranges like "3.0 - 5.5V" or "min 2.0, typ 3.3, max 5.0", extract the typical or mid-range value
5. **UNIT EXTRACTION**: Always capture the unit (V, A, mA, MHz, °C, etc.)
6. **CONFIDENCE SCORING**: 
   - 0.9-1.0: Clear table entry or specification box
   - 0.7-0.8: Clear text statement  
   - 0.5-0.6: Inferred from context
   - Below 0.5: Don't extract

RESPONSE FORMAT - STRICT JSON ARRAY:
[
  {
    "fieldId": "supply_voltage", 
    "value": "3.3", 
    "unit": "V", 
    "confidence": 0.9, 
    "provenance": {"page": 1, "method": "mistral_ocr", "documentId": "doc-id"}
  }
]

CRITICAL: Return ONLY valid JSON array, no markdown formatting, no explanations.`;

	const userData = {
		ocrTexts: ocrTexts.map(t => ({
			page: t.page,
			text: t.text.slice(0, 8000), // Increased limit since Mistral OCR gives cleaner structured text
			documentId: t.documentId
		}))
	};
	
	const user = JSON.stringify(userData);
	
	const res = await openai.chat.completions.create({
		model: ENV.openaiModel || 'gpt-4o-mini',
		messages: [ 
			{ role: 'system', content: sys }, 
			{ role: 'user', content: user } 
		],
		temperature: 0.1, // Lower temperature for more consistent extraction
		max_tokens: 4000,
	});
	
	const txt = res.choices[0]?.message?.content || '[]';
	
	try { 
		const parsed = JSON.parse(txt) as FieldExtraction[]; 
		return parsed.filter(item => 
			item.fieldId && 
			item.value && 
			typeof item.confidence === 'number' &&
			item.confidence >= 0.1 && 
			item.confidence <= 1.0
		);
	} catch (error) {
		console.error('Failed to parse LLM response:', txt);
		return []; 
	}
}

function getDomainFields(domain: string): string {
	const fieldDefs: Record<string, string> = {
		'SaaS': `
- pricing: Monthly/annual cost (with currency unit)
- api_latency: API response time (ms, s)
- sla: Service level uptime (%)
- security_rating: Security score (1-10)
- auth_type: Authentication method (OAuth 2.0, API Key, etc.)
- onboarding_time: Setup/implementation time (days, weeks, months)
- nps_score: Net Promoter Score (-100 to 100)`,
		
		'API': `
- rate_limit: Request rate limits (req/min, req/hour)
- auth_type: Authentication method (OAuth 2.0, API Key, Basic, JWT)
- response_format: Response format (JSON, XML, CSV)
- max_payload: Maximum payload size (MB, KB, GB)
- timeout: Request timeout (s, ms)`,
		
		'Chip': `
- supply_voltage: Supply voltage VCC/VDD (V, mV) - look for "Supply Voltage", "VCC", "VDD", "Input Voltage"
- supply_current: Supply current ICC (A, mA, μA) - look for "Supply Current", "ICC", "IDD", "Quiescent Current"
- input_voltage_range: Input voltage range (V) - look for "Input Voltage Range", "VIN", "Operating Voltage Range"
- output_voltage: Output voltage (V, mV) - look for "Output Voltage", "VOUT", "Regulated Voltage"
- output_current: Output current capability (A, mA) - look for "Output Current", "IOUT", "Load Current", "Current Limit"
- frequency: Clock/switching frequency (Hz, kHz, MHz, GHz) - look for "Frequency", "Clock", "Switching Freq", "FSW"
- power_consumption: Power consumption (W, mW, μW) - look for "Power", "Power Consumption", "Power Dissipation"
- efficiency: Efficiency (%) - look for "Efficiency", "η", "Power Efficiency"
- temperature_range: Operating temperature (°C, K) - look for "Operating Temperature", "Ambient Temperature", "TA"
- package_type: Package type (text) - look for "Package", "Pinout", "Form Factor", "Housing"
- dropout_voltage: Dropout voltage for LDOs (V, mV) - look for "Dropout", "VDO", "Dropout Voltage"
- bandwidth: Gain bandwidth (Hz, MHz, GHz) - look for "Bandwidth", "GBW", "Gain Bandwidth"`
	};
	
	return fieldDefs[domain] || fieldDefs['SaaS'];
}

function buildSynonymContext(synonymSnapshot: Record<string, string[]>): string {
	if (Object.keys(synonymSnapshot).length === 0) return '';
	
	const synonymLines = Object.entries(synonymSnapshot)
		.slice(0, 10) // Limit to avoid token overflow
		.map(([fieldId, variants]) => 
			`- ${fieldId}: also called ${variants.slice(0, 5).join(', ')}`
		);
	
	return `\nKNOWN SYNONYMS:\n${synonymLines.join('\n')}\n`;
}

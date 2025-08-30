import { ExtractionRaw, ExtractionNorm } from './types';

export interface NormalizerResult {
	value: string;
	unit?: string;
	note?: string;
	flags?: string[];
	confidence: number;
}

// Mappatura unità standard
const UNIT_MAPPINGS: Record<string, string> = {
	// Current
	'mA': 'A',
	'milliamp': 'A',
	'milliamps': 'A',
	'microamp': 'A',
	'uA': 'A',
	
	// Voltage
	'mV': 'V',
	'millivolt': 'V',
	'millivolts': 'V',
	'kV': 'V',
	'kilovolt': 'V',
	
	// Power
	'mW': 'W',
	'milliwatt': 'W',
	'kW': 'W',
	'kilowatt': 'W',
	
	// Frequency
	'MHz': 'Hz',
	'megahertz': 'Hz',
	'GHz': 'Hz',
	'gigahertz': 'Hz',
	'kHz': 'Hz',
	'kilohertz': 'Hz',
	
	// Time
	'ms': 's',
	'millisecond': 's',
	'milliseconds': 's',
	'us': 's',
	'microsecond': 's',
	'microseconds': 's',
	'ns': 's',
	'nanosecond': 's',
	'nanoseconds': 's',
	
	// Temperature
	'celsius': '°C',
	'fahrenheit': '°F',
	'kelvin': 'K',
	
	// Memory/Storage
	'KB': 'B',
	'MB': 'B',
	'GB': 'B',
	'TB': 'B',
	'kB': 'B',
	'mB': 'B',
	'gB': 'B',
	'tB': 'B',
	'kilobyte': 'B',
	'megabyte': 'B',
	'gigabyte': 'B',
	'terabyte': 'B',
	
	// Rate/Percentage
	'percent': '%',
	'percentage': '%',
	'pct': '%',
	
	// Currency normalization
	'dollar': '$',
	'dollars': '$',
	'USD': '$',
	'euro': '€',
	'euros': '€',
	'EUR': '€',
};

// Range patterns (min/typ/max)
const RANGE_PATTERNS = [
	/(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)/,  // 1.2-3.4
	/(\d+(?:\.\d+)?)\s*to\s*(\d+(?:\.\d+)?)/i,  // 1.2 to 3.4
	/(\d+(?:\.\d+)?)\s*~\s*(\d+(?:\.\d+)?)/,  // 1.2~3.4
	/min:\s*(\d+(?:\.\d+)?),?\s*typ:\s*(\d+(?:\.\d+)?),?\s*max:\s*(\d+(?:\.\d+)?)/i,
	/(\d+(?:\.\d+)?)\s*\(typ\)/i,  // 3.3(typ)
];

// Enum canonicalization
const ENUM_MAPPINGS: Record<string, Record<string, string>> = {
	'auth_type': {
		'oauth2': 'OAuth 2.0',
		'oauth 2': 'OAuth 2.0',
		'oauth2.0': 'OAuth 2.0',
		'oauth 2.0': 'OAuth 2.0',
		'basic auth': 'Basic Authentication',
		'basic': 'Basic Authentication',
		'api key': 'API Key',
		'apikey': 'API Key',
		'bearer': 'Bearer Token',
		'bearer token': 'Bearer Token',
		'jwt': 'JWT',
		'json web token': 'JWT',
	},
	'protocol': {
		'http': 'HTTP',
		'https': 'HTTPS',
		'websocket': 'WebSocket',
		'ws': 'WebSocket',
		'wss': 'WebSocket Secure',
		'rest': 'REST',
		'graphql': 'GraphQL',
		'grpc': 'gRPC',
		'soap': 'SOAP',
	},
	'tier': {
		'free': 'Free',
		'basic': 'Basic',
		'pro': 'Pro',
		'professional': 'Pro',
		'premium': 'Premium',
		'enterprise': 'Enterprise',
		'business': 'Business',
	}
};

export function normalizeValue(raw: ExtractionRaw): NormalizerResult {
	const flags: string[] = [];
	let value = raw.valueRaw.trim();
	let unit = raw.unitRaw?.trim();
	let note: string | undefined;
	let confidence = 0.9; // Base confidence

	// 1. Gestione range
	const rangeMatch = detectRange(value);
	if (rangeMatch) {
		flags.push('range');
		if (rangeMatch.type === 'min-max') {
			value = `${rangeMatch.min}-${rangeMatch.max}`;
			note = `Range: min ${rangeMatch.min}, max ${rangeMatch.max}`;
		} else if (rangeMatch.type === 'typical') {
			value = rangeMatch.typical!;
			note = `Typical value: ${rangeMatch.typical}`;
		}
	}

	// 2. Normalizzazione unità
	if (unit && UNIT_MAPPINGS[unit.toLowerCase()]) {
		const originalUnit = unit;
		unit = UNIT_MAPPINGS[unit.toLowerCase()];
		flags.push('unit_normalized');
		note = note ? `${note}. Unit normalized from ${originalUnit}` : `Unit normalized from ${originalUnit}`;
	}

	// 3. Canonicalization enum
	const enumResult = canonicalizeEnum(value, raw.fieldId);
	if (enumResult.canonical !== value) {
		value = enumResult.canonical;
		flags.push('enum_canonicalized');
		note = note ? `${note}. Canonicalized from ${raw.valueRaw}` : `Canonicalized from ${raw.valueRaw}`;
	}

	// 4. Outlier detection (valori strani)
	if (detectOutlier(value, raw.fieldId)) {
		flags.push('potential_outlier');
		confidence *= 0.7; // Riduce confidenza per outlier
	}

	// 5. Ambiguity detection
	if (detectAmbiguity(raw.valueRaw)) {
		flags.push('ambiguous');
		confidence *= 0.8;
	}

	return {
		value,
		unit,
		note,
		flags: flags.length > 0 ? flags : undefined,
		confidence: Math.max(0.1, Math.min(1.0, confidence))
	};
}

interface RangeMatch {
	type: 'min-max' | 'typical';
	min?: string;
	max?: string;
	typical?: string;
}

function detectRange(value: string): RangeMatch | null {
	// Check for min-max patterns
	for (const pattern of RANGE_PATTERNS.slice(0, 3)) {
		const match = value.match(pattern);
		if (match) {
			return {
				type: 'min-max',
				min: match[1],
				max: match[2]
			};
		}
	}

	// Check for min/typ/max pattern
	const minTypMaxMatch = value.match(RANGE_PATTERNS[3]);
	if (minTypMaxMatch) {
		return {
			type: 'min-max',
			min: minTypMaxMatch[1],
			max: minTypMaxMatch[3]
		};
	}

	// Check for typical pattern
	const typMatch = value.match(RANGE_PATTERNS[4]);
	if (typMatch) {
		return {
			type: 'typical',
			typical: typMatch[1]
		};
	}

	return null;
}

function canonicalizeEnum(value: string, fieldId: string): { canonical: string } {
	const lowerValue = value.toLowerCase();
	
	// Try exact field mapping first
	if (ENUM_MAPPINGS[fieldId]?.[lowerValue]) {
		return { canonical: ENUM_MAPPINGS[fieldId][lowerValue] };
	}

	// Try general mappings
	for (const category of Object.values(ENUM_MAPPINGS)) {
		if (category[lowerValue]) {
			return { canonical: category[lowerValue] };
		}
	}

	return { canonical: value };
}

function detectOutlier(value: string, fieldId: string): boolean {
	// Semplice outlier detection per valori numerici
	const numMatch = value.match(/^(\d+(?:\.\d+)?)/);
	if (!numMatch) return false;
	
	const num = parseFloat(numMatch[1]);
	
	// Regole specifiche per campo
	if (fieldId.includes('voltage') && (num > 1000 || num < 0)) return true;
	if (fieldId.includes('current') && (num > 100 || num < 0)) return true;
	if (fieldId.includes('frequency') && (num > 10000000000 || num < 0)) return true;
	if (fieldId.includes('price') && (num > 100000 || num < 0)) return true;
	
	return false;
}

function detectAmbiguity(value: string): boolean {
	// Detect ambiguous values
	const ambiguousPatterns = [
		/tbd|tba|n\/a|unknown|varies|depends/i,
		/\?|\.\.\.|\.\.\.|pending/i,
		/contact|call|inquire/i
	];
	
	return ambiguousPatterns.some(pattern => pattern.test(value));
}

export async function normalizeExtractions(rawExtractions: ExtractionRaw[]): Promise<ExtractionNorm[]> {
	const normalized: ExtractionNorm[] = [];
	
	for (const raw of rawExtractions) {
		const result = normalizeValue(raw);
		
		normalized.push({
			id: require('crypto').randomUUID(),
			documentId: raw.documentId,
			fieldId: raw.fieldId,
			value: result.value,
			unit: result.unit,
			note: result.note,
			flags: result.flags,
			provenanceRef: raw.id,
			confidence: result.confidence
		});
	}
	
	return normalized;
}

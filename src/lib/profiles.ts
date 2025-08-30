export interface DomainProfile {
	id: string;
	domain: string;
	version: string;
	schema: Record<string, FieldSchema>;
	units: Record<string, string[]>; // fieldId -> accepted units
	rules: ProfileRule[];
	synonymsSeed: Record<string, string[]>;
}

export interface FieldSchema {
	id: string;
	name: string;
	type: 'number' | 'string' | 'enum' | 'range' | 'currency' | 'boolean';
	required: boolean;
	units?: string[];
	enums?: string[];
	validation?: {
		min?: number;
		max?: number;
		pattern?: string;
	};
	description?: string;
}

export interface ProfileRule {
	id: string;
	type: 'validation' | 'normalization' | 'extraction';
	condition: string;
	action: string;
	priority: number;
}

// Pre-defined domain profiles
export const DOMAIN_PROFILES: Record<string, DomainProfile> = {
	'SaaS': {
		id: 'saas-v1',
		domain: 'SaaS',
		version: '1.0',
		schema: {
			'pricing': {
				id: 'pricing',
				name: 'Pricing',
				type: 'currency',
				required: true,
				units: ['$', '€', '£'],
				description: 'Monthly or annual subscription cost'
			},
			'api_latency': {
				id: 'api_latency',
				name: 'API Latency',
				type: 'number',
				required: false,
				units: ['ms', 's'],
				validation: { min: 0, max: 10000 },
				description: 'Average API response time'
			},
			'sla': {
				id: 'sla',
				name: 'SLA Uptime',
				type: 'number',
				required: false,
				units: ['%'],
				validation: { min: 0, max: 100 },
				description: 'Service Level Agreement uptime percentage'
			},
			'security_rating': {
				id: 'security_rating',
				name: 'Security Rating',
				type: 'number',
				required: false,
				validation: { min: 1, max: 10 },
				description: 'Security compliance score (1-10)'
			},
			'auth_type': {
				id: 'auth_type',
				name: 'Authentication Type',
				type: 'enum',
				required: false,
				enums: ['OAuth 2.0', 'API Key', 'Basic Authentication', 'JWT', 'Bearer Token'],
				description: 'Supported authentication methods'
			},
			'onboarding_time': {
				id: 'onboarding_time',
				name: 'Onboarding Time',
				type: 'number',
				required: false,
				units: ['days', 'weeks', 'months'],
				description: 'Time to complete setup and go-live'
			},
			'nps_score': {
				id: 'nps_score',
				name: 'NPS Score',
				type: 'number',
				required: false,
				validation: { min: -100, max: 100 },
				description: 'Net Promoter Score'
			}
		},
		units: {
			'pricing': ['$', '€', '£', 'USD', 'EUR', 'GBP'],
			'api_latency': ['ms', 's', 'milliseconds', 'seconds'],
			'sla': ['%', 'percent', 'percentage'],
			'onboarding_time': ['days', 'weeks', 'months', 'd', 'w', 'm']
		},
		rules: [
			{
				id: 'price-validation',
				type: 'validation',
				condition: 'field.id === "pricing" && value > 10000',
				action: 'flag_as_outlier',
				priority: 1
			},
			{
				id: 'sla-normalize',
				type: 'normalization',
				condition: 'field.id === "sla" && unit !== "%"',
				action: 'convert_to_percentage',
				priority: 2
			}
		],
		synonymsSeed: {
			'pricing': ['price', 'cost', 'fee', 'rate', 'charge', 'subscription'],
			'api_latency': ['latency', 'response_time', 'delay', 'lag', 'speed'],
			'sla': ['uptime', 'availability', 'service_level', 'reliability'],
			'security_rating': ['security', 'sec_score', 'compliance', 'security_score'],
			'auth_type': ['authentication', 'auth', 'login', 'access_control'],
			'onboarding_time': ['setup', 'implementation', 'go_live', 'deployment'],
			'nps_score': ['nps', 'satisfaction', 'customer_satisfaction', 'rating']
		}
	},

	'API': {
		id: 'api-v1',
		domain: 'API',
		version: '1.0',
		schema: {
			'rate_limit': {
				id: 'rate_limit',
				name: 'Rate Limit',
				type: 'number',
				required: false,
				units: ['req/min', 'req/hour', 'req/day'],
				description: 'Maximum requests per time period'
			},
			'auth_type': {
				id: 'auth_type',
				name: 'Authentication',
				type: 'enum',
				required: true,
				enums: ['OAuth 2.0', 'API Key', 'Basic', 'JWT', 'Bearer'],
				description: 'Authentication method'
			},
			'response_format': {
				id: 'response_format',
				name: 'Response Format',
				type: 'enum',
				required: false,
				enums: ['JSON', 'XML', 'CSV', 'HTML', 'Plain Text'],
				description: 'API response data format'
			},
			'max_payload': {
				id: 'max_payload',
				name: 'Max Payload Size',
				type: 'number',
				required: false,
				units: ['MB', 'KB', 'GB'],
				description: 'Maximum request payload size'
			},
			'timeout': {
				id: 'timeout',
				name: 'Timeout',
				type: 'number',
				required: false,
				units: ['s', 'ms'],
				validation: { min: 0, max: 300 },
				description: 'Request timeout period'
			}
		},
		units: {
			'rate_limit': ['req/min', 'req/hour', 'req/day', 'requests/minute'],
			'max_payload': ['MB', 'KB', 'GB', 'bytes'],
			'timeout': ['s', 'ms', 'seconds', 'milliseconds']
		},
		rules: [],
		synonymsSeed: {
			'rate_limit': ['rate_limiting', 'throttling', 'request_limit', 'quota'],
			'auth_type': ['authentication', 'security', 'access_method'],
			'response_format': ['format', 'output', 'data_format', 'content_type'],
			'max_payload': ['payload_size', 'request_size', 'body_limit'],
			'timeout': ['response_timeout', 'request_timeout', 'deadline']
		}
	},

	'Chip': {
		id: 'chip-v1',
		domain: 'Chip',
		version: '1.0',
		schema: {
			'supply_voltage': {
				id: 'supply_voltage',
				name: 'Supply Voltage',
				type: 'range',
				required: true,
				units: ['V', 'mV'],
				validation: { min: 0, max: 50 },
				description: 'Operating supply voltage range'
			},
			'supply_current': {
				id: 'supply_current',
				name: 'Supply Current',
				type: 'range',
				required: true,
				units: ['A', 'mA', 'μA'],
				validation: { min: 0, max: 10 },
				description: 'Operating supply current'
			},
			'frequency': {
				id: 'frequency',
				name: 'Operating Frequency',
				type: 'range',
				required: false,
				units: ['Hz', 'kHz', 'MHz', 'GHz'],
				validation: { min: 0 },
				description: 'Maximum operating frequency'
			},
			'power_consumption': {
				id: 'power_consumption',
				name: 'Power Consumption',
				type: 'number',
				required: false,
				units: ['W', 'mW', 'μW'],
				validation: { min: 0 },
				description: 'Typical power consumption'
			},
			'temperature_range': {
				id: 'temperature_range',
				name: 'Operating Temperature',
				type: 'range',
				required: false,
				units: ['°C', 'K'],
				description: 'Operating temperature range'
			},
			'package_type': {
				id: 'package_type',
				name: 'Package',
				type: 'string',
				required: false,
				description: 'IC package type and pin count'
			}
		},
		units: {
			'supply_voltage': ['V', 'mV', 'volts', 'millivolts'],
			'supply_current': ['A', 'mA', 'μA', 'uA', 'amps', 'milliamps'],
			'frequency': ['Hz', 'kHz', 'MHz', 'GHz', 'hertz'],
			'power_consumption': ['W', 'mW', 'μW', 'uW', 'watts'],
			'temperature_range': ['°C', 'C', 'K', 'celsius', 'kelvin']
		},
		rules: [
			{
				id: 'voltage-range-validation',
				type: 'validation',
				condition: 'field.id === "supply_voltage" && (min < 0 || max > 50)',
				action: 'flag_invalid_range',
				priority: 1
			}
		],
		synonymsSeed: {
			'supply_voltage': ['vdd', 'vcc', 'voltage', 'v_supply', 'operating_voltage'],
			'supply_current': ['idd', 'icc', 'current', 'i_supply', 'operating_current'],
			'frequency': ['freq', 'clock', 'f_max', 'operating_freq', 'clock_freq'],
			'power_consumption': ['power', 'p_total', 'power_draw', 'consumption'],
			'temperature_range': ['temp', 'temperature', 'ambient_temp', 'operating_temp'],
			'package_type': ['package', 'packaging', 'form_factor', 'pin_count']
		}
	}
};

export function getProfile(domain: string): DomainProfile | null {
	return DOMAIN_PROFILES[domain] || null;
}

export function validateFieldValue(
	profile: DomainProfile, 
	fieldId: string, 
	value: string, 
	unit?: string
): { valid: boolean; errors: string[] } {
	const field = profile.schema[fieldId];
	if (!field) {
		return { valid: false, errors: [`Unknown field: ${fieldId}`] };
	}

	const errors: string[] = [];

	// Type validation
	if (field.type === 'number' || field.type === 'range') {
		const numValue = parseFloat(value);
		if (isNaN(numValue)) {
			errors.push(`Expected number for ${field.name}, got: ${value}`);
		} else if (field.validation) {
			if (field.validation.min !== undefined && numValue < field.validation.min) {
				errors.push(`${field.name} below minimum (${field.validation.min}): ${numValue}`);
			}
			if (field.validation.max !== undefined && numValue > field.validation.max) {
				errors.push(`${field.name} above maximum (${field.validation.max}): ${numValue}`);
			}
		}
	}

	// Enum validation
	if (field.type === 'enum' && field.enums) {
		if (!field.enums.includes(value)) {
			errors.push(`Invalid enum value for ${field.name}: ${value}. Expected: ${field.enums.join(', ')}`);
		}
	}

	// Unit validation
	if (unit && field.units && !field.units.includes(unit)) {
		const profileUnits = profile.units[fieldId] || field.units;
		if (!profileUnits.includes(unit)) {
			errors.push(`Invalid unit for ${field.name}: ${unit}. Expected: ${profileUnits.join(', ')}`);
		}
	}

	// Pattern validation
	if (field.validation?.pattern) {
		const regex = new RegExp(field.validation.pattern);
		if (!regex.test(value)) {
			errors.push(`${field.name} does not match required pattern: ${value}`);
		}
	}

	return { valid: errors.length === 0, errors };
}

export function getRequiredFields(profile: DomainProfile): string[] {
	return Object.entries(profile.schema)
		.filter(([_, field]) => field.required)
		.map(([fieldId, _]) => fieldId);
}

export function getFieldSuggestions(profile: DomainProfile, partialName: string): FieldSchema[] {
	const partial = partialName.toLowerCase();
	return Object.values(profile.schema)
		.filter(field => 
			field.name.toLowerCase().includes(partial) ||
			field.id.toLowerCase().includes(partial) ||
			(profile.synonymsSeed[field.id] || []).some(syn => syn.toLowerCase().includes(partial))
		)
		.sort((a, b) => {
			// Prioritize exact matches
			const aExact = a.name.toLowerCase() === partial || a.id.toLowerCase() === partial;
			const bExact = b.name.toLowerCase() === partial || b.id.toLowerCase() === partial;
			if (aExact && !bExact) return -1;
			if (!aExact && bExact) return 1;
			return a.name.localeCompare(b.name);
		});
}

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
		id: 'api-v2',
		domain: 'API',
		version: '2.0',
		schema: {
			// Core API Information
			'api_name': {
				id: 'api_name',
				name: 'API Name',
				type: 'string',
				required: true,
				description: 'Official API name or service identifier'
			},
			'provider': {
				id: 'provider',
				name: 'Provider',
				type: 'string',
				required: true,
				description: 'Company or organization providing the API'
			},
			'version': {
				id: 'version',
				name: 'API Version',
				type: 'string',
				required: true,
				description: 'API version or protocol version'
			},
			'base_url': {
				id: 'base_url',
				name: 'Base URL',
				type: 'string',
				required: false,
				description: 'API root endpoint URL'
			},
			
			// Authentication & Security
			'auth_type': {
				id: 'auth_type',
				name: 'Authentication Type',
				type: 'enum',
				required: true,
				enums: ['OAuth 2.0', 'API Key', 'Basic Auth', 'JWT', 'Bearer Token', 'Custom Headers'],
				description: 'Primary authentication method'
			},
			'https_required': {
				id: 'https_required',
				name: 'HTTPS Required',
				type: 'boolean',
				required: false,
				description: 'Whether HTTPS/TLS is mandatory'
			},
			'security_headers': {
				id: 'security_headers',
				name: 'Security Headers',
				type: 'string',
				required: false,
				description: 'Required security headers (x-api-version, etc.)'
			},

			// Rate Limits & Performance  
			'rate_limit_minute': {
				id: 'rate_limit_minute',
				name: 'Rate Limit (per minute)',
				type: 'number',
				required: false,
				units: ['req/min'],
				description: 'Maximum requests per minute'
			},
			'rate_limit_hour': {
				id: 'rate_limit_hour',
				name: 'Rate Limit (per hour)',
				type: 'number',
				required: false,
				units: ['req/hour'],
				description: 'Maximum requests per hour'
			},
			'rate_limit_day': {
				id: 'rate_limit_day',
				name: 'Rate Limit (per day)',
				type: 'number',
				required: false,
				units: ['req/day'],
				description: 'Maximum requests per day'
			},
			'timeout': {
				id: 'timeout',
				name: 'Request Timeout',
				type: 'number',
				required: false,
				units: ['s', 'ms'],
				validation: { min: 0, max: 300 },
				description: 'Maximum request timeout period'
			},
			
			// Data Formats & Content
			'request_format': {
				id: 'request_format',
				name: 'Request Format',
				type: 'enum',
				required: false,
				enums: ['JSON', 'XML', 'Form Data', 'Multipart', 'Plain Text'],
				description: 'Accepted request data format'
			},
			'response_format': {
				id: 'response_format',
				name: 'Response Format',
				type: 'enum',
				required: false,
				enums: ['JSON', 'XML', 'CSV', 'HTML', 'Plain Text', 'Binary'],
				description: 'API response data format'
			},
			'content_types': {
				id: 'content_types',
				name: 'Supported Content Types',
				type: 'string',
				required: false,
				description: 'MIME types supported (application/json, video/mp4, etc.)'
			},
			'compression': {
				id: 'compression',
				name: 'Compression Support',
				type: 'enum',
				required: false,
				enums: ['gzip', 'deflate', 'br', 'none'],
				description: 'Supported compression methods'
			},
			'max_payload': {
				id: 'max_payload',
				name: 'Max Payload Size',
				type: 'number',
				required: false,
				units: ['MB', 'KB', 'GB'],
				description: 'Maximum request payload size'
			},

			// HTTP Methods & Operations
			'http_methods': {
				id: 'http_methods',
				name: 'HTTP Methods',
				type: 'string',
				required: false,
				description: 'Supported HTTP methods (GET, POST, PUT, DELETE)'
			},
			'supported_objects': {
				id: 'supported_objects',
				name: 'Supported Objects',
				type: 'string',
				required: false,
				description: 'API objects/resources (Banner, Video, Audio, Native)'
			},

			// Error Handling & Status
			'error_codes': {
				id: 'error_codes',
				name: 'Error Codes',
				type: 'string',
				required: false,
				description: 'HTTP status codes returned (200, 204, 400, 500)'
			},
			'error_format': {
				id: 'error_format',
				name: 'Error Format',
				type: 'enum',
				required: false,
				enums: ['JSON', 'XML', 'Plain Text', 'Custom'],
				description: 'Format of error responses'
			},

			// Compliance & Privacy
			'compliance': {
				id: 'compliance',
				name: 'Compliance',
				type: 'string',
				required: false,
				description: 'Privacy/regulatory compliance (COPPA, GDPR, CCPA)'
			},
			'privacy_features': {
				id: 'privacy_features',
				name: 'Privacy Features',
				type: 'string',
				required: false,
				description: 'Privacy controls (Do Not Track, User Consent, etc.)'
			},

			// Backward Compatibility
			'deprecated_fields': {
				id: 'deprecated_fields',
				name: 'Deprecated Fields',
				type: 'string',
				required: false,
				description: 'Fields deprecated in this version'
			},
			'backward_compatible': {
				id: 'backward_compatible',
				name: 'Backward Compatible',
				type: 'boolean',
				required: false,
				description: 'Compatible with previous API versions'
			}
		},
		units: {
			'rate_limit_minute': ['req/min', 'requests/minute', 'rpm'],
			'rate_limit_hour': ['req/hour', 'requests/hour', 'rph'],
			'rate_limit_day': ['req/day', 'requests/day', 'rpd'],
			'max_payload': ['MB', 'KB', 'GB', 'bytes', 'megabytes', 'kilobytes'],
			'timeout': ['s', 'ms', 'seconds', 'milliseconds']
		},
		rules: [],
		synonymsSeed: {
			// Core API Information
			'api_name': ['name', 'service_name', 'api_title', 'endpoint_name'],
			'provider': ['company', 'vendor', 'organization', 'maintainer'],
			'version': ['api_version', 'protocol_version', 'spec_version', 'v'],
			'base_url': ['endpoint', 'api_root', 'host_url', 'service_url'],

			// Authentication & Security
			'auth_type': ['authentication', 'auth_method', 'security', 'access_control'],
			'https_required': ['tls_required', 'ssl_required', 'secure_transport'],
			'security_headers': ['custom_headers', 'required_headers', 'auth_headers'],

			// Rate Limits & Performance
			'rate_limit_minute': ['rate_limit', 'throttling', 'requests_per_minute', 'rpm'],
			'rate_limit_hour': ['hourly_limit', 'requests_per_hour', 'rph'],
			'rate_limit_day': ['daily_limit', 'requests_per_day', 'rpd', 'quota'],
			'timeout': ['response_timeout', 'request_timeout', 'deadline'],

			// Data Formats & Content
			'request_format': ['input_format', 'request_type', 'payload_format'],
			'response_format': ['output_format', 'return_type', 'response_encoding'],
			'content_types': ['mime_types', 'media_types', 'supported_content', 'data_encoding'],
			'compression': ['encoding', 'data_compression', 'content_encoding'],
			'max_payload': ['payload_size', 'request_size', 'body_limit', 'max_request_size'],

			// HTTP Methods & Operations
			'http_methods': ['methods', 'verbs', 'supported_methods', 'operations'],
			'supported_objects': ['objects', 'resources', 'entities', 'data_types'],

			// Error Handling & Status
			'error_codes': ['status_codes', 'response_codes', 'http_codes'],
			'error_format': ['error_response', 'failure_format', 'error_encoding'],

			// Compliance & Privacy
			'compliance': ['certifications', 'standards', 'regulatory_support'],
			'privacy_features': ['privacy_controls', 'user_consent', 'data_protection'],

			// Backward Compatibility
			'deprecated_fields': ['deprecated', 'legacy_fields', 'obsolete'],
			'backward_compatible': ['compatibility', 'legacy_support', 'version_compatibility']
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

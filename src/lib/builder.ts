import { ExtractionNorm, ResultTable } from './types';
import { DomainProfile, getProfile } from './profiles';
import { getSupabaseAdmin, STORAGE_BUCKET } from './supabase';

export interface TableColumn {
	id: string;
	name: string;
	type: 'spec' | 'document';
	fieldId?: string; // For spec columns
	documentId?: string; // For document columns
}

export interface TableRow {
	id: string;
	fieldId: string;
	fieldName: string;
	values: Record<string, TableCell>; // columnId -> cell
}

export interface TableCell {
	value: string;
	unit?: string;
	confidence: number;
	provenance?: {
		page: number;
		bbox?: number[];
		method: string;
	};
	flags?: string[];
	note?: string;
}

export interface TableHighlights {
	bestValues: Record<string, string>; // fieldId -> columnId
	worstValues: Record<string, string>; // fieldId -> columnId
	outliers: Array<{ fieldId: string; columnId: string; reason: string }>;
}

export interface ExportData {
	csv?: { url: string; expiresAt: Date };
	xlsx?: { url: string; expiresAt: Date };
	json?: { url: string; expiresAt: Date };
}

export class TableBuilder {
	private runId: string;
	private workspaceId: string;
	private domain: string;
	private profile: DomainProfile | null;

	constructor(runId: string, workspaceId: string, domain: string) {
		this.runId = runId;
		this.workspaceId = workspaceId;
		this.domain = domain;
		this.profile = getProfile(domain);
	}

	async buildTable(normalizedExtractions: ExtractionNorm[], documents: any[]): Promise<ResultTable> {
		// 1. Build columns (spec + documents)
		const columns = this.buildColumns(documents);

		// 2. Group extractions by field
		const extractionsByField = this.groupExtractionsByField(normalizedExtractions);

		// 3. Build rows
		const rows = this.buildRows(extractionsByField, columns);

		// 4. Generate highlights
		const highlights = this.generateHighlights(rows);

		// 5. Generate insights
		const insights = this.generateInsights(rows, highlights);

		// 6. Create exports
		const exports = await this.generateExports(columns, rows);

		const result: ResultTable = {
			id: require('crypto').randomUUID(),
			runId: this.runId,
			columns,
			rows,
			highlights,
			insights,
			exports
		};

		return result;
	}

	private buildColumns(documents: any[]): TableColumn[] {
		const columns: TableColumn[] = [];

		// Add spec column
		columns.push({
			id: 'spec',
			name: 'SPEC',
			type: 'spec'
		});

		// Add document columns
		for (const doc of documents) {
			columns.push({
				id: doc.id,
				name: this.extractDocumentName(doc.filename),
				type: 'document',
				documentId: doc.id
			});
		}

		return columns;
	}

	private extractDocumentName(filename: string): string {
		// Extract meaningful name from filename
		let name = String(filename).replace(/\.(pdf|PDF)$/, '');
		
		// Remove common prefixes/suffixes
		name = name.replace(/^(spec|datasheet|manual|guide)[-_\s]/i, '');
		name = name.replace(/[-_\s](spec|datasheet|manual|guide)$/i, '');
		
		// Convert to uppercase and limit length
		name = name.toUpperCase();
		if (name.length > 15) {
			name = name.substring(0, 12) + '...';
		}

		return name || 'DOC';
	}

	private groupExtractionsByField(extractions: ExtractionNorm[]): Record<string, ExtractionNorm[]> {
		const grouped: Record<string, ExtractionNorm[]> = {};
		
		for (const extraction of extractions) {
			if (!grouped[extraction.fieldId]) {
				grouped[extraction.fieldId] = [];
			}
			grouped[extraction.fieldId].push(extraction);
		}

		return grouped;
	}

	private buildRows(extractionsByField: Record<string, ExtractionNorm[]>, columns: TableColumn[]): TableRow[] {
		const rows: TableRow[] = [];

		for (const [fieldId, extractions] of Object.entries(extractionsByField)) {
			const fieldName = this.getFieldDisplayName(fieldId);
			const values: Record<string, TableCell> = {};

			// Set spec column
			values['spec'] = {
				value: fieldName,
				confidence: 1.0
			};

			// Set document columns
			for (const column of columns.filter(c => c.type === 'document')) {
				const extraction = extractions.find(e => e.documentId === column.documentId);
				if (extraction) {
					values[column.id] = {
						value: extraction.value,
						unit: extraction.unit,
						confidence: extraction.confidence,
						flags: extraction.flags,
						note: extraction.note,
						provenance: this.buildProvenance(extraction)
					};
				} else {
					values[column.id] = {
						value: '',
						confidence: 0.0
					};
				}
			}

			rows.push({
				id: require('crypto').randomUUID(),
				fieldId,
				fieldName,
				values
			});
		}

		// Sort rows by field importance (profile order if available)
		return this.sortRows(rows);
	}

	private getFieldDisplayName(fieldId: string): string {
		if (this.profile?.schema[fieldId]) {
			return this.profile.schema[fieldId].name.toUpperCase();
		}
		
		// Convert field ID to display name
		return String(fieldId)
			.replace(/_/g, ' ')
			.toUpperCase();
	}

	private buildProvenance(extraction: ExtractionNorm): any {
		// This would reference the original extraction_raw provenance
		// For now, return a basic structure
		return {
			page: 1,
			method: 'ocr'
		};
	}

	private sortRows(rows: TableRow[]): TableRow[] {
		if (!this.profile) return rows;

		const fieldOrder = Object.keys(this.profile.schema);
		
		return rows.sort((a, b) => {
			const aIndex = fieldOrder.indexOf(a.fieldId);
			const bIndex = fieldOrder.indexOf(b.fieldId);
			
			// Profile fields first, then others
			if (aIndex >= 0 && bIndex >= 0) return aIndex - bIndex;
			if (aIndex >= 0) return -1;
			if (bIndex >= 0) return 1;
			
			return a.fieldName.localeCompare(b.fieldName);
		});
	}

	private generateHighlights(rows: TableRow[]): TableHighlights {
		const bestValues: Record<string, string> = {};
		const worstValues: Record<string, string> = {};
		const outliers: Array<{ fieldId: string; columnId: string; reason: string }> = [];

		for (const row of rows) {
			const documentColumns = Object.entries(row.values).filter(([columnId]) => columnId !== 'spec');
			
			if (documentColumns.length < 2) continue;

			// Numeric comparison
			const numericValues = documentColumns
				.map(([columnId, cell]) => ({
					columnId,
					cell,
					numValue: this.parseNumericValue(cell.value)
				}))
				.filter(item => item.numValue !== null);

			if (numericValues.length >= 2) {
				// Determine if higher or lower is better based on field type
				const higherIsBetter = this.isHigherValueBetter(row.fieldId);
				
				numericValues.sort((a, b) => 
					higherIsBetter ? b.numValue! - a.numValue! : a.numValue! - b.numValue!
				);

				bestValues[row.fieldId] = numericValues[0].columnId;
				worstValues[row.fieldId] = numericValues[numericValues.length - 1].columnId;

				// Check for outliers
				if (numericValues.length >= 3) {
					const median = this.calculateMedian(numericValues.map(v => v.numValue!));
					const outlierThreshold = median * 2; // Simple outlier detection

					for (const item of numericValues) {
						if (Math.abs(item.numValue! - median) > outlierThreshold) {
							outliers.push({
								fieldId: row.fieldId,
								columnId: item.columnId,
								reason: `Value ${item.numValue} significantly differs from median ${median.toFixed(2)}`
							});
						}
					}
				}
			}

			// Check for flagged values
			for (const [columnId, cell] of documentColumns) {
				if (cell.flags?.includes('potential_outlier')) {
					outliers.push({
						fieldId: row.fieldId,
						columnId,
						reason: 'Flagged as potential outlier during normalization'
					});
				}
			}
		}

		return { bestValues, worstValues, outliers };
	}

	private parseNumericValue(value: string): number | null {
		// Extract first number from value
		const match = value.match(/(\d+(?:\.\d+)?)/);
		return match ? parseFloat(match[1]) : null;
	}

	private isHigherValueBetter(fieldId: string): boolean {
		// Field-specific logic for what constitutes "better"
		const higherBetterFields = [
			'sla', 'uptime', 'nps', 'security', 'frequency', 'performance',
			'speed', 'throughput', 'bandwidth', 'rating', 'score'
		];
		
		const lowerBetterFields = [
			'latency', 'delay', 'price', 'cost', 'power', 'current',
			'onboarding', 'setup_time', 'response_time'
		];

		const fieldLower = fieldId.toLowerCase();
		
		if (higherBetterFields.some(term => fieldLower.includes(term))) return true;
		if (lowerBetterFields.some(term => fieldLower.includes(term))) return false;
		
		return true; // Default to higher is better
	}

	private calculateMedian(values: number[]): number {
		const sorted = [...values].sort((a, b) => a - b);
		const mid = Math.floor(sorted.length / 2);
		return sorted.length % 2 === 0 
			? (sorted[mid - 1] + sorted[mid]) / 2 
			: sorted[mid];
	}

	private generateInsights(rows: TableRow[], highlights: TableHighlights): string[] {
		const insights: string[] = [];
		const documentCount = Object.keys(rows[0]?.values || {}).length - 1; // Exclude spec column

		if (documentCount < 2) {
			insights.push('Upload at least 2 documents to enable comparison insights.');
			return insights;
		}

		// Performance insights
		const bestPerformers = this.getBestPerformers(rows, highlights);
		if (bestPerformers.length > 0) {
			insights.push(`Best overall performance: ${bestPerformers.join(', ')}`);
		}

		// Specific field insights
		for (const row of rows.slice(0, 3)) { // Top 3 fields
			const bestColumn = highlights.bestValues[row.fieldId];
			const worstColumn = highlights.worstValues[row.fieldId];
			
			if (bestColumn && worstColumn && bestColumn !== worstColumn) {
				const bestCell = row.values[bestColumn];
				const worstCell = row.values[worstColumn];
				const bestDoc = this.getColumnName(rows, bestColumn);
				const worstDoc = this.getColumnName(rows, worstColumn);
				
				if (bestCell && worstCell && bestDoc && worstDoc) {
					const improvement = this.calculateImprovement(bestCell.value, worstCell.value);
					if (improvement) {
						insights.push(`${row.fieldName}: ${bestDoc} outperforms ${worstDoc} by ${improvement}`);
					}
				}
			}
		}

		// Outlier insights
		if (highlights.outliers.length > 0) {
			insights.push(`Found ${highlights.outliers.length} potential outlier${highlights.outliers.length > 1 ? 's' : ''} - review highlighted values`);
		}

		// Data quality insights
		const completeness = this.calculateDataCompleteness(rows);
		if (completeness < 0.8) {
			insights.push(`Data completeness: ${(completeness * 100).toFixed(0)}% - some fields may need manual review`);
		}

		return insights.slice(0, 5); // Limit to 5 insights
	}

	private getBestPerformers(rows: TableRow[], highlights: TableHighlights): string[] {
		const performanceScores: Record<string, number> = {};

		// Count "wins" for each document
		for (const fieldId of Object.keys(highlights.bestValues)) {
			const winnerColumn = highlights.bestValues[fieldId];
			if (winnerColumn && winnerColumn !== 'spec') {
				performanceScores[winnerColumn] = (performanceScores[winnerColumn] || 0) + 1;
			}
		}

		// Get top performers
		const sorted = Object.entries(performanceScores)
			.sort(([,a], [,b]) => b - a)
			.slice(0, 2);

		return sorted.map(([columnId]) => this.getColumnName(rows, columnId)).filter(Boolean) as string[];
	}

	private getColumnName(rows: TableRow[], columnId: string): string | null {
		// This would need access to column definitions
		// For now, return the columnId
		return columnId;
	}

	private calculateImprovement(bestValue: string, worstValue: string): string | null {
		const best = this.parseNumericValue(bestValue);
		const worst = this.parseNumericValue(worstValue);
		
		if (best === null || worst === null || worst === 0) return null;
		
		const improvement = Math.abs((best - worst) / worst * 100);
		if (improvement < 5) return null; // Skip small differences
		
		return `${improvement.toFixed(0)}%`;
	}

	private calculateDataCompleteness(rows: TableRow[]): number {
		let totalCells = 0;
		let filledCells = 0;

		for (const row of rows) {
			const documentCells = Object.entries(row.values).filter(([columnId]) => columnId !== 'spec');
			totalCells += documentCells.length;
			filledCells += documentCells.filter(([, cell]) => cell.value && cell.value.trim() !== '').length;
		}

		return totalCells > 0 ? filledCells / totalCells : 0;
	}

	private async generateExports(columns: TableColumn[], rows: TableRow[]): Promise<ExportData> {
		const supa = getSupabaseAdmin();
		const exports: ExportData = {};

		try {
			// Generate CSV
			const csvContent = this.generateCSV(columns, rows);
			const csvPath = `workspace/${this.workspaceId}/runs/${this.runId}/exports/comparison.csv`;
			
			const { error: csvError } = await supa.storage
				.from(STORAGE_BUCKET)
				.upload(csvPath, csvContent, { contentType: 'text/csv' });

			if (!csvError) {
				const { data: csvData } = await supa.storage
					.from(STORAGE_BUCKET)
					.createSignedUrl(csvPath, 3600 * 24); // 24 hours

				if (csvData) {
					exports.csv = {
						url: csvData.signedUrl,
						expiresAt: new Date(Date.now() + 3600 * 24 * 1000)
					};
				}
			}

			// Generate JSON
			const jsonContent = this.generateJSON(columns, rows);
			const jsonPath = `workspace/${this.workspaceId}/runs/${this.runId}/exports/comparison.json`;
			
			const { error: jsonError } = await supa.storage
				.from(STORAGE_BUCKET)
				.upload(jsonPath, jsonContent, { contentType: 'application/json' });

			if (!jsonError) {
				const { data: jsonData } = await supa.storage
					.from(STORAGE_BUCKET)
					.createSignedUrl(jsonPath, 3600 * 24);

				if (jsonData) {
					exports.json = {
						url: jsonData.signedUrl,
						expiresAt: new Date(Date.now() + 3600 * 24 * 1000)
					};
				}
			}

		} catch (error) {
			console.error('Export generation failed:', error);
		}

		return exports;
	}

	private generateCSV(columns: TableColumn[], rows: TableRow[]): string {
		const csvRows: string[] = [];
		
		// Header
		const headers = columns.map(col => col.name);
		csvRows.push(headers.join(','));

		// Data rows
		for (const row of rows) {
			const csvRow = columns.map(col => {
				const cell = row.values[col.id];
				if (!cell) return '';
				
				let value = String(cell.value || '');
				if (cell.unit) value += ` ${cell.unit}`;
				
				// Escape commas and quotes
				if (value.includes(',') || value.includes('"')) {
					value = `"${value.replace(/"/g, '""')}"`;
				}
				
				return value;
			});
			csvRows.push(csvRow.join(','));
		}

		return csvRows.join('\n');
	}

	private generateJSON(columns: TableColumn[], rows: TableRow[]): string {
		const data = {
			metadata: {
				runId: this.runId,
				domain: this.domain,
				generatedAt: new Date().toISOString(),
				columns: columns.length,
				rows: rows.length
			},
			columns,
			rows: rows.map(row => ({
				fieldId: row.fieldId,
				fieldName: row.fieldName,
				values: row.values
			}))
		};

		return JSON.stringify(data, null, 2);
	}
}

export async function buildComparisonTable(
	runId: string, 
	workspaceId: string, 
	domain: string, 
	normalizedExtractions: ExtractionNorm[], 
	documents: any[]
): Promise<ResultTable> {
	const builder = new TableBuilder(runId, workspaceId, domain);
	return await builder.buildTable(normalizedExtractions, documents);
}

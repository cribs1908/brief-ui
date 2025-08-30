/**
 * LangChain-based structured data extraction
 * Simplified, production-ready approach
 */

import { ChatOpenAI } from '@langchain/openai';
import { PromptTemplate } from '@langchain/core/prompts';
import { StructuredOutputParser } from '@langchain/core/output_parsers';
import { z } from 'zod';
import { ENV } from './env';

// Define schema for extracted data
const FieldExtractionSchema = z.object({
  fieldId: z.string().describe('The field identifier'),
  value: z.string().describe('The extracted value'),
  unit: z.string().optional().describe('Unit of measurement if applicable'),
  confidence: z.number().min(0).max(1).describe('Confidence score 0-1'),
  source: z.string().describe('Source of the data (table/text)'),
  page: z.number().describe('Page number where found')
});

const ExtractionResultSchema = z.object({
  extractions: z.array(FieldExtractionSchema),
  summary: z.string().describe('Brief summary of the document type')
});

type ExtractionResult = z.infer<typeof ExtractionResultSchema>;

/**
 * Initialize LangChain model
 */
function createModel() {
  return new ChatOpenAI({
    modelName: ENV.openaiModel,
    temperature: 0.1, // Low temperature for consistent extraction
    apiKey: ENV.openaiKey,
  });
}

/**
 * Get domain-specific fields to extract
 */
function getDomainFields(domain: string): string[] {
  const fieldMaps = {
    'Chip': [
      'supply_voltage', 'supply_current', 'input_voltage_range', 'output_voltage', 
      'output_current', 'frequency', 'power_consumption', 'efficiency',
      'temperature_range', 'package_type', 'dropout_voltage', 'bandwidth'
    ],
    'API': [
      'base_url', 'authentication', 'rate_limit', 'response_format',
      'max_payload', 'timeout', 'pricing', 'sla', 'regions'
    ],
    'SaaS': [
      'pricing_model', 'free_tier', 'max_users', 'storage_limit',
      'api_calls_limit', 'support_level', 'uptime_sla', 'security_compliance'
    ]
  };
  
  return fieldMaps[domain as keyof typeof fieldMaps] || fieldMaps.Chip;
}

/**
 * Create extraction prompt for a specific domain
 */
function createExtractionPrompt(domain: string, fields: string[]) {
  const fieldList = fields.map(f => `- ${f}`).join('\n');
  
  const template = `You are an expert data extractor specializing in {domain} specifications.

TARGET FIELDS TO EXTRACT:
{fieldList}

EXTRACTION RULES:
1. Extract ONLY the fields listed above
2. Look first in structured tables (marked with [TABLE])
3. For ranges like "3.0-5.5V", extract the typical/middle value
4. Always include units (V, A, mA, MHz, °C, etc.)
5. Set confidence based on clarity: 0.9-1.0 for tables, 0.7-0.8 for clear text
6. Use exact field IDs from the list above

DOCUMENT CONTENT:
{content}

{format_instructions}`;

  return PromptTemplate.fromTemplate(template);
}

/**
 * Extract structured data using LangChain
 */
export async function extractWithLangChain(
  domain: string,
  content: string,
  documentId: string
): Promise<ExtractionResult> {
  
  const model = createModel();
  const fields = getDomainFields(domain);
  const parser = StructuredOutputParser.fromZodSchema(ExtractionResultSchema);
  
  const prompt = createExtractionPrompt(domain, fields);
  
  const chain = prompt.pipe(model).pipe(parser);
  
  try {
    const result = await chain.invoke({
      domain,
      fieldList: fields.map(f => `- ${f}`).join('\n'),
      content: content.substring(0, 15000), // Limit content size
      format_instructions: parser.getFormatInstructions(),
    });
    
    // Add document ID to all extractions
    result.extractions = result.extractions.map(ext => ({
      ...ext,
      documentId
    }));
    
    return result;
    
  } catch (error: any) {
    console.error('LangChain extraction failed:', error);
    
    // Return empty result on failure
    return {
      extractions: [],
      summary: `Extraction failed for ${domain} document`
    };
  }
}

/**
 * Process multiple documents with LangChain
 */
export async function processBatch(
  domain: string,
  documents: Array<{
    id: string;
    filename: string;
    content: string;
  }>
): Promise<{
  allExtractions: any[];
  documentSummaries: Record<string, string>;
}> {
  
  const allExtractions: any[] = [];
  const documentSummaries: Record<string, string> = {};
  
  for (const doc of documents) {
    console.log(`🔍 Processing ${doc.filename} with LangChain...`);
    
    const result = await extractWithLangChain(domain, doc.content, doc.id);
    
    allExtractions.push(...result.extractions);
    documentSummaries[doc.id] = result.summary;
    
    console.log(`✅ Extracted ${result.extractions.length} fields from ${doc.filename}`);
  }
  
  return {
    allExtractions,
    documentSummaries
  };
}

/**
 * Generate comparison insights using LangChain
 */
export async function generateInsights(
  domain: string,
  comparisonData: any
): Promise<string[]> {
  
  const model = createModel();
  
  const prompt = PromptTemplate.fromTemplate(`
You are an expert analyst for {domain} products. 

Analyze this comparison data and provide 3-5 key insights:

{data}

Provide insights as a JSON array of strings, focusing on:
- Performance differences
- Value propositions  
- Technical trade-offs
- Recommendations

Format: ["insight1", "insight2", "insight3"]
`);
  
  try {
    const chain = prompt.pipe(model);
    
    const result = await chain.invoke({
      domain,
      data: JSON.stringify(comparisonData, null, 2)
    });
    
    // Parse the insights from the response
    const content = result.content as string;
    const jsonMatch = content.match(/\[[\s\S]*?\]/);
    
    if (jsonMatch) {
      const insights = JSON.parse(jsonMatch[0]);
      return insights.filter((insight: any) => typeof insight === 'string');
    }
    
    return [`Analysis completed for ${domain} comparison`];
    
  } catch (error) {
    console.error('Insight generation failed:', error);
    return [`Unable to generate insights for ${domain} comparison`];
  }
}
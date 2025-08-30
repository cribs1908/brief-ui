// Nuova struttura semplificata - solo 4 stati
export type RunStatus =
  | 'QUEUED'
  | 'PROCESSING' 
  | 'READY'
  | 'ERROR';

export type WorkspaceId = string;
export type RunId = string;
export type DocumentId = string;

export interface Run {
  id: RunId;
  userId: string; // da Clerk
  workspaceId?: WorkspaceId;
  status: RunStatus;
  prompt?: string;
  domain?: 'CHIP' | 'SAAS' | 'API' | 'AUTO';
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentRec {
  id: DocumentId;
  runId: RunId;
  filename: string;
  storagePath: string;
  pages?: number;
  ocrUsed?: boolean;
}

// Nuova struttura: Result con tabella JSON completa
export interface Result {
  id: string;
  runId: RunId;
  tableJson: {
    columns: any[];
    rows: any[];
    highlights?: any;
    citations?: any;
  };
  exportCsvPath?: string;
  sourceMapPath?: string; // JSON con testo-per-pagina e mappatura
  createdAt: string;
}

// Q&A Messages per chat sui risultati
export interface Message {
  id: string;
  runId: RunId;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: string;
}

// Manteniamo ResultTable per compatibility, ma utilizziamo Result come principale
export interface ResultTable {
  id: string;
  runId: RunId;
  columns: any[];
  rows: any[];
  highlights?: any;
  exports?: {
    csv?: { url: string; expiresAt: Date };
    xlsx?: { url: string; expiresAt: Date };
    json?: { url: string; expiresAt: Date };
  };
  insights?: string[];
}

// SSE Events semplificati per la nuova struttura
export interface SSEEvent {
  type: 'status' | 'progress' | 'error' | 'heartbeat';
  status?: RunStatus;
  progress?: number;
  message?: string;
  error?: { code: string; message: string };
}

// Pipeline types for processing
export interface ExtractionRaw {
  id: string;
  documentId: string;
  fieldId: string;
  valueRaw: string;
  unitRaw?: string;
  source: string;
  confidence: number;
  provenance?: any;
}

export interface ExtractionNorm {
  id: string;
  documentId: string;
  fieldId: string;
  value: string;
  unit?: string;
  note?: string;
  flags?: string[];
  provenanceRef?: string;
  confidence: number;
}

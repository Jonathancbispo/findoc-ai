
export enum Role {
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER',
  VIEWER = 'VIEWER'
}

export enum DocStatus {
  IDLE = 'IDLE',
  UPLOADING = 'UPLOADING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED'
}

export type BillingTier = 'FREE' | 'PRO' | 'ENTERPRISE';

export interface PlanLimits {
  maxDocs: number;
  maxFileSizeMB: number;
  advancedAI: boolean;
}

export const PLAN_CONFIGS: Record<BillingTier, PlanLimits> = {
  FREE: { maxDocs: 5, maxFileSizeMB: 2, advancedAI: false },
  PRO: { maxDocs: 50, maxFileSizeMB: 20, advancedAI: true },
  ENTERPRISE: { maxDocs: 1000, maxFileSizeMB: 100, advancedAI: true }
};

export interface DownloadRecord {
  id: string;
  docName: string;
  format: 'PDF' | 'EXCEL';
  timestamp: number;
  expiresAt: number;
}

export interface AuditLog {
  id: string;
  timestamp: number;
  userId: string;
  userName: string;
  action: 'LOGIN' | 'UPLOAD' | 'DELETE' | 'EXPORT' | 'UPGRADE' | 'ACCESS_REVOKE';
  details: string;
  ip: string;
  status: 'SUCCESS' | 'FAILURE' | 'WARNING';
}

export interface Organization {
  id: string;
  name: string;
  billingTier: BillingTier;
  createdAt: number;
  encryptionKeyId: string;
  isLGPDCompliant: boolean;
  dataRetentionDays: number;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  orgId: string;
  avatar?: string;
}

export interface ExtractionResult {
  companyName: string;
  reportDate: string;
  metrics: FinancialMetric[];
  invoiceItems: InvoiceItem[];
  anomalies: Anomaly[];
  summary: string;
  keyInsights: string[];
  integrityScore: number;
}

export interface FinancialMetric {
  label: string;
  value: number;
  currency: string;
  normalizedValueBRL: number;
}

export interface Anomaly {
  description: string;
  value: number;
  severity: 'low' | 'medium' | 'high';
}

export interface InvoiceItem {
  numeroNF: string;
  fornecedor: string;
  dataEmissao: string;
  dataEntrada: string;
  setor: string;
  codigoMaterial: string;
  descricaoMaterial: string;
  quantidadeNF: number;
  valorUnitario: number;
  valorTotal: number;
}

export interface ProcessedDocument {
  id: string;
  orgId: string;
  userId: string;
  name: string;
  size: string; 
  sizeBytes: number;
  type: string;
  status: DocStatus;
  result?: ExtractionResult;
  timestamp: number;
  extractionKeywords?: string[]; // Novos metadados de extração
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

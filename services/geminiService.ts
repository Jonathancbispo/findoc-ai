
import { GoogleGenAI, Type } from "@google/genai";
import { ExtractionResult } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const FINANCIAL_PIPELINE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    companyName: { type: Type.STRING },
    reportDate: { type: Type.STRING },
    metrics: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          label: { type: Type.STRING },
          value: { type: Type.NUMBER },
          currency: { type: Type.STRING },
          normalizedValueBRL: { type: Type.NUMBER }
        },
        required: ["label", "value", "normalizedValueBRL"]
      }
    },
    invoiceItems: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          numeroNF: { type: Type.STRING },
          fornecedor: { type: Type.STRING },
          dataEmissao: { type: Type.STRING },
          dataEntrada: { type: Type.STRING },
          setor: { type: Type.STRING },
          codigoMaterial: { type: Type.STRING },
          descricaoMaterial: { type: Type.STRING },
          quantidadeNF: { type: Type.NUMBER },
          valorUnitario: { type: Type.NUMBER },
          valorTotal: { type: Type.NUMBER }
        },
        required: ["numeroNF", "fornecedor", "dataEmissao", "descricaoMaterial", "valorTotal"]
      }
    },
    anomalies: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          description: { type: Type.STRING },
          value: { type: Type.NUMBER },
          severity: { type: Type.STRING }
        },
        required: ["description", "severity"]
      }
    },
    summary: { type: Type.STRING },
    keyInsights: { type: Type.ARRAY, items: { type: Type.STRING } },
    integrityScore: { type: Type.INTEGER }
  },
  required: ["companyName", "reportDate", "invoiceItems", "summary", "integrityScore"]
};

const tryRepairJson = (jsonString: string): string => {
  let stack = [];
  let inString = false;
  let escaped = false;

  for (let i = 0; i < jsonString.length; i++) {
    const char = jsonString[i];
    if (escaped) { escaped = false; continue; }
    if (char === '\\') { escaped = true; continue; }
    if (char === '"') { inString = !inString; continue; }
    if (!inString) {
      if (char === '{' || char === '[') stack.push(char);
      else if (char === '}' || char === ']') stack.pop();
    }
  }

  let repaired = jsonString;
  if (inString) repaired += '"';
  while (stack.length > 0) {
    const last = stack.pop();
    if (last === '{') repaired += '}';
    if (last === '[') repaired += ']';
  }
  return repaired;
};

async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  let lastError: any;
  let delay = 2000;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (err: any) {
      lastError = err;
      const isServerError = err.message?.includes("500") || err.status === 500 || (err.error && err.error.code === 500);
      
      if (isServerError && i < maxRetries - 1) {
        console.warn(`[FinDoc AI] Erro 500. Tentativa ${i + 1}/${maxRetries}...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2;
        continue;
      }
      break;
    }
  }
  throw lastError;
}

export const processDocument = async (fileBase64: string, mimeType: string, keywords: string[] = []): Promise<ExtractionResult> => {
  return withRetry(async () => {
    const isImage = mimeType.startsWith('image/');
    const keywordContext = keywords.length > 0 
      ? `EXTRAÇÃO PRIORITÁRIA DE KEYWORDS: ${keywords.join(', ')}. Scaneie meticulosamente por estes termos.`
      : "";

    const systemInstruction = `Você é o Motor de Auditoria de Alta Performance FinDoc AI. 
DIRETRIZ DE EFICIÊNCIA MÁXIMA:

1. RECONSTRUÇÃO RELACIONAL: Mapeie o documento como uma grade de dados. Preserve a relação entre cabeçalhos e linhas mesmo se houver quebra de página.
2. PROTOCOLO DE INTEGRIDADE NUMÉRICA: Realize a soma aritmética de todos os 'valorTotal' extraídos e valide contra o 'Total Geral' declarado no documento. Se houver divergência, re-examine os centavos e quantidades.
3. ZERO RESUMO: É terminantemente proibido omitir linhas. Se uma tabela possuir centenas de registros, você deve listar todos.
4. VARREDURA DE ALTA DENSIDADE: Capture dados em fontes pequenas (4pt a 6pt), notas de rodapé e textos verticais em bordas.
5. TRATAMENTO DE ALUCINAÇÃO: Não preencha lacunas com inferências. Se o dado é ilegível, marque como null.

${keywordContext}

${isImage ? 'OCR TURBO MODE: Mapeamento pixel-a-texto com correção de perspectiva e realce de contraste digital.' : 'PDF DEEP ANALYSIS: Leitura de streams de dados fiscais e extração de tabelas complexas.'}

Seu objetivo é 100% de cobertura dos dados financeiros presentes.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      config: {
        thinkingConfig: { thinkingBudget: 32768 },
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: FINANCIAL_PIPELINE_SCHEMA,
      },
      contents: [
        {
          parts: [
            { inlineData: { mimeType: mimeType, data: fileBase64 } },
            { text: "Inicie extração de alta eficiência. Ignore brevidade, priorize a integridade absoluta de todos os dados da tabela." }
          ]
        }
      ],
    });

    let rawText = response.text?.trim() || "";
    
    try {
      return JSON.parse(rawText);
    } catch (parseError) {
      const repairedJson = tryRepairJson(rawText);
      try {
        return JSON.parse(repairedJson);
      } catch (repairError) {
        throw new Error("Erro de processamento em massa. O documento é muito complexo para o pipeline atual.");
      }
    }
  });
};

export const getChatResponse = async (history: { role: string; content: string }[], message: string, context: ExtractionResult): Promise<string> => {
  return withRetry(async () => {
    const chat = ai.chats.create({
      model: 'gemini-3-pro-preview',
      config: {
        systemInstruction: `Você é o Especialista em Auditoria FinDoc. Utilize o contexto de extração de alta eficiência para responder com precisão cirúrgica.`,
      },
      history: history.map(h => ({
        role: h.role === 'user' ? 'user' : 'model',
        parts: [{ text: h.content }]
      }))
    });
    const response = await chat.sendMessage({ message });
    return response.text || "Dados insuficientes no contexto auditado.";
  });
};

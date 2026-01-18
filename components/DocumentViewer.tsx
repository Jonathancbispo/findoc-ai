
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  ProcessedDocument, 
  DocStatus, 
  ChatMessage 
} from '../types';
import { 
  FileText, 
  Search, 
  MessageSquare, 
  Send,
  Loader2,
  CheckCircle,
  CheckCircle2,
  BrainCircuit,
  AlertTriangle,
  FileSpreadsheet,
  FileDown,
  ArrowUpDown,
  ShieldCheck,
  Lightbulb,
  Sparkles,
  Info,
  XCircle,
  RefreshCw,
  Tags,
  Table as TableIcon,
  Cpu,
  Layers,
  Database,
  SearchCode,
  ShieldAlert,
  ShieldQuestion,
  Eye,
  Maximize2,
  Activity,
  Zap,
  ChevronRight,
  Terminal,
  Brain
} from 'lucide-react';
import { getChatResponse } from '../services/geminiService';
import { useAuth } from '../contexts/AuthContext';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

interface DocumentViewerProps {
  document?: ProcessedDocument;
  onClose: () => void;
  allDocs: ProcessedDocument[];
  onSelectDoc: (id: string) => void;
  notify?: (msg: string, type?: 'error' | 'warning' | 'success') => void;
}

const DocumentViewer: React.FC<DocumentViewerProps> = ({ document, onClose, notify }) => {
  const { org, trackDownload } = useAuth();
  const [chatInput, setChatInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [activeView, setActiveView] = useState<'summary' | 'tables' | 'preview'>('tables');
  const [searchTerm, setSearchTerm] = useState('');
  const [loadingStep, setLoadingStep] = useState(0);
  const [progress, setProgress] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const processingSteps = [
    { 
      label: "Leitura do Arquivo", 
      sub: "Análise binária e mapeamento de metadados fiscais.",
      icon: <Layers size={14} className="text-blue-400" />,
      range: [0, 33]
    },
    { 
      label: "Extração de Tabelas", 
      sub: "Mapeamento de itens, quantidades e valores via OCR Turbo.",
      icon: <TableIcon size={14} className="text-amber-400" />,
      range: [33, 66]
    },
    { 
      label: "Validação de Dados", 
      sub: "Auditoria aritmética cruzada e integridade financeira.",
      icon: <ShieldCheck size={14} className="text-emerald-400" />,
      range: [66, 100]
    }
  ];

  const isImage = document?.type.startsWith('image/');

  useEffect(() => {
    if (document?.status === DocStatus.PROCESSING) {
      setLoadingStep(0);
      setProgress(2);
      
      const stepInterval = setInterval(() => {
        setLoadingStep(prev => {
          if (prev < processingSteps.length - 1) return prev + 1;
          return prev;
        });
      }, 6000);
      
      const progressInterval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 98) return prev;
          const currentRange = processingSteps[loadingStep].range;
          if (prev < currentRange[1]) {
            return prev + (currentRange[1] - prev) * 0.04;
          }
          return prev + 0.1;
        });
      }, 500);

      return () => {
        clearInterval(stepInterval);
        clearInterval(progressInterval);
      };
    } else if (document?.status === DocStatus.COMPLETED) {
      setProgress(100);
      setLoadingStep(processingSteps.length - 1);
    }
  }, [document?.status, loadingStep]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [messages, isTyping]);

  const filteredItems = useMemo(() => {
    if (!document?.result?.invoiceItems) return [];
    const search = searchTerm.toLowerCase();
    return document.result.invoiceItems.filter(item => {
      const fornecedor = (item.fornecedor || "").toLowerCase();
      const descricao = (item.descricaoMaterial || "").toLowerCase();
      const nf = (item.numeroNF || "").toLowerCase();
      return fornecedor.includes(search) || descricao.includes(search) || nf.includes(search);
    });
  }, [document, searchTerm]);

  const exportToPDF = () => {
    if (!document?.result) return;
    try {
      const { result } = document;
      const doc = new jsPDF();
      doc.setFontSize(18);
      doc.setTextColor(79, 70, 229);
      doc.text('Relatório de Extração Fidedigna', 14, 20);
      autoTable(doc, {
        startY: 50,
        head: [["Linha", "NF", "Fornecedor", "Descrição Item", "Total (BRL)"]],
        body: result.invoiceItems.map((i, index) => [
          index + 1,
          i.numeroNF, 
          i.fornecedor, 
          i.descricaoMaterial,
          i.valorTotal?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) || '0'
        ]),
        theme: 'striped',
        headStyles: { fillColor: [79, 70, 229], fontSize: 8 },
        styles: { fontSize: 7, cellPadding: 2 },
      });
      doc.save(`Auditoria_Doc_${result.companyName}.pdf`);
      trackDownload(document.name, 'PDF');
      if(notify) notify("Relatório gerado com sucesso.", "success");
    } catch (err) {
      if(notify) notify("Falha ao exportar PDF.", "error");
    }
  };

  const exportToExcel = () => {
    if (!document?.result) return;
    try {
      const { result } = document;
      const excelData = result.invoiceItems.map((item, index) => ({
        'ID': index + 1,
        'Nota Fiscal': item.numeroNF,
        'Fornecedor': item.fornecedor,
        'Emissão': item.dataEmissao,
        'Descrição': item.descricaoMaterial,
        'Valor Total (BRL)': item.valorTotal,
      }));
      const ws = XLSX.utils.json_to_sheet(excelData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Extração Completa");
      XLSX.writeFile(wb, `Dados_Extraidos_${result.companyName}.xlsx`);
      trackDownload(document.name, 'EXCEL');
      if(notify) notify("Planilha exportada com sucesso.", "success");
    } catch (err) {
      if(notify) notify("Falha ao exportar Excel.", "error");
    }
  };

  const handleSendMessage = async () => {
    if (!chatInput.trim() || !document?.result || isTyping) return;
    const msg = chatInput;
    setChatInput('');
    setMessages(prev => [...prev, { role: 'user', content: msg }]);
    setIsTyping(true);
    try {
      const response = await getChatResponse(messages.map(m => ({ role: m.role, content: m.content })), msg, document.result);
      setMessages(prev => [...prev, { role: 'assistant', content: response }]);
    } catch (error: any) {
      setMessages(prev => [...prev, { role: 'assistant', content: "Erro na análise profunda." }]);
    } finally {
      setIsTyping(false);
    }
  };

  if (!document) return (
    <div className="flex-1 flex flex-col items-center justify-center text-slate-500 p-12 text-center animate-in fade-in duration-500">
      <div className="w-24 h-24 bg-slate-900 border-4 border-slate-800 rounded-[32px] flex items-center justify-center mb-8 shadow-2xl">
        <Cpu size={48} className="text-slate-700" />
      </div>
      <h3 className="font-black text-2xl text-white mb-2 uppercase tracking-tighter text-indigo-400">Pipeline FinDoc</h3>
      <p className="max-w-xs text-xs font-black uppercase tracking-widest text-slate-500">Selecione um arquivo para iniciar a varredura profunda.</p>
    </div>
  );

  return (
    <div className="flex h-full flex-col lg:flex-row gap-6 animate-in slide-in-from-right-4 duration-500">
      <div className="flex-1 overflow-auto space-y-6">
        {document.status === DocStatus.FAILED && (
           <div className="bg-rose-950/30 border-2 border-rose-500/50 p-12 rounded-[50px] flex flex-col items-center text-center gap-6">
              <ShieldAlert className="text-rose-500" size={48} />
              <h3 className="text-2xl font-black text-white uppercase tracking-tighter">Erro de Extração</h3>
              <p className="text-sm font-bold text-rose-200 opacity-80 max-w-md">O documento possui complexidade excessiva ou baixa legibilidade para o pipeline turbo.</p>
              <button onClick={() => window.location.reload()} className="bg-rose-600 hover:bg-rose-500 text-white px-8 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 transition-all">
                <RefreshCw size={14} /> Tentar Outra Vez
              </button>
           </div>
        )}

        {document.status === DocStatus.COMPLETED && (
        <div className="bg-slate-900 rounded-[40px] border border-slate-800 shadow-2xl overflow-hidden">
          <div className="p-10 bg-slate-950 text-white flex flex-col md:flex-row justify-between items-center gap-8 border-b border-slate-800">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                 <h1 className="text-3xl font-black tracking-tighter uppercase text-white truncate max-w-xl">{document.result?.companyName}</h1>
                 <span className="bg-emerald-500 text-white px-3 py-1 rounded-lg text-[9px] font-black uppercase shadow-lg shadow-emerald-500/20">Auditado</span>
              </div>
              <div className="flex flex-wrap gap-4 items-center">
                <div className="flex gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                  <span className="bg-slate-900 px-3 py-1 rounded-lg border border-slate-800 flex items-center gap-2">
                    <CheckCircle2 size={12} className="text-emerald-400" />
                    Integridade: {document.result?.integrityScore}%
                  </span>
                  <span className="bg-amber-600/20 text-amber-400 px-3 py-1 rounded-lg border border-amber-500/30 flex items-center gap-2">
                    <Zap size={12} /> Extração de Alta Eficiência
                  </span>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-3 shrink-0">
              <button onClick={exportToExcel} className="bg-emerald-600 hover:bg-emerald-500 px-6 py-3 rounded-2xl font-black text-[10px] uppercase text-white flex items-center gap-2 transition-all shadow-lg"><FileSpreadsheet size={16} /> Planilha</button>
              <button onClick={exportToPDF} className="bg-indigo-600 hover:bg-indigo-500 px-6 py-3 rounded-2xl font-black text-[10px] uppercase text-white flex items-center gap-2 transition-all shadow-lg"><FileDown size={16} /> Relatório</button>
              <div className="bg-slate-900 p-1 rounded-2xl flex border border-slate-800">
                <button onClick={() => setActiveView('tables')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${activeView === 'tables' ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}>Tabelas</button>
                <button onClick={() => setActiveView('summary')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${activeView === 'summary' ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}>Resumo</button>
                {isImage && (
                  <button onClick={() => setActiveView('preview')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${activeView === 'preview' ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}>Fonte</button>
                )}
              </div>
            </div>
          </div>

          <div className="p-10 bg-slate-900 min-h-[400px]">
            {activeView === 'summary' && (
              <div className="space-y-8 animate-in fade-in duration-500">
                <div className="bg-slate-950 p-8 rounded-[32px] border border-slate-800">
                  <h3 className="font-black text-[10px] text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2"><CheckCircle size={14} className="text-emerald-400" /> Auditoria de Completude</h3>
                  <p className="text-sm font-bold text-slate-300 leading-relaxed bg-slate-900 p-6 rounded-2xl border border-slate-800">{document.result?.summary}</p>
                </div>
              </div>
            )}
            
            {activeView === 'tables' && (
              <div className="space-y-6 animate-in fade-in duration-500">
                 <div className="relative">
                    <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                    <input type="text" placeholder="Localizar registros no banco auditado..." className="w-full pl-14 pr-6 py-4 rounded-2xl bg-slate-950 border border-slate-800 font-bold outline-none focus:border-indigo-500 text-slate-200" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                 </div>
                 <div className="border border-slate-800 rounded-[32px] overflow-hidden bg-slate-950 shadow-inner">
                    <div className="overflow-x-auto">
                      <table className="w-full text-[10px] text-left">
                        <thead>
                          <tr className="bg-slate-800 text-slate-300 font-black uppercase tracking-widest border-b border-slate-700">
                            <th className="px-6 py-5">#</th>
                            <th className="px-6 py-5">NF</th>
                            <th className="px-6 py-5">Fornecedor</th>
                            <th className="px-6 py-5">Descrição</th>
                            <th className="px-6 py-5 text-right">Valor Auditado</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800 font-bold text-slate-300">
                          {filteredItems.map((item, i) => (
                            <tr key={i} className="hover:bg-slate-800/30 transition-colors">
                              <td className="px-6 py-5 text-slate-500">{i + 1}</td>
                              <td className="px-6 py-5 text-indigo-400 font-black">{item.numeroNF}</td>
                              <td className="px-6 py-5 text-slate-200">{item.fornecedor}</td>
                              <td className="px-6 py-5 text-slate-500 text-[9px] uppercase tracking-tighter">{item.descricaoMaterial}</td>
                              <td className="px-6 py-5 text-right font-black text-slate-100">{item.valorTotal?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) || '0'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                 </div>
              </div>
            )}

            {activeView === 'preview' && isImage && (
              <div className="flex flex-col items-center justify-center animate-in fade-in zoom-in-95 duration-500">
                 <div className="bg-slate-950 p-4 rounded-[40px] border border-slate-800 shadow-2xl max-w-2xl w-full">
                    <img 
                      src={`data:${document.type};base64,${localStorage.getItem(`raw_${document.id}`) || ''}`} 
                      alt="Original" 
                      className="w-full h-auto rounded-[32px] object-contain max-h-[600px]"
                    />
                 </div>
                 <p className="mt-6 text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    <Info size={14} className="text-indigo-500" />
                    Fonte de Evidência: Imagem utilizada para extração turbo.
                 </p>
              </div>
            )}
          </div>
        </div>
        )}

        {document.status === DocStatus.PROCESSING && (
           <div className="flex-1 flex flex-col items-center justify-center p-12 lg:p-24 animate-in fade-in zoom-in-95 duration-700 h-full">
              <div className="w-full max-w-3xl space-y-12">
                <div className="flex flex-col items-center gap-6 text-center">
                   <div className="relative w-48 h-48">
                      <svg className="w-full h-full transform -rotate-90">
                        <circle cx="96" cy="96" r="88" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-slate-800" />
                        <circle cx="96" cy="96" r="88" stroke="currentColor" strokeWidth="8" fill="transparent" strokeDasharray={2 * Math.PI * 88} strokeDashoffset={2 * Math.PI * 88 * (1 - progress / 100)} className="text-indigo-500 transition-all duration-500 ease-out" strokeLinecap="round" />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                         <span className="text-4xl font-black text-white tracking-tighter">{Math.round(progress)}%</span>
                         <span className="text-[10px] font-black uppercase text-indigo-400 tracking-widest animate-pulse">Extraindo Dados</span>
                      </div>
                   </div>

                   <div className="space-y-3">
                     <h2 className="text-3xl font-black text-white uppercase tracking-tighter">Status da Extração</h2>
                     <p className="text-xs text-slate-500 uppercase tracking-widest font-bold flex items-center gap-2 justify-center">
                        <Activity size={14} className="text-emerald-500" />
                        Fase atual: {processingSteps[loadingStep].label}
                     </p>
                   </div>
                </div>

                <div className="w-full bg-slate-900 h-3 rounded-full overflow-hidden border border-slate-800 p-[1px] shadow-inner">
                   <div className="bg-gradient-to-r from-indigo-600 via-indigo-400 to-emerald-500 h-full rounded-full transition-all duration-700 ease-out shadow-[0_0_15px_rgba(79,70,229,0.5)]" style={{ width: `${progress}%` }} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {processingSteps.map((step, idx) => {
                    const isActive = idx === loadingStep;
                    const isCompleted = idx < loadingStep;
                    
                    return (
                      <div key={idx} className={`relative flex flex-col gap-4 p-6 rounded-[32px] border transition-all duration-500 ${isActive ? 'bg-indigo-600/10 border-indigo-500/50 scale-[1.05] shadow-2xl shadow-indigo-600/10 z-10' : isCompleted ? 'bg-slate-900/50 border-emerald-500/30' : 'bg-slate-950/30 border-slate-800 opacity-30'}`}>
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${isActive ? 'bg-indigo-600 text-white animate-pulse' : isCompleted ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-600'}`}>
                          {isCompleted ? <CheckCircle2 size={24} /> : isActive ? <Activity size={24} className="animate-pulse" /> : step.icon}
                        </div>
                        <div>
                          <span className={`block text-xs font-black uppercase tracking-widest mb-1 ${isActive ? 'text-indigo-400' : isCompleted ? 'text-emerald-500' : 'text-slate-500'}`}>
                            {step.label}
                          </span>
                          <p className={`text-[10px] font-bold uppercase leading-tight ${isActive ? 'text-slate-200' : 'text-slate-600'}`}>
                            {step.sub}
                          </p>
                        </div>
                        {isActive && (
                           <div className="absolute top-4 right-4">
                              <Loader2 size={16} className="animate-spin text-indigo-500" />
                           </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="bg-black/40 border border-slate-800 p-6 rounded-[32px] font-mono text-[9px] text-slate-500 space-y-1 h-32 overflow-hidden relative shadow-inner">
                  <div className="flex items-center gap-2 mb-2 text-indigo-500 font-bold uppercase tracking-widest">
                    <Terminal size={14} /> Auditor System Logs
                  </div>
                  <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                    <p className="text-emerald-500/70">{`[${new Date().toLocaleTimeString()}] HANDSHAKE COM MOTOR GEMINI-3-PRO ESTABELECIDO.`}</p>
                    <p>{`[${new Date().toLocaleTimeString()}] ALOCANDO RECURSOS DE THINKING (32K TOKENS)...`}</p>
                    {loadingStep >= 1 && <p className="text-indigo-400/70">{`[${new Date().toLocaleTimeString()}] EXTRAINDO TABELAS: IDENTIFICADOS ${Math.floor(progress * 1.5)} REGISTROS PARCIAIS.`}</p>}
                    {loadingStep >= 2 && <p className="text-amber-500/70">{`[${new Date().toLocaleTimeString()}] AUDITORIA: CALCULANDO INTEGRIDADE ARITMÉTICA...`}</p>}
                    <p className="animate-pulse">_</p>
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-slate-950 to-transparent pointer-events-none" />
                </div>
              </div>
           </div>
        )}
      </div>

      <div className="w-full lg:w-[400px] bg-slate-900 border border-slate-800 rounded-[40px] flex flex-col shadow-2xl h-[600px] lg:h-auto overflow-hidden">
        <div className="p-8 bg-slate-950 text-white flex items-center gap-4 border-b border-slate-800">
          <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-600/20">
            <BrainCircuit size={20} className="text-indigo-200" />
          </div>
          <span className="font-black text-xs uppercase tracking-widest text-slate-200">Consultor IA</span>
        </div>
        
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-8 space-y-6 bg-slate-900/50">
          <div className="bg-slate-800 p-5 rounded-3xl rounded-tl-none border border-slate-700 text-xs font-bold text-slate-300 shadow-sm leading-relaxed">
            {document.status === DocStatus.COMPLETED 
              ? `Análise concluída com sucesso. Base de dados de ${document.result?.companyName} pronta para consultas exaustivas.`
              : "Iniciando pipeline de processamento e auditoria..."}
          </div>
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-2`}>
              <div className={`max-w-[85%] p-5 rounded-[28px] text-xs font-bold leading-relaxed shadow-md ${m.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-slate-800 border border-slate-700 text-slate-200 rounded-tl-none'}`}>
                {m.content}
              </div>
            </div>
          ))}
          {isTyping && (
            <div className="flex justify-start">
              <div className="bg-slate-950 border border-slate-800 p-5 rounded-[28px] rounded-tl-none flex flex-col gap-3 shadow-2xl shadow-indigo-500/10 border-l-4 border-l-indigo-500">
                <div className="flex items-center gap-3 text-[10px] font-black text-indigo-400 uppercase tracking-widest">
                  <div className="relative">
                    <Brain size={18} className="text-indigo-400 animate-pulse" />
                    <div className="absolute inset-0 bg-indigo-500 blur-md opacity-20 animate-pulse rounded-full" />
                  </div>
                  <span>Executando Análise Profunda...</span>
                </div>
                <div className="flex gap-1.5 ml-1">
                   <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                   <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                   <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="p-8 bg-slate-950 border-t border-slate-800 flex gap-4">
          <input 
            type="text" 
            placeholder="Analise dados fidedignos..." 
            value={chatInput} 
            onChange={e => setChatInput(e.target.value)} 
            onKeyDown={e => e.key === 'Enter' && handleSendMessage()} 
            disabled={isTyping || document.status !== DocStatus.COMPLETED}
            className="flex-1 border border-slate-700 bg-slate-900 text-white rounded-2xl px-6 py-4 text-sm font-bold outline-none focus:border-indigo-500 placeholder:text-slate-600 transition-all disabled:opacity-50" 
          />
          <button 
            onClick={handleSendMessage} 
            disabled={isTyping || !chatInput.trim() || document.status !== DocStatus.COMPLETED} 
            className="bg-indigo-600 text-white w-14 h-14 rounded-2xl flex items-center justify-center hover:scale-105 active:scale-95 transition-all disabled:opacity-50 shadow-lg shadow-indigo-600/20"
          >
            {isTyping ? <Loader2 className="animate-spin" size={20} /> : <Send size={24} />}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DocumentViewer;

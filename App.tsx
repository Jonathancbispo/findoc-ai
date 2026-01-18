import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  LayoutDashboard, 
  Settings, 
  Upload, 
  BrainCircuit, 
  Loader2, 
  LogOut, 
  ShieldCheck, 
  History, 
  Server, 
  FileSearch,
  DownloadCloud,
  User as UserIcon,
  Timer,
  AlertCircle,
  XCircle,
  X,
  Tags,
  Plus,
  Camera,
  Image as ImageIcon
} from 'lucide-react';
import { DocStatus, ProcessedDocument, Role, PLAN_CONFIGS } from './types';
import { processDocument } from './services/geminiService';
import Dashboard from './components/Dashboard';
import DocumentViewer from './components/DocumentViewer';
import LoginView from './components/LoginView';
import { AuthProvider, useAuth } from './contexts/AuthContext';

interface Notification {
  id: string;
  message: string;
  type: 'error' | 'warning' | 'success';
}

const AppContent: React.FC = () => {
  const { user, org, auditLogs, downloads, logout, addAuditLog, isLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'documents' | 'audit' | 'downloads' | 'profile'>('dashboard');
  const [documents, setDocuments] = useState<ProcessedDocument[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  
  const [extractionKeywords, setExtractionKeywords] = useState<string[]>([]);
  const [keywordInput, setKeywordInput] = useState('');

  const addNotification = useCallback((message: string, type: 'error' | 'warning' | 'success' = 'error') => {
    const id = Math.random().toString(36).substr(2, 9);
    setNotifications(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 6000);
  }, []);

  useEffect(() => {
    if (org) {
      const stored = localStorage.getItem(`docs_${org.id}`);
      if (stored) setDocuments(JSON.parse(stored));
      else setDocuments([]);
    }
  }, [org]);

  useEffect(() => {
    if (org) {
      localStorage.setItem(`docs_${org.id}`, JSON.stringify(documents));
    }
  }, [documents, org]);

  const isAdmin = user?.role === Role.ADMIN;
  const limits = useMemo(() => org ? PLAN_CONFIGS[org.billingTier] : null, [org]);
  
  const currentUsage = useMemo(() => {
    const count = documents.length;
    return { count };
  }, [documents]);

  const addKeyword = () => {
    if (keywordInput.trim() && !extractionKeywords.includes(keywordInput.trim())) {
      setExtractionKeywords(prev => [...prev, keywordInput.trim()]);
      setKeywordInput('');
    }
  };

  const removeKeyword = (tag: string) => {
    setExtractionKeywords(prev => prev.filter(t => t !== tag));
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!isAdmin || !user || !org || !limits) return;
    // Fix: Explicitly cast Array.from result to File[] to ensure 'file' in map is properly typed as File instead of unknown.
    const files = Array.from(event.target.files || []) as File[];
    if (files.length === 0) return;

    if (currentUsage.count + files.length > limits.maxDocs) {
      addAuditLog('UPLOAD', 'Tentativa de upload em lote bloqueada: Cota excedida.', 'WARNING');
      addNotification(`Limite do plano excedido. Você pode enviar mais ${limits.maxDocs - currentUsage.count} documentos.`, 'warning');
      return;
    }

    setIsUploading(true);
    addNotification(`Iniciando processamento de ${files.length} arquivos simultâneos.`, 'success');

    // Mapear palavras-chave atuais para este lote
    const batchKeywords = [...extractionKeywords];

    // Criar promessas para todos os arquivos
    const processingPromises = files.map(async (file) => {
      const id = Math.random().toString(36).substr(2, 9);
      
      const newDoc: ProcessedDocument = {
        id,
        orgId: org.id,
        userId: user.id,
        name: file.name,
        size: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
        sizeBytes: file.size,
        type: file.type,
        status: DocStatus.PROCESSING,
        timestamp: Date.now(),
        extractionKeywords: batchKeywords
      };

      // Adicionar à lista imediatamente como "em processamento"
      setDocuments(prev => [newDoc, ...prev]);

      return new Promise<void>((resolve) => {
        const reader = new FileReader();
        reader.onload = async () => {
          const fullDataUrl = reader.result as string;
          const base64 = fullDataUrl.split(',')[1];
          
          if (file.type.startsWith('image/')) {
            try {
              localStorage.setItem(`raw_${id}`, base64);
            } catch (e) {
              console.warn("Local storage cheio para preview de imagem.");
            }
          }

          try {
            const result = await processDocument(base64, newDoc.type, newDoc.extractionKeywords);
            setDocuments(prev => prev.map(d => d.id === id ? { ...d, status: DocStatus.COMPLETED, result } : d));
            addAuditLog('UPLOAD', `Análise Finalizada: ${file.name}`);
          } catch (error: any) {
            setDocuments(prev => prev.map(d => d.id === id ? { ...d, status: DocStatus.FAILED } : d));
            addNotification(`Erro em ${file.name}: ${error.message}`, 'error');
          } finally {
            resolve();
          }
        };
        reader.readAsDataURL(file);
      });
    });

    // Mudar para a aba de documentos para visualizar o progresso
    setActiveTab('documents');
    // Se for apenas um arquivo, seleciona ele automaticamente
    if (files.length === 1) {
       // O ID ainda não está disponível aqui facilmente sem mudar a estrutura, 
       // mas o dashboard já mostrará o mais recente no topo.
    }

    try {
      await Promise.all(processingPromises);
    } catch (err) {
      console.error("Erro no processamento do lote:", err);
    } finally {
      setIsUploading(false);
      if (event.target) event.target.value = '';
    }
  };

  if (isLoading) return <div className="h-screen flex items-center justify-center bg-slate-950"><Loader2 className="animate-spin text-indigo-500" /></div>;
  if (!user || !org) return <LoginView />;

  const selectedDoc = documents.find(d => d.id === selectedDocId);

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 overflow-hidden font-bold">
      <div className="fixed top-6 right-6 z-[100] flex flex-col gap-4 pointer-events-none">
        {notifications.map(n => (
          <div key={n.id} className={`pointer-events-auto flex items-center gap-4 p-5 rounded-3xl border-2 shadow-2xl animate-in slide-in-from-right-10 duration-500 ${n.type === 'error' ? 'bg-slate-900 border-rose-500 text-white' : n.type === 'warning' ? 'bg-slate-900 border-amber-500 text-white' : 'bg-slate-900 border-emerald-500 text-white'}`}>
            {n.type === 'error' ? <XCircle className="text-rose-500" size={24} /> : n.type === 'warning' ? <AlertCircle className="text-amber-500" size={24} /> : <ShieldCheck className="text-emerald-500" size={24} />}
            <div className="flex-1 min-w-[200px] max-w-sm">
              <p className="text-[10px] font-black uppercase tracking-widest opacity-50 mb-1">
                {n.type === 'error' ? 'Falha no Sistema' : n.type === 'warning' ? 'Aviso do Auditor' : 'Sucesso Operacional'}
              </p>
              <p className="text-xs font-bold leading-relaxed">{n.message}</p>
            </div>
            <button onClick={() => setNotifications(prev => prev.filter(item => item.id !== n.id))} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
              <X size={16} />
            </button>
          </div>
        ))}
      </div>

      <aside className="w-72 bg-slate-900 border-r-2 border-slate-800 flex flex-col shadow-2xl z-20 overflow-hidden">
        <div className="p-8 border-b-2 border-slate-800 flex items-center gap-4">
          <div className="w-12 h-12 bg-indigo-600 rounded-[20px] flex items-center justify-center text-white shadow-lg shadow-indigo-600/20">
            <BrainCircuit size={28} />
          </div>
          <span className="font-black text-2xl tracking-tighter uppercase text-white">FinDoc AI</span>
        </div>

        <nav className="p-6 space-y-2 border-b-2 border-slate-800">
          <SidebarItem icon={<LayoutDashboard size={18} />} label="Dashboard" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
          <SidebarItem icon={<FileSearch size={18} />} label="Audit-Trail" active={activeTab === 'documents'} onClick={() => setActiveTab('documents')} />
        </nav>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="bg-slate-950 p-6 rounded-[32px] border border-slate-800 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Tags size={16} className="text-indigo-400" />
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Diretrizes de Extração</span>
            </div>
            
            <p className="text-[9px] text-slate-500 uppercase leading-tight">Palavras-chave forçam a IA a intensificar a busca por dados específicos.</p>
            
            <div className="relative">
              <input 
                type="text" 
                placeholder="Ex: Valor IPI, Vencimento..." 
                value={keywordInput}
                onChange={e => setKeywordInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addKeyword()}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-xs font-bold outline-none focus:border-indigo-500 pr-10 text-white"
              />
              <button onClick={addKeyword} className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-indigo-600 rounded-lg text-white hover:bg-indigo-500 transition-all">
                <Plus size={14} />
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              {extractionKeywords.map(tag => (
                <span key={tag} className="bg-slate-900 border border-slate-700 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase text-indigo-300 flex items-center gap-2 animate-in zoom-in-50">
                  {tag}
                  <button onClick={() => removeKeyword(tag)} className="hover:text-white"><X size={10} /></button>
                </span>
              ))}
              {extractionKeywords.length === 0 && (
                <div className="text-[9px] text-slate-600 italic uppercase">Extração Linear Padrão</div>
              )}
            </div>
          </div>
        </div>

        <div className="p-6 border-t-2 border-slate-800">
           <button onClick={logout} className="w-full flex items-center justify-center gap-3 p-4 rounded-2xl text-slate-500 hover:text-rose-400 hover:bg-rose-950/30 transition-all font-black uppercase text-[10px] tracking-widest border border-transparent hover:border-rose-900/50">
            <LogOut size={16} /> Encerrar
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-slate-950">
        <header className="h-20 bg-slate-900 border-b-2 border-slate-800 flex items-center justify-between px-10 sticky top-0 z-10">
          <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-widest text-slate-500">
            <Server size={18} className="text-indigo-500" />
            <span className="text-slate-300">Cluster Ativo: {org.name}</span>
          </div>
          
          <div className="flex items-center gap-6">
            {isAdmin && (
              <div className="flex gap-4">
                <label className={`cursor-pointer bg-slate-800 hover:bg-slate-700 text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-3 transition-all border border-slate-700 ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
                  <Camera size={16} className="text-indigo-400" />
                  Capturar Foto
                  <input type="file" className="hidden" accept="image/*" capture="environment" onChange={handleFileUpload} disabled={isUploading} multiple />
                </label>
                <label className={`cursor-pointer bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-3 transition-all shadow-lg shadow-indigo-600/20 ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
                  {isUploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                  Upload em Lote
                  <input type="file" className="hidden" accept="application/pdf,image/*" onChange={handleFileUpload} disabled={isUploading} multiple />
                </label>
              </div>
            )}
          </div>
        </header>

        <div className="flex-1 overflow-auto p-10">
          {activeTab === 'dashboard' && <Dashboard documents={documents} onViewDoc={(id) => { setSelectedDocId(id); setActiveTab('documents'); }} />}
          {activeTab === 'documents' && (
            <DocumentViewer 
              document={selectedDoc} 
              onClose={() => setSelectedDocId(null)} 
              allDocs={documents} 
              onSelectDoc={setSelectedDocId}
              notify={addNotification}
            />
          )}
        </div>
      </main>
    </div>
  );
};

const SidebarItem: React.FC<{ icon: React.ReactNode; label: string; active?: boolean; onClick: () => void }> = ({ icon, label, active, onClick }) => (
  <button onClick={onClick} className={`w-full flex items-center gap-4 px-6 py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all ${active ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20 scale-105' : 'text-slate-500 hover:bg-slate-800 hover:text-slate-200'}`}>
    {icon}
    {label}
  </button>
);

const App: React.FC = () => (
  <AuthProvider>
    <AppContent />
  </AuthProvider>
);

export default App;
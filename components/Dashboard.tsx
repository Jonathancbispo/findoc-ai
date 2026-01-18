
import React, { useMemo, useState, useEffect } from 'react';
import { ProcessedDocument, DocStatus, PLAN_CONFIGS } from '../types';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  AreaChart,
  Area
} from 'recharts';
import { 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  FileText, 
  ArrowUpRight, 
  TrendingUp, 
  DollarSign, 
  Building, 
  Activity,
  ArrowUp,
  ArrowDown,
  RefreshCw,
  BrainCircuit
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface DashboardProps {
  documents: ProcessedDocument[];
  onViewDoc: (id: string) => void;
}

const COLORS = ['#6366f1', '#818cf8', '#a5b4fc', '#c7d2fe', '#e0e7ff'];

const Dashboard: React.FC<DashboardProps> = ({ documents, onViewDoc }) => {
  const { org } = useAuth();
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setIsSyncing(true);
      setTimeout(() => setIsSyncing(false), 2000);
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  const completedDocs = useMemo(() => documents.filter(d => d.status === DocStatus.COMPLETED), [documents]);
  
  const totalExtractedValue = useMemo(() => {
    return completedDocs.reduce((acc, doc) => {
      const revenueMetric = doc.result?.metrics?.find(m => {
        const label = (m.label || "").toLowerCase();
        return label.includes('receita') || label.includes('total');
      });
      return acc + (revenueMetric?.normalizedValueBRL || 0);
    }, 0);
  }, [completedDocs]);

  const supplierData = useMemo(() => {
    const counts: Record<string, number> = {};
    completedDocs.forEach(doc => {
      const name = doc.result?.companyName || 'Desconhecido';
      counts[name] = (counts[name] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [completedDocs]);

  const valueOverTime = useMemo(() => {
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return d.toLocaleDateString('pt-BR', { weekday: 'short' });
    });

    const dataMap: Record<string, number> = {};
    last7Days.forEach(day => dataMap[day] = 0);

    completedDocs.forEach(doc => {
      const day = new Date(doc.timestamp).toLocaleDateString('pt-BR', { weekday: 'short' });
      if (dataMap[day] !== undefined) {
        const val = doc.result?.metrics?.[0]?.normalizedValueBRL || 0;
        dataMap[day] += val;
      }
    });

    return last7Days.map(day => ({ name: day, value: dataMap[day] }));
  }, [completedDocs]);

  const limits = useMemo(() => org ? PLAN_CONFIGS[org.billingTier] : null, [org]);
  const usagePercentage = useMemo(() => {
    if (!limits) return 0;
    return (documents.length / limits.maxDocs) * 100;
  }, [documents, limits]);

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex items-center justify-between bg-slate-900 px-6 py-3 rounded-2xl border border-slate-800 shadow-sm">
        <div className="flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full ${isSyncing ? 'bg-indigo-400 animate-ping' : 'bg-green-400'}`} />
          <span className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
            {isSyncing ? 'Sincronizando Pipeline...' : 'Monitoramento em Tempo Real Ativo'}
            {isSyncing && <RefreshCw size={12} className="animate-spin" />}
          </span>
        </div>
        <div className="text-[10px] font-bold text-slate-500 bg-slate-950 px-3 py-1 rounded-full border border-slate-800 uppercase tracking-tighter">
          Atualizado às: {new Date().toLocaleTimeString('pt-BR')}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Capital Extraído" 
          value={totalExtractedValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })} 
          icon={<DollarSign className="text-emerald-400" />} 
          trend="+12.5%" 
          positive
        />
        <StatCard 
          title="Principal Fornecedor" 
          value={supplierData[0]?.name || '—'} 
          icon={<Building className="text-indigo-400" />} 
          trend={`${supplierData[0]?.count || 0} docs`}
        />
        <StatCard 
          title="Velocidade de Ingestão" 
          value={`${completedDocs.length} Arquivos`} 
          icon={<Activity className="text-blue-400" />} 
          trend="Média de 8.4s"
        />
        <StatCard 
          title="Ocupação do Plano" 
          value={`${usagePercentage.toFixed(0)}%`} 
          icon={<TrendingUp className="text-amber-400" />} 
          trend={`${documents.length}/${limits?.maxDocs}`}
          warning={usagePercentage > 85}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-slate-900 p-6 rounded-3xl border border-slate-800 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="font-bold text-lg text-white">Visão de Liquidez Extraída</h3>
              <p className="text-xs text-slate-500">Volume de capital identificado diariamente pelo pipeline</p>
            </div>
            <div className="flex items-center gap-2 bg-slate-950 p-1 rounded-lg border border-slate-800">
               <button className="px-3 py-1 text-[10px] font-bold text-slate-500 hover:text-white transition-colors">1D</button>
               <button className="px-3 py-1 text-[10px] font-bold bg-indigo-600 text-white shadow-sm rounded-md border border-indigo-500">7D</button>
               <button className="px-3 py-1 text-[10px] font-bold text-slate-500 hover:text-white transition-colors">1M</button>
            </div>
          </div>
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={valueOverTime}>
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(val) => `R$${val >= 1000 ? (val/1000).toFixed(0)+'k' : val}`} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '12px' }}
                  itemStyle={{ color: '#818cf8' }}
                  formatter={(val: any) => [`R$ ${val.toLocaleString('pt-BR')}`, 'Valor Total']} 
                />
                <Area type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorValue)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 shadow-sm">
          <div className="mb-6">
            <h3 className="font-bold text-lg text-white">Ranking de Fornecedores</h3>
            <p className="text-xs text-slate-500">Distribuição de documentos por entidade</p>
          </div>
          <div className="h-[200px] mb-6">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={supplierData} layout="vertical">
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} width={80} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={16}>
                  {supplierData.map((entry, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-3">
             {supplierData.map((s, i) => (
               <div key={i} className="flex items-center justify-between p-2 rounded-xl bg-slate-950 border border-slate-800">
                 <span className="text-xs font-bold text-slate-300 truncate max-w-[120px]">{s.name}</span>
                 <span className="text-[10px] font-black text-indigo-400 uppercase">{s.count} ARQUIVOS</span>
               </div>
             ))}
          </div>
        </div>
      </div>

      <div className="bg-slate-900 rounded-3xl border border-slate-800 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-800 bg-slate-950 flex justify-between items-center">
          <h3 className="font-bold text-lg text-white">Atividade Recente do Pipeline</h3>
          <span className="text-[10px] font-black uppercase text-slate-500">Ambiente de Produção</span>
        </div>
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-slate-800 text-slate-500 text-[9px] font-black uppercase tracking-widest">
              <th className="px-6 py-4">Documento / Empresa</th>
              <th className="px-6 py-4">Confiança IA</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4">Processado em</th>
              <th className="px-6 py-4 text-right">Ação</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {documents.length === 0 ? (
              <tr><td colSpan={5} className="px-6 py-12 text-center text-slate-500 italic">Nenhum documento processado ainda.</td></tr>
            ) : documents.slice(0, 5).map(doc => (
              <tr key={doc.id} className="hover:bg-slate-800/50 transition-colors">
                <td className="px-6 py-5">
                  <div className="font-bold text-slate-200 text-sm">{doc.result?.companyName || doc.name}</div>
                  <div className="text-[10px] text-slate-500">{doc.name}</div>
                </td>
                <td className="px-6 py-5 text-xs font-bold text-slate-300">{doc.result?.integrityScore || 0}%</td>
                <td className="px-6 py-5">
                   <span className={`px-2 py-1 rounded-full text-[9px] font-black uppercase ${doc.status === DocStatus.COMPLETED ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>
                    {doc.status === DocStatus.COMPLETED ? 'Sucesso' : 'Em curso'}
                   </span>
                </td>
                <td className="px-6 py-5 text-[11px] font-medium text-slate-500">{new Date(doc.timestamp).toLocaleString('pt-BR')}</td>
                <td className="px-6 py-5 text-right">
                  <button onClick={() => onViewDoc(doc.id)} className="text-indigo-400 hover:bg-indigo-500/10 p-2 rounded-lg transition-colors"><ArrowUpRight size={18} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const StatCard: React.FC<{ title: string; value: string; icon: React.ReactNode; trend?: string; warning?: boolean; positive?: boolean }> = ({ title, value, icon, trend, warning, positive }) => (
  <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 shadow-sm hover:shadow-indigo-500/5 transition-all">
    <div className="flex justify-between items-start mb-6">
      <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800">{icon}</div>
      {trend && <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${positive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>{trend}</span>}
    </div>
    <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">{title}</div>
    <div className="text-xl font-black text-white">{value}</div>
  </div>
);

export default Dashboard;

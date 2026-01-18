
import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { BrainCircuit, Loader2, ArrowRight, User as UserIcon, ShieldCheck } from 'lucide-react';
import { Role } from '../types';

const LoginView: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>(Role.ADMIN);
  const [name, setName] = useState('');
  const [orgName, setOrgName] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, register } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isLogin) {
        await login(email, password, role);
      } else {
        await register(name, email, orgName);
      }
    } catch (err) {
      alert('Falha na autenticação ou e-mail inválido.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 p-6">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-10">
          <div className="w-20 h-20 bg-indigo-600 rounded-[30px] flex items-center justify-center text-white shadow-2xl shadow-indigo-600/30 mb-6">
            <BrainCircuit size={40} />
          </div>
          <h1 className="text-4xl font-black text-white tracking-tight uppercase">FinDoc AI</h1>
          <p className="text-slate-500 mt-2 font-bold uppercase text-[10px] tracking-[0.3em]">Serviço de Governança Digital</p>
        </div>

        <div className="bg-slate-900 p-10 rounded-[40px] border border-slate-800 shadow-2xl">
          <h2 className="text-xl font-black text-white mb-8 text-center uppercase tracking-widest">
            {isLogin ? 'Controle de Acesso' : 'Criar Organização'}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-5">
            {!isLogin && (
              <>
                <InputField label="Nome Completo" value={name} onChange={setName} placeholder="Ex: João Silva" />
                <InputField label="Nome da Empresa" value={orgName} onChange={setOrgName} placeholder="Ex: Acme S.A." />
              </>
            )}
            <InputField label="E-mail Corporativo" type="email" value={email} onChange={setEmail} placeholder="contato@empresa.com" />
            <InputField label="Senha Segura" type="password" value={password} onChange={setPassword} placeholder="••••••••" />
            
            {isLogin && (
              <div className="space-y-2">
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Nível de Permissão</label>
                <div className="grid grid-cols-2 gap-3">
                  <button 
                    type="button"
                    onClick={() => setRole(Role.ADMIN)}
                    className={`flex items-center justify-center gap-2 p-3 rounded-2xl border transition-all font-black text-[10px] uppercase ${role === Role.ADMIN ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg' : 'bg-slate-950 border-slate-800 text-slate-500'}`}
                  >
                    <ShieldCheck size={14} /> Administrador
                  </button>
                  <button 
                    type="button"
                    onClick={() => setRole(Role.VIEWER)}
                    className={`flex items-center justify-center gap-2 p-3 rounded-2xl border transition-all font-black text-[10px] uppercase ${role === Role.VIEWER ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg' : 'bg-slate-950 border-slate-800 text-slate-500'}`}
                  >
                    <UserIcon size={14} /> Usuário Padrão
                  </button>
                </div>
              </div>
            )}

            <button 
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-black py-5 rounded-2xl flex items-center justify-center gap-3 transition-all shadow-xl shadow-indigo-600/20 disabled:opacity-50 mt-8 uppercase text-xs tracking-widest"
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : (
                <>
                  {isLogin ? 'Autorizar Acesso' : 'Registrar Serviço'}
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>

          <div className="mt-10 text-center border-t border-slate-800 pt-8">
            <button 
              onClick={() => setIsLogin(!isLogin)}
              className="text-[10px] font-black text-indigo-400 hover:text-indigo-300 transition-colors uppercase tracking-widest underline underline-offset-8"
            >
              {isLogin ? "Precisa de uma instância corporativa? Registre-se" : "Já possui conta? Faça o login"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const InputField: React.FC<{ label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string }> = ({ label, value, onChange, type = 'text', placeholder }) => (
  <div className="space-y-1">
    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">{label}</label>
    <input 
      type={type} required placeholder={placeholder}
      className="w-full px-5 py-4 rounded-2xl bg-slate-950 border border-slate-800 text-white focus:border-indigo-500 transition-all text-sm font-bold outline-none placeholder:text-slate-700 shadow-inner"
      value={value} onChange={(e) => onChange(e.target.value)}
    />
  </div>
);

export default LoginView;

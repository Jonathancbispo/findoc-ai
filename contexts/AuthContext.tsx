
import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, Organization, Role, BillingTier, AuditLog, DownloadRecord } from '../types';

interface AuthContextType {
  user: User | null;
  org: Organization | null;
  auditLogs: AuditLog[];
  downloads: DownloadRecord[];
  login: (email: string, pass: string, role?: Role) => Promise<void>;
  register: (name: string, email: string, orgName: string) => Promise<void>;
  logout: () => void;
  addAuditLog: (action: AuditLog['action'], details: string, status?: AuditLog['status']) => void;
  trackDownload: (docName: string, format: 'PDF' | 'EXCEL') => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [org, setOrg] = useState<Organization | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [downloads, setDownloads] = useState<DownloadRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const DOWNLOAD_TTL = 1000 * 60 * 60 * 24; // 24 Horas

  useEffect(() => {
    const savedSession = localStorage.getItem('findoc_session');
    if (savedSession) {
      const { user, org } = JSON.parse(savedSession);
      setUser(user);
      setOrg(org);
      
      const savedLogs = localStorage.getItem(`audit_${org.id}`);
      if (savedLogs) setAuditLogs(JSON.parse(savedLogs));

      const savedDownloads = localStorage.getItem(`downloads_${user.id}`);
      if (savedDownloads) {
        const filtered = JSON.parse(savedDownloads).filter((d: DownloadRecord) => d.expiresAt > Date.now());
        setDownloads(filtered);
      }
    }
    setIsLoading(false);
  }, []);

  const saveSession = (u: User, o: Organization) => {
    setUser(u);
    setOrg(o);
    localStorage.setItem('findoc_session', JSON.stringify({ user: u, org: o }));
  };

  const trackDownload = (docName: string, format: 'PDF' | 'EXCEL') => {
    if (!user) return;
    const newDownload: DownloadRecord = {
      id: Math.random().toString(36).substr(2, 9),
      docName,
      format,
      timestamp: Date.now(),
      expiresAt: Date.now() + DOWNLOAD_TTL
    };
    const updated = [newDownload, ...downloads];
    setDownloads(updated);
    localStorage.setItem(`downloads_${user.id}`, JSON.stringify(updated));
    addAuditLog('EXPORT', `Exportação realizada: ${docName} (${format})`);
  };

  const addAuditLog = (action: AuditLog['action'], details: string, status: AuditLog['status'] = 'SUCCESS') => {
    if (!user || !org) return;
    const newLog: AuditLog = {
      id: Math.random().toString(36).substr(2, 9),
      timestamp: Date.now(),
      userId: user.id,
      userName: user.name,
      action,
      details,
      ip: '192.168.1.1',
      status
    };
    const updatedLogs = [newLog, ...auditLogs].slice(0, 100);
    setAuditLogs(updatedLogs);
    localStorage.setItem(`audit_${org.id}`, JSON.stringify(updatedLogs));
  };

  const login = async (email: string, pass: string, role: Role = Role.ADMIN) => {
    const mockOrg: Organization = { 
      id: 'org_123', 
      name: 'Acme Financial', 
      billingTier: 'PRO',
      createdAt: Date.now() - 1000 * 60 * 60 * 24 * 30,
      encryptionKeyId: 'kms-fips-140-2-active',
      isLGPDCompliant: true,
      dataRetentionDays: 365
    };
    const mockUser: User = { 
      id: 'u_1', 
      email, 
      name: email.split('@')[0], 
      role, 
      orgId: mockOrg.id 
    };
    saveSession(mockUser, mockOrg);
    addAuditLog('LOGIN', `Autenticação bem-sucedida como ${role}`);
  };

  const register = async (name: string, email: string, orgName: string) => {
    const newOrg: Organization = { 
      id: `org_${Math.random().toString(36).substr(2, 5)}`, 
      name: orgName, 
      billingTier: 'FREE',
      createdAt: Date.now(),
      encryptionKeyId: 'kms-fips-140-2-default',
      isLGPDCompliant: true,
      dataRetentionDays: 30
    };
    const newUser: User = { 
      id: `u_${Math.random().toString(36).substr(2, 5)}`, 
      email, 
      name, 
      role: Role.ADMIN, 
      orgId: newOrg.id 
    };
    saveSession(newUser, newOrg);
    addAuditLog('LOGIN', 'Nova conta organizacional criada');
  };

  const logout = () => {
    setUser(null);
    setOrg(null);
    localStorage.removeItem('findoc_session');
  };

  return (
    <AuthContext.Provider value={{ user, org, auditLogs, downloads, login, register, logout, addAuditLog, trackDownload, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};

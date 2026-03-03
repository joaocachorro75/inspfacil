/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Users, 
  ClipboardList, 
  FilePlus, 
  LogOut, 
  Plus, 
  Camera, 
  CheckCircle, 
  Clock, 
  MapPin, 
  ChevronRight,
  FileText,
  Upload,
  Loader2,
  Image as ImageIcon,
  X,
  Settings,
  LayoutDashboard,
  Download,
  AlertTriangle,
  BarChart3,
  Edit,
  Trash2,
  HardHat
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell 
} from 'recharts';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import Groq from "groq-sdk";
import { User, Inspection, InspectionType, FormField, InspectionReport } from './types';

// --- Components ---

const Login = ({ onLogin }: { onLogin: (user: User) => void }) => {
  const [identifier, setIdentifier] = useState('admin');
  const [password, setPassword] = useState('admin123');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password })
      });
      if (res.ok) {
        const user = await res.json();
        onLogin(user);
      } else {
        setError('Credenciais inválidas');
      }
    } catch (err) {
      setError('Erro ao conectar ao servidor');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#E4E3E0] p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white p-8 rounded-2xl shadow-xl border border-red-100"
      >
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-red-600 rounded-2xl flex items-center justify-center mb-4">
            <HardHat className="text-white w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Inspetor EPI</h1>
          <p className="text-sm text-gray-500 italic">Gestão de Segurança do Trabalho</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">Usuário ou WhatsApp</label>
            <input 
              type="text" 
              value={identifier} 
              onChange={e => setIdentifier(e.target.value)}
              placeholder="admin ou 5511999999999"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-red-600/5 transition-all text-base"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">Senha</label>
            <input 
              type="password" 
              value={password} 
              onChange={e => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-red-600/5 transition-all text-base"
              required
            />
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-red-600 text-white py-3 rounded-xl font-semibold hover:bg-red-700 transition-colors flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="animate-spin w-5 h-5" /> : 'Entrar'}
          </button>
        </form>
        <div className="mt-6 pt-6 border-top border-gray-100 text-center">
          <p className="text-xs text-gray-400">Acesso restrito a pessoal autorizado</p>
        </div>
      </motion.div>
    </div>
  );
};

// --- Admin Views ---

const AdminDashboard = ({ user, onLogout }: { user: User, onLogout: () => void }) => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'inspections' | 'techs' | 'types' | 'settings'>('dashboard');
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [techs, setTechs] = useState<User[]>([]);
  const [types, setTypes] = useState<InspectionType[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [showNewTech, setShowNewTech] = useState(false);
  const [showNewType, setShowNewType] = useState(false);
  const [showNewInspection, setShowNewInspection] = useState(false);
  const [editingTech, setEditingTech] = useState<User | null>(null);
  const [editingType, setEditingType] = useState<InspectionType | null>(null);
  const [editingInspection, setEditingInspection] = useState<Inspection | null>(null);
  const [selectedReport, setSelectedReport] = useState<InspectionReport | null>(null);

  const fetchData = async () => {
    try {
      const [iRes, tRes, tyRes, sRes] = await Promise.all([
        fetch('/api/inspections/admin'),
        fetch('/api/technicians'),
        fetch('/api/inspection-types'),
        fetch('/api/stats')
      ]);
      setInspections(await iRes.json());
      setTechs(await tRes.json());
      setTypes(await tyRes.json());
      setStats(await sRes.json());
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleViewReport = async (id: number) => {
    const res = await fetch(`/api/inspections/${id}/report`);
    if (res.ok) {
      setSelectedReport(await res.json());
    }
  };

  const handleDeleteTech = async (id: number) => {
    if (!confirm('Deseja realmente excluir este técnico?')) return;
    const res = await fetch(`/api/technicians/${id}`, { method: 'DELETE' });
    if (res.ok) fetchData();
    else {
      const err = await res.json();
      alert(err.error || 'Erro ao excluir técnico');
    }
  };

  const handleDeleteType = async (id: number) => {
    if (!confirm('Deseja realmente excluir este tipo de inspeção?')) return;
    const res = await fetch(`/api/inspection-types/${id}`, { method: 'DELETE' });
    if (res.ok) fetchData();
    else {
      const err = await res.json();
      alert(err.error || 'Erro ao excluir tipo');
    }
  };

  const handleDeleteInspection = async (id: number) => {
    if (!confirm('Deseja realmente excluir esta inspeção?')) return;
    const res = await fetch(`/api/inspections/${id}`, { method: 'DELETE' });
    if (res.ok) fetchData();
  };

  return (
    <div className="min-h-screen bg-[#F5F5F5] flex flex-col md:flex-row">
      {/* Sidebar - Desktop */}
      <div className="hidden md:flex w-64 bg-white border-r border-gray-200 flex-col sticky top-0 h-screen">
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center gap-3 mb-2">
            <HardHat className="w-6 h-6 text-red-600" />
            <span className="font-bold text-lg tracking-tight">Inspetor EPI</span>
          </div>
          <p className="text-xs text-gray-400 font-mono text-red-600/50">ADMIN PANEL</p>
        </div>
        
        <nav className="flex-1 p-4 space-y-2">
          <button 
            onClick={() => setActiveTab('dashboard')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'dashboard' ? 'bg-red-600 text-white shadow-lg' : 'text-gray-500 hover:bg-gray-50'}`}
          >
            <LayoutDashboard size={20} />
            <span className="text-sm font-medium">Dashboard</span>
          </button>
          <button 
            onClick={() => setActiveTab('inspections')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'inspections' ? 'bg-red-600 text-white shadow-lg' : 'text-gray-500 hover:bg-gray-50'}`}
          >
            <ClipboardList size={20} />
            <span className="text-sm font-medium">Inspeções</span>
          </button>
          <button 
            onClick={() => setActiveTab('techs')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'techs' ? 'bg-red-600 text-white shadow-lg' : 'text-gray-500 hover:bg-gray-50'}`}
          >
            <Users size={20} />
            <span className="text-sm font-medium">Técnicos</span>
          </button>
          <button 
            onClick={() => setActiveTab('types')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'types' ? 'bg-red-600 text-white shadow-lg' : 'text-gray-500 hover:bg-gray-50'}`}
          >
            <FilePlus size={20} />
            <span className="text-sm font-medium">Tipos de Inspeção</span>
          </button>
          <button 
            onClick={() => setActiveTab('settings')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'settings' ? 'bg-red-600 text-white shadow-lg' : 'text-gray-500 hover:bg-gray-50'}`}
          >
            <Settings size={20} />
            <span className="text-sm font-medium">Configurações</span>
          </button>
        </nav>

        <div className="p-4 border-t border-gray-100">
          <div className="flex items-center gap-3 px-4 py-3 mb-2">
            <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold">
              {user.name[0]}
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-semibold truncate">{user.name}</p>
              <p className="text-[10px] text-gray-400 truncate">{user.username || user.whatsapp}</p>
            </div>
          </div>
          <button 
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-4 py-3 text-red-500 hover:bg-red-50 rounded-xl transition-all"
          >
            <LogOut size={20} />
            <span className="text-sm font-medium">Sair</span>
          </button>
        </div>
      </div>

      {/* Mobile Header */}
      <div className="md:hidden bg-white border-b border-gray-200 p-4 flex justify-between items-center sticky top-0 z-20">
        <div className="flex items-center gap-2">
          <HardHat className="w-6 h-6 text-red-600" />
          <span className="font-bold text-lg tracking-tight">Inspetor EPI</span>
        </div>
        <button onClick={onLogout} className="p-2 text-red-500">
          <LogOut size={20} />
        </button>
      </div>

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-8 overflow-y-auto pb-24 md:pb-8">
        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' && (
            <motion.div 
              key="dashboard"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <div className="mb-6 md:mb-8">
                <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Dashboard</h2>
                <p className="text-gray-500 italic serif text-sm md:text-base">Visão geral de performance e riscos</p>
              </div>
              <DashboardView stats={stats} />
            </motion.div>
          )}

          {activeTab === 'inspections' && (
            <motion.div 
              key="inspections"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-4 mb-6 md:mb-8">
                <div>
                  <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Inspeções</h2>
                  <p className="text-gray-500 italic serif text-sm md:text-base">Acompanhamento de vistorias em campo</p>
                </div>
                <button 
                  onClick={() => setShowNewInspection(true)}
                  className="bg-red-600 text-white px-6 py-3 rounded-xl font-semibold flex items-center justify-center gap-2 hover:bg-red-700 transition-all shadow-lg shadow-red-100 w-full md:w-auto"
                >
                  <Plus size={20} />
                  Nova Inspeção
                </button>
              </div>

              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                {/* Desktop Header */}
                <div className="hidden md:grid grid-cols-6 p-4 bg-gray-50 border-b border-gray-200 text-[10px] uppercase font-bold tracking-widest text-gray-400">
                  <div className="col-span-2">Tipo / Local</div>
                  <div>Técnico</div>
                  <div>Data Agendada</div>
                  <div>Status</div>
                  <div className="text-right">Ações</div>
                </div>
                
                {inspections.map(i => (
                  <div key={i.id} className="flex flex-col md:grid md:grid-cols-6 p-4 border-b border-gray-100 md:items-center hover:bg-gray-50 transition-colors gap-4 md:gap-0">
                    <div className="md:col-span-2">
                      <p className="font-semibold text-sm">{i.type_name}</p>
                      <div className="flex items-center gap-1 text-xs text-gray-400">
                        <MapPin size={12} />
                        {i.location}
                      </div>
                    </div>
                    <div className="flex justify-between md:block">
                      <span className="md:hidden text-[10px] font-bold uppercase text-gray-400">Técnico</span>
                      <div className="text-sm text-gray-600">{i.technician_name}</div>
                    </div>
                    <div className="flex justify-between md:block">
                      <span className="md:hidden text-[10px] font-bold uppercase text-gray-400">Data</span>
                      <div className="text-sm text-gray-600 font-mono">{i.scheduled_date}</div>
                    </div>
                    <div className="flex justify-between md:block">
                      <span className="md:hidden text-[10px] font-bold uppercase text-gray-400">Status</span>
                      <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        i.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                      }`}>
                        {i.status === 'completed' ? 'Concluída' : 'Pendente'}
                      </span>
                    </div>
                    <div className="flex justify-end gap-2 border-t md:border-t-0 pt-3 md:pt-0">
                      {i.status === 'completed' ? (
                        <button 
                          onClick={() => handleViewReport(i.id)}
                          className="text-red-600 hover:underline text-xs font-bold px-2 py-1"
                        >
                          Ver Relatório
                        </button>
                      ) : (
                        <button 
                          onClick={() => setEditingInspection(i)}
                          className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                          title="Editar Agendamento"
                        >
                          <Edit size={16} />
                        </button>
                      )}
                      <button 
                        onClick={() => handleDeleteInspection(i.id)}
                        className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                        title="Excluir Inspeção"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
                {inspections.length === 0 && (
                  <div className="p-12 text-center text-gray-400 italic">Nenhuma inspeção cadastrada</div>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'techs' && (
            <motion.div 
              key="techs"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-4 mb-6 md:mb-8">
                <div>
                  <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Técnicos</h2>
                  <p className="text-gray-500 italic serif text-sm md:text-base">Gerenciamento de equipe de campo</p>
                </div>
                <button 
                  onClick={() => setShowNewTech(true)}
                  className="bg-red-600 text-white px-6 py-3 rounded-xl font-semibold flex items-center justify-center gap-2 hover:bg-red-700 transition-all shadow-lg shadow-red-100 w-full md:w-auto"
                >
                  <Plus size={20} />
                  Novo Técnico
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                {techs.map(t => (
                  <div key={t.id} className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-all">
                    <div className="flex items-center gap-4 mb-4">
                      <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center text-lg font-bold">
                        {t.name[0]}
                      </div>
                      <div>
                        <h3 className="font-bold text-lg">{t.name}</h3>
                        <p className="text-xs text-gray-400">{t.whatsapp}</p>
                      </div>
                    </div>
                    <div className="pt-4 border-t border-gray-50 flex justify-between items-center">
                      <div className="flex gap-2">
                        <button 
                          onClick={() => setEditingTech(t)}
                          className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                          title="Editar Técnico"
                        >
                          <Edit size={16} />
                        </button>
                        <button 
                          onClick={() => handleDeleteTech(t.id)}
                          className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                          title="Excluir Técnico"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Técnico Ativo</span>
                        <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {activeTab === 'types' && (
            <motion.div 
              key="types"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-4 mb-6 md:mb-8">
                <div>
                  <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Tipos de Inspeção</h2>
                  <p className="text-gray-500 italic serif text-sm md:text-base">Definição de formulários via IA</p>
                </div>
                <button 
                  onClick={() => setShowNewType(true)}
                  className="bg-red-600 text-white px-6 py-3 rounded-xl font-semibold flex items-center justify-center gap-2 hover:bg-red-700 transition-all shadow-lg shadow-red-100 w-full md:w-auto"
                >
                  <Upload size={20} />
                  Importar Formulário
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                {types.map(t => (
                  <div key={t.id} className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center">
                          <FileText className="text-gray-400" size={20} />
                        </div>
                        <h3 className="font-bold text-lg">{t.name}</h3>
                      </div>
                      <div className="flex items-center gap-1">
                        <button 
                          onClick={() => setEditingType(t)}
                          className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                          title="Editar Tipo"
                        >
                          <Edit size={16} />
                        </button>
                        <button 
                          onClick={() => handleDeleteType(t.id)}
                          className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                          title="Excluir Tipo"
                        >
                          <Trash2 size={16} />
                        </button>
                        <span className="text-[10px] font-bold bg-gray-100 px-2 py-1 rounded uppercase tracking-widest ml-2">
                          {t.schema.length} campos
                        </span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      {t.schema.slice(0, 3).map((f, idx) => (
                        <div key={idx} className="flex items-center justify-between text-xs text-gray-500">
                          <span>{f.label}</span>
                          <span className="font-mono opacity-50">{f.type}</span>
                        </div>
                      ))}
                      {t.schema.length > 3 && <p className="text-[10px] text-gray-400 italic">...e mais {t.schema.length - 3} campos</p>}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {activeTab === 'settings' && (
            <motion.div 
              key="settings"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <div className="mb-6 md:mb-8">
                <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Configurações</h2>
                <p className="text-gray-500 italic serif text-sm md:text-base">Gerenciamento de integrações e sistema</p>
              </div>
              <SettingsView />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Bottom Navigation - Mobile */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-2 flex justify-between items-center z-30">
        <button onClick={() => setActiveTab('dashboard')} className={`flex flex-col items-center gap-1 p-2 ${activeTab === 'dashboard' ? 'text-red-600' : 'text-gray-400'}`}>
          <LayoutDashboard size={20} />
          <span className="text-[10px] font-bold uppercase">Início</span>
        </button>
        <button onClick={() => setActiveTab('inspections')} className={`flex flex-col items-center gap-1 p-2 ${activeTab === 'inspections' ? 'text-red-600' : 'text-gray-400'}`}>
          <ClipboardList size={20} />
          <span className="text-[10px] font-bold uppercase">Inspeções</span>
        </button>
        <button onClick={() => setActiveTab('techs')} className={`flex flex-col items-center gap-1 p-2 ${activeTab === 'techs' ? 'text-red-600' : 'text-gray-400'}`}>
          <Users size={20} />
          <span className="text-[10px] font-bold uppercase">Equipe</span>
        </button>
        <button onClick={() => setActiveTab('types')} className={`flex flex-col items-center gap-1 p-2 ${activeTab === 'types' ? 'text-red-600' : 'text-gray-400'}`}>
          <FilePlus size={20} />
          <span className="text-[10px] font-bold uppercase">Tipos</span>
        </button>
        <button onClick={() => setActiveTab('settings')} className={`flex flex-col items-center gap-1 p-2 ${activeTab === 'settings' ? 'text-red-600' : 'text-gray-400'}`}>
          <Settings size={20} />
          <span className="text-[10px] font-bold uppercase">Config</span>
        </button>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {showNewTech && (
          <Modal title="Novo Técnico" onClose={() => setShowNewTech(false)}>
            <NewTechForm onComplete={() => { setShowNewTech(false); fetchData(); }} />
          </Modal>
        )}
        {showNewType && (
          <Modal title="Importar Formulário (IA)" onClose={() => setShowNewType(false)}>
            <NewTypeForm onComplete={() => { setShowNewType(false); fetchData(); }} />
          </Modal>
        )}
        {showNewInspection && (
          <Modal title="Agendar Inspeção" onClose={() => setShowNewInspection(false)}>
            <NewInspectionForm techs={techs} types={types} onComplete={() => { setShowNewInspection(false); fetchData(); }} />
          </Modal>
        )}
        {editingTech && (
          <Modal title="Editar Técnico" onClose={() => setEditingTech(null)}>
            <NewTechForm initialData={editingTech} onComplete={() => { setEditingTech(null); fetchData(); }} />
          </Modal>
        )}
        {editingType && (
          <Modal title="Editar Tipo de Inspeção" onClose={() => setEditingType(null)}>
            <NewTypeForm initialData={editingType} onComplete={() => { setEditingType(null); fetchData(); }} />
          </Modal>
        )}
        {editingInspection && (
          <Modal title="Editar Agendamento" onClose={() => setEditingInspection(null)}>
            <NewInspectionForm initialData={editingInspection} techs={techs} types={types} onComplete={() => { setEditingInspection(null); fetchData(); }} />
          </Modal>
        )}
        {selectedReport && (
          <Modal title="Relatório de Inspeção" onClose={() => setSelectedReport(null)} wide>
            <ReportView report={selectedReport} />
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
};

// --- Technician Views ---

const TechnicianDashboard = ({ user, onLogout }: { user: User, onLogout: () => void }) => {
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [selectedInspection, setSelectedInspection] = useState<Inspection | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchInspections = async () => {
    setLoading(true);
    const res = await fetch(`/api/inspections/technician/${user.id}`);
    setInspections(await res.json());
    setLoading(false);
  };

  useEffect(() => { fetchInspections(); }, []);

  return (
    <div className="min-h-screen bg-[#F5F5F5]">
      <header className="bg-white border-b border-gray-200 p-4 md:p-6 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2 md:gap-3">
            <HardHat className="w-6 h-6 md:w-8 md:h-8 text-red-600" />
            <div>
              <h1 className="font-bold text-lg md:text-xl tracking-tight">Inspetor EPI</h1>
              <p className="text-[8px] md:text-[10px] font-bold uppercase tracking-widest text-gray-400">Área do Técnico</p>
            </div>
          </div>
          <div className="flex items-center gap-2 md:gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-bold">{user.name}</p>
              <p className="text-[10px] text-gray-400">{user.whatsapp}</p>
            </div>
            <button onClick={onLogout} className="p-2 text-gray-400 hover:text-red-500 transition-colors">
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 md:p-6">
        <div className="mb-6 md:mb-8">
          <h2 className="text-xl md:text-2xl font-bold mb-1 md:mb-2">Minhas Inspeções</h2>
          <p className="text-gray-500 italic serif text-sm md:text-base">Vistorias pendentes aguardando preenchimento</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="animate-spin text-gray-400" size={32} />
          </div>
        ) : (
          <div className="space-y-4">
            {inspections.map(i => (
              <motion.button
                key={i.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={() => setSelectedInspection(i)}
                className="w-full bg-white p-6 rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-all flex items-center justify-between text-left group"
              >
                <div className="flex items-center gap-6">
                  <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center text-gray-400 group-hover:bg-red-600 group-hover:text-white transition-all">
                    <HardHat size={24} />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">{i.type_name}</h3>
                    <div className="flex flex-wrap gap-4 mt-1">
                      <div className="flex items-center gap-1 text-xs text-gray-400">
                        <MapPin size={14} />
                        {i.location}
                      </div>
                      <div className="flex items-center gap-1 text-xs text-gray-400">
                        <Clock size={14} />
                        {i.scheduled_date}
                      </div>
                    </div>
                  </div>
                </div>
                <ChevronRight className="text-gray-300 group-hover:text-black group-hover:translate-x-1 transition-all" />
              </motion.button>
            ))}
            {inspections.length === 0 && (
              <div className="bg-white p-12 rounded-2xl border border-dashed border-gray-300 text-center text-gray-400 italic">
                Nenhuma inspeção pendente no momento. Bom trabalho!
              </div>
            )}
          </div>
        )}
      </main>

      <AnimatePresence>
        {selectedInspection && (
          <div className="fixed inset-0 z-50 bg-white overflow-y-auto">
            <InspectionForm 
              inspection={selectedInspection} 
              onClose={() => setSelectedInspection(null)}
              onComplete={() => {
                setSelectedInspection(null);
                fetchInspections();
              }}
            />
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

// --- Helper Components ---

const Modal = ({ title, children, onClose, wide = false }: { title: string, children: React.ReactNode, onClose: () => void, wide?: boolean }) => (
  <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4 bg-black/40 backdrop-blur-sm">
    <motion.div 
      initial={{ opacity: 0, y: 100 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 100 }}
      className={`bg-white rounded-t-3xl md:rounded-3xl shadow-2xl overflow-hidden flex flex-col h-[95vh] md:h-auto md:max-h-[90vh] ${wide ? 'w-full max-w-4xl' : 'w-full max-w-lg'}`}
    >
      <div className="p-4 md:p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
        <h3 className="font-bold text-lg md:text-xl tracking-tight">{title}</h3>
        <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
          <X size={20} />
        </button>
      </div>
      <div className="p-4 md:p-6 overflow-y-auto flex-1 pb-20 md:pb-6">
        {children}
      </div>
    </motion.div>
  </div>
);

const NewTechForm = ({ onComplete, initialData }: { onComplete: () => void, initialData?: User }) => {
  const [name, setName] = useState(initialData?.name || '');
  const [whatsapp, setWhatsapp] = useState(initialData?.whatsapp || '');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const url = initialData ? `/api/technicians/${initialData.id}` : '/api/technicians';
    const method = initialData ? 'PUT' : 'POST';
    
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, whatsapp, password: password || undefined })
    });
    if (res.ok) onComplete();
    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Nome Completo</label>
        <input required value={name} onChange={e => setName(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-black/5 outline-none" />
      </div>
      <div>
        <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">WhatsApp (com DDD)</label>
        <input required type="text" placeholder="5511999999999" value={whatsapp} onChange={e => setWhatsapp(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-black/5 outline-none" />
      </div>
      <div>
        <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Senha de Acesso {initialData && '(deixe em branco para manter)'}</label>
        <input required={!initialData} type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-black/5 outline-none" />
      </div>
      <button disabled={loading} className="w-full bg-red-600 text-white py-4 rounded-xl font-bold hover:bg-red-700 transition-all flex items-center justify-center gap-2">
        {loading ? <Loader2 className="animate-spin" /> : initialData ? 'Salvar Alterações' : 'Cadastrar Técnico'}
      </button>
    </form>
  );
};

const NewTypeForm = ({ onComplete, initialData }: { onComplete: () => void, initialData?: InspectionType }) => {
  const [name, setName] = useState(initialData?.name || '');
  const [content, setContent] = useState('');
  const [file, setFile] = useState<{ data: string, type: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setFile({
        data: reader.result as string,
        type: selectedFile.type
      });
    };
    reader.readAsDataURL(selectedFile);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      if (initialData && !file && !content) {
        // Just rename
        const res = await fetch(`/api/inspection-types/${initialData.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, schema: initialData.schema })
        });
        if (res.ok) onComplete();
        return;
      }

      const apiKey = process.env.GROQ_API_KEY;
      if (!apiKey) {
        throw new Error('GROQ_API_KEY não configurada no ambiente.');
      }
      const groq = new Groq({ apiKey, dangerouslyAllowBrowser: true });
      let schema = [];

      const promptContent = `Analise o seguinte conteúdo de um formulário de inspeção e gere um esquema JSON para um formulário dinâmico. 
      O esquema deve ser um array de objetos, onde cada objeto tem: "label" (string), "type" (string: 'text', 'number', 'boolean', 'select'), "options" (array de strings, apenas se type for 'select'), "required" (boolean).
      
      IMPORTANTE: Se o formulário tiver perguntas de Sim/Não/NA, use type: 'boolean'. Se for múltipla escolha, use type: 'select'.
      Responda APENAS o JSON.`;

      let messages: any[] = [{ role: 'user', content: [{ type: 'text', text: promptContent }] }];

      if (file) {
        if (file.type === 'application/pdf') {
          // Groq doesn't support PDF directly, we'd need text extraction
          // For now, let's assume we can't process PDF or we'd need a server-side extractor
          messages[0].content.push({ type: 'text', text: "Nota: O usuário enviou um PDF. Tente inferir os campos se houver texto disponível ou peça para enviar em outro formato." });
        } else if (file.type.includes('wordprocessingml') || file.type.includes('msword')) {
          const extractRes = await fetch('/api/extract-text', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fileData: file.data })
          });
          if (extractRes.ok) {
            const { text } = await extractRes.json();
            messages[0].content.push({ type: 'text', text: `Conteúdo do arquivo Word: ${text}` });
          } else {
            throw new Error("Falha ao extrair texto do Word");
          }
        } else {
          messages[0].content.push({ type: 'text', text: `Conteúdo: ${content}` });
        }
      } else {
        messages[0].content.push({ type: 'text', text: `Conteúdo: ${content}` });
      }

      const response = await groq.chat.completions.create({
        model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
        messages,
        response_format: { type: "json_object" }
      });

      const result = JSON.parse(response.choices[0]?.message?.content || "[]");
      schema = Array.isArray(result) ? result : (result.schema || result.fields || []);

      const url = initialData ? `/api/inspection-types/${initialData.id}` : '/api/inspection-types';
      const method = initialData ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, schema })
      });
      if (res.ok) onComplete();
    } catch (err) {
      console.error("AI Error:", err);
      alert("Erro ao gerar formulário via IA. Verifique sua chave de API.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Nome da Inspeção</label>
        <input required placeholder="Ex: Inspeção de Extintores" value={name} onChange={e => setName(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-black/5 outline-none" />
      </div>
      
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">
              {initialData ? 'Atualizar Formulário (Opcional)' : 'Upload de Arquivo (PDF/Word)'}
            </label>
            <button 
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className={`w-full px-4 py-3 rounded-xl border-2 border-dashed transition-all flex items-center justify-center gap-2 ${file ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-gray-200 text-gray-400 hover:border-black hover:text-black'}`}
            >
              {file ? <><CheckCircle size={18} /> Arquivo Selecionado</> : <><Upload size={18} /> Selecionar PDF ou Word</>}
            </button>
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept=".pdf,.doc,.docx" 
              onChange={handleFileChange} 
            />
          </div>
          <div className="pt-5 text-gray-300 font-bold">OU</div>
          <div className="flex-1">
             <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1 opacity-0">.</label>
             <p className="text-[10px] text-gray-400 italic py-3">Cole o texto abaixo</p>
          </div>
        </div>

        {!file && (
          <div>
            <textarea 
              placeholder={initialData ? "Deixe em branco para manter o formulário atual ou cole novo texto..." : "Cole aqui o texto do formulário ou descreva os campos necessários..."}
              rows={6}
              value={content} 
              onChange={e => setContent(e.target.value)} 
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-black/5 outline-none font-mono text-xs"
            />
          </div>
        )}
      </div>

      <div className="p-4 bg-red-50 rounded-xl border border-red-100 flex gap-3">
        <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center shrink-0">
          <HardHat className="text-red-600 w-4 h-4" />
        </div>
        <p className="text-[10px] text-red-800 leading-relaxed">
          {initialData ? 'Se você fornecer um novo arquivo ou texto, a IA irá gerar um novo formulário substituindo o atual.' : 'Nossa IA irá analisar o arquivo ou texto fornecido e criar automaticamente os campos do formulário digital.'}
        </p>
      </div>
      <button disabled={loading} className="w-full bg-red-600 text-white py-4 rounded-xl font-bold hover:bg-red-700 transition-all flex items-center justify-center gap-2">
        {loading ? <Loader2 className="animate-spin" /> : initialData ? 'Salvar Alterações' : 'Gerar Formulário Digital'}
      </button>
    </form>
  );
};

const NewInspectionForm = ({ techs, types, onComplete, initialData }: { techs: User[], types: InspectionType[], onComplete: () => void, initialData?: Inspection }) => {
  const [typeId, setTypeId] = useState(initialData?.type_id?.toString() || '');
  const [techId, setTechId] = useState(initialData?.technician_id?.toString() || '');
  const [location, setLocation] = useState(initialData?.location || '');
  const [date, setDate] = useState(initialData?.scheduled_date || '');
  const [status, setStatus] = useState(initialData?.status || 'pending');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const url = initialData ? `/api/inspections/${initialData.id}` : '/api/inspections';
    const method = initialData ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        type_id: typeId, 
        technician_id: techId, 
        location, 
        scheduled_date: date,
        status
      })
    });
    if (res.ok) onComplete();
    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Tipo de Inspeção</label>
        <select required value={typeId} onChange={e => setTypeId(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-black/5 outline-none bg-white">
          <option value="">Selecione um tipo...</option>
          {types.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Técnico Responsável</label>
        <select required value={techId} onChange={e => setTechId(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-black/5 outline-none bg-white">
          <option value="">Selecione um técnico...</option>
          {techs.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Local da Inspeção</label>
        <input required placeholder="Ex: Unidade Industrial A - Setor 04" value={location} onChange={e => setLocation(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-black/5 outline-none" />
      </div>
      <div>
        <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Data Agendada</label>
        <input required type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-black/5 outline-none" />
      </div>
      {initialData && (
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Status</label>
          <select required value={status} onChange={e => setStatus(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-black/5 outline-none bg-white">
            <option value="pending">Pendente</option>
            <option value="completed">Concluída</option>
          </select>
        </div>
      )}
      <button disabled={loading} className="w-full bg-red-600 text-white py-4 rounded-xl font-bold hover:bg-red-700 transition-all flex items-center justify-center gap-2">
        {loading ? <Loader2 className="animate-spin" /> : initialData ? 'Salvar Alterações' : 'Agendar Inspeção'}
      </button>
    </form>
  );
};

const InspectionForm = ({ inspection, onClose, onComplete }: { inspection: Inspection, onClose: () => void, onComplete: () => void }) => {
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [photos, setPhotos] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    
    Array.from(files).forEach((file: File) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotos(prev => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const res = await fetch(`/api/inspections/${inspection.id}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: formData, photos })
    });
    if (res.ok) onComplete();
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F5F5F5]">
      <header className="bg-white border-b border-gray-200 p-3 md:p-4 sticky top-0 z-20 flex justify-between items-center">
        <div className="flex items-center gap-2 md:gap-3">
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <X size={20} />
          </button>
          <div className="overflow-hidden">
            <h2 className="font-bold text-base md:text-lg leading-tight truncate">{inspection.type_name}</h2>
            <p className="text-[8px] md:text-[10px] text-gray-400 uppercase tracking-widest truncate">{inspection.location}</p>
          </div>
        </div>
        <button 
          onClick={handleSubmit}
          disabled={loading}
          className="bg-emerald-600 text-white px-4 md:px-6 py-2 rounded-xl font-bold hover:bg-emerald-700 transition-all flex items-center gap-2 shadow-lg shadow-emerald-100 text-sm md:text-base"
        >
          {loading ? <Loader2 className="animate-spin" /> : <><CheckCircle size={18} /> Finalizar</>}
        </button>
      </header>

      <div className="flex-1 max-w-2xl mx-auto w-full p-6 space-y-8">
        <section className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm space-y-6">
          <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 border-b border-gray-50 pb-4">Formulário de Inspeção</h3>
          <div className="space-y-6">
            {inspection.schema?.map((field, idx) => (
              <div key={idx}>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  {field.label} {field.required && <span className="text-red-500">*</span>}
                </label>
                {field.type === 'select' ? (
                  <select 
                    required={field.required}
                    onChange={e => setFormData(p => ({ ...p, [field.label]: e.target.value }))}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-black/5 outline-none bg-white"
                  >
                    <option value="">Selecione...</option>
                    {field.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                ) : field.type === 'boolean' ? (
                  <div className="flex gap-4">
                    {['Sim', 'Não', 'N/A'].map(opt => (
                      <label key={opt} className="flex-1">
                        <input 
                          type="radio" 
                          name={field.label} 
                          value={opt}
                          onChange={e => setFormData(p => ({ ...p, [field.label]: e.target.value }))}
                          className="hidden peer" 
                        />
                        <div className="text-center py-3 rounded-xl border border-gray-200 peer-checked:bg-red-600 peer-checked:text-white peer-checked:border-red-600 transition-all cursor-pointer text-sm font-medium">
                          {opt}
                        </div>
                      </label>
                    ))}
                  </div>
                ) : (
                  <input 
                    type={field.type === 'number' ? 'number' : 'text'}
                    required={field.required}
                    onChange={e => setFormData(p => ({ ...p, [field.label]: e.target.value }))}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-black/5 outline-none"
                  />
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm space-y-6">
          <div className="flex justify-between items-center border-b border-gray-50 pb-4">
            <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400">Evidências Fotográficas</h3>
            <span className="text-[10px] font-bold bg-gray-100 px-2 py-1 rounded">{photos.length} fotos</span>
          </div>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {photos.map((photo, idx) => (
              <div key={idx} className="aspect-square rounded-2xl overflow-hidden relative group border border-gray-100">
                <img src={photo} className="w-full h-full object-cover" />
                <button 
                  onClick={() => setPhotos(p => p.filter((_, i) => i !== idx))}
                  className="absolute top-2 right-2 p-1 bg-white/80 backdrop-blur-sm rounded-full text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="aspect-square rounded-2xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center gap-2 text-gray-400 hover:border-red-600 hover:text-red-600 transition-all"
            >
              <Camera size={24} />
              <span className="text-[10px] font-bold uppercase tracking-widest">Adicionar Foto</span>
            </button>
          </div>
          <input 
            type="file" 
            accept="image/*" 
            multiple 
            capture="environment" 
            className="hidden" 
            ref={fileInputRef}
            onChange={handlePhotoUpload}
          />
        </section>
      </div>
    </div>
  );
};

const DashboardView = ({ stats }: { stats: any }) => {
  if (!stats) return <div className="flex justify-center p-12"><Loader2 className="animate-spin" /></div>;

  const COLORS = ['#DC2626', '#EF4444', '#F87171', '#FCA5A5'];

  const pieData = [
    { name: 'Concluídas', value: stats.completed },
    { name: 'Pendentes', value: stats.pending }
  ];

  return (
    <div className="space-y-6 md:space-y-8">
      {/* Quick Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <div className="bg-white p-4 md:p-6 rounded-2xl md:rounded-3xl border border-gray-100 shadow-sm">
          <div className="w-8 h-8 md:w-10 md:h-10 bg-red-50 rounded-xl flex items-center justify-center mb-3 md:mb-4">
            <ClipboardList className="text-red-600" size={18} />
          </div>
          <p className="text-xl md:text-2xl font-bold">{stats.total}</p>
          <p className="text-[10px] text-gray-400 uppercase font-bold tracking-widest">Total Inspeções</p>
        </div>
        <div className="bg-white p-4 md:p-6 rounded-2xl md:rounded-3xl border border-gray-100 shadow-sm">
          <div className="w-8 h-8 md:w-10 md:h-10 bg-emerald-50 rounded-xl flex items-center justify-center mb-3 md:mb-4">
            <CheckCircle className="text-emerald-600" size={18} />
          </div>
          <p className="text-xl md:text-2xl font-bold">{stats.completed}</p>
          <p className="text-[10px] text-gray-400 uppercase font-bold tracking-widest">Concluídas</p>
        </div>
        <div className="bg-white p-4 md:p-6 rounded-2xl md:rounded-3xl border border-gray-100 shadow-sm">
          <div className="w-8 h-8 md:w-10 md:h-10 bg-amber-50 rounded-xl flex items-center justify-center mb-3 md:mb-4">
            <Clock className="text-amber-600" size={18} />
          </div>
          <p className="text-xl md:text-2xl font-bold">{stats.pending}</p>
          <p className="text-[10px] text-gray-400 uppercase font-bold tracking-widest">Pendentes</p>
        </div>
        <div className="bg-white p-4 md:p-6 rounded-2xl md:rounded-3xl border border-gray-100 shadow-sm">
          <div className="w-8 h-8 md:w-10 md:h-10 bg-red-50 rounded-xl flex items-center justify-center mb-3 md:mb-4">
            <AlertTriangle className="text-red-600" size={18} />
          </div>
          <p className="text-xl md:text-2xl font-bold">{stats.risksFound}</p>
          <p className="text-[10px] text-gray-400 uppercase font-bold tracking-widest">Riscos Detectados</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
        {/* Chart: Inspections by Type */}
        <div className="bg-white p-6 md:p-8 rounded-2xl md:rounded-3xl border border-gray-100 shadow-sm">
          <h3 className="font-bold text-base md:text-lg mb-6 flex items-center gap-2">
            <BarChart3 size={20} className="text-gray-400" />
            Inspeções por Tipo
          </h3>
          <div className="h-[250px] md:h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.byType}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9ca3af' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9ca3af' }} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  cursor={{ fill: '#f9fafb' }}
                />
                <Bar dataKey="count" fill="#DC2626" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart: Status Distribution */}
        <div className="bg-white p-6 md:p-8 rounded-2xl md:rounded-3xl border border-gray-100 shadow-sm">
          <h3 className="font-bold text-base md:text-lg mb-6 flex items-center gap-2">
            <CheckCircle size={20} className="text-gray-400" />
            Distribuição de Status
          </h3>
          <div className="h-[250px] md:h-[300px] flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center gap-6 mt-4">
            {pieData.map((entry, index) => (
              <div key={entry.name} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                <span className="text-[10px] text-gray-500 font-medium uppercase tracking-widest">{entry.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Performance by Technician */}
      <div className="bg-white p-6 md:p-8 rounded-2xl md:rounded-3xl border border-gray-100 shadow-sm">
        <h3 className="font-bold text-base md:text-lg mb-6 flex items-center gap-2">
          <Users size={20} className="text-gray-400" />
          Performance por Técnico
        </h3>
        <div className="h-[250px] md:h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stats.byTech} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f3f4f6" />
              <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9ca3af' }} />
              <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9ca3af' }} width={80} />
              <Tooltip 
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                cursor={{ fill: '#f9fafb' }}
              />
              <Bar dataKey="count" fill="#EF4444" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

const SettingsView = () => {
  const [settings, setSettings] = useState<Record<string, string>>({
    evolution_url: '',
    evolution_key: '',
    evolution_instance: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetch('/api/settings')
      .then(res => res.json())
      .then(data => {
        setSettings(data);
        setLoading(false);
      });
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      if (res.ok) {
        setMessage('Configurações salvas com sucesso!');
      } else {
        setMessage('Erro ao salvar configurações.');
      }
    } catch (e) {
      setMessage('Erro ao conectar ao servidor.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="max-w-2xl bg-white p-6 md:p-8 rounded-2xl md:rounded-3xl border border-gray-200 shadow-sm">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 md:w-12 md:h-12 bg-red-50 rounded-xl flex items-center justify-center shrink-0">
          <HardHat className="text-red-600" size={24} />
        </div>
        <div>
          <h3 className="font-bold text-lg md:text-xl">Integração Evolution API</h3>
          <p className="text-[10px] md:text-xs text-gray-400">Configure as credenciais para notificações via WhatsApp</p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">API URL</label>
          <input 
            type="url" 
            placeholder="https://api.sua-evolution.com"
            value={settings.evolution_url} 
            onChange={e => setSettings(p => ({ ...p, evolution_url: e.target.value }))}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-red-600/5 outline-none text-base" 
          />
        </div>
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">API Key</label>
          <input 
            type="password" 
            placeholder="Sua API Key"
            value={settings.evolution_key} 
            onChange={e => setSettings(p => ({ ...p, evolution_key: e.target.value }))}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-red-600/5 outline-none text-base" 
          />
        </div>
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Nome da Instância</label>
          <input 
            type="text" 
            placeholder="Inspetor EPI"
            value={settings.evolution_instance} 
            onChange={e => setSettings(p => ({ ...p, evolution_instance: e.target.value }))}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-red-600/5 outline-none text-base" 
          />
        </div>

        {message && (
          <p className={`text-xs font-bold text-center p-3 rounded-xl ${message.includes('sucesso') ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
            {message}
          </p>
        )}

        <button 
          disabled={saving}
          className="w-full bg-red-600 text-white py-4 rounded-xl font-bold hover:bg-red-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-red-100"
        >
          {saving ? <Loader2 className="animate-spin" /> : 'Salvar Configurações'}
        </button>
      </form>
    </div>
  );
};

const ReportView = ({ report }: { report: InspectionReport }) => {
  const [analysis, setAnalysis] = useState(report.analysis);
  const [loading, setLoading] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  const generateAnalysis = async () => {
    setLoading(true);
    try {
      const apiKey = process.env.GROQ_API_KEY;
      if (!apiKey) {
        throw new Error('GROQ_API_KEY não configurada no ambiente.');
      }
      const groq = new Groq({ apiKey, dangerouslyAllowBrowser: true });
      const prompt = `Você é um especialista em segurança do trabalho. Analise os seguintes dados de uma inspeção de "${report.type_name}" e forneça um parecer técnico resumido, destacando riscos e recomendações.
      Dados: ${JSON.stringify(report.data)}`;

      const content: any[] = [{ type: 'text', text: prompt }];
      
      // Add up to 3 photos for analysis
      report.photos.slice(0, 3).forEach((photo: string) => {
        content.push({
          type: 'image_url',
          image_url: {
            url: photo
          }
        });
      });

      const response = await groq.chat.completions.create({
        model: "meta-llama/llama-4-scout-17b-16e-instruct",
        messages: [{ role: 'user', content }]
      });

      const analysisText = response.choices[0]?.message?.content || "";
      
      const res = await fetch(`/api/inspections/${report.id}/analysis`, { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ analysis: analysisText })
      });

      if (res.ok) {
        setAnalysis(analysisText);
      }
    } catch (e) {
      console.error("Analysis Error:", e);
      alert("Erro ao gerar análise via IA.");
    } finally {
      setLoading(false);
    }
  };

  const exportPDF = async () => {
    if (!reportRef.current) return;
    const canvas = await html2canvas(reportRef.current, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff'
    });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const imgProps = pdf.getImageProperties(imgData);
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
    
    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
    pdf.save(`Relatorio_${report.type_name}_${report.id}.pdf`);
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:justify-end gap-3">
        <button 
          onClick={exportPDF}
          className="w-full md:w-auto bg-white border border-gray-200 text-gray-600 px-4 py-3 rounded-xl text-xs font-bold hover:bg-gray-50 transition-all flex items-center justify-center gap-2"
        >
          <Download size={14} /> Baixar PDF
        </button>
      </div>

      <div ref={reportRef} className="p-4 md:p-8 bg-white rounded-2xl md:rounded-3xl border border-gray-100">
        <div className="flex flex-col md:flex-row justify-between items-start gap-6 mb-8 md:mb-12">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-red-600 rounded-2xl flex items-center justify-center shrink-0">
              <HardHat className="text-white" size={24} />
            </div>
            <div>
              <h2 className="text-xl md:text-2xl font-bold tracking-tight">{report.type_name}</h2>
              <p className="text-gray-400 text-[10px] uppercase tracking-widest font-bold">Relatório #{report.id}</p>
            </div>
          </div>
          <div className="w-full md:w-auto text-left md:text-right">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Status</p>
            <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-[10px] font-bold">CONCLUÍDA</span>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-8 md:mb-12">
          <div className="p-4 bg-gray-50 rounded-2xl">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Técnico</p>
            <p className="font-bold text-xs md:text-sm truncate">{report.technician_name}</p>
          </div>
          <div className="p-4 bg-gray-50 rounded-2xl">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Data</p>
            <p className="font-bold text-xs md:text-sm font-mono">{new Date(report.submitted_at!).toLocaleDateString()}</p>
          </div>
          <div className="p-4 bg-gray-50 rounded-2xl">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Local</p>
            <p className="font-bold text-xs md:text-sm truncate">{report.location}</p>
          </div>
          <div className="p-4 bg-gray-50 rounded-2xl">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">ID</p>
            <p className="font-bold text-xs md:text-sm font-mono">#{report.id}</p>
          </div>
        </div>

        <div className="space-y-8">
          <div className="space-y-4">
            <div className="flex justify-between items-center border-b pb-2">
              <h4 className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Análise Técnica (IA)</h4>
              {!analysis && (
                <button 
                  onClick={generateAnalysis}
                  disabled={loading}
                  className="text-[10px] font-bold bg-red-600 text-white px-3 py-1 rounded-full hover:bg-red-700 transition-all flex items-center gap-1"
                >
                  {loading ? <Loader2 className="animate-spin w-3 h-3" /> : <><HardHat size={12} /> Gerar Análise</>}
                </button>
              )}
            </div>
            {analysis ? (
              <div className="p-4 md:p-6 bg-emerald-50 rounded-2xl border border-emerald-100">
                <p className="text-sm text-emerald-900 leading-relaxed whitespace-pre-wrap italic serif">
                  "{analysis}"
                </p>
              </div>
            ) : (
              <div className="p-6 bg-gray-50 rounded-2xl border border-dashed border-gray-200 text-center">
                <p className="text-xs text-gray-400 italic">Nenhuma análise gerada ainda.</p>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <h4 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 border-b pb-2">Dados Coletados</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-4">
              {Object.entries(report.data).map(([label, value]) => (
                <div key={label} className="flex justify-between items-center py-2 border-b border-gray-50">
                  <span className="text-sm text-gray-500">{label}</span>
                  <span className={`text-sm font-bold ${value === 'Não' ? 'text-red-500' : value === 'Sim' ? 'text-emerald-600' : ''}`}>
                    {String(value)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 border-b pb-2">Evidências</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {report.photos.map((photo, idx) => (
                <div key={idx} className="aspect-video rounded-2xl overflow-hidden border border-gray-100">
                  <img src={photo} className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- Main App ---

export default function App() {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('safeinspect_user');
    if (saved) setUser(JSON.parse(saved));
  }, []);

  const handleLogin = (u: User) => {
    setUser(u);
    localStorage.setItem('safeinspect_user', JSON.stringify(u));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('safeinspect_user');
  };

  if (!user) return <Login onLogin={handleLogin} />;

  return user.role === 'admin' ? (
    <AdminDashboard user={user} onLogout={handleLogout} />
  ) : (
    <TechnicianDashboard user={user} onLogout={handleLogout} />
  );
}

import React, { useState, useEffect } from 'react';
import { Shield, UserPlus, FileCheck, FileText, Search, Plus, Trash2, X, Activity, Server, Clock } from 'lucide-react';
import { getTeachers, saveTeacher, deleteTeacher, getAuditLogs, TeacherRecord, AuditLog, subscribeToStoreChanges } from '../../utils/evaluationStore';

export const AdminPortal: React.FC = () => {
  const [teachers, setTeachers] = useState<TeacherRecord[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [activeSubTab, setActiveSubTab] = useState<'teachers' | 'audit'>('teachers');
  const [search, setSearch] = useState('');
  const [isAddOpen, setIsAddOpen] = useState(false);

  // Teacher Form State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [department, setDepartment] = useState('');

  useEffect(() => {
    const load = () => {
      setTeachers(getTeachers());
      setLogs(getAuditLogs());
    };
    load();
    return subscribeToStoreChanges(load);
  }, []);

  const handleRegisterTeacher = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !department) return;
    const newT = saveTeacher({ name, email, department, status: 'Active' });
    setTeachers(prev => [...prev, newT]);
    setLogs(getAuditLogs()); // refresh logs since saveTeacher adds a log entry
    setIsAddOpen(false);
    
    // Reset form
    setName('');
    setEmail('');
    setDepartment('');
  };

  const handleDeleteTeacher = (id: string) => {
    if (confirm('Are you sure you want to remove this instructor? This will de-authorize all of their course workflows.')) {
      deleteTeacher(id);
      setTeachers(prev => prev.filter(t => t.id !== id));
      setLogs(getAuditLogs()); // refresh logs
    }
  };

  const filteredTeachers = teachers.filter(t => 
    t.name.toLowerCase().includes(search.toLowerCase()) || 
    t.email.toLowerCase().includes(search.toLowerCase()) || 
    t.department.toLowerCase().includes(search.toLowerCase())
  );

  const filteredLogs = logs.filter(l => 
    l.actor.toLowerCase().includes(search.toLowerCase()) || 
    l.action.toLowerCase().includes(search.toLowerCase()) || 
    l.details.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-8">
      {/* Admin stats dashboard tiles */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-slate-900 border border-black/5 dark:border-white/5 p-6 rounded-3xl space-y-2">
          <span className="text-[10px] font-black uppercase text-blue-500 tracking-wider">Institute Status</span>
          <h4 className="text-3xl font-black italic tracking-tighter">ACTIVE</h4>
          <p className="text-xs opacity-50 font-medium">NeuroClass Multi-Tenant Cluster v1</p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-black/5 dark:border-white/5 p-6 rounded-3xl space-y-2">
          <span className="text-[10px] font-black uppercase text-purple-500 tracking-wider">Authorized Teachers</span>
          <h4 className="text-3xl font-black italic tracking-tighter">{teachers.length}</h4>
          <p className="text-xs opacity-50 font-medium">Managing 10,000+ Students</p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-black/5 dark:border-white/5 p-6 rounded-3xl space-y-2">
          <span className="text-[10px] font-black uppercase text-emerald-500 tracking-wider">Indexed Vectors</span>
          <h4 className="text-3xl font-black italic tracking-tighter">424</h4>
          <p className="text-xs opacity-50 font-medium">Active RAG Grounding Nodes</p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-black/5 dark:border-white/5 p-6 rounded-3xl space-y-2">
          <span className="text-[10px] font-black uppercase text-rose-500 tracking-wider">System Safety Ratio</span>
          <h4 className="text-3xl font-black italic tracking-tighter">100%</h4>
          <p className="text-xs opacity-50 font-medium">Auto Audit logs synchronized</p>
        </div>
      </div>

      {/* Navigation Controls & Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex bg-slate-100 dark:bg-white/5 p-1 rounded-2xl border border-black/5 dark:border-white/5 max-w-xs">
          <button
            onClick={() => { setActiveSubTab('teachers'); setSearch(''); }}
            className={`flex-1 px-5 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${activeSubTab === 'teachers' ? 'bg-white dark:bg-slate-800 shadow-sm text-blue-500' : 'opacity-40 text-slate-500 dark:text-white'}`}
          >
            Manage Teachers
          </button>
          <button
            onClick={() => { setActiveSubTab('audit'); setSearch(''); }}
            className={`flex-1 px-5 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${activeSubTab === 'audit' ? 'bg-white dark:bg-slate-800 shadow-sm text-blue-500' : 'opacity-40 text-slate-500 dark:text-white'}`}
          >
            Audit Logs
          </button>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 opacity-45" size={14} />
            <input 
              type="text" 
              placeholder={activeSubTab === 'teachers' ? "Search instructors..." : "Search security operations..."}
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-3 rounded-2xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-xs"
            />
          </div>

          {activeSubTab === 'teachers' && (
            <button
              onClick={() => setIsAddOpen(true)}
              className="px-5 py-3 rounded-2xl bg-blue-500 text-white font-bold text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-blue-500/10 cursor-pointer hover:bg-blue-600 transition-all active:scale-95"
            >
              <UserPlus size={14} /> Add Teacher
            </button>
          )}
        </div>
      </div>

      {/* Main Body */}
      {activeSubTab === 'teachers' ? (
        <div className="bg-white dark:bg-slate-900 border border-black/5 dark:border-white/5 rounded-3xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-black/5 dark:border-white/5 text-[9px] font-black uppercase tracking-widest opacity-40 bg-slate-50 dark:bg-black/20">
                  <th className="py-5 px-8">Teacher Name</th>
                  <th className="py-5 px-6">Email Address</th>
                  <th className="py-5 px-6">Department</th>
                  <th className="py-5 px-6">Status</th>
                  <th className="py-5 px-6">Joined Date</th>
                  <th className="py-5 px-8 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5 dark:divide-white/5 text-sm">
                {filteredTeachers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-20 opacity-40">
                      No teachers found. Register an instructor to begin cataloging courses.
                    </td>
                  </tr>
                ) : (
                  filteredTeachers.map(t => (
                    <tr key={t.id} className="hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors">
                      <td className="py-5 px-8 font-bold tracking-tight text-slate-900 dark:text-white">
                        {t.name}
                      </td>
                      <td className="py-5 px-6 opacity-60 font-mono text-xs">
                        {t.email}
                      </td>
                      <td className="py-5 px-6 opacity-60">
                        {t.department}
                      </td>
                      <td className="py-5 px-6">
                        <span className={`inline-block text-[9px] font-bold uppercase tracking-wider px-3 py-1 rounded-full ${t.status === 'Active' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}>
                          {t.status}
                        </span>
                      </td>
                      <td className="py-5 px-6 opacity-40 font-mono text-xs">
                        {t.joinedAt}
                      </td>
                      <td className="py-5 px-8 text-center">
                        <button
                          onClick={() => handleDeleteTeacher(t.id)}
                          className="p-2 text-slate-400 hover:text-rose-500 rounded-xl border border-black/5 dark:border-white/10 hover:bg-rose-500/10 transition-all cursor-pointer inline-flex items-center"
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="p-6 bg-slate-50 dark:bg-slate-900/40 rounded-3xl border border-black/5 dark:border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Server size={18} className="text-blue-500 animate-pulse" />
              <span className="text-xs font-bold uppercase tracking-widest text-slate-500">Security Audit Logs</span>
            </div>
            <div className="flex items-center gap-4 text-[10px] font-bold uppercase tracking-wider opacity-40">
              <span className="flex items-center gap-1"><Clock size={12} /> Sync Period: Realtime</span>
              <span>100% Compliant Logs</span>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-black/5 dark:border-white/5 rounded-3xl overflow-hidden shadow-xl overflow-y-auto max-h-[500px] custom-scrollbar">
            <div className="divide-y divide-black/5 dark:divide-white/5">
              {filteredLogs.length === 0 ? (
                <div className="text-center py-20 opacity-40">No audit logs matching this filter.</div>
              ) : (
                filteredLogs.map(l => (
                  <div key={l.id} className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors">
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black uppercase text-blue-500 tracking-wider">{l.action}</span>
                        <span className="text-xs opacity-50">•</span>
                        <span className="text-xs font-semibold opacity-70">{l.actor}</span>
                      </div>
                      <p className="text-sm tracking-tight opacity-90">{l.details}</p>
                    </div>

                    <div className="flex md:flex-col items-center md:items-end justify-between text-right text-[10px] font-mono opacity-40 font-bold uppercase tracking-wider">
                      <span>{new Date(l.timestamp).toLocaleString()}</span>
                      <span className="md:mt-1">{l.ipAddress}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add Teacher Modal */}
      {isAddOpen && (
        <div className="fixed inset-0 z-[210] bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
          <div className="relative max-w-md w-full p-8 rounded-3xl bg-white dark:bg-slate-900 border border-black/10 dark:border-white/10 shadow-2xl space-y-6 animate-scaleUp">
            <button 
              onClick={() => setIsAddOpen(false)}
              className="absolute right-6 top-6 p-2 rounded-full hover:bg-slate-100 dark:hover:bg-white/5 cursor-pointer"
            >
              <X size={18} />
            </button>

            <div>
              <h3 className="text-2xl font-black tracking-tight">CREATE TEACHER ACCOUNT</h3>
              <p className="text-xs opacity-50 mt-1">Authorize secure credentials to grant a teacher workspace profile.</p>
            </div>

            <form onSubmit={handleRegisterTeacher} className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">FullName</label>
                <input 
                  type="text" 
                  required 
                  placeholder="e.g. Professor Charles Xavier"
                  value={name} 
                  onChange={e => setName(e.target.value)}
                  className="w-full px-5 py-3.5 rounded-2xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-sm"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Institutional Email</label>
                <input 
                  type="email" 
                  required 
                  placeholder="e.g. xavier@academy.edu"
                  value={email} 
                  onChange={e => setEmail(e.target.value)}
                  className="w-full px-5 py-3.5 rounded-2xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-sm"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Department</label>
                <input 
                  type="text" 
                  required 
                  placeholder="e.g. Genetic Mutation Studies"
                  value={department} 
                  onChange={e => setDepartment(e.target.value)}
                  className="w-full px-5 py-3.5 rounded-2xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-sm"
                />
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="flex-1 py-4 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-xs font-bold uppercase tracking-widest transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-4 rounded-2xl bg-blue-500 text-white hover:bg-blue-600 shadow-xl shadow-blue-500/10 text-xs font-bold uppercase tracking-widest transition-all cursor-pointer"
                >
                  Create Profile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

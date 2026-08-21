import React, { useEffect, useState } from 'react';
import { BarChart3, CheckCircle2, FileText, MessageCircle, RefreshCw, Users } from 'lucide-react';
import { supabase } from '../../database/supabase';
import { getApiUrl } from '../../config/apiConfig';

interface ClassroomLearningAnalyticsProps { classroomId: string; }
type Analytics = { classroomName: string; threadCount: number; messageCount: number; feedbackCount: number; materialCount: number; readyMaterialCount: number };

export const ClassroomLearningAnalytics: React.FC<ClassroomLearningAnalyticsProps> = ({ classroomId }) => {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error('Your session has expired.');
      const response = await fetch(`${getApiUrl('/api/ai/classroom-analytics')}?classroomId=${encodeURIComponent(classroomId)}`, { headers: { Authorization: `Bearer ${token}` } });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || 'Analytics could not be loaded.');
      setAnalytics(body.analytics);
    } catch (err: any) {
      setError(err.message || 'Analytics could not be loaded.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [classroomId]);

  return <section className="rounded-3xl border border-indigo-500/20 bg-indigo-500/5 p-6">
    <div className="mb-5 flex items-start justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-indigo-600">Teacher command center</p><h3 className="mt-1 text-xl font-bold">Adaptive learning analytics</h3><p className="mt-1 text-sm text-slate-500">Aggregate classroom signals only; student message content is never exposed here.</p></div><button type="button" onClick={() => void load()} disabled={loading} aria-label="Refresh analytics" className="rounded-xl border border-indigo-500/20 p-2 text-indigo-600 hover:bg-indigo-500/10 disabled:opacity-40"><RefreshCw size={16} className={loading ? 'animate-spin' : ''} /></button></div>
    {error && <p className="mb-4 rounded-xl bg-rose-500/10 p-3 text-xs font-semibold text-rose-600">{error}</p>}
    {loading && !analytics ? <p className="text-sm text-slate-500">Loading classroom signals…</p> : analytics && <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5"><Metric icon={<Users size={16} />} label="Learner threads" value={analytics.threadCount} /><Metric icon={<MessageCircle size={16} />} label="Messages" value={analytics.messageCount} /><Metric icon={<BarChart3 size={16} />} label="Feedback events" value={analytics.feedbackCount} /><Metric icon={<FileText size={16} />} label="Materials" value={analytics.materialCount} /><Metric icon={<CheckCircle2 size={16} />} label="Tutor-ready" value={`${analytics.readyMaterialCount}/${analytics.materialCount}`} /></div>}
  </section>;
};

const Metric: React.FC<{ icon: React.ReactNode; label: string; value: React.ReactNode }> = ({ icon, label, value }) => <div className="rounded-2xl border border-black/5 bg-white p-4 dark:border-white/10 dark:bg-white/5"><div className="mb-3 flex items-center gap-2 text-indigo-600">{icon}<span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{label}</span></div><p className="text-2xl font-black">{value}</p></div>;

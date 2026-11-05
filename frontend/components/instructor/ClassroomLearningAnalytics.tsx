import React, { useEffect, useState } from 'react';
import { BarChart3, CheckCircle2, FileText, MessageCircle, RefreshCw, Users } from '../ui/icons-compat';
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

  return <section className="rounded-card border border-primary-soft bg-primary-light p-6">
    <div className="mb-5 flex items-start justify-between gap-4"><div><p className="text-meta font-bold text-primary">Teacher command center</p><h3 className="mt-1 text-xl font-bold">Adaptive learning analytics</h3><p className="mt-1 text-sm text-ink-2">Aggregate classroom signals only; student message content is never exposed here.</p></div><button type="button" onClick={() => void load()} disabled={loading} aria-label="Refresh analytics" className="rounded-button border border-primary-soft p-2 text-primary hover:bg-primary-light disabled:opacity-40"><RefreshCw size={16} className={loading ? 'animate-spin' : ''} /></button></div>
    {error && <p className="mb-4 rounded-button bg-danger-bg p-3 text-xs font-semibold text-danger-ink">{error}</p>}
    {loading && !analytics ? <p className="text-sm text-ink-2">Loading classroom signals…</p> : analytics && <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5"><Metric icon={<Users size={16} />} label="Learner threads" value={analytics.threadCount} /><Metric icon={<MessageCircle size={16} />} label="Messages" value={analytics.messageCount} /><Metric icon={<BarChart3 size={16} />} label="Feedback events" value={analytics.feedbackCount} /><Metric icon={<FileText size={16} />} label="Materials" value={analytics.materialCount} /><Metric icon={<CheckCircle2 size={16} />} label="Tutor-ready" value={`${analytics.readyMaterialCount}/${analytics.materialCount}`} /></div>}
  </section>;
};

const Metric: React.FC<{ icon: React.ReactNode; label: string; value: React.ReactNode }> = ({ icon, label, value }) => <div className="rounded-card border border-line bg-surface p-4 "><div className="mb-3 flex items-center gap-2 text-primary">{icon}<span className="text-meta font-bold text-ink-2">{label}</span></div><p className="text-2xl font-semibold">{value}</p></div>;

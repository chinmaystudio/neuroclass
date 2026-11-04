import React, { useState } from 'react';
import { ArrowRight, BrainCircuit, CheckCircle2, Lightbulb, Sparkles } from 'lucide-react';

import { getApiUrl } from '../../config/apiConfig';
import { supabase } from '../../database/supabase';
import { useAuth } from '../../context/AuthContext';

const categories = ['AI & Machine Learning', 'Web3 & Blockchain', 'Climate & Sustainability', 'Health & Accessibility', 'Education & Campus Life', 'Cybersecurity', 'Open Innovation'];

export const ProjectAdvisor: React.FC = () => {
  const { user } = useAuth();
  const [category, setCategory] = useState(categories[0]);
  const [target, setTarget] = useState('');
  const [skills, setSkills] = useState('');
  const [constraints, setConstraints] = useState('');
  const [impact, setImpact] = useState('');
  const [preferredStack, setPreferredStack] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user) return setError('Sign in again before requesting a project plan.');
    if ([target, skills, constraints, impact].some((value) => !value.trim())) {
      return setError('Answer all four planning questions so the advisor can produce a useful plan.');
    }
    setError('');
    setLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('Your session has expired. Please sign in again.');
      // Payments are temporarily disabled, so the advisor is called directly.
      const response = await fetch(getApiUrl('/api/ai/project-idea'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ category, target, skills, constraints, impact, preferredStack }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'The project advisor is unavailable right now. Please try again.');
      if (!payload.project) throw new Error('The project advisor returned an incomplete plan. Please try again.');
      // The plan is stored server-side in project_ideas for the signed-in student.
      setResult(payload.project);
    } catch (err) {
      // No fabricated fallback plan: show the real problem.
      setError(err instanceof Error ? err.message : 'The project advisor is unavailable right now.');
    } finally {
      setLoading(false);
    }
  };

  const field = 'mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm outline-none focus:border-purple-500 dark:border-white/10 dark:bg-black/20';

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-4 sm:p-8">
      <header className="flex items-start gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-purple-600 text-white shadow-lg shadow-purple-500/25"><Lightbulb size={26} /></div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-purple-600">Project studio</p>
          <h1 className="text-3xl font-black tracking-tight">Find a project worth building</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-500">Answer four focused questions. The advisor returns a competition-ready problem, MVP scope, architecture, milestones, risks, and demo story.</p>
        </div>
      </header>

      {!result ? (
        <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
          <form onSubmit={handleSubmit} className="space-y-5 rounded-3xl border border-black/5 bg-white p-6 shadow-xl dark:border-white/10 dark:bg-white/5">
            <label className="block text-sm font-bold">What category interests you?
              <select value={category} onChange={(event) => setCategory(event.target.value)} className={field}>
                {categories.map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>
            <label className="block text-sm font-bold">1. Who or what do you want to help?
              <textarea value={target} onChange={(event) => setTarget(event.target.value)} placeholder="Example: first-year students who struggle to find reliable study groups" rows={3} className={field} />
            </label>
            <label className="block text-sm font-bold">2. What skills and resources do you already have?
              <textarea value={skills} onChange={(event) => setSkills(event.target.value)} placeholder="Example: React, Python basics, one designer, four weekends" rows={3} className={field} />
            </label>
            <label className="block text-sm font-bold">3. What constraints must the project respect?
              <textarea value={constraints} onChange={(event) => setConstraints(event.target.value)} placeholder="Example: must run on free tiers, protect student data, and demo in five minutes" rows={3} className={field} />
            </label>
            <label className="block text-sm font-bold">4. What measurable impact would make it successful?
              <textarea value={impact} onChange={(event) => setImpact(event.target.value)} placeholder="Example: reduce time to find a study partner by 30% in a pilot" rows={3} className={field} />
            </label>
            <label className="block text-sm font-bold">Preferred stack, if any <span className="font-normal text-slate-400">(optional)</span>
              <input value={preferredStack} onChange={(event) => setPreferredStack(event.target.value)} placeholder="React, Python, Supabase..." className={field} />
            </label>
            {error && <p role="alert" className="rounded-xl bg-rose-500/10 p-3 text-xs font-semibold text-rose-600">{error}</p>}
            <button type="submit" disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-xl bg-purple-600 px-5 py-4 text-xs font-bold uppercase tracking-widest text-white shadow-lg shadow-purple-500/25 disabled:opacity-50">
              <Sparkles size={16} /> {loading ? 'Generating your plan…' : 'Generate project plan'} {!loading && <ArrowRight size={16} />}
            </button>
          </form>
          <aside className="rounded-3xl border border-purple-500/20 bg-gradient-to-br from-purple-600 to-indigo-700 p-7 text-white shadow-xl">
            <BrainCircuit size={32} className="mb-8 opacity-80" />
            <h2 className="text-2xl font-black">Your deliverable</h2>
            <p className="mt-3 text-sm leading-6 text-white/75">One structured blueprint designed for execution, not a generic list of ideas.</p>
            <div className="mt-8 space-y-3 text-sm text-white/85">{['Specific problem and target users', 'MVP and stretch scope', 'Architecture and milestones', 'Risks and mitigations', 'Competition demo flow and metrics'].map((item) => <div key={item} className="flex gap-2"><CheckCircle2 size={16} className="mt-0.5 shrink-0" /> {item}</div>)}</div>
          </aside>
        </div>
      ) : (
        <div className="space-y-6">
          <article className="rounded-3xl border border-black/5 bg-white p-6 shadow-xl dark:border-white/10 dark:bg-white/5 sm:p-8">
            <div className="mb-8 border-b border-black/5 pb-6 dark:border-white/10"><p className="text-[10px] font-bold uppercase tracking-widest text-purple-600">Project blueprint</p><h2 className="mt-2 text-3xl font-black">{result.title}</h2><p className="mt-2 text-slate-500">{result.oneLinePitch}</p></div>
            <div className="grid gap-6 md:grid-cols-2">
              {(['problem', 'solution', 'novelty', 'targetUsers', 'mvpScope', 'stretchFeatures', 'architecture', 'milestones', 'risks', 'competitionReadiness', 'nextActions'] as const).filter((key) => result[key] !== undefined).map((key) => (
                <section key={key} className="rounded-2xl border border-black/5 p-5 dark:border-white/10 md:last:col-span-2"><h3 className="mb-3 text-sm font-black capitalize">{key.replace(/[A-Z]/g, ' $&')}</h3><pre className="whitespace-pre-wrap font-sans text-sm leading-6 text-slate-600 dark:text-slate-300">{typeof result[key] === 'string' ? result[key] : JSON.stringify(result[key], null, 2)}</pre></section>
              ))}
            </div>
          </article>
          <button onClick={() => { setResult(null); setError(''); }} className="rounded-xl border border-black/10 px-4 py-3 text-xs font-bold uppercase tracking-widest dark:border-white/10">Start another plan</button>
        </div>
      )}
    </div>
  );
};

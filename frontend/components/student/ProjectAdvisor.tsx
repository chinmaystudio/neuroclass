import React, { useState } from 'react';
import { PageHeader } from '../ui';
import { ArrowRight, BrainCircuit, CheckCircle2, Lightbulb, Sparkles } from '../ui/icons-compat';

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

  const field = 'mt-2 w-full rounded-button border border-line bg-surface-2 p-3 text-sm outline-none focus:border-primary ';

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <PageHeader title="Project advisor" description="Answer four questions and get a project plan: the problem, first version, architecture, milestones, risks and how to demo it." />

      {!result ? (
        <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
          <form onSubmit={handleSubmit} className="space-y-5 rounded-card border border-line bg-surface p-6 shadow-raised ">
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
            <label className="block text-sm font-bold">Preferred stack, if any <span className="font-normal text-ink-2">(optional)</span>
              <input value={preferredStack} onChange={(event) => setPreferredStack(event.target.value)} placeholder="React, Python, Supabase..." className={field} />
            </label>
            {error && <p role="alert" className="rounded-button bg-danger-bg p-3 text-xs font-semibold text-danger-ink">{error}</p>}
            <button type="submit" disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-button bg-primary px-5 py-4 text-xs font-bold text-on-primary shadow-raised disabled:opacity-50">
              <Sparkles size={16} /> {loading ? 'Generating your plan…' : 'Generate project plan'} {!loading && <ArrowRight size={16} />}
            </button>
          </form>
          <aside className="rounded-card border border-primary-soft bg-brand-gradient p-7 text-white shadow-raised">
            <BrainCircuit size={32} className="mb-8 opacity-80" />
            <h2 className="text-2xl font-semibold">Your deliverable</h2>
            <p className="mt-3 text-sm leading-6 text-white">One structured blueprint designed for execution, not a generic list of ideas.</p>
            <div className="mt-8 space-y-3 text-sm text-white">{['Specific problem and target users', 'MVP and stretch scope', 'Architecture and milestones', 'Risks and mitigations', 'Competition demo flow and metrics'].map((item) => <div key={item} className="flex gap-2"><CheckCircle2 size={16} className="mt-0.5 shrink-0" /> {item}</div>)}</div>
          </aside>
        </div>
      ) : (
        <div className="space-y-6">
          <article className="rounded-card border border-line bg-surface p-6 shadow-raised sm:p-8">
            <div className="mb-8 border-b border-line pb-6 "><p className="text-meta font-bold text-primary">Project blueprint</p><h2 className="mt-2 text-3xl font-semibold">{result.title}</h2><p className="mt-2 text-ink-2">{result.oneLinePitch}</p></div>
            <div className="grid gap-6 md:grid-cols-2">
              {(['problem', 'solution', 'novelty', 'targetUsers', 'mvpScope', 'stretchFeatures', 'architecture', 'milestones', 'risks', 'competitionReadiness', 'nextActions'] as const).filter((key) => result[key] !== undefined).map((key) => (
                <section key={key} className="rounded-card border border-line p-5 md:last:col-span-2"><h3 className="mb-3 text-sm font-semibold capitalize">{key.replace(/[A-Z]/g, ' $&')}</h3><pre className="whitespace-pre-wrap font-sans text-sm leading-6 text-ink-2 ">{typeof result[key] === 'string' ? result[key] : JSON.stringify(result[key], null, 2)}</pre></section>
              ))}
            </div>
          </article>
          <button onClick={() => { setResult(null); setError(''); }} className="rounded-button border border-line px-4 py-3 text-xs font-bold ">Start another plan</button>
        </div>
      )}
    </div>
  );
};

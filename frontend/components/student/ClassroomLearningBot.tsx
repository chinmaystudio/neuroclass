import React, { useEffect, useMemo, useState } from 'react';
import { BookOpen, Bot, FileText, MessageCircle, Send, UserRound, ThumbsDown, ThumbsUp } from 'lucide-react';
import { supabase } from '../../database/supabase';
import { useAuth } from '../../context/AuthContext';
import { getApiUrl } from '../../config/apiConfig';

type ChatMessage = { id?: string; role: 'user' | 'assistant'; content: string; citations?: Array<{ source: string; reason: string }>; confidence?: 'high' | 'medium' | 'low'; answerState?: 'grounded' | 'insufficient_context' | 'error'; followUp?: string; feedback?: number };

export const ClassroomLearningBot: React.FC = () => {
  const { user } = useAuth();
  const [classrooms, setClassrooms] = useState<any[]>([]);
  const [classroomId, setClassroomId] = useState('');
  const [threadId, setThreadId] = useState('');
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sources, setSources] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [preferredStyle, setPreferredStyle] = useState('step-by-step');
  const [learningGoal, setLearningGoal] = useState('');

  useEffect(() => {
    const loadClassrooms = async () => {
      if (!user) return;
      const { data: memberships } = await (supabase.from('students') as any).select('classroom_id').eq('user_id', user.id);
      const ids = (memberships || []).map((item: any) => item.classroom_id).filter(Boolean);
      if (!ids.length) return setClassrooms([]);
      const { data } = await supabase.from('classrooms').select('id,name').in('id', ids).order('name');
      setClassrooms(data || []);
      if (data?.[0]) setClassroomId(data[0].id);
    };
    loadClassrooms();
  }, [user]);

  const selectedClassroom = useMemo(() => classrooms.find((item) => item.id === classroomId), [classrooms, classroomId]);

  const askQuestion = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!question.trim() || !classroomId) return;
    setLoading(true);
    setError('');
    const currentQuestion = question.trim();
    setQuestion('');
    setMessages((previous) => [...previous, { role: 'user', content: currentQuestion }]);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('Your session has expired. Please sign in again.');
      const response = await fetch(getApiUrl('/api/ai/classroom-answer'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ classroomId, threadId: threadId || undefined, question: currentQuestion, learnerProfile: { preferredStyle, goals: learningGoal } }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'The classroom assistant could not answer.');
      setThreadId(data.threadId || '');
      setSources(data.sources || []);
      setMessages((previous) => [...previous, { id: data.assistantMessageId, role: 'assistant', content: data.answer?.answer || 'No grounded answer was returned.', citations: data.answer?.citations || [], confidence: data.answer?.confidence || 'low', answerState: data.answer?.answerState || 'insufficient_context', followUp: data.answer?.followUp || '' }]);
    } catch (err: any) {
      setError(err.message || 'Request failed.');
    } finally {
      setLoading(false);
    }
  };

  const rateAnswer = async (message: ChatMessage, rating: 1 | -1) => {
    if (!message.id || !threadId || message.feedback) return;
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) return;
      const response = await fetch(getApiUrl('/api/ai/feedback'), { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ threadId, messageId: message.id, rating }) });
      if (!response.ok) return;
      setMessages((previous) => previous.map((item) => item.id === message.id ? { ...item, feedback: rating } : item));
    } catch { /* feedback is non-blocking */ }
  };

  const changeClassroom = (id: string) => {
    setClassroomId(id);
    setThreadId('');
    setMessages([]);
    setSources([]);
    setError('');
  };

  return (
    <div className="mx-auto flex min-h-full max-w-6xl flex-col gap-6 p-8">
      <header className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4"><div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-500/25"><MessageCircle size={26} /></div><div><p className="text-[10px] font-bold uppercase tracking-[0.25em] text-indigo-600">Classroom-scoped adaptive learning</p><h1 className="text-3xl font-black tracking-tight">Ask your classroom AI</h1><p className="mt-2 max-w-2xl text-sm text-slate-500">Answers are grounded only in processed assignments, PDFs, and files from the selected classroom. It will say when the source material is insufficient.</p></div></div>
        <div className="flex flex-col gap-2"><select value={classroomId} onChange={(event) => changeClassroom(event.target.value)} disabled={!classrooms.length} className="min-w-[220px] rounded-xl border border-slate-200 bg-white p-3 text-sm font-bold dark:border-white/10 dark:bg-white/5"><option value="">Select classroom</option>{classrooms.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><div className="flex gap-2"><select value={preferredStyle} onChange={(event) => setPreferredStyle(event.target.value)} className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10px] dark:border-white/10 dark:bg-white/5"><option value="step-by-step">Step-by-step</option><option value="concise">Concise</option><option value="examples">Examples first</option></select><input value={learningGoal} onChange={(event) => setLearningGoal(event.target.value.slice(0, 160))} placeholder="Learning goal (optional)" className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10px] dark:border-white/10 dark:bg-white/5" /></div></div>
      </header>

      {!classrooms.length ? <div className="rounded-3xl border border-dashed border-slate-300 p-12 text-center text-sm text-slate-500 dark:border-white/10">Join a classroom before using its adaptive learning assistant.</div> : (
        <div className="grid min-h-[560px] flex-1 gap-6 lg:grid-cols-[1fr_280px]">
          <section className="flex flex-col overflow-hidden rounded-3xl border border-black/5 bg-white shadow-xl dark:border-white/10 dark:bg-white/5">
            <div className="flex items-center gap-3 border-b border-black/5 p-5 dark:border-white/10"><BookOpen size={18} className="text-indigo-600" /><div><p className="text-sm font-bold">{selectedClassroom?.name || 'Classroom'}</p><p className="text-[10px] uppercase tracking-widest text-slate-500">Private learning thread</p></div></div>
            <div className="flex-1 space-y-5 overflow-y-auto p-6">
              {!messages.length && <div className="flex h-full min-h-[320px] flex-col items-center justify-center text-center text-slate-400"><Bot size={42} className="mb-4 text-indigo-500" /><p className="max-w-md text-sm">Ask for a concept explanation, assignment hint, revision plan, or file-based answer.</p></div>}
              {messages.map((message, index) => <div key={`${message.role}-${index}`} className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[82%] rounded-2xl p-4 text-sm leading-6 ${message.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-200'}`}><div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest opacity-60">{message.role === 'user' ? <UserRound size={12} /> : <Bot size={12} />}{message.role}{message.confidence && <span className={`ml-auto rounded-full px-2 py-0.5 ${message.confidence === 'high' ? 'bg-emerald-500/15 text-emerald-600' : message.confidence === 'medium' ? 'bg-amber-500/15 text-amber-600' : 'bg-rose-500/15 text-rose-600'}`}>{message.confidence} confidence</span>}</div><p className="whitespace-pre-wrap">{message.content}</p>{message.answerState === 'insufficient_context' && <p className="mt-3 rounded-lg bg-amber-500/10 p-2 text-xs font-semibold text-amber-700 dark:text-amber-300">The classroom sources may not fully support this answer. Check with your instructor before relying on it.</p>}{message.followUp && <p className="mt-3 text-xs italic opacity-70">Next step: {message.followUp}</p>}{message.citations?.length ? <div className="mt-3 space-y-1 border-t border-current/10 pt-3 text-[11px] opacity-75">{message.citations.map((citation) => <p key={`${citation.source}-${citation.reason}`}><FileText size={11} className="mr-1 inline" />{citation.source}: {citation.reason}</p>)}</div> : null}{message.role === 'assistant' && message.id && <div className="mt-3 flex items-center gap-2 border-t border-current/10 pt-3 text-[10px] opacity-70"><span>Helpful?</span><button type="button" aria-label="Helpful answer" disabled={Boolean(message.feedback)} onClick={() => void rateAnswer(message, 1)} className="rounded p-1 hover:bg-emerald-500/10 disabled:opacity-40"><ThumbsUp size={13} /></button><button type="button" aria-label="Not helpful answer" disabled={Boolean(message.feedback)} onClick={() => void rateAnswer(message, -1)} className="rounded p-1 hover:bg-rose-500/10 disabled:opacity-40"><ThumbsDown size={13} /></button></div>}</div></div>)}
              {loading && <div className="flex items-center gap-2 text-xs text-slate-500"><Bot size={16} className="animate-pulse text-indigo-500" /> Reading classroom sources…</div>}
            </div>
            <form onSubmit={askQuestion} className="flex gap-3 border-t border-black/5 p-4 dark:border-white/10"><input value={question} onChange={(event) => setQuestion(event.target.value)} disabled={loading || !classroomId} placeholder="Ask about your class material…" className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-indigo-500 dark:border-white/10 dark:bg-black/20" /><button type="submit" disabled={loading || !question.trim() || !classroomId} className="rounded-xl bg-indigo-600 px-4 text-white disabled:opacity-40"><Send size={17} /></button></form>
          </section>
          <aside className="space-y-4"><div className="rounded-3xl border border-indigo-500/20 bg-indigo-500/5 p-5"><p className="text-[10px] font-bold uppercase tracking-widest text-indigo-600">Context boundary</p><p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">This assistant cannot read files from another classroom, and students cannot upload arbitrary sources into the teacher’s classroom context.</p></div><div className="rounded-3xl border border-black/5 bg-white p-5 shadow-lg dark:border-white/10 dark:bg-white/5"><p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Available sources</p>{sources.length ? <div className="mt-3 space-y-2">{sources.map((source) => <p key={source} className="flex gap-2 text-xs text-slate-600 dark:text-slate-300"><FileText size={14} className="shrink-0 text-indigo-500" />{source}</p>)}</div> : <p className="mt-3 text-xs leading-5 text-slate-500">Sources will appear after the first grounded answer. If none are processed, ask your instructor to upload or process classroom materials.</p>}</div>{error && <div className="rounded-2xl bg-rose-500/10 p-4 text-xs font-semibold text-rose-600">{error}</div>}</aside>
        </div>
      )}
    </div>
  );
};

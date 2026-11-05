import React, { useEffect, useMemo, useState } from 'react';
import { Button, EmptyState, Field, Input, PageHeader, Select } from '../ui';
import { BookOpen, Bot, FileText, MessageCircle, Send, UserRound, ThumbsDown, ThumbsUp } from '../ui/icons-compat';
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
    <div className="mx-auto flex min-h-full w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <PageHeader
        title="Class assistant"
        description="Answers come only from the materials your teacher added to the selected class. It tells you when they don’t cover your question."
      />
      {classrooms.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Class"><Select value={classroomId} onChange={(event) => changeClassroom(event.target.value)} placeholder="Choose a class">{classrooms.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></Field>
          <Field label="Answer style"><Select value={preferredStyle} onChange={(event) => setPreferredStyle(event.target.value)}><option value="step-by-step">Step by step</option><option value="concise">Concise</option><option value="examples">Examples first</option></Select></Field>
          <Field label="Learning goal" optional><Input value={learningGoal} onChange={(event) => setLearningGoal(event.target.value.slice(0, 160))} /></Field>
        </div>
      )}

      {!classrooms.length ? <EmptyState title="Join a class first" body="The assistant answers from your class materials, so you need to be in a class to use it." /> : (
        <div className="grid min-h-[560px] flex-1 gap-6 lg:grid-cols-[1fr_280px]">
          <section className="flex flex-col overflow-hidden rounded-card border border-line bg-surface shadow-raised ">
            <div className="flex items-center gap-3 border-b border-line p-5 "><BookOpen size={18} className="text-primary" /><div><p className="text-sm font-bold">{selectedClassroom?.name || 'Classroom'}</p><p className="text-meta text-ink-2">Private learning thread</p></div></div>
            <div className="flex-1 space-y-5 overflow-y-auto p-6">
              {!messages.length && <div className="flex h-full min-h-[320px] flex-col items-center justify-center text-center text-ink-2"><Bot size={42} className="mb-4 text-primary" /><p className="max-w-md text-sm">Ask for a concept explanation, assignment hint, revision plan, or file-based answer.</p></div>}
              {messages.map((message, index) => <div key={`${message.role}-${index}`} className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[82%] rounded-card p-4 text-sm leading-6 ${message.role === 'user' ? 'bg-primary text-on-primary' : 'bg-surface-2 text-ink-2 '}`}><div className="mb-2 flex items-center gap-2 text-meta font-bold opacity-60">{message.role === 'user' ? 'You' : 'Assistant'}{message.confidence && <span className={`ml-auto rounded-full px-2 py-0.5 ${message.confidence === 'high' ? 'bg-success-bg text-success-ink' : message.confidence === 'medium' ? 'bg-warning-bg text-warning-ink' : 'bg-danger-bg text-danger-ink'}`}>{message.confidence} confidence</span>}</div><p className="whitespace-pre-wrap">{message.content}</p>{message.answerState === 'insufficient_context' && <p className="mt-3 rounded-lg bg-warning-bg p-2 text-xs font-semibold text-warning-ink ">The classroom sources may not fully support this answer. Check with your instructor before relying on it.</p>}{message.followUp && <p className="mt-3 text-xs italic opacity-70">Next step: {message.followUp}</p>}{message.citations?.length ? <div className="mt-3 space-y-1 border-t border-current/10 pt-3 text-meta opacity-75">{message.citations.map((citation) => <p key={`${citation.source}-${citation.reason}`}><FileText size={11} className="mr-1 inline" />{citation.source}: {citation.reason}</p>)}</div> : null}{message.role === 'assistant' && message.id && <div className="mt-3 flex items-center gap-2 border-t border-current/10 pt-3 text-meta opacity-70"><span>Helpful?</span><button type="button" aria-label="Helpful answer" disabled={Boolean(message.feedback)} onClick={() => void rateAnswer(message, 1)} className="rounded p-1 hover:bg-success-bg disabled:opacity-40"><ThumbsUp size={13} /></button><button type="button" aria-label="Not helpful answer" disabled={Boolean(message.feedback)} onClick={() => void rateAnswer(message, -1)} className="rounded p-1 hover:bg-danger-bg disabled:opacity-40"><ThumbsDown size={13} /></button></div>}</div></div>)}
              {loading && <div className="flex items-center gap-2 text-xs text-ink-2"><Bot size={16} className="animate-pulse text-primary" /> Reading classroom sources…</div>}
            </div>
            <form onSubmit={askQuestion} className="flex gap-3 border-t border-line p-4 "><input value={question} onChange={(event) => setQuestion(event.target.value)} disabled={loading || !classroomId} placeholder="Ask about your class material…" className="flex-1 rounded-button border border-line bg-surface-2 px-4 py-3 text-sm outline-none focus:border-primary " /><Button type="submit" disabled={loading || !question.trim() || !classroomId} aria-label="Send question" iconLeft={<Send size={17} />}>Ask</Button></form>
          </section>
          <aside className="space-y-4"><div className="rounded-card border border-primary-soft bg-primary-light p-5"><p className="text-body font-medium text-ink">What it can read</p><p className="mt-1 text-support text-ink-2">Only this class’s materials. It can’t see other classes, and students can’t add their own files.</p></div><div className="rounded-card border border-line bg-surface p-5 shadow-raised "><p className="text-meta font-bold text-ink-2">Available sources</p>{sources.length ? <div className="mt-3 space-y-2">{sources.map((source) => <p key={source} className="flex gap-2 text-xs text-ink-2 "><FileText size={14} className="shrink-0 text-primary" />{source}</p>)}</div> : <p className="mt-3 text-xs leading-5 text-ink-2">Sources will appear after the first grounded answer. If none are processed, ask your instructor to upload or process classroom materials.</p>}</div>{error && <div className="rounded-card bg-danger-bg p-4 text-xs font-semibold text-danger-ink">{error}</div>}</aside>
        </div>
      )}
    </div>
  );
};

import { cors } from 'hono/cors';
import type { Context } from 'hono';
import { aiGenerationService } from './aiGenerationService';
import { addSettlementReceipt, x402App } from './x402Routes';
import { supabase } from '../database/supabase';

const boundedText = (value: unknown, field: string, maxLength: number): string => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${field} is required`);
  }
  const normalized = value.trim();
  if (normalized.length > maxLength) throw new Error(`${field} is too long`);
  return normalized;
};

const getObjectBody = async (c: Context): Promise<Record<string, unknown>> => {
  const body = await c.req.json().catch(() => null);
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new Error('A JSON object request body is required');
  }
  return body as Record<string, unknown>;
};

const validateTestBody = (body: Record<string, unknown>) => {
  const topic = boundedText(body.topic, 'topic', 160);
  const subject = boundedText(body.subject, 'subject', 120);
  const difficultyValue = String(body.difficulty);
  if (!['Easy', 'Medium', 'Hard', 'Adaptive'].includes(difficultyValue)) {
    throw new Error('difficulty is invalid');
  }
  const difficulty = difficultyValue as 'Easy' | 'Medium' | 'Hard' | 'Adaptive';

  const questionCount = Number(body.questionCount ?? 5);
  const durationMins = Number(body.durationMins ?? 45);
  const totalMarks = Number(body.totalMarks ?? 50);
  if (!Number.isInteger(questionCount) || questionCount < 1 || questionCount > 20) {
    throw new Error('questionCount must be between 1 and 20');
  }
  if (!Number.isInteger(durationMins) || durationMins < 5 || durationMins > 300) {
    throw new Error('durationMins must be between 5 and 300');
  }
  if (!Number.isInteger(totalMarks) || totalMarks < questionCount || totalMarks > 500) {
    throw new Error('totalMarks is invalid');
  }

  const instructions = body.instructions == null
    ? ''
    : boundedText(body.instructions, 'instructions', 1000);

  return {
    topic,
    subject,
    difficulty,
    questionCount,
    durationMins,
    totalMarks,
    instructions,
  } as const;
};

const validateClassroomAnswerBody = (body: Record<string, unknown>) => {
  const classroomId = boundedText(body.classroomId, 'classroomId', 100);
  const question = boundedText(body.question, 'question', 2000);
  const threadId = body.threadId == null ? '' : boundedText(body.threadId, 'threadId', 100);
  const rawProfile = body.learnerProfile && typeof body.learnerProfile === 'object' && !Array.isArray(body.learnerProfile) ? body.learnerProfile as Record<string, unknown> : {};
  const recentTopics = Array.isArray(rawProfile.recentTopics) ? rawProfile.recentTopics.filter((item): item is string => typeof item === 'string').slice(-6).map((item) => item.slice(0, 120)) : [];
  const learnerProfile = {
    level: rawProfile.level == null ? '' : boundedText(rawProfile.level, 'learnerProfile.level', 60),
    goals: rawProfile.goals == null ? '' : boundedText(rawProfile.goals, 'learnerProfile.goals', 240),
    preferredStyle: rawProfile.preferredStyle == null ? 'step-by-step' : boundedText(rawProfile.preferredStyle, 'learnerProfile.preferredStyle', 80),
    recentTopics,
  };
  return { classroomId, question, threadId, learnerProfile } as const;
};

const validateProjectIdeaBody = (body: Record<string, unknown>) => {
  const category = boundedText(body.category, 'category', 100);
  const target = boundedText(body.target, 'target', 200);
  const skills = boundedText(body.skills, 'skills', 500);
  const constraints = boundedText(body.constraints, 'constraints', 500);
  const impact = boundedText(body.impact, 'impact', 500);
  const preferredStack = body.preferredStack == null ? '' : boundedText(body.preferredStack, 'preferredStack', 200);
  return { category, target, skills, constraints, impact, preferredStack } as const;
};

const validateAssignmentBody = (body: Record<string, unknown>) => {
  const topic = boundedText(body.topic, 'topic', 160);
  const subject = boundedText(body.subject, 'subject', 120);
  const difficulty = boundedText(body.difficulty, 'difficulty', 30);
  const totalMarks = Number(body.totalMarks ?? 100);
  if (!Number.isInteger(totalMarks) || totalMarks < 1 || totalMarks > 500) {
    throw new Error('totalMarks must be between 1 and 500');
  }
  const instructions = body.instructions == null
    ? ''
    : boundedText(body.instructions, 'instructions', 1000);

  return { topic, subject, difficulty, totalMarks, instructions } as const;
};

const withHandlerErrors = async (c: Context, handler: () => Promise<Response>) => {
  try {
    return await handler();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Paid AI request failed';
    console.error('Paid AI request failed:', error);
    return c.json({ error: message }, 400);
  }
};

x402App.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'PAYMENT-SIGNATURE', 'X-PAYMENT'],
  exposeHeaders: ['PAYMENT-RESPONSE', 'X-402-Transaction-Id'],
}));

x402App.options('*', (c) => c.body(null, 204));

x402App.post('/api/ai/generate-test', async (c) => withHandlerErrors(c, async () => {
  const params = validateTestBody(await getObjectBody(c));
  const test = await aiGenerationService.generateTest(params);
  return c.json({ success: true, test });
}));

x402App.post('/api/ai/generate-assignment', async (c) => withHandlerErrors(c, async () => {
  const assignment = await aiGenerationService.generateAssignment(
    validateAssignmentBody(await getObjectBody(c)),
  );
  return c.json({ success: true, assignment });
}));

x402App.post('/api/ai/project-idea', async (c) => withHandlerErrors(c, async () => {
  const token = c.req.header('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return c.json({ error: 'Authentication is required.' }, 401);
  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authData.user) return c.json({ error: 'Authentication is invalid or expired.' }, 401);
  const project = await aiGenerationService.generateProjectIdea(
    validateProjectIdeaBody(await getObjectBody(c)),
  );
  return c.json({ success: true, project });
}));

x402App.post('/api/ai/classroom-answer', async (c) => withHandlerErrors(c, async () => {
  const { classroomId, question, threadId, learnerProfile } = validateClassroomAnswerBody(await getObjectBody(c));
  const token = c.req.header('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return c.json({ error: 'Authentication is required.' }, 401);
  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authData.user) return c.json({ error: 'Authentication is invalid or expired.' }, 401);

  const { data: membership, error: membershipError } = await (supabase.from('students') as any)
    .select('id,name,roll_number')
    .eq('user_id', authData.user.id)
    .eq('classroom_id', classroomId)
    .limit(1)
    .maybeSingle();
  if (membershipError || !membership) return c.json({ error: 'You are not enrolled in this classroom.' }, 403);

  const { data: materials } = await (supabase.from('classroom_materials') as any)
    .select('name, mime_type, extracted_text, extraction_status')
    .eq('classroom_id', classroomId)
    .eq('extraction_status', 'ready')
    .order('created_at', { ascending: false })
    .limit(40);
  const context = (materials || []).map((material: any) => `SOURCE: ${material.name} (${material.mime_type})\\n${String(material.extracted_text || '').slice(0, 12000)}`).join('\\n\\n');

  let thread: any = null;
  if (threadId) {
    const { data } = await (supabase.from('learning_threads') as any)
      .select('id, classroom_id, student_user_id, learner_profile, last_confidence, last_source_count')
      .eq('id', threadId)
      .eq('classroom_id', classroomId)
      .eq('student_user_id', authData.user.id)
      .maybeSingle();
    thread = data;
  }
  if (!thread) {
    const { data, error } = await (supabase.from('learning_threads') as any).insert({
      classroom_id: classroomId,
      student_user_id: authData.user.id,
      title: question.slice(0, 80),
      learner_profile: { level: 'student', goals: '', preferredStyle: 'step-by-step', recentTopics: [] },
    }).select('id, classroom_id, student_user_id, learner_profile, last_confidence, last_source_count').single();
    if (error) throw error;
    thread = data;
  }

  const { data: history } = await (supabase.from('learning_messages') as any)
    .select('role, content')
    .eq('thread_id', thread.id)
    .order('created_at', { ascending: true })
    .limit(20);
  const previousProfile = (thread.learner_profile || {}) as any;
  const recentTopics = [...(Array.isArray(previousProfile.recentTopics) ? previousProfile.recentTopics : []), ...(learnerProfile.recentTopics || []), question.slice(0, 120)].slice(-6);
  const answer = await aiGenerationService.answerClassroomQuestion({
    question,
    context,
    history: history || [],
    learnerProfile: { ...previousProfile, ...learnerProfile, recentTopics },
  });
  const { data: userMessage, error: userMessageError } = await (supabase.from('learning_messages') as any).insert({ thread_id: thread.id, role: 'user', content: question }).select('id').single();
  if (userMessageError) throw userMessageError;
  const { data: assistantMessage, error: assistantMessageError } = await (supabase.from('learning_messages') as any).insert({
    thread_id: thread.id,
    role: 'assistant',
    content: String(answer.answer || ''),
    citations: answer.citations || [],
    confidence: answer.confidence || 'low',
    answer_state: answer.answerState || 'insufficient_context',
    follow_up: answer.followUp || null,
  }).select('id').single();
  if (assistantMessageError) throw assistantMessageError;
  await (supabase.from('learning_threads') as any).update({ learner_profile: { ...previousProfile, ...learnerProfile, recentTopics }, last_confidence: answer.confidence || 'low', last_source_count: (materials || []).length }).eq('id', thread.id);
  return c.json({ success: true, threadId: thread.id, userMessageId: userMessage.id, assistantMessageId: assistantMessage.id, answer, sources: (materials || []).map((item: any) => item.name) });
}));

x402App.get('/api/ai/classroom-analytics', async (c) => withHandlerErrors(c, async () => {
  const token = c.req.header('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return c.json({ error: 'Authentication is required.' }, 401);
  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authData.user) return c.json({ error: 'Authentication is invalid or expired.' }, 401);
  const classroomId = boundedText(c.req.query('classroomId'), 'classroomId', 100);
  const { data: classroom } = await (supabase.from('classrooms') as any).select('id,name').eq('id', classroomId).eq('user_id', authData.user.id).maybeSingle();
  if (!classroom) return c.json({ error: 'You do not own this classroom.' }, 403);
  const { data: classroomThreads } = await (supabase.from('learning_threads') as any).select('id').eq('classroom_id', classroomId).limit(500);
  const threadIds = (classroomThreads || []).map((item: any) => item.id).filter(Boolean);
  const [{ count: threadCount }, { count: messageCount }, { count: feedbackCount }, { count: materialCount }, { count: readyMaterialCount }] = await Promise.all([
    (supabase.from('learning_threads') as any).select('id', { count: 'exact', head: true }).eq('classroom_id', classroomId),
    threadIds.length ? (supabase.from('learning_messages') as any).select('id', { count: 'exact', head: true }).in('thread_id', threadIds) : Promise.resolve({ count: 0 }),
    (supabase.from('learning_feedback') as any).select('id', { count: 'exact', head: true }).eq('classroom_id', classroomId),
    (supabase.from('classroom_materials') as any).select('id', { count: 'exact', head: true }).eq('classroom_id', classroomId),
    (supabase.from('classroom_materials') as any).select('id', { count: 'exact', head: true }).eq('classroom_id', classroomId).eq('extraction_status', 'ready'),
  ]);
  return c.json({ analytics: { classroomId, classroomName: classroom.name, threadCount: threadCount || 0, messageCount: messageCount || 0, feedbackCount: feedbackCount || 0, materialCount: materialCount || 0, readyMaterialCount: readyMaterialCount || 0 } });
}));

x402App.post('/api/ai/feedback', async (c) => withHandlerErrors(c, async () => {
  const token = c.req.header('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return c.json({ error: 'Authentication is required.' }, 401);
  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authData.user) return c.json({ error: 'Authentication is invalid or expired.' }, 401);
  const body = await getObjectBody(c);
  const threadId = typeof body.threadId === 'string' ? body.threadId : '';
  const messageId = typeof body.messageId === 'string' ? body.messageId : '';
  const rating = body.rating === 1 || body.rating === -1 ? body.rating : null;
  const note = typeof body.note === 'string' ? body.note.slice(0, 500) : null;
  if (!threadId || !messageId || rating === null) return c.json({ error: 'threadId, messageId, and rating are required.' }, 400);
  const { data: thread } = await (supabase.from('learning_threads') as any).select('id,classroom_id,student_user_id').eq('id', threadId).eq('student_user_id', authData.user.id).maybeSingle();
  if (!thread) return c.json({ error: 'Learning thread not found.' }, 404);
  const { data: message } = await (supabase.from('learning_messages') as any).select('id,role').eq('id', messageId).eq('thread_id', thread.id).eq('role', 'assistant').maybeSingle();
  if (!message) return c.json({ error: 'Assistant message not found.' }, 404);
  const { error } = await (supabase.from('learning_feedback') as any).upsert({ thread_id: thread.id, message_id: message.id, classroom_id: thread.classroom_id, student_user_id: authData.user.id, rating, note }, { onConflict: 'message_id,student_user_id' });
  if (error) throw error;
  return c.json({ success: true });
}));

export async function handleX402AiRequest(request: Request): Promise<Response> {
  const response = await x402App.fetch(request);
  return addSettlementReceipt(request, response);
}

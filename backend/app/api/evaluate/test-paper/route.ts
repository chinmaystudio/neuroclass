import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from "@google/genai";
import { withCors, handleOptions } from '../../../../lib/cors';
import { boundedJsonSize, boundedString, parseImageDataUrl, requireAuth } from '../../../../lib/requireAuth';

let aiClient: GoogleGenAI | null = null;

function getAIClient(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error('GEMINI_API_KEY is not configured');
    aiClient = new GoogleGenAI({ apiKey: key, httpOptions: { headers: { 'User-Agent': 'NeuroClass/1.0' } } });
  }
  return aiClient;
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if ('response' in auth) return auth.response;
    const body = await req.json();
    if (!boundedJsonSize(body, 8_000_000)) {
      return withCors(NextResponse.json({ error: 'Evaluation payload is too large.' }, { status: 413 }));
    }
    const studentAnswerSheet = boundedString(body.studentAnswerSheet, 7_000_000);
    const subject = boundedString(body.subject, 160, 'General');
    const studentName = boundedString(body.studentName, 160, 'Student');
    const rawPaper = body.analyzedQuestionPaper;
    const analyzedQuestionPaper = rawPaper && typeof rawPaper === 'object' ? {
      title: boundedString(rawPaper.title, 240),
      subject: boundedString(rawPaper.subject, 160),
      totalMarks: Math.max(0, Math.min(100000, Number(rawPaper.totalMarks) || 0)),
      questions: Array.isArray(rawPaper.questions) ? rawPaper.questions.slice(0, 200).map((question: any) => ({ questionNumber: boundedString(question?.questionNumber || question?.number, 40), questionText: boundedString(question?.questionText || question?.text, 2000), maxMarks: Math.max(0, Math.min(1000, Number(question?.maxMarks || question?.marks) || 0)), expectedAnswerSummary: boundedString(question?.expectedAnswerSummary || question?.expectedAnswer, 2500) })) : [],
    } : null;
    if (!studentAnswerSheet || !analyzedQuestionPaper || !analyzedQuestionPaper.questions.length) {
      return withCors(NextResponse.json({ error: "Missing student answer sheet or reference question paper." }, { status: 400 }));
    }

    const ai = getAIClient();
    const parts: any[] = [];

    let promptText = `
      You are the Master AI Evaluator for NeuroClass.
      Grade the student's submission against the reference Question Paper.
      Reference Question Paper: ${JSON.stringify(analyzedQuestionPaper)}
      Student Name: ${studentName || 'Student'}
      Subject: ${subject || 'General'}

      Output strictly JSON:
      {
        "totalMarksObtained": 85,
        "totalMarksPossible": 100,
        "percentage": 85,
        "grade": "A",
        "overallFeedback": "Excellent analytical rigor.",
        "strengths": ["Clear step-by-step mathematical proofs"],
        "weaknesses": ["Minor arithmetic slip in final step"],
        "improvementSuggestions": ["Review wave packet boundary conditions"],
        "questionEvaluations": [
          {
            "questionNumber": "Q1",
            "marksAllocated": 10,
            "marksAwarded": 9,
            "feedback": "Great logic.",
            "studentResponseSummary": "Accurate derivation."
          }
        ]
      }
    `;

    if (studentAnswerSheet.startsWith('data:')) {
      const image = parseImageDataUrl(studentAnswerSheet);
      if (!image) return withCors(NextResponse.json({ error: 'Only bounded PNG, JPEG, or WebP answer-sheet images are accepted.' }, { status: 400 }));
      parts.push({ inlineData: image });
    } else {
      promptText += `\n\n--- STUDENT ANSWER SHEET ---\n${studentAnswerSheet}`;
    }

    parts.push({ text: promptText });

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: { parts },
      config: {
        responseMimeType: "application/json",
        temperature: 0.2
      }
    });

    const responseText = response.text || '{}';
    const cleaned = responseText.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
    const result = JSON.parse(cleaned);
    if (!result || typeof result !== 'object' || !Array.isArray(result.questionEvaluations)) throw new Error('Evaluation engine returned an invalid grading structure');
    return withCors(NextResponse.json(result));

  } catch (err: any) {
    console.error('Test Paper Evaluation Error:', err);
    return withCors(NextResponse.json({ error: 'Evaluation engine failed.' }, { status: 500 }));
  }
}

export async function OPTIONS() {
  return handleOptions();
}

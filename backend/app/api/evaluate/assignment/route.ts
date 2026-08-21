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
    const assignmentDescription = boundedString(body.assignmentDescription, 8_000);
    const subject = boundedString(body.subject, 160, 'General');
    const studentName = boundedString(body.studentName, 160, 'Student');
    const studentSubmission = boundedString(body.studentSubmission, 7_000_000);
    const rubric = Array.isArray(body.rubric) ? body.rubric.slice(0, 20).map((item: any) => ({ name: boundedString(item?.name, 120), maxMarks: Math.max(0, Math.min(1000, Number(item?.maxMarks) || 0)) })).filter((item: any) => item.name && item.maxMarks > 0) : [];
    if (!rubric.length || rubric.reduce((sum: number, item: any) => sum + item.maxMarks, 0) <= 0) {
      return withCors(NextResponse.json({ error: 'A valid grading rubric is required.' }, { status: 400 }));
    }
    
    if (!studentSubmission) {
      return withCors(NextResponse.json({ error: "Missing student assignment submission." }, { status: 400 }));
    }

    const ai = getAIClient();
    const parts: any[] = [];

    let promptText = `
      You are the NeuroClass AI Assignment & Rubric Grading Agent.
      Assignment: ${assignmentDescription || 'General Assignment'}
      Rubric Parameters: ${JSON.stringify(rubric)}
      Student: ${studentName || 'Student'}

      Output strictly JSON:
      {
        "finalGrade": "A",
        "overallJustification": "Outstanding structured research.",
        "criteriaScores": [
          {
            "name": "Content Quality",
            "maxMarks": 30,
            "scoreObtained": 28,
            "justification": "Original insights."
          }
        ],
        "plagiarismScore": 2,
        "plagiarismDetails": "Original student submission.",
        "improvementSuggestions": ["Incorporate more primary sources."]
      }
    `;

    if (studentSubmission.startsWith('data:')) {
      const image = parseImageDataUrl(studentSubmission);
      if (!image) return withCors(NextResponse.json({ error: 'Only bounded PNG, JPEG, or WebP image submissions are accepted.' }, { status: 400 }));
      parts.push({ inlineData: image });
    } else {
      promptText += `\n\n--- STUDENT SUBMISSION ---\n${studentSubmission}`;
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
    if (!result || typeof result !== 'object' || !Array.isArray(result.criteriaScores)) throw new Error('Assignment evaluator returned an invalid rubric structure');
    return withCors(NextResponse.json(result));

  } catch (err: any) {
    console.error('Assignment Rubric Evaluation Error:', err);
    return withCors(NextResponse.json({ error: 'Assignment grading failed.' }, { status: 500 }));
  }
}

export async function OPTIONS() {
  return handleOptions();
}

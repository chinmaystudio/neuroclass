import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import dotenv from "dotenv";
import cors from "cors";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

let aiClient: GoogleGenAI | null = null;

function getAIClient(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error("GEMINI_API_KEY environment variable is required");
    }
    aiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // AI Question Paper Analysis Route
  app.post("/api/analyze-question-paper", async (req, res) => {
    try {
      const { questionPaper, subject } = req.body;
      if (!questionPaper) {
        return res.status(400).json({ error: "Missing question paper content." });
      }

      const ai = getAIClient();
      const parts: any[] = [];

      let promptText = `
        You are the Elite AI Question Paper Analyst and OCR digitizer for NeuroClass.
        YOUR TASK is to:
        1. Parse the uploaded question paper (which can be raw text or an image of printed/handwritten exam paper).
        2. Identify and list every single question in the paper.
        3. For each question, extract or suggest:
           a. The question number (e.g. "Q1", "2", "3b").
           b. The exact/extracted question text.
           c. The maximum marks allocated to this question (if specified; if not, guess reasonable marks like 5 or 10).
           d. A concise expected answer key/concept reference for full marks.
        4. Provide the total marks (sum of all maximum marks).
        
        Return a valid JSON object matching this structure:
        {
          "title": "Exam/Test Sheet Title",
          "subject": "${subject || "General Studies"}",
          "totalMarks": number,
          "questions": Array<{
            "questionNumber": string,
            "questionText": string,
            "maxMarks": number,
            "expectedAnswerSummary": string
          }>
        }
      `;

      parts.push({ text: promptText });

      const parseBase64Image = (dataUrl: string) => {
        const matches = dataUrl.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
        return matches ? { mimeType: matches[1], data: matches[2] } : null;
      };

      if (typeof questionPaper === 'string') {
        const imgData = parseBase64Image(questionPaper);
        if (imgData) {
          parts.push({
            inlineData: {
              mimeType: imgData.mimeType,
              data: imgData.data
            }
          });
        } else {
          parts.push({ text: `Question Paper Content:\n${questionPaper}` });
        }
      }

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: { parts },
        config: {
          responseMimeType: "application/json",
          temperature: 0.1
        }
      });

      const responseText = response.text || "{}";
      const cleaned = responseText.trim().replace(/^```json/, '').replace(/```$/, '');
      res.json(JSON.parse(cleaned));

    } catch (err: any) {
      console.error("Question Paper Analysis Error:", err);
      res.status(500).json({ error: err.message || "Failed to analyze question paper." });
    }
  });

  // AI Test Paper Evaluation Route
  app.post("/api/evaluate/test-paper", async (req, res) => {
    try {
      const { questionPaper, modelAnswerKey, markingScheme, studentAnswerSheet, subject, studentName, analyzedQuestionPaper } = req.body;
      
      if (!studentAnswerSheet) {
        return res.status(400).json({ error: "Missing student answer sheet content." });
      }

      const ai = getAIClient();
      const parts: any[] = [];

      let promptText = "";

      if (analyzedQuestionPaper && Array.isArray(analyzedQuestionPaper.questions)) {
        promptText = `
          You are the Elite AI Evaluation Engine and OCR digitizer for NeuroClass.
          YOUR TASK is to:
          1. Identify the writing/text on the student's answer sheet. High-speed OCR the students file if it is an image (handwritten or printed). If the user provided text, process the text directly.
          2. Evaluate the student's answers strictly against the following pre-analyzed Question Paper reference:
             - Subject: ${subject || "General Studies"}
             - Student Name: ${studentName || "Anonymous Student"}
             - Assessment Name: ${analyzedQuestionPaper.title || "N/A"}
             - Total Possible Marks: ${analyzedQuestionPaper.totalMarks || 100}
             
             QUESTIONS & GUIDELINES:
             ${JSON.stringify(analyzedQuestionPaper.questions, null, 2)}
          3. Match the student's written response for each question number listed.
          4. Grade each student's answer carefully. Award partial marks out of the allocated maxMarks.
          5. Explain deductions clearly and give direct, constructive feedback for each question.
          6. Highlight overarching strengths, weaknesses, and direct steps for improvement.
          7. Provide final score details.
          
          Return a valid JSON object matching this structure:
          {
            "totalMarksObtained": number,
            "totalMarksPossible": number,
            "percentage": number,
            "grade": string,
            "questionEvaluations": Array<{
              "questionNumber": string,
              "questionSummary": string,
              "studentAnswerExtracted": string,
              "marksAwarded": number,
              "maxMarks": number,
              "deductionExplanation": string,
              "feedback": string
            }>,
            "overallFeedback": string,
            "strengths": string[],
            "weaknesses": string[],
            "improvementSuggestions": string[]
          }
        `;
      } else {
        // Fallback to legacy structure
        promptText = `
          You are the Elite AI Evaluation Engine and OCR digitizer for NeuroClass.
          YOUR TASK is to:
          1. Identify the writing/text on the student's answer sheet. High-speed OCR the students file if it is an image (handwritten or printed). If the user provided text, process the text directly.
          2. Identify individual questions and answers.
          3. Compare each student answer with the corresponding Model Answer Key / Reference.
          4. Grade each answer carefully against the Marking Scheme. Award partial marks where appropriate.
          5. Explain deductions clearly and give direct, constructive feedback for each question.
          6. Highlight overarching strengths, weaknesses, and direct steps for improvement.
          7. Provide a final score, total score, percentage, grade, and evaluation commentary.

          CONTEXT:
          - Subject: ${subject || "General Science/Studies"}
          - Student Name: ${studentName || "Anonymous Student"}
          - Question Paper Guidelines: ${questionPaper || "N/A"}
          - Model Answer Key: ${modelAnswerKey || "Align to logical correctness based on general standards"}
          - Marking Scheme: ${markingScheme || "Award marks on accuracy, explanation depth, and relevant formulas"}

          Return a valid JSON object matching the following TypeScript schema:
          {
            "totalMarksObtained": number,
            "totalMarksPossible": number,
            "percentage": number,
            "grade": string,
            "questionEvaluations": Array<{
              "questionNumber": string,
              "questionSummary": string,
              "studentAnswerExtracted": string,
              "marksAwarded": number,
              "maxMarks": number,
              "deductionExplanation": string,
              "feedback": string
            }>,
            "overallFeedback": string,
            "strengths": string[],
            "weaknesses": string[],
            "improvementSuggestions": string[]
          }
        `;
      }

      parts.push({ text: promptText });

      const parseBase64Image = (dataUrl: string) => {
        const matches = dataUrl.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
        return matches ? { mimeType: matches[1], data: matches[2] } : null;
      };

      if (typeof studentAnswerSheet === 'string') {
        const imgData = parseBase64Image(studentAnswerSheet);
        if (imgData) {
          parts.push({
            inlineData: {
              mimeType: imgData.mimeType,
              data: imgData.data
            }
          });
        } else {
          parts.push({ text: `Student Answer Sheet Document Content:\n${studentAnswerSheet}` });
        }
      }

      // If other keys are images (like question paper / answer keys), handle them
      if (typeof questionPaper === 'string' && questionPaper.startsWith('data:image/')) {
        const pImg = parseBase64Image(questionPaper);
        if (pImg) parts.push({ inlineData: pImg });
      }
      if (typeof modelAnswerKey === 'string' && modelAnswerKey.startsWith('data:image/')) {
        const keyImg = parseBase64Image(modelAnswerKey);
        if (keyImg) parts.push({ inlineData: keyImg });
      }

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: { parts },
        config: {
          responseMimeType: "application/json",
          temperature: 0.2
        }
      });

      const responseText = response.text || "{}";
      const cleaned = responseText.trim().replace(/^```json/, '').replace(/```$/, '');
      res.json(JSON.parse(cleaned));

    } catch (err: any) {
      console.error("Test Paper Evaluation Error:", err);
      res.status(500).json({ error: err.message || "Evaluation processing failed." });
    }
  });

  // AI Rubrics Assessment Route
  app.post("/api/evaluate/assignment", async (req, res) => {
    try {
      const { assignmentDescription, rubric, studentSubmission, subject, studentName } = req.body;

      if (!studentSubmission) {
        return res.status(400).json({ error: "Missing student assignment submission." });
      }

      const ai = getAIClient();
      const parts: any[] = [];

      let rubricText = typeof rubric === 'string' ? rubric : JSON.stringify(rubric, null, 2);

      let promptText = `
        You are the Elite Rubric Evaluation Engine for NeuroClass.
        YOUR TASK is to grade a student's uploaded assignment against a customized criteria rubric.
        
        INSTRUCTIONS:
        1. Fully inspect the student's submission (text or OCR handwritten/digitized image).
        2. Evaluate each criterion in the Rubric strictly and separately.
        3. Assign an earned score (marks) for each criterion and offer a bulletproof justification outlining exactly where they gained or lost points.
        4. Detect potential plagiarism or copy-paste markers and provide an estimated Plagiarism confidence level (0 to 100%) and details.
        5. Compile the final score, percentage, letter grade, and constructive improvement suggestions.

        CONTEXT:
        - Subject: ${subject || "General Assignment"}
        - Student Name: ${studentName || "Anonymous Student"}
        - Assignment Description: ${assignmentDescription || "N/A"}
        - Evaluation Rubric Guidelines:
        ${rubricText}

        Return a valid JSON object matching the following structure:
        {
          "criteriaScores": Array<{
            "criterionName": string,
            "maxMarks": number,
            "scoreObtained": number,
            "justification": string
          }>,
          "totalScore": number,
          "maxScore": number,
          "percentage": number,
          "finalGrade": string,
          "plagiarismScore": number,
          "plagiarismDetails": string,
          "overallJustification": string,
          "feedbackComments": string,
          "improvementSuggestions": string[]
        }
      `;

      parts.push({ text: promptText });

      const parseBase64Image = (dataUrl: string) => {
        const matches = dataUrl.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
        return matches ? { mimeType: matches[1], data: matches[2] } : null;
      };

      if (typeof studentSubmission === 'string') {
        const imgData = parseBase64Image(studentSubmission);
        if (imgData) {
          parts.push({
            inlineData: {
              mimeType: imgData.mimeType,
              data: imgData.data
            }
          });
        } else {
          parts.push({ text: `Student Submission Document:\n${studentSubmission}` });
        }
      }

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: { parts },
        config: {
          responseMimeType: "application/json",
          temperature: 0.2
        }
      });

      const responseText = response.text || "{}";
      const cleaned = responseText.trim().replace(/^```json/, '').replace(/```$/, '');
      res.json(JSON.parse(cleaned));

    } catch (err: any) {
      console.error("Assignment Rubric Evaluation Error:", err);
      res.status(500).json({ error: err.message || "Assignment grading failed." });
    }
  });

  // AI Chat Tutor & Learning Advisor Route
  app.post("/api/chat", async (req, res) => {
    try {
      const { message, history = [], systemInstruction = "You are the NeuroClass AI Learning Advisor. Help students and instructors master educational topics, design perfect Rubrics, and analyze marking gaps based on evaluations." } = req.body;

      if (!message) {
        return res.status(400).json({ error: "Missing prompt or query message." });
      }

      const ai = getAIClient();
      
      // Adapt conversational history to Gemini's dynamic format
      const contents = [
        ...history.map((msg: any) => ({
          role: msg.role === "assistant" ? "model" : "user",
          parts: [{ text: msg.content }]
        })),
        { role: "user", parts: [{ text: message }] }
      ];

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents,
        config: {
          systemInstruction,
          temperature: 0.7
        }
      });

      res.json({ text: response.text || "" });
    } catch (err: any) {
      console.error("AI Chat Advisor Route Error:", err);
      res.status(500).json({ error: err.message || "AI response failed to compile." });
    }
  });

  // Vite Middleware
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
});

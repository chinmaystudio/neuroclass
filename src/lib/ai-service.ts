/**
 * Secure gateway for communicating with the Render AI Service.
 * This ensures raw embeddings and the AI_SERVICE_SECRET never reach the browser.
 */

export async function sendToRenderAI(endpoint: string, formData: FormData) {
  const baseUrl = process.env.AI_SERVICE_URL;
  const secret = process.env.AI_SERVICE_SECRET;

  if (!baseUrl || !secret) {
    console.error("AI_SERVICE_URL or AI_SERVICE_SECRET is missing.");
    throw new Error("AI Service configuration is missing on the backend.");
  }

  const url = `${baseUrl}${endpoint}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${secret}`
        // Do not set Content-Type; node-fetch/undici handles the multipart boundary automatically
      },
      body: formData as any
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`AI Service Error (${response.status}):`, errorText);
      throw new Error(`AI Service returned ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Failed to reach AI Service:", error);
    throw new Error("Failed to communicate with the biometric AI service.");
  }
}

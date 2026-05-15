import { GoogleGenAI } from "@google/genai";

let aiClient: GoogleGenAI | null = null;
function getAI() {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error("GEMINI_API_KEY environment variable is required");
    }
    aiClient = new GoogleGenAI({ apiKey: key });
  }
  return aiClient;
}

export async function translateChat(messages: any[], targetLanguage: string = "user's preferred language") {
  try {
    const ai = getAI();
    const formattedChat = messages.map(m => `[${m.senderId === 'me' ? 'User' : 'Other'}]: ${m.content || (m.mediaUrl ? '[Media]' : '')}`).join('\n');

    
    // We want the AI to translate the conversation but maybe we want to provide the translated messages mapped to their IDs.
    const prompt = `Translate the following chat conversation to ${targetLanguage}.
Return ONLY a valid JSON array of objects, where each object corresponds to a message in the same order, with the translated content. Do not return markdown code blocks, just raw JSON.
Example format:
[
  { "id": "msg1", "content": "Translated content 1" }
]

Messages:
${JSON.stringify(messages.map(m => ({ id: m.id, content: m.content })))}
`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });

    const result = response.text;
    if (result) {
      const cleanJson = result.replace(/```(?:json)?/gi, '').trim();
      return JSON.parse(cleanJson);
    }
    return [];
  } catch (error) {
    console.error("Translation error:", error);
    throw error;
  }
}

export async function summarizeChat(messages: any[]) {
  try {
    const ai = getAI();
    const prompt = `Summarize the following chat conversation briefly and extract any key action items or important takeaways.
Return ONLY a valid JSON object with the following schema. Do not return markdown blocks, just raw JSON.
{
  "summary": "A concise 2-3 sentence summary of the chat",
  "actionItems": ["Action item 1", "Action item 2"]
}

Messages:
${JSON.stringify(messages.map(m => ({ content: m.content })))}
`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });

    const result = response.text;
    if (result) {
      const cleanJson = result.replace(/```(?:json)?/gi, '').trim();
      return JSON.parse(cleanJson);
    }
    return null;
  } catch (error) {
    console.error("Summary error:", error);
    throw error;
  }
}

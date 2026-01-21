import { GoogleGenAI } from "@google/genai";

const DAILY_POINTS = 30;

// Costs
export const COSTS = {
  REWRITE: 3,
  SUMMARIZE: 3,
  EXPAND: 3,
  AUTO_TITLE: 1,
  CUSTOM_BASE: 5,
  SPELLCHECK: 2,
};

export const calculateCustomCost = (promptLength: number): number => {
  // 5 points base + 1 point for every 100 characters of prompt
  const lengthCost = Math.floor(promptLength / 100);
  return COSTS.CUSTOM_BASE + lengthCost;
};

export const getAIPoints = (): number => {
  const today = new Date().toISOString().split('T')[0];
  const key = `scripta_ai_points_${today}`;
  const pointsUsed = parseInt(localStorage.getItem(key) || '0', 10);
  // Ensure points don't appear negative and are capped at daily max implicitly by logic
  return Math.max(0, DAILY_POINTS - pointsUsed);
};

export const checkPointsAvailable = (cost: number): boolean => {
  return getAIPoints() >= cost;
};

const deductPoints = (cost: number): boolean => {
  const today = new Date().toISOString().split('T')[0];
  const key = `scripta_ai_points_${today}`;
  const pointsUsed = parseInt(localStorage.getItem(key) || '0', 10);
  
  if (pointsUsed + cost > DAILY_POINTS) {
    return false;
  }
  
  localStorage.setItem(key, (pointsUsed + cost).toString());
  return true;
};

const getAIClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error('API Key is missing');
  }
  return new GoogleGenAI({ apiKey });
};

export const generateTitleFromContent = async (content: string): Promise<string> => {
  if (!content || content.length < 10) return '';
  
  // Minimal cost for auto-title to encourage usage but prevent abuse
  if (!deductPoints(COSTS.AUTO_TITLE)) return '';

  try {
    const ai = getAIClient();
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Generate a very short, maximum 4-word title for this text. Do not use quotes. Text: ${content.substring(0, 500)}`,
    });
    return response.text?.trim() || '';
  } catch (e: any) {
    console.error("Auto-title failed", e);
    // Silent fail for auto-title
    return '';
  }
};

export const generateAIContent = async (
  prompt: string,
  cost: number,
  context?: string
): Promise<string> => {
  // First check points
  if (!deductPoints(cost)) {
    throw new Error(`I apologize, but this request requires ${cost} points and you only have ${getAIPoints()} left.`);
  }

  try {
    const ai = getAIClient();
    const model = 'gemini-3-flash-preview';
    
    const fullPrompt = context 
      ? `Context: ${context}\n\nTask: ${prompt}`
      : prompt;

    const response = await ai.models.generateContent({
      model,
      contents: fullPrompt,
      config: {
        systemInstruction: "You are Scripta, a helpful, calm, and intelligent writing assistant. Keep responses concise. Output clean text only. No markdown symbols like ** or # unless absolutely necessary for structure (like lists)."
      }
    });

    if (!response.text) {
        throw new Error("No response generated.");
    }

    return response.text;
  } catch (error: any) {
    console.error('Gemini API Error:', error);
    
    // Check for common API errors
    if (error.message?.includes('429') || error.status === 429) {
        throw new Error("System is currently experiencing high traffic (Quota Exceeded). Please try again later.");
    }
    
    throw error;
  }
};

export const checkSpelling = async (text: string): Promise<Array<{original: string, suggestion: string}>> => {
    if (!text || text.trim().length < 5) return [];
    
    if (!deductPoints(COSTS.SPELLCHECK)) {
         throw new Error(`Not enough points for spellcheck (Cost: ${COSTS.SPELLCHECK})`);
    }

    try {
        const ai = getAIClient();
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `Identify spelling and grammar errors in the following text. Return strictly a JSON array of objects with "original" (the exact incorrect text found in the source) and "suggestion" (the corrected text). If no errors are found, return an empty array []. Text: ${text}`,
            config: {
                responseMimeType: "application/json"
            }
        });
        
        const jsonStr = response.text?.trim();
        if (!jsonStr) return [];
        
        const result = JSON.parse(jsonStr);
        return Array.isArray(result) ? result : [];
    } catch (e) {
        console.error("Spellcheck failed", e);
        return [];
    }
}
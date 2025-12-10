import { GoogleGenAI } from "@google/genai";
import { StockPriceResponse } from "../types";

// NOTE: In a production app, these calls should go through a backend to protect the API key.
// For this frontend-only demo, we assume the key is available or user provides it.
// We will use a placeholder or check environment.

const getClient = () => {
  const apiKey = import.meta.env.VITE_API_KEY;
  if (!apiKey) {
    throw new Error("API Key not found in environment.");
  }
  return new GoogleGenAI({ apiKey });
};

export const fetchStockPrice = async (ticker: string): Promise<StockPriceResponse> => {
  try {
    const ai = getClient();
    
    // We use the search tool to get real-time info
    const model = 'gemini-2.5-flash';
    
    const prompt = `What is the current stock price of ${ticker}? 
    Return strictly a JSON object with keys: "price" (number) and "currency" (string like "USD"). 
    Do not include markdown formatting.`;

    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        // We cannot use responseMimeType: 'application/json' with googleSearch tool per guidelines
        // So we must parse the text manually
      }
    });

    const text = response.text || "";
    
    // Attempt to extract JSON from text (it might be wrapped in ```json ... ``` or just text)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    
    if (jsonMatch) {
      const json = JSON.parse(jsonMatch[0]);
      return {
        price: typeof json.price === 'number' ? json.price : parseFloat(json.price),
        currency: json.currency || 'USD',
        sourceUrl: response.candidates?.[0]?.groundingMetadata?.groundingChunks?.[0]?.web?.uri
      };
    }

    // Fallback: regex search for price if JSON parse fails
    const priceMatch = text.match(/\$?([0-9,]+\.[0-9]{2})/);
    if (priceMatch) {
        return {
            price: parseFloat(priceMatch[1].replace(/,/g, '')),
            currency: 'USD'
        };
    }

    throw new Error("Could not parse stock price from AI response");

  } catch (error) {
    console.error("Error fetching stock price:", error);
    // Return a mockup error or rethrow
    throw error;
  }
};
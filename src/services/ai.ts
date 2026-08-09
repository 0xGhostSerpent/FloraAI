import { GoogleGenAI, Type } from '@google/genai';
import type { ChatMessage, PlantData, PlantStatus, PriceEstimate } from '../store';

const MODEL = 'gemini-2.5-flash';

export type AiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } };

const fail = (message: string): AiResult<never> => ({
  ok: false,
  error: { code: 'AI_FAILED', message },
});

const client = (apiKey: string) =>
  new GoogleGenAI({ apiKey: apiKey || import.meta.env.VITE_GEMINI_API_KEY });

/** Splits a data URL into the parts the Gemini inlineData part expects. */
function imageParts(dataUrl: string) {
  return {
    inlineData: {
      data: dataUrl.split(',')[1],
      mimeType: dataUrl.split(';')[0].split(':')[1],
    },
  };
}

async function generateJson<T>(
  apiKey: string,
  parts: unknown[],
  responseSchema: unknown,
): Promise<AiResult<T>> {
  if (!apiKey) return { ok: false, error: { code: 'NO_API_KEY', message: 'Add your Gemini API key in Settings.' } };

  try {
    const response = await client(apiKey).models.generateContent({
      model: MODEL,
      contents: [{ parts }] as never,
      config: { responseMimeType: 'application/json', responseSchema } as never,
    });
    return { ok: true, data: JSON.parse(response.text!) as T };
  } catch {
    return fail('The AI request failed. Check your API key and network, then try again.');
  }
}

const priceBand = {
  type: Type.OBJECT,
  properties: { min: { type: Type.NUMBER }, max: { type: Type.NUMBER } },
  required: ['min', 'max'],
};

export type ToxicAlertLevel = 'high' | 'low' | 'none';

export type Identification = {
  name: string;
  scientificName: string;
  confidence: number;
  careInstructions: string;
  healthStatus: string;
  personality: string;
  isToxic: boolean;
  toxicityDetails: string;
  toxicAlertLevel: ToxicAlertLevel;
};

/** The model returns free text here; constrain it to the values we store. */
const normalizeAlertLevel = (value: string): ToxicAlertLevel =>
  value === 'high' || value === 'low' ? value : 'none';

/**
 * scientificName is load-bearing: GBIF matching and price estimation are both
 * useless without a binomial name.
 */
export async function identifyPlant(
  image: string,
  apiKey: string,
): Promise<AiResult<Identification>> {
  const result = await generateJson<Identification>(
    apiKey,
    [
      {
        text: 'Analyze this plant. Prioritize identifying toxicity. Provide its common name, its binomial scientific name, a confidence between 0 and 1, care instructions, its health status, and a 1-sentence "personality" based on its species to act as a chatbot character. Also return boolean `isToxic`, string `toxicityDetails`, and string `toxicAlertLevel` (high, low, or none). Return JSON.',
      },
      imageParts(image),
    ],
    {
      type: Type.OBJECT,
      properties: {
        name: { type: Type.STRING },
        scientificName: { type: Type.STRING },
        confidence: { type: Type.NUMBER },
        careInstructions: { type: Type.STRING },
        healthStatus: { type: Type.STRING },
        personality: { type: Type.STRING },
        isToxic: { type: Type.BOOLEAN },
        toxicityDetails: { type: Type.STRING },
        toxicAlertLevel: { type: Type.STRING },
      },
      required: [
        'name',
        'scientificName',
        'confidence',
        'careInstructions',
        'healthStatus',
        'personality',
        'isToxic',
        'toxicityDetails',
        'toxicAlertLevel',
      ],
    },
  );

  if (!result.ok) return result;
  return {
    ok: true,
    data: { ...result.data, toxicAlertLevel: normalizeAlertLevel(result.data.toxicAlertLevel) },
  };
}

export type CheckIn = { healthStatus: string; openingMessage: string };

export function checkInOnPlant(image: string, apiKey: string): Promise<AiResult<CheckIn>> {
  return generateJson<CheckIn>(
    apiKey,
    [
      {
        text: `You are a plant avatar. Analyze the user's provided photo of this plant (soil and leaves). First, check for soil wetness and leaf health (drooping, brown spots). Your opening message MUST directly address the plant's current physical state. Example: "My soil looks dry, please water me!" Be conversational and act in character based on the plant's personality. Return your health assessment and opening message in JSON.`,
      },
      imageParts(image),
    ],
    {
      type: Type.OBJECT,
      properties: { healthStatus: { type: Type.STRING }, openingMessage: { type: Type.STRING } },
      required: ['healthStatus', 'openingMessage'],
    },
  );
}

export function assessStatus(
  image: string,
  plantName: string,
  apiKey: string,
): Promise<AiResult<Omit<PlantStatus, 'assessedAt'>>> {
  return generateJson<Omit<PlantStatus, 'assessedAt'>>(
    apiKey,
    [
      {
        text: `Assess the health of this ${plantName} from the photo. Judge hydration from the soil and leaves, leaf condition, and whether the light it appears to be receiving suits the species. Give one concrete recommended action. \`overall\` must be exactly one of: healthy, stressed, declining, unknown. Return JSON.`,
      },
      imageParts(image),
    ],
    {
      type: Type.OBJECT,
      properties: {
        overall: { type: Type.STRING },
        hydration: { type: Type.STRING },
        leafCondition: { type: Type.STRING },
        lightAdequacy: { type: Type.STRING },
        recommendedAction: { type: Type.STRING },
      },
      required: ['overall', 'hydration', 'leafCondition', 'lightAdequacy', 'recommendedAction'],
    },
  );
}

export function estimatePrice(
  scientificName: string,
  countryName: string,
  apiKey: string,
): Promise<AiResult<Omit<PriceEstimate, 'scientificName' | 'fetchedAt'>>> {
  return generateJson<Omit<PriceEstimate, 'scientificName' | 'fetchedAt'>>(
    apiKey,
    [
      {
        text: `Estimate the typical retail price of a potted ${scientificName} at a plant nursery in ${countryName}. Give a range for each of three sizes (small, medium, large) in that country's local currency, returning the currency as an ISO 4217 code. Always give a range, never a single figure. Add a one-sentence note about what drives the price. Return JSON.`,
      },
    ],
    {
      type: Type.OBJECT,
      properties: {
        currency: { type: Type.STRING },
        small: priceBand,
        medium: priceBand,
        large: priceBand,
        note: { type: Type.STRING },
      },
      required: ['currency', 'small', 'medium', 'large', 'note'],
    },
  );
}

export type Habitat = {
  nativeRange: string;
  habitat: string;
  season: string;
  whatToLookFor: string;
};

export function describeHabitat(scientificName: string, apiKey: string): Promise<AiResult<Habitat>> {
  return generateJson<Habitat>(
    apiKey,
    [
      {
        text: `Describe where ${scientificName} grows in the wild: its native range, the habitat it favours, the season it is most visible or in flower, and what to look for when identifying it in the field. If it is primarily a cultivated plant rarely found wild, say so plainly. Return JSON.`,
      },
    ],
    {
      type: Type.OBJECT,
      properties: {
        nativeRange: { type: Type.STRING },
        habitat: { type: Type.STRING },
        season: { type: Type.STRING },
        whatToLookFor: { type: Type.STRING },
      },
      required: ['nativeRange', 'habitat', 'season', 'whatToLookFor'],
    },
  );
}

export async function chat(
  plant: PlantData,
  history: ChatMessage[],
  apiKey: string,
): Promise<AiResult<string>> {
  if (!apiKey) return { ok: false, error: { code: 'NO_API_KEY', message: 'Add your Gemini API key in Settings.' } };

  const systemInstruction = `You are a ${plant.name}. Your personality is: "${plant.personality}". Your current health is: "${plant.healthStatus}". Act exactly like this plant in a text conversation with your owner. Keep responses conversational.`;

  try {
    const response = await client(apiKey).models.generateContent({
      model: MODEL,
      contents: history.map((msg) => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.text }],
      })) as never,
      config: { systemInstruction: { parts: [{ text: systemInstruction }] } } as never,
    });
    return { ok: true, data: response.text || '*rustles leaves*' };
  } catch {
    return fail('Sorry, my connection is poor today.');
  }
}

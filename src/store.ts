import { get, set } from 'idb-keyval';

export type PlantData = {
  id: string;
  name: string;
  careInstructions: string;
  healthStatus: string;
  personality: string;
  isToxic?: boolean;
  toxicityDetails?: string;
  toxicAlertLevel?: 'high' | 'low' | 'none';
  imageUrl: string;
  dateScanned: string;
  timestamp: number;
  checkIns: {
    dateId: string; // e.g. "2023-10-27"
    imageUrl: string;
  }[];
};

export type ChatMessage = {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
};

export async function getPlants(): Promise<PlantData[]> {
  const plants = await get<PlantData[]>('flora_plants');
  return plants || [];
}

export async function savePlants(plants: PlantData[]): Promise<void> {
  await set('flora_plants', plants);
}

export async function getChatHistory(plantId: string): Promise<ChatMessage[]> {
  const history = await get<ChatMessage[]>(`flora_chat_${plantId}`);
  return history || [];
}

export async function saveChatHistory(plantId: string, messages: ChatMessage[]): Promise<void> {
  await set(`flora_chat_${plantId}`, messages);
}

export async function getAppConfig() {
  const config = await get('flora_config');
  return config || { lastCheckInDate: null, streak: 0, theme: 'theme-minimalist' };
}

export async function saveAppConfig(config: any) {
  await set('flora_config', config);
}

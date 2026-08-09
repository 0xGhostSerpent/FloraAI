import { useState, useEffect, type ChangeEvent } from 'react';
import { ChevronLeft, Leaf, ScanLine, Store } from 'lucide-react';
import { GoogleGenAI, Type } from '@google/genai';
import { AnimatePresence } from 'motion/react';
import { auth } from './firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import {
  getPlants,
  savePlants,
  getChatHistory,
  saveChatHistory,
  getAppConfig,
  saveAppConfig,
  PlantData,
  ChatMessage,
} from './store';
import { getTodayDateId, getYesterdayDateId } from './lib/dates';
import OnboardingScreen from './screens/OnboardingScreen';
import HomeScreen from './screens/HomeScreen';
import ScannerScreen from './screens/ScannerScreen';
import ChatScreen from './screens/ChatScreen';
import HistoryScreen from './screens/HistoryScreen';
import SettingsScreen from './screens/SettingsScreen';

type Screen = 'home' | 'scanner' | 'settings' | 'chat' | 'history' | 'nurseries';

const getAiInstance = (apiKey?: string) =>
  new GoogleGenAI({ apiKey: apiKey || import.meta.env.VITE_GEMINI_API_KEY });

export default function App() {
  const [isInitializing, setIsInitializing] = useState(true);
  const [, setCurrentUser] = useState<User | null>(null);

  // App config
  const [hasOnboarded, setHasOnboarded] = useState(false);
  const [userApiKey, setUserApiKey] = useState('');
  const [appTheme, setAppTheme] = useState('theme-minimalist');

  // Data
  const [plants, setPlants] = useState<PlantData[]>([]);
  const [chatHistory, setChatHistory] = useState<Record<string, ChatMessage[]>>({});
  const [streak, setStreak] = useState(0);
  const [lastCheckInDate, setLastCheckInDate] = useState<string | null>(null);

  // Navigation
  const [currentScreen, setCurrentScreen] = useState<Screen>('home');
  const [activePlantDetails, setActivePlantDetails] = useState<PlantData | null>(null);

  // Scanner
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<Partial<PlantData> | null>(null);
  const [scanMode, setScanMode] = useState<'new_plant' | 'check_in'>('new_plant');
  const [showToxicAlert, setShowToxicAlert] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

  // Chat
  const [chatMessage, setChatMessage] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);

  useEffect(() => {
    const initApp = async () => {
      const onboarded = localStorage.getItem('flora_onboarded') === 'true';
      const key = localStorage.getItem('flora_api_key') || '';

      setHasOnboarded(onboarded);
      setUserApiKey(key);

      setPlants(await getPlants());

      const config = await getAppConfig();

      let currentStreak = config.streak || 0;
      const lastCheckIn = config.lastCheckInDate;
      if (lastCheckIn !== getTodayDateId() && lastCheckIn !== getYesterdayDateId()) {
        currentStreak = 0; // Reset streak if a day was missed
      }
      setStreak(currentStreak);
      setLastCheckInDate(lastCheckIn);
      setAppTheme(config.theme || 'theme-minimalist');

      onAuthStateChanged(auth, (user) => {
        setCurrentUser(user);
        setIsInitializing(false);
      });
    };
    void initApp();
  }, []);

  const saveConfig = async (updates: Record<string, unknown>) => {
    const current = await getAppConfig();
    await saveAppConfig({ ...current, ...updates });
  };

  const updateTheme = async (newTheme: string) => {
    setAppTheme(newTheme);
    await saveConfig({ theme: newTheme });
  };

  const changeApiKey = (value: string) => {
    setUserApiKey(value);
    localStorage.setItem('flora_api_key', value);
  };

  const completeOnboarding = () => {
    setHasOnboarded(true);
    localStorage.setItem('flora_onboarded', 'true');
  };

  const handleCameraCapture = (
    e: ChangeEvent<HTMLInputElement>,
    mode: 'new_plant' | 'check_in' = 'new_plant',
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      setScanMode(mode);
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage(reader.result as string);
        setScanResult(null);
        setScanError(null);
        setShowToxicAlert(false);
        setCurrentScreen('scanner');
      };
      reader.readAsDataURL(file);
    }
    e.target.value = '';
  };

  const goBack = () => {
    if (currentScreen === 'history') setCurrentScreen('chat');
    else if (currentScreen === 'chat' && scanMode === 'check_in') setCurrentScreen('home');
    else setCurrentScreen('home');
  };

  const openPlant = (plant: PlantData) => {
    setActivePlantDetails(plant);
    void loadChatHistory(plant.id);
    setCurrentScreen('chat');
  };

  const processImage = async () => {
    if (!selectedImage) return;
    setIsScanning(true);
    setScanError(null);
    try {
      const base64Data = selectedImage.split(',')[1];
      const mimeType = selectedImage.split(';')[0].split(':')[1];
      const ai = getAiInstance(userApiKey);

      if (scanMode === 'new_plant') {
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: [
            {
              parts: [
                {
                  text: 'Analyze this plant. Prioritize identifying toxicity. Provide its name, care instructions, its health status, and a 1-sentence "personality" based on its species to act as a chatbot character. Also return boolean `isToxic`, string `toxicityDetails`, and string `toxicAlertLevel` (high, low, or none). Return JSON.',
                },
                { inlineData: { data: base64Data, mimeType } },
              ],
            },
          ],
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                careInstructions: { type: Type.STRING },
                healthStatus: { type: Type.STRING },
                personality: { type: Type.STRING },
                isToxic: { type: Type.BOOLEAN },
                toxicityDetails: { type: Type.STRING },
                toxicAlertLevel: { type: Type.STRING },
              },
              required: [
                'name',
                'careInstructions',
                'healthStatus',
                'personality',
                'isToxic',
                'toxicityDetails',
                'toxicAlertLevel',
              ],
            },
          },
        });
        const res = JSON.parse(response.text!);
        if (res.isToxic) setShowToxicAlert(true);
        setScanResult(res);
      } else if (scanMode === 'check_in' && activePlantDetails) {
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: [
            {
              parts: [
                {
                  text: `You are a plant avatar. Analyze the user's provided photo of this plant (soil and leaves). First, check for soil wetness and leaf health (drooping, brown spots). Your opening message MUST directly address the plant's current physical state. Example: "My soil looks dry, please water me!" Be conversational and act in character based on the plant's personality. Return your health assessment and opening message in JSON.`,
                },
                { inlineData: { data: base64Data, mimeType } },
              ],
            },
          ],
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: { healthStatus: { type: Type.STRING }, openingMessage: { type: Type.STRING } },
              required: ['healthStatus', 'openingMessage'],
            },
          },
        });
        setScanResult(JSON.parse(response.text!));
      }
    } catch {
      setScanError('Could not analyze the plant. Check your API key and network, then try again.');
    } finally {
      setIsScanning(false);
    }
  };

  const savePlantData = async () => {
    if (!scanResult || !selectedImage) return;

    let updatedPlants = [...plants];
    const today = getTodayDateId();

    if (lastCheckInDate !== today) {
      const newStreak = lastCheckInDate === getYesterdayDateId() ? streak + 1 : 1;
      setStreak(newStreak);
      setLastCheckInDate(today);
      await saveConfig({ streak: newStreak, lastCheckInDate: today });
    }

    if (scanMode === 'new_plant') {
      const newPlant: PlantData = {
        id: Date.now().toString(),
        name: scanResult.name || 'Unknown',
        careInstructions: scanResult.careInstructions || '',
        healthStatus: scanResult.healthStatus || '',
        personality: scanResult.personality || 'A friendly botanical companion.',
        isToxic: scanResult.isToxic,
        toxicityDetails: scanResult.toxicityDetails,
        toxicAlertLevel: scanResult.toxicAlertLevel,
        imageUrl: selectedImage,
        dateScanned: new Date().toLocaleDateString(),
        timestamp: Date.now(),
        checkIns: [{ dateId: today, imageUrl: selectedImage }],
      };
      updatedPlants = [newPlant, ...plants].sort((a, b) => b.timestamp - a.timestamp);
      setPlants(updatedPlants);
      setActivePlantDetails(newPlant);
    } else if (scanMode === 'check_in' && activePlantDetails) {
      updatedPlants = plants.map((p) => {
        if (p.id === activePlantDetails.id) {
          const newCheckIns = [...p.checkIns];
          if (!newCheckIns.find((c) => c.dateId === today)) {
            newCheckIns.push({ dateId: today, imageUrl: selectedImage });
          }
          const updated = { ...p, healthStatus: scanResult.healthStatus || p.healthStatus, checkIns: newCheckIns };
          setActivePlantDetails(updated);
          return updated;
        }
        return p;
      });
      setPlants(updatedPlants);

      const openingMsg = (scanResult as { openingMessage?: string }).openingMessage;
      if (openingMsg) {
        const currentHistory = chatHistory[activePlantDetails.id] || [];
        const openingEntry: ChatMessage = {
          id: Date.now().toString(),
          role: 'model',
          text: openingMsg,
          timestamp: Date.now(),
        };
        const finalHistory: ChatMessage[] = [...currentHistory, openingEntry];
        setChatHistory((prev) => ({ ...prev, [activePlantDetails.id]: finalHistory }));
        await saveChatHistory(activePlantDetails.id, finalHistory);
      }
    }

    await savePlants(updatedPlants);
    setSelectedImage(null);
    setScanResult(null);

    setCurrentScreen(scanMode === 'new_plant' ? 'home' : 'chat');
  };

  const loadChatHistory = async (plantId: string) => {
    const history = await getChatHistory(plantId);
    setChatHistory((prev) => ({ ...prev, [plantId]: history }));
  };

  const sendMessage = async () => {
    if (!chatMessage.trim() || !activePlantDetails) return;
    const plantId = activePlantDetails.id;
    const currentHistory = chatHistory[plantId] || [];

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: chatMessage,
      timestamp: Date.now(),
    };
    const newHistory = [...currentHistory, userMsg];

    setChatHistory({ ...chatHistory, [plantId]: newHistory });
    setChatMessage('');
    setIsChatLoading(true);

    try {
      const ai = getAiInstance(userApiKey);
      const systemInstruction = `You are a ${activePlantDetails.name}. Your personality is: "${activePlantDetails.personality}". Your current health is: "${activePlantDetails.healthStatus}". Act exactly like this plant in a text conversation with your owner. Keep responses conversational.`;

      const contents = newHistory.map((msg) => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.text }],
      }));

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents,
        config: { systemInstruction: { parts: [{ text: systemInstruction }] } },
      });

      const modelMsg: ChatMessage = {
        id: Date.now().toString(),
        role: 'model',
        text: response.text || '*rustles leaves*',
        timestamp: Date.now(),
      };
      const finalHistory = [...newHistory, modelMsg];

      setChatHistory((prev) => ({ ...prev, [plantId]: finalHistory }));
      await saveChatHistory(plantId, finalHistory);
    } catch {
      setChatHistory((prev) => ({
        ...prev,
        [plantId]: [
          ...newHistory,
          {
            id: Date.now().toString(),
            role: 'model',
            text: 'Sorry, my connection is poor today.',
            timestamp: Date.now(),
          },
        ],
      }));
    } finally {
      setIsChatLoading(false);
    }
  };

  const resetLocalData = () => {
    if (!confirm('Reset Flora AI and wipe local data on this computer?')) return;
    localStorage.clear();
    window.location.reload();
  };

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className={`flex justify-center min-h-screen bg-black font-sans text-white ${appTheme}`}>
      <div className="w-full max-w-md bg-bg-main min-h-screen relative flex flex-col overflow-hidden text-text-main dynamic-border border-y-0 sm:border-y border-x">
        {!hasOnboarded ? (
          <OnboardingScreen onAccept={completeOnboarding} />
        ) : (
          <>
            {currentScreen !== 'home' && currentScreen !== 'scanner' && (
              <div className="px-4 py-4 flex items-center gap-3 sticky top-0 bg-bg-main/90 backdrop-blur-md z-30 border-b border-[var(--color-accent)]/10">
                <button
                  onClick={goBack}
                  className="w-10 h-10 bg-bg-card rounded-full flex items-center justify-center shadow-sm hover:brightness-110"
                >
                  <ChevronLeft size={24} className="text-text-main" />
                </button>
                <h2 className="text-xl font-bold text-text-main capitalize">
                  {currentScreen === 'settings' ? 'Settings' : currentScreen}
                </h2>
              </div>
            )}

            <main
              className={`flex-1 overflow-y-auto ${
                currentScreen === 'home' ? 'pb-28' : 'pb-6'
              } custom-scrollbar z-10 w-full relative`}
            >
              <AnimatePresence mode="wait">
                {currentScreen === 'home' && (
                  <HomeScreen
                    key="home"
                    plants={plants}
                    streak={streak}
                    appTheme={appTheme}
                    lastCheckInDate={lastCheckInDate}
                    hasApiKey={Boolean(userApiKey)}
                    onOpenSettings={() => setCurrentScreen('settings')}
                    onOpenPlant={openPlant}
                  />
                )}

                {currentScreen === 'scanner' && (
                  <ScannerScreen
                    key="scanner"
                    selectedImage={selectedImage}
                    isScanning={isScanning}
                    scanResult={scanResult}
                    scanMode={scanMode}
                    showToxicAlert={showToxicAlert}
                    hasApiKey={Boolean(userApiKey)}
                    activePlantName={activePlantDetails?.name}
                    scanError={scanError}
                    onAnalyze={processImage}
                    onSave={savePlantData}
                    onDismissToxicAlert={() => setShowToxicAlert(false)}
                    onBack={goBack}
                  />
                )}

                {currentScreen === 'history' && activePlantDetails && (
                  <HistoryScreen key="history" plant={activePlantDetails} />
                )}

                {currentScreen === 'chat' && activePlantDetails && (
                  <ChatScreen
                    key="chat"
                    plant={activePlantDetails}
                    messages={chatHistory[activePlantDetails.id] || []}
                    chatMessage={chatMessage}
                    isChatLoading={isChatLoading}
                    hasApiKey={Boolean(userApiKey)}
                    onChangeMessage={setChatMessage}
                    onSend={sendMessage}
                    onOpenHistory={() => setCurrentScreen('history')}
                    onCheckInPhoto={(e) => handleCameraCapture(e, 'check_in')}
                  />
                )}

                {currentScreen === 'settings' && (
                  <SettingsScreen
                    key="settings"
                    apiKey={userApiKey}
                    appTheme={appTheme}
                    onChangeApiKey={changeApiKey}
                    onChangeTheme={updateTheme}
                    onReset={resetLocalData}
                  />
                )}
              </AnimatePresence>
            </main>

            {currentScreen !== 'scanner' && currentScreen !== 'history' && (
              <nav className="absolute bottom-0 w-full bg-bg-card/90 backdrop-blur-md border-t border-[var(--color-accent)]/20 pb-safe px-10 flex justify-between h-[90px] items-start pt-4 z-40">
                <button
                  onClick={() => setCurrentScreen('home')}
                  className={`flex flex-col items-center gap-1.5 w-16 transition-colors ${
                    currentScreen === 'home' || currentScreen === 'settings'
                      ? 'text-[var(--color-accent)]'
                      : 'text-text-muted hover:text-text-main'
                  }`}
                >
                  <Leaf size={24} strokeWidth={2.5} />
                  <span className="text-[10px] font-bold uppercase tracking-wider">Garden</span>
                </button>

                <label className="relative w-16 h-16 flex items-center justify-center -mt-8 rounded-full bg-[var(--color-accent)] text-bg-main shadow-lg border-4 border-bg-main transition transform active:scale-95 cursor-pointer">
                  <ScanLine size={26} strokeWidth={2.5} />
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleCameraCapture(e, 'new_plant')}
                  />
                </label>

                <button
                  onClick={() => setCurrentScreen('nurseries')}
                  className={`flex flex-col items-center gap-1.5 w-16 transition-colors ${
                    currentScreen === 'nurseries'
                      ? 'text-[var(--color-accent)]'
                      : 'text-text-muted hover:text-text-main'
                  }`}
                >
                  <Store size={24} strokeWidth={2.5} />
                  <span className="text-[10px] font-bold uppercase tracking-wider">Nurseries</span>
                </button>
              </nav>
            )}
          </>
        )}
      </div>
    </div>
  );
}

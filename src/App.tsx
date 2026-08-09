import { useState, useRef, useEffect, type ChangeEvent } from 'react';
import { Camera, Leaf, Settings as SettingsIcon, ChevronLeft, Send, LogIn, LogOut, Shield, Cloud, Lock, Unlock, CheckCircle2, History, Info, Sun, Gamepad2, Cpu, ScanLine, AlertTriangle, Store } from 'lucide-react';
import { GoogleGenAI, Type } from '@google/genai';
import { motion, AnimatePresence } from 'motion/react';
import { auth, signInWithGoogle, logout } from './firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { getPlants, savePlants, getChatHistory, saveChatHistory, getAppConfig, saveAppConfig, PlantData, ChatMessage } from './store';

const THEMES = [
  { id: 'theme-minimalist', name: 'Botanical Minimalist', icon: Sun },
  { id: 'theme-gamified', name: 'Tamagotchi Garden', icon: Gamepad2 },
  { id: 'theme-cyber', name: 'Cyber-Botanical', icon: Cpu }
];

const getAiInstance = (apiKey?: string) => {
  return new GoogleGenAI({ apiKey: apiKey || import.meta.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY });
};

const getTodayDateId = () => {
    const d = new Date();
    return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
};
const getYesterdayDateId = () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
};

export default function App() {
  const [isInitializing, setIsInitializing] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  
  // App Config State
  const [hasOnboarded, setHasOnboarded] = useState(false);
  const [userApiKey, setUserApiKey] = useState('');
  const [appTheme, setAppTheme] = useState('theme-minimalist');
  
  // Data State
  const [plants, setPlants] = useState<PlantData[]>([]);
  const [chatHistory, setChatHistory] = useState<Record<string, ChatMessage[]>>({});
  const [streak, setStreak] = useState(0);
  const [lastCheckInDate, setLastCheckInDate] = useState<string | null>(null);

  // UI Navigation State
  const [currentScreen, setCurrentScreen] = useState<'home' | 'scanner' | 'settings' | 'chat' | 'history' | 'nurseries'>('home');
  const [activePlantDetails, setActivePlantDetails] = useState<PlantData | null>(null);
  
  // Scanner State
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<Partial<PlantData> | null>(null);
  const [scanMode, setScanMode] = useState<'new_plant' | 'check_in'>('new_plant');
  const [showToxicAlert, setShowToxicAlert] = useState(false);

  // Chat State
  const [chatMessage, setChatMessage] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  
  // Sync Status
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'synced'>('idle');

  // Initialization
  useEffect(() => {
    const initApp = async () => {
      // Local Storage Configs
      const onboarded = localStorage.getItem('flora_onboarded') === 'true';
      const key = localStorage.getItem('flora_api_key') || '';

      setHasOnboarded(onboarded);
      setUserApiKey(key);

      // IndexedDB Data
      const p = await getPlants();
      setPlants(p);
      
      const config = await getAppConfig();
      
      // Streak Logic
      let currentStreak = config.streak || 0;
      let lastCheckIn = config.lastCheckInDate;
      const today = getTodayDateId();
      const yesterday = getYesterdayDateId();
      
      if (lastCheckIn !== today && lastCheckIn !== yesterday) {
          currentStreak = 0; // Reset streak if missed a day
      }
      setStreak(currentStreak);
      setLastCheckInDate(lastCheckIn);
      setAppTheme(config.theme || 'theme-minimalist');

      // Auth
      onAuthStateChanged(auth, (user) => {
        setCurrentUser(user);
        setIsInitializing(false);
      });
    };
    initApp();
  }, []);

  const saveConfig = async (updates: any) => {
      const current = await getAppConfig();
      await saveAppConfig({ ...current, ...updates });
  };

  const updateTheme = async (newTheme: string) => {
      setAppTheme(newTheme);
      await saveConfig({ theme: newTheme });
  };

  // Sync Simulation
  const triggerDriveSync = () => {
      if (!currentUser) return;
      setSyncStatus('syncing');
      setTimeout(() => {
          setSyncStatus('synced');
          setTimeout(() => setSyncStatus('idle'), 3000);
      }, 1500);
  };

  const completeOnboarding = () => {
      setHasOnboarded(true);
      localStorage.setItem('flora_onboarded', 'true');
  };

  const handleCameraCapture = (e: ChangeEvent<HTMLInputElement>, mode: 'new_plant' | 'check_in' = 'new_plant') => {
    const file = e.target.files?.[0];
    if (file) {
      setScanMode(mode);
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage(reader.result as string);
        setScanResult(null);
        setShowToxicAlert(false);
        setCurrentScreen('scanner');
      };
      reader.readAsDataURL(file);
    }
    // Clear input
    e.target.value = '';
  };

  const goBack = () => {
     if (currentScreen === 'history') setCurrentScreen('chat');
     else if (currentScreen === 'chat' && scanMode === 'check_in') setCurrentScreen('home');
     else setCurrentScreen('home');
  };

  const processImage = async () => {
    if (!selectedImage) return;
    setIsScanning(true);
    try {
      const base64Data = selectedImage.split(',')[1];
      const mimeType = selectedImage.split(';')[0].split(':')[1];
      const ai = getAiInstance(userApiKey);

      if (scanMode === 'new_plant') {
          const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [{
              parts: [
                { text: 'Analyze this plant. Prioritize identifying toxicity. Provide its name, care instructions, its health status, and a 1-sentence "personality" based on its species to act as a chatbot character. Also return boolean `isToxic`, string `toxicityDetails`, and string `toxicAlertLevel` (high, low, or none). Return JSON.' },
                { inlineData: { data: base64Data, mimeType } }
              ]
            }],
            config: {
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  careInstructions: { type: Type.STRING },
                  healthStatus: { type: Type.STRING },
                  personality: { type: Type.STRING },
                  isToxic: { type: Type.BOOLEAN },
                  toxicityDetails: { type: Type.STRING },
                  toxicAlertLevel: { type: Type.STRING }
                },
                required: ["name", "careInstructions", "healthStatus", "personality", "isToxic", "toxicityDetails", "toxicAlertLevel"]
              }
            }
          });
          const res = JSON.parse(response.text!);
          if (res.isToxic) {
              setShowToxicAlert(true);
          }
          setScanResult(res);
      } else if (scanMode === 'check_in' && activePlantDetails) {
          // Check-in logic: analyze soil and leaves
          const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [{
                parts: [
                  { text: `You are a plant avatar. Analyze the user's provided photo of this plant (soil and leaves). First, check for soil wetness and leaf health (drooping, brown spots). Your opening message MUST directly address the plant's current physical state. Example: "My soil looks dry, please water me!" Be conversational and act in character based on the plant's personality. Return your health assessment and opening message in JSON.` },
                  { inlineData: { data: base64Data, mimeType } }
                ]
            }],
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                  type: Type.OBJECT,
                  properties: { healthStatus: { type: Type.STRING }, openingMessage: { type: Type.STRING } },
                  required: ["healthStatus", "openingMessage"]
                }
            }
          });
          const res = JSON.parse(response.text!);
          setScanResult(res);
      }
    } catch (err) {
      alert('Error analyzing the plant. Please check your API key or network.');
    } finally {
      setIsScanning(false);
    }
  };

  const savePlantData = async () => {
    if (!scanResult || !selectedImage) return;
    
    let updatedPlants = [...plants];
    const today = getTodayDateId();
    
    // Update streak if checked in today
    let newStreak = streak;
    if (lastCheckInDate !== today) {
        newStreak = lastCheckInDate === getYesterdayDateId() ? streak + 1 : 1;
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
        checkIns: [{ dateId: today, imageUrl: selectedImage }]
      };
      updatedPlants = [newPlant, ...plants].sort((a,b) => b.timestamp - a.timestamp);
      setPlants(updatedPlants);
      setActivePlantDetails(newPlant);
    } else if (scanMode === 'check_in' && activePlantDetails) {
        updatedPlants = plants.map(p => {
            if (p.id === activePlantDetails.id) {
                const newCheckIns = [...p.checkIns];
                if (!newCheckIns.find(c => c.dateId === today)) {
                    newCheckIns.push({ dateId: today, imageUrl: selectedImage });
                }
                const updated = { ...p, healthStatus: scanResult.healthStatus || p.healthStatus, checkIns: newCheckIns };
                setActivePlantDetails(updated);
                return updated;
            }
            return p;
        });
        setPlants(updatedPlants);
        
        // Add the AI's opening message to chat
        const openingMsg = (scanResult as any).openingMessage;
        if (openingMsg) {
             const currentHistory = chatHistory[activePlantDetails.id] || [];
             const openingEntry: ChatMessage = { id: Date.now().toString(), role: 'model', text: openingMsg, timestamp: Date.now() };
             const finalHistory: ChatMessage[] = [...currentHistory, openingEntry];
             setChatHistory(prev => ({ ...prev, [activePlantDetails.id]: finalHistory }));
             await saveChatHistory(activePlantDetails.id, finalHistory);
        }
    }
    
    await savePlants(updatedPlants);
    setSelectedImage(null);
    setScanResult(null);
    triggerDriveSync();
    
    if (scanMode === 'new_plant') {
        setCurrentScreen('home');
    } else {
        setCurrentScreen('chat');
    }
  };

  const loadChatHistory = async (plantId: string) => {
      const history = await getChatHistory(plantId);
      setChatHistory(prev => ({ ...prev, [plantId]: history }));
  };

  const sendMessage = async () => {
    if (!chatMessage.trim() || !activePlantDetails) return;
    const plantId = activePlantDetails.id;
    const currentHistory = chatHistory[plantId] || [];
    
    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', text: chatMessage, timestamp: Date.now() };
    const newHistory = [...currentHistory, userMsg];
    
    setChatHistory({ ...chatHistory, [plantId]: newHistory });
    setChatMessage('');
    setIsChatLoading(true);

    try {
      const ai = getAiInstance(userApiKey);
      const systemInstruction = `You are a ${activePlantDetails.name}. Your personality is: "${activePlantDetails.personality}". Your current health is: "${activePlantDetails.healthStatus}". Act exactly like this plant in a text conversation with your owner. Keep responses conversational.`;
      
      const contents = newHistory.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.text }]
      }));

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        //@ts-ignore
        contents,
        config: { systemInstruction: { parts: [{ text: systemInstruction }] } }
      });
      
      const modelMsg: ChatMessage = { id: Date.now().toString(), role: 'model', text: response.text || '*rustles leaves*', timestamp: Date.now() };
      const finalHistory = [...newHistory, modelMsg];
      
      setChatHistory(prev => ({ ...prev, [plantId]: finalHistory }));
      await saveChatHistory(plantId, finalHistory);
      triggerDriveSync();
    } catch (err) {
      setChatHistory(prev => ({ ...prev, [plantId]: [...newHistory, { id: Date.now().toString(), role: 'model', text: 'Sorry, my connection is poor today.', timestamp: Date.now() }] }));
    } finally {
      setIsChatLoading(false);
    }
  };

  useEffect(() => {
    if (chatScrollRef.current) {
        chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatHistory, isChatLoading, currentScreen]);

  // Screen Rendering
  if (isInitializing) {
    return <div className="min-h-screen bg-black flex items-center justify-center"><div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin"></div></div>;
  }

  const renderStreakIcon = () => {
      if (appTheme === 'theme-gamified') {
          return <span className="font-black text-xs px-2 py-1 bg-gradient-to-r from-yellow-400 to-yellow-600 text-black rounded-lg">Lvl {streak}</span>;
      }
      if (appTheme === 'theme-cyber') {
          return <span className="font-bold text-xs uppercase tracking-widest text-[#39FF14]">Link: {streak * 10}%</span>;
      }
      return (
          <div className="flex items-center gap-1.5 opacity-80">
              <Sun size={18} className={streak > 0 ? 'text-yellow-600' : 'text-neutral-400'} />
              <span className={`text-sm font-semibold ${streak > 0 ? 'text-yellow-700' : 'text-neutral-500'}`}>{streak}</span>
          </div>
      );
  }

  return (
    <div className={`flex justify-center min-h-screen bg-black font-sans text-white ${appTheme}`}>
      <div className="w-full max-w-md bg-bg-main min-h-screen relative flex flex-col overflow-hidden text-text-main dynamic-border border-y-0 sm:border-y border-x">

        {!hasOnboarded ? (
            // ONBOARDING SCREEN
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 flex flex-col p-8 items-center justify-center text-center z-10 relative">
                <div className="w-24 h-24 bg-[var(--color-accent)]/10 rounded-full flex items-center justify-center mb-8 border border-[var(--color-accent)]/20 shadow-lg">
                    <Leaf size={48} className="text-[var(--color-accent)]" />
                </div>
                <h1 className="text-4xl font-bold mb-4 tracking-tight">Flora AI</h1>
                <p className="text-text-muted mb-8 text-lg">Your intelligent botanical companion.</p>
                
                <div className="bg-bg-card border border-[var(--color-accent)]/20 rounded-2xl p-6 text-left mb-8 shadow-sm">
                    <h3 className="flex items-center gap-2 font-bold mb-3"><Shield size={18} className="text-[var(--color-accent)]" /> AI Liability Disclaimer</h3>
                    <p className="text-sm text-text-muted leading-relaxed mb-4">
                        Flora AI provides plant identification and care suggestions through artificial intelligence. Information provided is for educational purposes only.
                    </p>
                    <p className="text-sm text-text-muted leading-relaxed font-bold">
                        Do not ingest or handle any unidentified plants. The developer assumes no liability for AI hallucinations or inaccuracies.
                    </p>
                </div>

                {!currentUser ? (
                    <button onClick={signInWithGoogle} className="w-full bg-[var(--color-accent)] text-bg-main py-4 rounded-[var(--radius-dynamic)] font-bold shadow-lg active:scale-95 transition-transform flex items-center justify-center gap-3">
                        <LogIn size={20} /> Sign in with Google
                    </button>
                ) : (
                    <button onClick={completeOnboarding} className="w-full bg-[var(--color-accent)] text-bg-main py-4 rounded-[var(--radius-dynamic)] font-bold shadow-lg active:scale-95 transition-transform flex items-center justify-center gap-2">
                        Accept & Continue
                    </button>
                )}
            </motion.div>
        ) : (
            <>
                {/* SYNC TOAST */}
                <AnimatePresence>
                    {syncStatus !== 'idle' && (
                        <motion.div initial={{ y: -50, opacity: 0 }} animate={{ y: 20, opacity: 1 }} exit={{ y: -50, opacity: 0 }} className="absolute top-0 left-0 right-0 flex justify-center z-50 pointer-events-none pt-4">
                            <div className="bg-bg-card border border-[var(--color-accent)]/30 px-4 py-2 rounded-full flex items-center gap-2 shadow-lg">
                                <Cloud size={14} className={syncStatus === 'syncing' ? 'text-[var(--color-accent)] animate-pulse' : 'text-[var(--color-accent-alt)]'} />
                                <span className="text-xs font-medium text-text-main">{syncStatus === 'syncing' ? 'Syncing to Google Drive...' : 'Backed up securely'}</span>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* UNIVERSAL APP BAR */}
                {currentScreen !== 'home' && currentScreen !== 'scanner' && (
                    <div className="px-4 py-4 flex items-center gap-3 sticky top-0 bg-bg-main/90 backdrop-blur-md z-30 border-b border-[var(--color-accent)]/10">
                         <button onClick={goBack} className="w-10 h-10 bg-bg-card rounded-full flex items-center justify-center shadow-sm hover:brightness-110">
                             <ChevronLeft size={24} className="text-text-main" />
                         </button>
                         <h2 className="text-xl font-bold text-text-main capitalize">
                            {currentScreen === 'settings' ? 'Settings' : currentScreen}
                         </h2>
                    </div>
                )}

                {/* MAIN CONTENT */}
                <main className={`flex-1 overflow-y-auto ${currentScreen === 'home' ? 'pb-28' : 'pb-6'} custom-scrollbar z-10 w-full relative`}>
                  <AnimatePresence mode="wait">
                    
                    {currentScreen === 'home' && (
                      <motion.div key="home" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="px-6 py-6 space-y-6">
                        <header className="flex items-center justify-between mb-2">
                            <h1 className="text-2xl font-bold flex items-center gap-2 tracking-tight">
                                <Leaf className="w-6 h-6 text-[var(--color-accent)]" /> Flora <span className="text-[var(--color-accent)] font-medium -ml-1">AI</span>
                            </h1>
                            <div className="flex items-center gap-3">
                                {renderStreakIcon()}
                                <button onClick={() => setCurrentScreen('settings')} className="w-10 h-10 bg-bg-card rounded-full flex items-center justify-center shadow-sm hover:opacity-80 transition-opacity">
                                    <SettingsIcon size={20} className="text-text-main" />
                                </button>
                            </div>
                        </header>

                        {/* Status Card */}
                        <div className="bg-bg-card dynamic-shadow dynamic-border p-5 flex justify-between items-center rounded-[var(--radius-dynamic)]">
                           <div>
                               <p className="text-xs text-[var(--color-accent)] font-bold tracking-wider uppercase mb-1">Today's Check-in</p>
                               <p className="font-semibold text-sm">{lastCheckInDate === getTodayDateId() ? 'Completed!' : 'Take a photo of a plant'}</p>
                           </div>
                           <div className={`w-10 h-10 rounded-full flex items-center justify-center ${lastCheckInDate === getTodayDateId() ? 'bg-[var(--color-accent)] text-bg-main shadow-lg' : 'bg-transparent border border-text-muted/30 text-text-muted'}`}>
                               {lastCheckInDate === getTodayDateId() ? <CheckCircle2 size={20} /> : <Camera size={18} />}
                           </div>
                        </div>

                        {!userApiKey && (
                            <div className="bg-red-500/10 border border-red-500/30 rounded-[var(--radius-dynamic)] p-5 flex gap-4 items-start cursor-pointer transition-colors" onClick={() => setCurrentScreen('settings')}>
                                <Info size={24} className="text-red-500 shrink-0 mt-0.5" />
                                <div>
                                    <h3 className="font-bold text-red-500 text-sm mb-1">Action Required</h3>
                                    <p className="text-xs text-text-muted leading-relaxed">Please configure your Gemini API Key in settings to unlock AI capabilities.</p>
                                </div>
                            </div>
                        )}

                        <div>
                          <div className="flex justify-between items-end mb-4">
                              <h2 className="text-xl font-bold text-text-main">Your Garden</h2>
                              <span className="text-xs text-text-muted font-medium">{plants.length} plants saved</span>
                          </div>
                          
                          {plants.length === 0 ? (
                            <div className="flex flex-col items-center justify-center p-8 text-center space-y-6 bg-bg-card dynamic-shadow dynamic-border rounded-[var(--radius-dynamic)]">
                              <div className="w-16 h-16 bg-[var(--color-accent)]/10 rounded-full flex items-center justify-center text-[var(--color-accent)]">
                                <Leaf size={32} />
                              </div>
                              <p className="text-sm font-medium text-text-muted">No plants tracked yet.<br/>Scan to grow your garden.</p>
                            </div>
                          ) : (
                            <div className="grid grid-cols-2 gap-4">
                              {plants.map(plant => {
                                const hasCheckedInToday = plant.checkIns?.some(c => c.dateId === getTodayDateId());
                                return (
                                <div key={plant.id} onClick={() => {setActivePlantDetails(plant); loadChatHistory(plant.id); setCurrentScreen('chat');}} className="bg-bg-card dynamic-shadow overflow-hidden cursor-pointer group hover:brightness-95 transition-all flex flex-col h-full relative dynamic-border rounded-[var(--radius-dynamic)]">
                                  <div className="absolute top-2 right-2 z-10 w-6 h-6 rounded-full bg-bg-main/80 backdrop-blur flex items-center justify-center border border-black/10">
                                      {hasCheckedInToday ? <Unlock size={12} className="text-[var(--color-accent)]" /> : <Lock size={12} className="text-text-muted" />}
                                  </div>
                                  <div className="aspect-square bg-gray-200 relative">
                                    <img src={plant.imageUrl} alt={plant.name} className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity" />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60 mt-10"></div>
                                  </div>
                                  <div className="p-3 bg-bg-card -mt-8 relative z-10">
                                      <h3 className="font-bold text-text-main text-sm truncate leading-tight">{plant.name}</h3>
                                      <p className="text-[10px] text-text-muted mt-0.5">{plant.checkIns?.length || 1} check-ins</p>
                                  </div>
                                </div>
                              )})}
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}

                    {currentScreen === 'scanner' && (
                      <motion.div key="scanner" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="p-6 flex flex-col items-center flex-1 h-full min-h-[70vh]">
                        {selectedImage && (
                          <div className="w-full flex-1 flex flex-col gap-6 pt-4">
                            <div className="w-full relative rounded-[var(--radius-dynamic)] overflow-hidden bg-black aspect-[3/4] max-h-[60vh] shadow-lg dynamic-border">
                              <img src={selectedImage} alt="Preview" className={`w-full h-full object-cover ${isScanning ? 'opacity-50 blur-sm' : 'opacity-100'} transition-all`} />
                              {isScanning && (
                                <div className="absolute inset-0 z-10 pointer-events-none overflow-hidden mix-blend-screen">
                                  <motion.div className="w-full h-2 bg-[var(--color-accent)] shadow-[0_0_30px_5px_var(--color-accent)]" animate={{ y: ['-10%', '600px', '-10%'] }} transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }} />
                                </div>
                              )}
                              {!isScanning && !scanResult && (
                                <button onClick={goBack} className="absolute top-4 left-4 w-10 h-10 flex items-center justify-center bg-black/50 text-white rounded-full backdrop-blur border border-white/20 hover:bg-black/70">
                                  <ChevronLeft size={20} />
                                </button>
                              )}
                            </div>
                            
                            {!scanResult ? (
                              <button onClick={processImage} disabled={isScanning || !userApiKey} className="w-full bg-[var(--color-accent)] disabled:opacity-50 disabled:grayscale text-bg-main py-4 rounded-[var(--radius-dynamic)] font-bold shadow-lg transition-all flex justify-center items-center gap-2 text-lg active:scale-95">
                                {isScanning ? (
                                  <div className="flex items-center gap-3">
                                     <div className="w-5 h-5 border-2 border-bg-main/30 border-t-bg-main rounded-full animate-spin" />
                                     Analyzing Profile...
                                  </div>
                                ) : (!userApiKey ? 'API Key Missing (Settings)' : 'Analyze Plant')}
                              </button>
                            ) : showToxicAlert ? (
                               <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="bg-red-500 rounded-[var(--radius-dynamic)] shadow-lg p-6 dynamic-border relative border border-black/10">
                                   <div className="flex items-center gap-3 mb-4">
                                       <AlertTriangle size={32} className="text-white shrink-0 animate-pulse" />
                                       <h2 className="text-2xl font-black text-white leading-tight uppercase tracking-tight">Toxicity Alert</h2>
                                   </div>
                                   <div className="text-red-100 mb-6 bg-black/20 p-4 rounded-xl border border-white/10">
                                       <p className="text-xs uppercase tracking-widest font-bold text-red-200 mb-1 opacity-80">Assessment Details</p>
                                       <p className="font-medium text-sm leading-relaxed">{scanResult.toxicityDetails || 'This plant contains toxic properties.'}</p>
                                   </div>
                                   <button onClick={() => setShowToxicAlert(false)} className="w-full bg-white text-red-600 py-4 rounded-[var(--radius-dynamic)] font-bold shadow-lg active:scale-95 transition-transform text-lg flex justify-center items-center gap-2">
                                       I Understand
                                   </button>
                               </motion.div>
                            ) : (
                              <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="bg-bg-card rounded-[var(--radius-dynamic)] shadow-lg p-6 dynamic-border relative">
                                <div className="mb-4 pr-10">
                                  <h2 className="text-2xl font-bold text-text-main leading-tight">{scanResult.name || activePlantDetails?.name}</h2>
                                  {scanResult.isToxic && (
                                     <div className="inline-flex items-center gap-1 bg-red-500/10 text-red-500 px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider mt-2 border border-red-500/20">
                                         <AlertTriangle size={12} /> Toxic Plant
                                     </div>
                                  )}
                                  <p className="text-[var(--color-accent)] text-xs font-bold uppercase mt-2">Health Assessment</p>
                                  <p className="text-sm font-medium text-text-muted mt-1">{scanResult.healthStatus}</p>
                                </div>
                                {scanMode === 'new_plant' && (
                                    <div className="p-4 bg-bg-main rounded-[var(--radius-dynamic)] mb-6 border border-black/5">
                                        <p className="text-sm text-text-muted leading-relaxed italic border-l-2 border-[var(--color-accent)] pl-3">"{scanResult.personality}"</p>
                                    </div>
                                )}
                                <button onClick={savePlantData} className="w-full bg-[var(--color-accent)] text-bg-main py-4 rounded-[var(--radius-dynamic)] font-bold shadow-lg active:scale-95 transition-transform text-lg">
                                  {scanMode === 'new_plant' ? 'Save to Garden' : 'Confirm Check-in'}
                                </button>
                              </motion.div>
                            )}
                          </div>
                        )}
                      </motion.div>
                    )}

                    {currentScreen === 'history' && activePlantDetails && (
                      <motion.div key="history" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="px-6 pb-6 space-y-6 pt-2">
                          <div className="grid grid-cols-3 gap-3">
                              {activePlantDetails.checkIns?.map((checkIn, i) => (
                                  <div key={i} className="aspect-square rounded-[var(--radius-dynamic)] overflow-hidden relative dynamic-border">
                                      <img src={checkIn.imageUrl} alt="" className="w-full h-full object-cover hover:scale-110 transition-transform duration-500" />
                                      <div className="absolute bottom-2 left-2 right-2 bg-black/60 backdrop-blur px-2 py-1 rounded text-[10px] text-white font-medium text-center">
                                          {checkIn.dateId}
                                      </div>
                                  </div>
                              ))}
                          </div>
                      </motion.div>
                    )}

                    {currentScreen === 'chat' && activePlantDetails && (
                      <motion.div key="chat" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="flex-1 flex flex-col px-4 z-10 h-full min-h-[90vh]">
                        <div className="flex items-center justify-between mb-4 mt-2">
                          <div className="flex flex-col">
                              <h2 className="font-bold text-text-main text-lg leading-tight">{activePlantDetails.name}</h2>
                              <p className="text-xs text-[var(--color-accent)] font-medium">Plant Avatar</p>
                          </div>
                          <button onClick={() => setCurrentScreen('history')} className="w-10 h-10 bg-bg-card rounded-full flex items-center justify-center text-[var(--color-accent)] shadow-sm border border-text-muted/10 hover:brightness-110">
                              <History size={18} />
                          </button>
                        </div>
                        
                        <div className="flex-1 bg-bg-card dynamic-border rounded-t-[var(--radius-dynamic)] overflow-hidden border-b-0 p-4 flex flex-col shadow-sm">
                          <div ref={chatScrollRef} className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar pb-4">
                            <div className="flex justify-start">
                                <div className="bg-bg-main p-4 rounded-2xl rounded-tl-sm max-w-[85%] text-sm text-text-main leading-relaxed shadow-sm font-medium border border-text-muted/10">
                                    *rustles* It's me, your {activePlantDetails.name}. {activePlantDetails.personality} Check in with me to unlock our chat!
                                </div>
                            </div>
                            {chatHistory[activePlantDetails.id]?.map((msg, i) => (
                              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`p-3.5 rounded-2xl max-w-[85%] text-sm leading-relaxed shadow-sm ${msg.role === 'user' ? 'bg-[var(--color-accent)] text-bg-main rounded-tr-sm font-semibold' : 'bg-bg-main rounded-tl-sm text-text-main border border-text-muted/10'}`}>
                                  {msg.text}
                                </div>
                              </div>
                            ))}
                            {isChatLoading && (
                                <div className="flex justify-start">
                                    <div className="bg-bg-main p-3.5 rounded-2xl rounded-tl-sm text-sm border border-text-muted/10">
                                        <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 1.5 }} className="flex gap-1.5 items-center justify-center p-1">
                                            <div className="w-1.5 h-1.5 bg-[var(--color-accent)] rounded-full"></div>
                                            <div className="w-1.5 h-1.5 bg-[var(--color-accent)] rounded-full"></div>
                                            <div className="w-1.5 h-1.5 bg-[var(--color-accent)] rounded-full"></div>
                                        </motion.div>
                                    </div>
                                </div>
                            )}
                          </div>
                          
                          {/* Chat Input Area */}
                          <div className="mt-2 pt-2 bg-transparent">
                            {/* Check if checked in today */}
                            {activePlantDetails.checkIns?.find(c => c.dateId === getTodayDateId()) ? (
                                <div>
                                    <div className="flex gap-2">
                                        <input value={chatMessage} onChange={(e) => setChatMessage(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && sendMessage()} placeholder="Message..." disabled={!userApiKey} className="flex-1 bg-bg-main border border-text-muted/30 rounded-full px-5 py-3 text-sm focus:outline-none focus:border-[var(--color-accent)] transition-colors placeholder:text-text-muted disabled:opacity-50 text-text-main" />
                                        <button onClick={sendMessage} disabled={isChatLoading || !chatMessage.trim() || !userApiKey} className="w-12 h-12 shrink-0 bg-[var(--color-accent)] disabled:opacity-50 rounded-full flex items-center justify-center text-bg-main hover:brightness-110 shadow-lg transition-all">
                                            <Send size={18} className="ml-1 shrink-0" />
                                        </button>
                                    </div>
                                    <p className="text-[10px] text-text-muted opacity-80 text-center mt-3 mb-1 px-4 leading-tight shrink-0 font-medium">
                                        AI toxicity identification is informational only and assumes no liability. Do not ingest plants without professional verification.
                                    </p>
                                </div>
                            ) : (
                                <div className="bg-bg-main border border-[var(--color-accent)]/30 rounded-[var(--radius-dynamic)] p-4 flex flex-col items-center text-center shadow-inner">
                                    <Lock size={20} className="text-[var(--color-accent)] mb-2" />
                                    <h4 className="text-sm font-bold text-text-main mb-1">Chat Locked</h4>
                                    <p className="text-xs text-text-muted mb-3 font-medium">Complete your daily check-in to chat.</p>
                                    
                                    <label className="w-full cursor-pointer bg-[var(--color-accent)]/10 text-[var(--color-accent)] border border-[var(--color-accent)]/30 py-3 rounded-[var(--radius-dynamic)] font-bold text-sm hover:bg-[var(--color-accent)]/20 transition-colors flex justify-center items-center gap-2">
                                        <Camera size={16} /> Daily Photo
                                        <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handleCameraCapture(e, 'check_in')} />
                                    </label>
                                </div>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    )}

                    {currentScreen === 'settings' && (
                      <motion.div key="settings" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="px-6 pb-6 space-y-6 pt-2">
                        
                        <div className="space-y-3">
                            <h3 className="text-xs font-bold text-[var(--color-accent)] uppercase tracking-widest flex items-center gap-2"><Lock size={14} /> Gemini API Access</h3>
                            <div className="bg-bg-card dynamic-border rounded-[var(--radius-dynamic)] p-5 space-y-3 shadow-sm">
                                <p className="text-xs text-text-muted leading-relaxed font-medium">Enter your personal Gemini API Key from Google AI Studio. Stored securely in your offline IndexedDB vault.</p>
                                <input type="password" value={userApiKey} onChange={(e) => {
                                    setUserApiKey(e.target.value);
                                    localStorage.setItem('flora_api_key', e.target.value);
                                }} placeholder="AIzaSy..." className="w-full bg-bg-main border border-text-muted/20 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[var(--color-accent)] font-mono text-text-main" />
                                {userApiKey && <div className="flex items-center gap-2 text-xs text-[var(--color-accent)] font-bold"><CheckCircle2 size={12} /> Key Saved Locally</div>}
                            </div>
                        </div>

                        <div className="space-y-3">
                            <h3 className="text-xs font-bold text-[var(--color-accent)] uppercase tracking-widest flex items-center gap-2">UI Theme Engine</h3>
                            <div className="bg-bg-card dynamic-border rounded-[var(--radius-dynamic)] p-5 shadow-sm grid grid-cols-1 gap-2">
                                {THEMES.map(theme => (
                                    <button key={theme.id} onClick={() => updateTheme(theme.id)} className={`flex items-center justify-between p-3 rounded-xl border-2 transition-all ${appTheme === theme.id ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10' : 'border-transparent hover:bg-bg-main'}`}>
                                        <div className="flex items-center gap-3">
                                            <theme.icon size={18} className={appTheme === theme.id ? 'text-[var(--color-accent)]' : 'text-text-muted'} />
                                            <span className={`text-sm font-bold ${appTheme === theme.id ? 'text-[var(--color-accent)]' : 'text-text-main'}`}>{theme.name}</span>
                                        </div>
                                        {appTheme === theme.id && <CheckCircle2 size={16} className="text-[var(--color-accent)]" />}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-3">
                            <h3 className="text-xs font-bold text-[var(--color-accent)] uppercase tracking-widest flex items-center gap-2"><Cloud size={14} /> Storage & Sync</h3>
                            <div className="bg-bg-card dynamic-border rounded-[var(--radius-dynamic)] p-5 space-y-4 shadow-sm flex flex-col justify-between">
                                <div>
                                    <p className="text-sm font-bold text-text-main mb-1">Google Drive Sync</p>
                                    <p className="text-xs text-text-muted mb-4 font-medium">Backs up local plants to Google Drive appDataFolder via Google Sign-In.</p>
                                </div>
                                <button onClick={triggerDriveSync} className="w-full bg-[var(--color-accent)]/10 text-[var(--color-accent)] border border-[var(--color-accent)]/30 py-3 rounded-xl font-bold text-sm hover:bg-[var(--color-accent)]/20 transition-colors">
                                    Force Backup Now
                                </button>
                            </div>
                        </div>

                        <div className="space-y-3 pt-4">
                            <button onClick={() => {
                                 if(confirm('Log out and wipe local data?')) {
                                     logout();
                                     localStorage.clear();
                                     window.location.reload();
                                 }
                            }} className="w-full bg-red-500/10 text-red-500 border border-red-500/30 py-4 rounded-xl font-bold hover:bg-red-500/20 transition-colors flex items-center justify-center gap-2">
                                <LogOut size={18} /> Sign Out & Reset
                            </button>
                        </div>
                      </motion.div>
                    )}

                  </AnimatePresence>
                </main>

                {/* BOTTOM NAVIGATION */}
                {currentScreen !== 'scanner' && currentScreen !== 'history' && (
                    <nav className="absolute bottom-0 w-full bg-bg-card/90 backdrop-blur-md border-t border-[var(--color-accent)]/20 pb-safe pt-2 px-10 flex justify-between h-[90px] items-start pt-4 z-40">
                    <button onClick={() => setCurrentScreen('home')} className={`flex flex-col items-center gap-1.5 w-16 transition-colors ${currentScreen === 'home' || currentScreen === 'settings' ? 'text-[var(--color-accent)]' : 'text-text-muted hover:text-text-main'}`}>
                        <Leaf size={24} strokeWidth={2.5} />
                        <span className="text-[10px] font-bold uppercase tracking-wider">Garden</span>
                    </button>
                    
                    <label className="relative w-16 h-16 flex items-center justify-center -mt-8 rounded-full bg-[var(--color-accent)] text-bg-main shadow-lg border-4 border-bg-main transition transform active:scale-95 cursor-pointer">
                        <ScanLine size={26} strokeWidth={2.5} />
                        <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handleCameraCapture(e, 'new_plant')} />
                    </label>

                    <button onClick={() => setCurrentScreen('nurseries')} className={`flex flex-col items-center gap-1.5 w-16 transition-colors ${currentScreen === 'nurseries' ? 'text-[var(--color-accent)]' : 'text-text-muted hover:text-text-main'}`}>
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

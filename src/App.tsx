import { useState, useEffect, type ChangeEvent } from 'react';
import { ChevronLeft, Leaf, ScanLine, Store } from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import { auth, logout, signInWithGoogleDesktop } from './firebase';
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
import {
  getUserLocation,
  saveUserLocation,
  getPriceEstimate,
  savePriceEstimate,
  getCachedNurseries,
  saveCachedNurseries,
  nurseryCacheKey,
  type Nursery,
  type OccurrenceSet,
  type PlantStatus,
  type PriceEstimate,
  type UserLocation,
} from './store';
import { getTodayDateId, getYesterdayDateId } from './lib/dates';
import {
  assessStatus,
  chat,
  checkInOnPlant,
  describeHabitat,
  estimatePrice,
  identifyPlant,
  type Habitat,
  type Identification,
} from './services/ai';
import ScanResultScreen from './screens/ScanResultScreen';
import StatusScreen from './screens/StatusScreen';
import NurseryScreen from './screens/NurseryScreen';
import WildScreen from './screens/WildScreen';
import OnboardingScreen from './screens/OnboardingScreen';
import HomeScreen from './screens/HomeScreen';
import ScannerScreen from './screens/ScannerScreen';
import ChatScreen from './screens/ChatScreen';
import HistoryScreen from './screens/HistoryScreen';
import SettingsScreen from './screens/SettingsScreen';

type Screen =
  | 'home'
  | 'scanner'
  | 'scanResult'
  | 'status'
  | 'settings'
  | 'chat'
  | 'history'
  | 'nurseries'
  | 'wild';

const API_KEY_SECRET = 'gemini_api_key';

export default function App() {
  const [isInitializing, setIsInitializing] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // Auth
  const [authConfigured, setAuthConfigured] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);

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
  const [scanResult, setScanResult] = useState<Identification | null>(null);
  const [checkInResult, setCheckInResult] = useState<{
    healthStatus: string;
    openingMessage: string;
  } | null>(null);
  const [scanMode, setScanMode] = useState<'new_plant' | 'check_in'>('new_plant');
  const [showToxicAlert, setShowToxicAlert] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

  // Chat
  const [chatMessage, setChatMessage] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);

  // The species the nursery and wild screens are about. Set from a fresh scan
  // or from a saved plant, so those screens work either way.
  const [activeSpecies, setActiveSpecies] = useState<{
    name: string;
    scientificName: string;
  } | null>(null);

  // Plant status
  const [status, setStatus] = useState<PlantStatus | null>(null);
  const [isStatusLoading, setIsStatusLoading] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  // Nurseries
  const [location, setLocation] = useState<UserLocation | null>(null);
  const [nurseries, setNurseries] = useState<Nursery[]>([]);
  const [radiusKm, setRadiusKm] = useState(15);
  const [isNurseryLoading, setIsNurseryLoading] = useState(false);
  const [nurseryError, setNurseryError] = useState<string | null>(null);
  const [nurseriesAreStale, setNurseriesAreStale] = useState(false);
  const [price, setPrice] = useState<PriceEstimate | null>(null);
  const [isPriceLoading, setIsPriceLoading] = useState(false);

  // Wild occurrences
  const [occurrences, setOccurrences] = useState<OccurrenceSet | null>(null);
  const [habitat, setHabitat] = useState<Habitat | null>(null);
  const [isWildLoading, setIsWildLoading] = useState(false);
  const [wildError, setWildError] = useState<string | null>(null);
  const [noWildRecords, setNoWildRecords] = useState(false);

  useEffect(() => {
    const initApp = async () => {
      const onboarded = localStorage.getItem('flora_onboarded') === 'true';

      // One-time migration: the key used to sit in plaintext localStorage,
      // which on a desktop app is a readable file on disk.
      const legacyKey = localStorage.getItem('flora_api_key');
      if (legacyKey) {
        await window.flora.secrets.set(API_KEY_SECRET, legacyKey);
        localStorage.removeItem('flora_api_key');
      }
      const key = (await window.flora.secrets.get(API_KEY_SECRET)) ?? '';

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

      setAuthConfigured(await window.flora.auth.isConfigured());
      setLocation(await getUserLocation());

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

  const [keyStoreError, setKeyStoreError] = useState<string | null>(null);

  const changeApiKey = async (value: string) => {
    setUserApiKey(value);
    if (!value) {
      await window.flora.secrets.clear(API_KEY_SECRET);
      setKeyStoreError(null);
      return;
    }
    const stored = await window.flora.secrets.set(API_KEY_SECRET, value);
    setKeyStoreError(
      stored ? null : 'Your system keychain is unavailable, so the key will not persist after you quit.',
    );
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
    else if (currentScreen === 'status' || currentScreen === 'wild') {
      // These are reached from a fresh scan or from a saved plant.
      setCurrentScreen(scanResult ? 'scanResult' : activePlantDetails ? 'chat' : 'home');
    } else if (currentScreen === 'nurseries') {
      setCurrentScreen(scanResult ? 'scanResult' : 'home');
    } else if (currentScreen === 'scanResult') {
      setScanResult(null);
      setSelectedImage(null);
      setCurrentScreen('home');
    } else if (currentScreen === 'chat' && scanMode === 'check_in') setCurrentScreen('home');
    else setCurrentScreen('home');
  };

  const startScan = (mode: 'new_plant' | 'check_in' = 'new_plant') => {
    setScanMode(mode);
    setSelectedImage(null);
    setScanResult(null);
    setCheckInResult(null);
    setStatus(null);
    setScanError(null);
    setShowToxicAlert(false);
    setCurrentScreen('scanner');
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

    if (scanMode === 'new_plant') {
      const result = await identifyPlant(selectedImage, userApiKey);
      if (result.ok) {
        if (result.data.isToxic) setShowToxicAlert(true);
        setScanResult(result.data);
        setCurrentScreen('scanResult');
      } else {
        setScanError(result.error.message);
      }
    } else if (scanMode === 'check_in' && activePlantDetails) {
      const result = await checkInOnPlant(selectedImage, userApiKey);
      if (result.ok) {
        setCheckInResult(result.data);
        await saveCheckIn(result.data);
      } else {
        setScanError(result.error.message);
      }
    }

    setIsScanning(false);
  };

  const bumpStreak = async () => {
    const today = getTodayDateId();
    if (lastCheckInDate === today) return;
    const newStreak = lastCheckInDate === getYesterdayDateId() ? streak + 1 : 1;
    setStreak(newStreak);
    setLastCheckInDate(today);
    await saveConfig({ streak: newStreak, lastCheckInDate: today });
  };

  const addToGarden = async () => {
    if (!scanResult || !selectedImage) return;
    const today = getTodayDateId();
    await bumpStreak();

    const newPlant: PlantData = {
      id: Date.now().toString(),
      name: scanResult.name || 'Unknown',
      scientificName: scanResult.scientificName,
      confidence: scanResult.confidence,
      careInstructions: scanResult.careInstructions || '',
      healthStatus: scanResult.healthStatus || '',
      personality: scanResult.personality || 'A friendly botanical companion.',
      isToxic: scanResult.isToxic,
      toxicityDetails: scanResult.toxicityDetails,
      toxicAlertLevel: scanResult.toxicAlertLevel,
      status: status ?? undefined,
      imageUrl: selectedImage,
      dateScanned: new Date().toLocaleDateString(),
      timestamp: Date.now(),
      checkIns: [{ dateId: today, imageUrl: selectedImage }],
    };

    const updated = [newPlant, ...plants].sort((a, b) => b.timestamp - a.timestamp);
    setPlants(updated);
    setActivePlantDetails(newPlant);
    await savePlants(updated);

    setSelectedImage(null);
    setScanResult(null);
    setStatus(null);
    setCurrentScreen('home');
  };

  const saveCheckIn = async (result: { healthStatus: string; openingMessage: string }) => {
    if (!activePlantDetails || !selectedImage) return;
    const today = getTodayDateId();
    await bumpStreak();

    const updated = plants.map((p) => {
      if (p.id !== activePlantDetails.id) return p;
      const newCheckIns = [...p.checkIns];
      if (!newCheckIns.find((c) => c.dateId === today)) {
        newCheckIns.push({ dateId: today, imageUrl: selectedImage });
      }
      const next = { ...p, healthStatus: result.healthStatus || p.healthStatus, checkIns: newCheckIns };
      setActivePlantDetails(next);
      return next;
    });
    setPlants(updated);
    await savePlants(updated);

    if (result.openingMessage) {
      const currentHistory = chatHistory[activePlantDetails.id] || [];
      const openingEntry: ChatMessage = {
        id: Date.now().toString(),
        role: 'model',
        text: result.openingMessage,
        timestamp: Date.now(),
      };
      const finalHistory: ChatMessage[] = [...currentHistory, openingEntry];
      setChatHistory((prev) => ({ ...prev, [activePlantDetails.id]: finalHistory }));
      await saveChatHistory(activePlantDetails.id, finalHistory);
    }

    setSelectedImage(null);
    setCheckInResult(null);
    setCurrentScreen('chat');
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

    const reply = await chat(activePlantDetails, newHistory, userApiKey);
    const modelMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'model',
      text: reply.ok ? reply.data : reply.error.message,
      timestamp: Date.now(),
    };
    const finalHistory = [...newHistory, modelMsg];

    setChatHistory((prev) => ({ ...prev, [plantId]: finalHistory }));
    if (reply.ok) await saveChatHistory(plantId, finalHistory);
    setIsChatLoading(false);
  };

  // ---- The four post-capture actions -------------------------------------

  const openPlantStatus = async (imageOverride?: string) => {
    const image = imageOverride ?? selectedImage;
    if (!image) return;
    const name = scanResult?.name ?? activePlantDetails?.name ?? 'this plant';
    setCurrentScreen('status');
    setIsStatusLoading(true);
    setStatusError(null);

    const result = await assessStatus(image, name, userApiKey);
    if (result.ok) {
      const assessed: PlantStatus = { ...result.data, assessedAt: Date.now() };
      setStatus(assessed);
      // Persist onto the plant when it is already in the garden.
      if (activePlantDetails) {
        const updated = plants.map((p) =>
          p.id === activePlantDetails.id ? { ...p, status: assessed } : p,
        );
        setPlants(updated);
        await savePlants(updated);
      }
    } else {
      setStatusError(result.error.message);
    }
    setIsStatusLoading(false);
  };

  const loadPrice = async (scientificName: string, loc: UserLocation | null) => {
    const cached = await getPriceEstimate(scientificName);
    if (cached) {
      setPrice(cached);
      return;
    }
    setIsPriceLoading(true);
    const country = loc?.label.split(',').pop()?.trim() || 'your country';
    const result = await estimatePrice(scientificName, country, userApiKey);
    if (result.ok) {
      const estimate: PriceEstimate = {
        ...result.data,
        scientificName,
        fetchedAt: Date.now(),
      };
      setPrice(estimate);
      await savePriceEstimate(estimate);
    }
    setIsPriceLoading(false);
  };

  const runNurserySearch = async (loc: UserLocation, km: number) => {
    setIsNurseryLoading(true);
    setNurseryError(null);
    setNurseriesAreStale(false);

    const key = nurseryCacheKey(loc.lat, loc.lon, km);
    const result = await window.flora.findNurseries({ lat: loc.lat, lon: loc.lon, radiusKm: km });

    if (result.ok) {
      setNurseries(result.data);
      await saveCachedNurseries(key, result.data);
    } else {
      // Fall back to the last saved results rather than showing nothing.
      const cached = await getCachedNurseries(key);
      if (cached?.length) {
        setNurseries(cached);
        setNurseriesAreStale(true);
      } else {
        setNurseries([]);
        setNurseryError(result.error.message);
      }
    }
    setIsNurseryLoading(false);
  };

  const openNurseries = async (species?: { name: string; scientificName: string }) => {
    if (species) setActiveSpecies(species);
    setCurrentScreen('nurseries');
    setPrice(null);

    const loc = location ?? (await getUserLocation());
    if (!loc) return; // The screen prompts for a location.

    setLocation(loc);
    await runNurserySearch(loc, radiusKm);

    const name = species?.scientificName ?? activeSpecies?.scientificName;
    if (name) await loadPrice(name, loc);
  };

  const submitPlace = async (query: string) => {
    setIsNurseryLoading(true);
    setNurseryError(null);
    const result = await window.flora.geocode(query);
    setIsNurseryLoading(false);

    if (!result.ok) {
      setNurseryError(result.error.message);
      return;
    }
    setLocation(result.data);
    await saveUserLocation(result.data);
    await runNurserySearch(result.data, radiusKm);
    if (activeSpecies) await loadPrice(activeSpecies.scientificName, result.data);
  };

  const useIpLocation = async () => {
    setIsNurseryLoading(true);
    setNurseryError(null);
    const result = await window.flora.locateByIp();
    setIsNurseryLoading(false);

    if (!result.ok) {
      setNurseryError(result.error.message);
      return;
    }
    setLocation(result.data);
    await saveUserLocation(result.data);
    await runNurserySearch(result.data, radiusKm);
    if (activeSpecies) await loadPrice(activeSpecies.scientificName, result.data);
  };

  const changeRadius = async (km: number) => {
    setRadiusKm(km);
    if (location) await runNurserySearch(location, km);
  };

  const openWild = async (species?: { name: string; scientificName: string }) => {
    const target = species ?? activeSpecies;
    if (species) setActiveSpecies(species);
    if (!target) return;

    setCurrentScreen('wild');
    setIsWildLoading(true);
    setWildError(null);
    setNoWildRecords(false);
    setOccurrences(null);
    setHabitat(null);

    const match = await window.flora.gbifMatch(target.scientificName || target.name);

    if (match.ok) {
      const origin = location ? { lat: location.lat, lon: location.lon } : undefined;
      const found = await window.flora.gbifOccurrences(match.data.usageKey, origin);
      if (found.ok) {
        setOccurrences(found.data);
        setNoWildRecords(found.data.records.length === 0);
      } else {
        setWildError(found.error.message);
      }
    } else if (match.error.code === 'SPECIES_NO_MATCH') {
      // Not an error: most cultivated plants have no wild backbone match.
      setNoWildRecords(true);
    } else {
      setWildError(match.error.message);
    }

    setIsWildLoading(false);

    const described = await describeHabitat(target.scientificName || target.name, userApiKey);
    if (described.ok) setHabitat(described.data);
  };

  const handleSignIn = async () => {
    setAuthError(null);
    setIsSigningIn(true);
    const result = await signInWithGoogleDesktop();
    // Cancelling is a normal choice, not an error worth surfacing.
    if (!result.ok && result.error.code !== 'OAUTH_CANCELLED') {
      setAuthError(result.error.message);
    }
    setIsSigningIn(false);
  };

  const handleSignOut = async () => {
    await logout();
    setAuthError(null);
  };

  const resetLocalData = async () => {
    if (!confirm('Reset Flora AI and wipe local data on this computer?')) return;
    await window.flora.secrets.clear(API_KEY_SECRET);
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
                    hasApiKey={Boolean(userApiKey)}
                    scanError={scanError}
                    onCaptured={(dataUrl) => {
                      setSelectedImage(dataUrl);
                      setScanError(null);
                    }}
                    onPickFile={(e) => handleCameraCapture(e, scanMode)}
                    onAnalyze={processImage}
                    onBack={goBack}
                  />
                )}

                {currentScreen === 'scanResult' && scanResult && selectedImage && (
                  <ScanResultScreen
                    key="scanResult"
                    image={selectedImage}
                    result={scanResult}
                    showToxicAlert={showToxicAlert}
                    isSaved={plants.some((p) => p.name === scanResult.name && p.imageUrl === selectedImage)}
                    onDismissToxicAlert={() => setShowToxicAlert(false)}
                    onAddToGarden={addToGarden}
                    onPlantStatus={openPlantStatus}
                    onWhereToBuy={() =>
                      openNurseries({
                        name: scanResult.name,
                        scientificName: scanResult.scientificName,
                      })
                    }
                    onFindInWild={() =>
                      openWild({
                        name: scanResult.name,
                        scientificName: scanResult.scientificName,
                      })
                    }
                  />
                )}

                {currentScreen === 'status' && (
                  <StatusScreen
                    key="status"
                    plantName={scanResult?.name ?? activePlantDetails?.name ?? 'This plant'}
                    status={status}
                    isLoading={isStatusLoading}
                    error={statusError}
                    onRetry={openPlantStatus}
                  />
                )}

                {currentScreen === 'nurseries' && (
                  <NurseryScreen
                    key="nurseries"
                    speciesName={activeSpecies?.scientificName ?? null}
                    location={location}
                    nurseries={nurseries}
                    price={price}
                    radiusKm={radiusKm}
                    isLoading={isNurseryLoading}
                    isPriceLoading={isPriceLoading}
                    error={nurseryError}
                    isStale={nurseriesAreStale}
                    onSubmitPlace={submitPlace}
                    onUseIpLocation={useIpLocation}
                    onChangeRadius={changeRadius}
                    onClearLocation={() => setLocation(null)}
                    onRetry={() => location && runNurserySearch(location, radiusKm)}
                    onOpenExternal={(url) => window.flora.openExternal(url)}
                  />
                )}

                {currentScreen === 'wild' && activeSpecies && (
                  <WildScreen
                    key="wild"
                    speciesName={activeSpecies.scientificName || activeSpecies.name}
                    occurrences={occurrences}
                    habitat={habitat}
                    isLoading={isWildLoading}
                    noWildRecords={noWildRecords}
                    error={wildError}
                    onRetry={() => openWild()}
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
                    onPlantStatus={() => openPlantStatus(activePlantDetails.imageUrl)}
                    onWhereToBuy={() =>
                      openNurseries({
                        name: activePlantDetails.name,
                        scientificName: activePlantDetails.scientificName ?? activePlantDetails.name,
                      })
                    }
                    onFindInWild={() =>
                      openWild({
                        name: activePlantDetails.name,
                        scientificName: activePlantDetails.scientificName ?? activePlantDetails.name,
                      })
                    }
                  />
                )}

                {currentScreen === 'settings' && (
                  <SettingsScreen
                    key="settings"
                    apiKey={userApiKey}
                    appTheme={appTheme}
                    keyStoreError={keyStoreError}
                    currentUser={currentUser}
                    authConfigured={authConfigured}
                    authError={authError}
                    isSigningIn={isSigningIn}
                    onSignIn={handleSignIn}
                    onSignOut={handleSignOut}
                    onChangeApiKey={changeApiKey}
                    onChangeTheme={updateTheme}
                    onReset={resetLocalData}
                  />
                )}
              </AnimatePresence>
            </main>

            {currentScreen !== 'scanner' &&
              currentScreen !== 'history' &&
              currentScreen !== 'scanResult' && (
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

                <button
                  onClick={() => startScan('new_plant')}
                  className="relative w-16 h-16 flex items-center justify-center -mt-8 rounded-full bg-[var(--color-accent)] text-bg-main shadow-lg border-4 border-bg-main transition transform active:scale-95"
                >
                  <ScanLine size={26} strokeWidth={2.5} />
                </button>

                <button
                  onClick={() => openNurseries()}
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

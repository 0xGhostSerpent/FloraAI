import { useState, useEffect, useRef, type ChangeEvent } from 'react';
import { ChevronLeft, Leaf, ScanLine, Store, WifiOff } from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import {
  auth,
  logout,
  signInWithGoogleDesktop,
  signInWithEmail,
  signUpWithEmail,
  signInInstantAccount,
  syncCloudBackup,
  fetchCloudBackup,
  getStoredActiveUser,
  type FloraUser,
} from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import {
  getPlants,
  savePlants,
  getChatHistory,
  saveChatHistory,
  getAppConfig,
  saveAppConfig,
  PlantData,
  ChatMessage,
  type AppConfig,
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
  detectProvider,
  estimatePrice,
  identifyPlant,
  listModels,
  pickVisionModel,
  testConnection,
  AI_PROVIDERS,
  DEFAULT_GEMINI_MODEL,
  type AiConfig,
  type AiProvider,
  type ConnectionResult,
  type Habitat,
  type Identification,
} from './services/ai';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import type { FloraResult, StorageBackend } from './types/flora';
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

/** The single pre-multi-provider slot, migrated into the namespace below. */
const LEGACY_KEY_SECRET = 'gemini_api_key';

/** Each provider gets its own slot, so switching never overwrites another key. */
const keyNameFor = (provider: AiProvider): string => `ai_api_key_${provider}`;

export default function App() {
  const [isInitializing, setIsInitializing] = useState(true);
  const [currentUser, setCurrentUser] = useState<FloraUser | null>(getStoredActiveUser());

  // Auth & Cloud Backup
  const [authConfigured, setAuthConfigured] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [lastDriveSync, setLastDriveSync] = useState<number | null>(null);
  const [driveSyncing, setDriveSyncing] = useState(false);
  const [driveSyncError, setDriveSyncError] = useState<string | null>(null);

  // App config
  const [hasOnboarded, setHasOnboarded] = useState(false);
  const [userApiKey, setUserApiKey] = useState('');
  const [aiModel, setAiModel] = useState(DEFAULT_GEMINI_MODEL);
  const [aiProvider, setAiProvider] = useState<AiProvider>('gemini');
  const [aiBaseUrl, setAiBaseUrl] = useState('');
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [modelError, setModelError] = useState<string | null>(null);
  const [appTheme, setAppTheme] = useState('theme-minimalist');

  // AI key state. `keyIsSaved` tracks what actually reached the key store, so
  // the UI stops claiming "Key saved" while the user is still typing.
  const [keyIsSaved, setKeyIsSaved] = useState(false);
  const [savedProviders, setSavedProviders] = useState<AiProvider[]>([]);
  const [storageBackend, setStorageBackend] = useState<StorageBackend>('os');
  const [connectionResult, setConnectionResult] = useState<ConnectionResult | null>(null);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const keyDebounce = useRef<number | null>(null);

  const isOnline = useOnlineStatus();

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

  const triggerDriveSync = async (
    overridePlants?: PlantData[],
    overrideHistory?: Record<string, ChatMessage[]>,
    overrideUser?: FloraUser | null,
  ) => {
    const userToSync = overrideUser !== undefined ? overrideUser : currentUser;
    if (!userToSync) return;

    setDriveSyncing(true);
    setDriveSyncError(null);

    const currentPlants = overridePlants ?? plants;
    const currentChat = overrideHistory ?? chatHistory;

    const payload = {
      version: 1,
      exportedAt: Date.now(),
      user: {
        uid: userToSync.uid,
        email: userToSync.email,
        displayName: userToSync.displayName,
      },
      plants: currentPlants,
      chatHistory: currentChat,
      config: {
        streak,
        lastCheckInDate,
        theme: appTheme,
      },
    };

    // 1. Sync to Firebase Cloud Firestore
    const cloudRes = await syncCloudBackup(userToSync.uid, payload);
    if (cloudRes.ok) {
      setLastDriveSync(cloudRes.data.syncedAt);
    } else {
      setDriveSyncError(cloudRes.error.message);
    }

    // 2. Also sync to Google Drive if active
    try {
      if (await window.flora.auth.isConfigured()) {
        const result = (await window.flora.drive.syncBackup(payload)) as FloraResult<{
          success: boolean;
          syncedAt: number;
          fileId?: string;
        }>;
        if (result.ok) {
          setLastDriveSync(result.data.syncedAt);
        }
      }
    } catch {
      // Non-fatal
    } finally {
      setDriveSyncing(false);
    }
  };

  useEffect(() => {
    const initApp = async () => {
      const onboarded = localStorage.getItem('flora_onboarded') === 'true';

      // One-time migration: the key used to sit in plaintext localStorage,
      // which on a desktop app is a readable file on disk.
      const legacyPlainKey = localStorage.getItem('flora_api_key');
      if (legacyPlainKey) {
        await window.flora.secrets.set(keyNameFor('gemini'), legacyPlainKey);
        localStorage.removeItem('flora_api_key');
      }

      // Second migration: the single 'gemini_api_key' slot becomes the first
      // entry in the per-provider namespace.
      const legacyKey = await window.flora.secrets.get(LEGACY_KEY_SECRET);
      if (legacyKey) {
        if (!(await window.flora.secrets.get(keyNameFor('gemini')))) {
          await window.flora.secrets.set(keyNameFor('gemini'), legacyKey);
        }
        await window.flora.secrets.clear(LEGACY_KEY_SECRET);
      }

      setHasOnboarded(onboarded);
      setStorageBackend(await window.flora.secrets.backend());

      const loadedPlants = await getPlants();
      setPlants(loadedPlants);

      const config = await getAppConfig();

      let currentStreak = config.streak || 0;
      const lastCheckIn = config.lastCheckInDate;
      if (lastCheckIn !== getTodayDateId() && lastCheckIn !== getYesterdayDateId()) {
        currentStreak = 0; // Reset streak if a day was missed
      }
      setStreak(currentStreak);
      setLastCheckInDate(lastCheckIn);
      setAppTheme(config.theme || 'theme-minimalist');

      const provider = config.aiProvider || 'gemini';
      setAiProvider(provider);
      setAiBaseUrl(config.aiBaseUrl || '');

      // Third migration: one shared aiModel becomes a per-provider map, so a
      // model ID never leaks across providers that do not offer it.
      const models = config.aiModels ?? (config.aiModel ? { [provider]: config.aiModel } : {});
      if (!config.aiModels && config.aiModel) {
        await saveAppConfig({ ...config, aiModels: models });
      }
      setAiModel(models[provider] || (provider === 'gemini' ? DEFAULT_GEMINI_MODEL : ''));

      const key = (await window.flora.secrets.get(keyNameFor(provider))) ?? '';
      setUserApiKey(key);
      setKeyIsSaved(Boolean(key));

      // Which providers already hold a key, so Settings can show it at a glance.
      const stored: AiProvider[] = [];
      for (const candidate of AI_PROVIDERS) {
        if (await window.flora.secrets.get(keyNameFor(candidate.id))) stored.push(candidate.id);
      }
      setSavedProviders(stored);

      setAuthConfigured(await window.flora.auth.isConfigured());
      setLocation(await getUserLocation());

      const lastSync = await window.flora.drive.getLastSync();
      setLastDriveSync(lastSync.syncedAt);

      onAuthStateChanged(auth, async (fbUser) => {
        if (fbUser) {
          const user: FloraUser = {
            uid: fbUser.uid,
            email: fbUser.email,
            displayName: fbUser.displayName || fbUser.email,
            photoURL: fbUser.photoURL,
            isAnonymous: fbUser.isAnonymous,
          };
          setCurrentUser(user);
          localStorage.setItem('flora_active_user', JSON.stringify(user));
          void triggerDriveSync(loadedPlants, undefined, user);
        } else {
          const local = getStoredActiveUser();
          if (local) {
            setCurrentUser(local);
          }
        }
        setIsInitializing(false);
      });
    };
    void initApp();
  }, []);

  const saveConfig = async (updates: Partial<AppConfig>) => {
    const current = await getAppConfig();
    await saveAppConfig({ ...current, ...updates });
  };

  const updateTheme = async (newTheme: string) => {
    setAppTheme(newTheme);
    await saveConfig({ theme: newTheme });
  };

  const [keyStoreError, setKeyStoreError] = useState<string | null>(null);
  const aiConfig: AiConfig = { apiKey: userApiKey, model: aiModel, provider: aiProvider, baseUrl: aiBaseUrl };

  const changeAiModel = async (value: string, provider: AiProvider = aiProvider) => {
    setAiModel(value);
    const config = await getAppConfig();
    await saveAppConfig({ ...config, aiModels: { ...config.aiModels, [provider]: value } });
  };

  /**
   * Fetches the models this key may use and settles on one that can accept a
   * photo. Takes an explicit config because it runs straight after a state
   * change, before React has applied it.
   */
  const loadModels = async (config: AiConfig) => {
    setIsLoadingModels(true);
    setModelError(null);
    const result = await listModels(config);

    if (!result.ok) {
      setAvailableModels([]);
      setModelError(result.error.message);
      setIsLoadingModels(false);
      return;
    }

    const provider = config.provider ?? 'gemini';
    setAvailableModels(result.data);
    const picked = pickVisionModel(result.data, provider, config.model);
    if (picked && picked !== config.model) await changeAiModel(picked, provider);
    if (!picked && result.data.length) {
      // Never silently settle on a text-only model: identification sends a photo.
      setModelError(
        `None of the ${result.data.length} models on this key look able to read photos. Pick one manually if you know it accepts images.`,
      );
    }
    setIsLoadingModels(false);
  };

  /** Persists the key for whichever provider it belongs to, then auto-loads. */
  const commitApiKey = async (raw?: string) => {
    const value = (raw ?? userApiKey).trim();
    if (!value) return;

    // An unfamiliar key shape leaves the current selection alone rather than
    // guessing and sending the key to the wrong provider.
    const detected = detectProvider(value);
    const provider = detected ?? aiProvider;
    let baseUrl = aiBaseUrl;

    if (detected && detected !== aiProvider) {
      setAiProvider(detected);
      // Only a custom endpoint keeps a base URL; otherwise a stale one would
      // linger behind a provider that has its own.
      baseUrl = detected === 'custom' ? aiBaseUrl : '';
      setAiBaseUrl(baseUrl);
      const config = await getAppConfig();
      await saveAppConfig({ ...config, aiProvider: detected });
    }

    const stored = await window.flora.secrets.set(keyNameFor(provider), value);
    setKeyIsSaved(stored);
    setKeyStoreError(
      stored ? null : 'No key store is available on this system, so the key cannot be saved.',
    );
    if (stored) {
      setSavedProviders((previous) =>
        previous.includes(provider) ? previous : [...previous, provider],
      );
    }

    const config = await getAppConfig();
    const model = config.aiModels?.[provider] ?? (provider === 'gemini' ? DEFAULT_GEMINI_MODEL : '');
    await loadModels({ apiKey: value, provider, baseUrl, model });
  };

  const forgetApiKey = async (provider: AiProvider) => {
    await window.flora.secrets.clear(keyNameFor(provider));
    setKeyIsSaved(false);
    setKeyStoreError(null);
    setAvailableModels([]);
    setSavedProviders((previous) => previous.filter((id) => id !== provider));
  };

  /**
   * Debounced so a pasted key saves and loads its models on its own, without
   * a keystroke-by-keystroke write or a request per character.
   */
  const changeApiKey = (value: string) => {
    setUserApiKey(value);
    setKeyIsSaved(false);
    setModelError(null);
    setConnectionResult(null);
    if (keyDebounce.current) window.clearTimeout(keyDebounce.current);

    const provider = aiProvider;
    keyDebounce.current = window.setTimeout(
      () => void (value.trim() ? commitApiKey(value) : forgetApiKey(provider)),
      600,
    );
  };

  /** The explicit Save button: same work, without waiting out the debounce. */
  const saveApiKeyNow = async () => {
    if (keyDebounce.current) window.clearTimeout(keyDebounce.current);
    await commitApiKey();
  };

  const refreshModels = () => loadModels(aiConfig);

  const runConnectionTest = async () => {
    setIsTestingConnection(true);
    setConnectionResult(null);
    const result = await testConnection(aiConfig);
    setConnectionResult(
      result.ok
        ? { ok: true, models: result.data.models, elapsedMs: result.data.elapsedMs }
        : { ok: false, message: result.error.message },
    );
    setIsTestingConnection(false);
  };

  const changeAiProvider = async (provider: AiProvider) => {
    if (keyDebounce.current) window.clearTimeout(keyDebounce.current);
    setAiProvider(provider);
    setAvailableModels([]);
    setModelError(null);
    setConnectionResult(null);
    setKeyStoreError(null);

    const config = await getAppConfig();
    // Each provider remembers its own key, model and (for custom) endpoint.
    const key = (await window.flora.secrets.get(keyNameFor(provider))) ?? '';
    const model = config.aiModels?.[provider] ?? (provider === 'gemini' ? DEFAULT_GEMINI_MODEL : '');
    const baseUrl = provider === 'custom' ? (config.aiBaseUrl ?? '') : '';

    setUserApiKey(key);
    setKeyIsSaved(Boolean(key));
    setAiModel(model);
    setAiBaseUrl(baseUrl);
    await saveAppConfig({ ...config, aiProvider: provider });

    if (key) await loadModels({ apiKey: key, provider, baseUrl, model });
  };

  const changeAiBaseUrl = async (baseUrl: string) => {
    setAiBaseUrl(baseUrl);
    await saveConfig({ aiBaseUrl: baseUrl });
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
      const result = await identifyPlant(selectedImage, aiConfig);
      if (result.ok) {
        if (result.data.isToxic) setShowToxicAlert(true);
        setScanResult(result.data);
        setCurrentScreen('scanResult');
      } else {
        setScanError(result.error.message);
      }
    } else if (scanMode === 'check_in' && activePlantDetails) {
      const result = await checkInOnPlant(selectedImage, aiConfig);
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
    if (currentUser) void triggerDriveSync(updated);

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

    let nextChat = chatHistory;
    if (result.openingMessage) {
      const currentHistory = chatHistory[activePlantDetails.id] || [];
      const openingEntry: ChatMessage = {
        id: Date.now().toString(),
        role: 'model',
        text: result.openingMessage,
        timestamp: Date.now(),
      };
      const finalHistory: ChatMessage[] = [...currentHistory, openingEntry];
      nextChat = { ...chatHistory, [activePlantDetails.id]: finalHistory };
      setChatHistory(nextChat);
      await saveChatHistory(activePlantDetails.id, finalHistory);
    }

    if (currentUser) void triggerDriveSync(updated, nextChat);

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

    const reply = await chat(activePlantDetails, newHistory, aiConfig);
    const modelMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'model',
      text: reply.ok ? reply.data : reply.error.message,
      timestamp: Date.now(),
    };
    const finalHistory = [...newHistory, modelMsg];
    const nextChat = { ...chatHistory, [plantId]: finalHistory };

    setChatHistory(nextChat);
    if (reply.ok) {
      await saveChatHistory(plantId, finalHistory);
      if (currentUser) void triggerDriveSync(plants, nextChat);
    }
    setIsChatLoading(false);
  };

  const deleteChatMessage = async (messageId: string) => {
    if (!activePlantDetails) return;
    const plantId = activePlantDetails.id;
    const current = chatHistory[plantId] || [];
    const updated = current.filter((m) => m.id !== messageId);
    const nextChat = { ...chatHistory, [plantId]: updated };
    setChatHistory(nextChat);
    await saveChatHistory(plantId, updated);
    if (currentUser) void triggerDriveSync(plants, nextChat);
  };

  const clearChatHistory = async () => {
    if (!activePlantDetails) return;
    const plantId = activePlantDetails.id;
    const nextChat = { ...chatHistory, [plantId]: [] };
    setChatHistory(nextChat);
    await saveChatHistory(plantId, []);
    if (currentUser) void triggerDriveSync(plants, nextChat);
  };

  // ---- The four post-capture actions -------------------------------------

  const openPlantStatus = async (imageOverride?: string) => {
    const image = imageOverride ?? selectedImage;
    if (!image) return;
    const name = scanResult?.name ?? activePlantDetails?.name ?? 'this plant';
    setCurrentScreen('status');
    setIsStatusLoading(true);
    setStatusError(null);

    const result = await assessStatus(image, name, aiConfig);
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
    const result = await estimatePrice(scientificName, country, aiConfig);
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

    const described = await describeHabitat(target.scientificName || target.name, aiConfig);
    if (described.ok) setHabitat(described.data);
  };

  const loadAndMergeCloudData = async (uid: string, initialPlants?: PlantData[]) => {
    const cloudRes = await fetchCloudBackup(uid);
    if (cloudRes.ok && cloudRes.data && cloudRes.data.payload) {
      const payload = cloudRes.data.payload as any;
      if (Array.isArray(payload.plants) && payload.plants.length > 0) {
        setPlants(payload.plants);
        await savePlants(payload.plants);
      }
      if (payload.chatHistory) {
        setChatHistory(payload.chatHistory);
        for (const [pId, hist] of Object.entries(payload.chatHistory)) {
          if (Array.isArray(hist)) await saveChatHistory(pId, hist as ChatMessage[]);
        }
      }
      if (cloudRes.data.updatedAt) {
        setLastDriveSync(cloudRes.data.updatedAt);
      }
    } else {
      void triggerDriveSync(initialPlants ?? plants, chatHistory);
    }
  };

  const handleEmailSignIn = async (email: string, pass: string) => {
    setAuthError(null);
    setIsSigningIn(true);
    const result = await signInWithEmail(email, pass);
    if (!result.ok) {
      setAuthError(result.error.message);
    } else {
      await loadAndMergeCloudData(result.data.uid);
      completeOnboarding();
    }
    setIsSigningIn(false);
  };

  const handleEmailSignUp = async (email: string, pass: string) => {
    setAuthError(null);
    setIsSigningIn(true);
    const result = await signUpWithEmail(email, pass);
    if (!result.ok) {
      setAuthError(result.error.message);
    } else {
      void triggerDriveSync(plants, chatHistory, result.data);
      completeOnboarding();
    }
    setIsSigningIn(false);
  };

  const handleInstantSignIn = async () => {
    setAuthError(null);
    setIsSigningIn(true);
    const result = await signInInstantAccount();
    if (!result.ok) {
      setAuthError(result.error.message);
    } else {
      await loadAndMergeCloudData(result.data.uid);
      completeOnboarding();
    }
    setIsSigningIn(false);
  };

  const handleExportBackup = () => {
    const backup = {
      app: 'Flora AI',
      exportedAt: new Date().toISOString(),
      plants,
      chatHistory,
      streak,
      theme: appTheme,
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `flora_ai_backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportBackup = (file: File) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const content = JSON.parse(e.target?.result as string);
        if (Array.isArray(content.plants)) {
          setPlants(content.plants);
          await savePlants(content.plants);
        }
        if (content.chatHistory) {
          setChatHistory(content.chatHistory);
          for (const [pId, hist] of Object.entries(content.chatHistory)) {
            if (Array.isArray(hist)) await saveChatHistory(pId, hist as ChatMessage[]);
          }
        }
        if (content.streak) {
          setStreak(content.streak);
        }
        if (content.theme) {
          void updateTheme(content.theme);
        }
        alert('Backup restored successfully!');
      } catch {
        alert('Could not read backup file. Please select a valid Flora AI JSON file.');
      }
    };
    reader.readAsText(file);
  };

  const handleSaveGoogleClientId = async (clientId: string) => {
    await window.flora.secrets.set('google_client_id', clientId);
    setAuthConfigured(await window.flora.auth.isConfigured());
    setAuthError(null);
  };

  const handleSignIn = async () => {
    setAuthError(null);
    setIsSigningIn(true);
    const result = await signInWithGoogleDesktop();
    // Cancelling is a normal choice, not an error worth surfacing.
    if (!result.ok && result.error.code !== 'OAUTH_CANCELLED') {
      setAuthError(result.error.message);
    } else if (result.ok) {
      void triggerDriveSync(plants, undefined, result.data);
    }
    setIsSigningIn(false);
  };

  const handleSignOut = async () => {
    await logout();
    await window.flora.auth.clearTokens();
    setLastDriveSync(null);
    setAuthError(null);
  };

  const resetLocalData = async () => {
    if (!confirm('Reset Flora AI and wipe local data on this computer?')) return;
    // Every provider slot, plus the pre-migration one in case it lingers.
    for (const provider of AI_PROVIDERS) {
      await window.flora.secrets.clear(keyNameFor(provider.id));
    }
    await window.flora.secrets.clear(LEGACY_KEY_SECRET);
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
    <div className={`flex justify-center min-h-screen bg-bg-main font-sans text-text-main ${appTheme}`}>
      <div className="w-full max-w-xl md:max-w-2xl bg-bg-main min-h-screen relative flex flex-col overflow-hidden text-text-main dynamic-border border-y-0 sm:border-y border-x dynamic-shadow">
        {!hasOnboarded ? (
          <OnboardingScreen
            onAccept={completeOnboarding}
            onInstantSignIn={handleInstantSignIn}
            onEmailSignIn={handleEmailSignIn}
            onEmailSignUp={handleEmailSignUp}
            isSigningIn={isSigningIn}
            authError={authError}
            currentUser={currentUser}
          />
        ) : (
          <>
            {currentScreen !== 'home' && currentScreen !== 'scanner' && (
              <div className="px-5 py-4 flex items-center gap-3 shrink-0 sticky top-0 bg-bg-main/90 backdrop-blur-md z-30 border-b border-[var(--color-accent)]/15">
                <button
                  onClick={goBack}
                  className="w-10 h-10 bg-bg-card rounded-full flex items-center justify-center dynamic-border shadow-sm hover:brightness-110 active:scale-95 transition-all"
                >
                  <ChevronLeft size={22} className="text-text-main" />
                </button>
                <h2 className="text-lg font-bold text-text-main capitalize tracking-tight">
                  {currentScreen === 'settings' ? 'Application Settings' : currentScreen}
                </h2>
              </div>
            )}

            {!isOnline && (
              <div className="px-4 py-2 flex items-center gap-2 bg-amber-500/15 border-b border-amber-500/30 text-amber-500 text-xs font-bold z-30">
                <WifiOff size={14} />
                Offline — identification, chat and nursery search need a connection.
              </div>
            )}

            <main
              className={`flex-1 ${
                currentScreen === 'chat'
                  ? 'h-[calc(100vh-70px)] pb-1 flex flex-col overflow-hidden'
                  : currentScreen === 'home' || currentScreen === 'nurseries'
                    ? 'overflow-y-auto pb-28 custom-scrollbar'
                    : 'overflow-y-auto pb-8 custom-scrollbar'
              } z-10 w-full relative`}
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
                    driveSyncing={driveSyncing}
                    lastDriveSync={lastDriveSync}
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
                    onBackToScanner={() => startScan('new_plant')}
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
                    onDeleteMessage={deleteChatMessage}
                    onClearHistory={clearChatHistory}
                  />
                )}

                {currentScreen === 'settings' && (
                  <SettingsScreen
                    key="settings"
                    apiKey={userApiKey}
                    aiModel={aiModel}
                    aiProvider={aiProvider}
                    aiBaseUrl={aiBaseUrl}
                    availableModels={availableModels}
                    isLoadingModels={isLoadingModels}
                    modelError={modelError}
                    appTheme={appTheme}
                    keyStoreError={keyStoreError}
                    keyIsSaved={keyIsSaved}
                    savedProviders={savedProviders}
                    storageBackend={storageBackend}
                    connectionResult={connectionResult}
                    isTestingConnection={isTestingConnection}
                    isOnline={isOnline}
                    currentUser={currentUser}
                    authConfigured={authConfigured}
                    authError={authError}
                    isSigningIn={isSigningIn}
                    driveSyncing={driveSyncing}
                    lastDriveSync={lastDriveSync}
                    driveSyncError={driveSyncError}
                    onSyncDrive={() => void triggerDriveSync()}
                    onSignIn={handleSignIn}
                    onSignOut={handleSignOut}
                    onEmailSignIn={handleEmailSignIn}
                    onEmailSignUp={handleEmailSignUp}
                    onInstantSignIn={handleInstantSignIn}
                    onSaveGoogleClientId={handleSaveGoogleClientId}
                    onExportBackup={handleExportBackup}
                    onImportBackup={handleImportBackup}
                    onChangeApiKey={changeApiKey}
                    onSaveApiKey={saveApiKeyNow}
                    onChangeAiModel={(value) => void changeAiModel(value)}
                    onChangeAiProvider={changeAiProvider}
                    onChangeAiBaseUrl={changeAiBaseUrl}
                    onRefreshModels={refreshModels}
                    onTestConnection={runConnectionTest}
                    onChangeTheme={updateTheme}
                    onReset={resetLocalData}
                  />
                )}
              </AnimatePresence>
            </main>

            {(currentScreen === 'home' || currentScreen === 'nurseries') && (
              <nav className="absolute bottom-0 w-full bg-bg-card/95 backdrop-blur-md border-t border-[var(--color-accent)]/15 pb-safe px-10 flex justify-between h-[85px] items-start pt-3.5 z-40 dynamic-shadow">
                <button
                  onClick={() => setCurrentScreen('home')}
                  className={`flex flex-col items-center gap-1.5 w-16 transition-colors ${
                    currentScreen === 'home'
                      ? 'text-[var(--color-accent)] font-bold'
                      : 'text-text-muted hover:text-text-main'
                  }`}
                >
                  <Leaf size={22} strokeWidth={2.5} />
                  <span className="text-[10px] font-bold uppercase tracking-wider">Garden</span>
                </button>

                <button
                  onClick={() => startScan('new_plant')}
                  className="relative w-14 h-14 flex items-center justify-center -mt-7 rounded-full bg-[var(--color-accent)] text-bg-main shadow-lg border-4 border-bg-main transition transform hover:scale-105 active:scale-95"
                >
                  <ScanLine size={24} strokeWidth={2.5} />
                </button>

                <button
                  onClick={() => openNurseries()}
                  className={`flex flex-col items-center gap-1.5 w-16 transition-colors ${
                    currentScreen === 'nurseries'
                      ? 'text-[var(--color-accent)] font-bold'
                      : 'text-text-muted hover:text-text-main'
                  }`}
                >
                  <Store size={22} strokeWidth={2.5} />
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

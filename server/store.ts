import fs from 'fs';
import path from 'path';
import type {
  AdminActivityLog,
  AdminDashboardData,
  AdMobConfig,
  AdSystemState,
  AiFeatureFlags,
  ApiLogEntry,
  AppSettingsConfig,
  AppStateResponse,
  ChatConversation,
  ChatMessage,
  GeminiModelId,
  GeminiModelOption,
  HistoryItem,
  PaymentConfig,
  PaymentMethod,
  PaymentRequest,
  QuotaState,
  RegisteredUserRecord,
  ResponseLanguageCode,
  SubscriptionPlanConfig,
  SubscriptionPlanId,
  SubscriptionState,
  UserAccountStatus,
  UserProfile,
} from '../src/types';
import { normalizeLanguageCode } from '../src/constants/languages';
import { getAdminConfigStatus } from './adminAuth';

export const AVAILABLE_GEMINI_MODELS: GeminiModelOption[] = [
  {
    id: 'gemini-3.1-flash-lite-preview',
    labelBn: 'Gemini 3.1 Flash Lite Preview (সুপারিশকৃত)',
    descriptionBn: 'বাংলা, শিক্ষা ও চ্যাটের জন্য দ্রুত, নির্ভরযোগ্য এবং v1beta-তে সার্বজনীনভাবে সমর্থিত',
    tierNoteBn: 'ফ্রি টিয়ার উপযোগী (v1beta সমর্থিত)',
    isFreeTier: true,
  },
  {
    id: 'gemini-3.1-flash-lite',
    labelBn: 'Gemini 3.1 Flash Lite',
    descriptionBn: 'সর্বোচ্চ গতি ও কম কোটা খরচের হালকা ৩.১ ফ্ল্যাশ মডেল',
    tierNoteBn: 'ফ্রি টিয়ার উপযোগী',
    isFreeTier: true,
  },
  {
    id: 'gemini-2.5-flash',
    labelBn: 'Gemini 2.5 Flash',
    descriptionBn: 'পাবলিক Gemini API কী-তে শক্তিশালী টেক্সট, শিক্ষা ও চ্যাট মডেল',
    tierNoteBn: 'ফ্রি টিয়ার উপযোগী (v1beta)',
    isFreeTier: true,
  },
  {
    id: 'gemini-2.5-flash-lite',
    labelBn: 'Gemini 2.5 Flash Lite',
    descriptionBn: 'কম কোটা খরচে দ্রুত উত্তরের জন্য ২.৫ ফ্ল্যাশ লাইট মডেল',
    tierNoteBn: 'ফ্রি টিয়ার উপযোগী (v1beta)',
    isFreeTier: true,
  },
  {
    id: 'gemini-2.5-pro',
    labelBn: 'Gemini 2.5 Pro',
    descriptionBn: 'জটিল গণিত, বিজ্ঞান ও দীর্ঘ বিশ্লেষণের জন্য উচ্চ ক্ষমতার মডেল',
    tierNoteBn: 'পেইড / প্রো API কোটা উপযোগী',
    isFreeTier: false,
  },
];

const VALID_MODEL_IDS = new Set<string>(AVAILABLE_GEMINI_MODELS.map((m) => m.id));

function resolveInitialModel(): GeminiModelId {
  const envModel = process.env.GEMINI_MODEL?.trim();
  if (envModel && VALID_MODEL_IDS.has(envModel)) {
    return envModel as GeminiModelId;
  }
  return 'gemini-3.1-flash-lite-preview';
}

const createDefaultPlans = (): SubscriptionPlanConfig[] => [
  {
    id: 'free',
    nameBn: 'ফ্রি স্টার্টার প্ল্যান',
    nameEn: 'Free Plan',
    priceBdt: 0,
    durationDays: 0,
    dailyLimit: 12,
    monthlyLimit: 150,
    isPaid: false,
    enabled: true,
    descriptionBn: 'দৈনিক সীমিত ব্যবহার, ফটো এডিটর ও নিরাপদ সাধারণ স্বাস্থ্য তথ্য',
  },
  {
    id: 'pro',
    nameBn: 'সাথী প্রো (কাস্টম/স্ট্যান্ডার্ড)',
    nameEn: 'Pro Plan',
    priceBdt: 200,
    durationDays: 30,
    dailyLimit: 200,
    monthlyLimit: 2500,
    isPaid: true,
    enabled: true,
    descriptionBn: 'বিজ্ঞাপনমুক্ত পূর্ণ প্রো অ্যাক্সেস ও উচ্চ দৈনিক/মাসিক সীমা',
  },
  {
    id: '1_month',
    nameBn: '১ মাস প্রো প্ল্যান (৳২০০)',
    nameEn: '200 BDT Plan (1 Month)',
    priceBdt: 200,
    durationDays: 30,
    dailyLimit: 200,
    monthlyLimit: 2500,
    isPaid: true,
    enabled: true,
    descriptionBn: '৩০ দিন মেয়াদি বিজ্ঞাপনমুক্ত প্যাকেজ ও অগ্রাধিকার উত্তর',
  },
  {
    id: '3_months',
    nameBn: '৩ মাস প্রো প্ল্যান (৳৫০০)',
    nameEn: '500 BDT Plan (3 Months)',
    priceBdt: 500,
    durationDays: 90,
    dailyLimit: 200,
    monthlyLimit: 6000,
    isPaid: true,
    enabled: true,
    descriptionBn: '৯০ দিন মেয়াদি সাশ্রয়ী প্রো প্যাকেজ ও সর্বোচ্চ মাসিক কোটা',
  },
];

const createDefaultPaymentConfig = (): PaymentConfig => ({
  bkashEnabled: true,
  bkashNumber: '01944527151',
  nagadEnabled: true,
  nagadNumber: '01354848807',
  rocketEnabled: false,
  rocketNumber: '',
  cardEnabled: false,
  sendMoneyNoteEn:
    'Send Money to the selected bKash or Nagad Personal number, then enter your sender number and TrxID below.',
  sendMoneyNoteBn:
    'নির্বাচিত বিকাশ বা নগদ পার্সোনাল নম্বরে Send Money করে নিচে আপনার প্রেরক নম্বর ও ট্রানজেকশন আইডি (TrxID) দিন।',
});

const createDefaultAiFeatures = (): AiFeatureFlags => ({
  educationEnabled: true,
  generalChatEnabled: true,
  imageGenerationEnabled: true,
  videoGenerationEnabled: true,
});

const REAL_ADSENSE_PUBLISHER_ID = 'ca-pub-9416678178678630';

const createDefaultAdMobConfig = (): AdMobConfig => ({
  providerMode: 'live_admob',
  testMode: false,
  appId: '',
  bannerUnitId: '',
  entryInterstitialUnitId: '',
  studyInterstitialUnitId: '',
  adsenseClientId: REAL_ADSENSE_PUBLISHER_ID,
  adsenseBannerSlot: '',
  adsenseInterstitialSlot: '',
});

const createDefaultAppSettings = (): AppSettingsConfig => ({
  defaultLanguage: 'en',
  v2DefaultsApplied: true,
  paymentConfig: createDefaultPaymentConfig(),
  aiFeatures: createDefaultAiFeatures(),
  announcement: {
    enabled: false,
    title: 'সিস্টেম বিজ্ঞপ্তি',
    message: '',
    type: 'info',
  },
  maintenanceMode: {
    enabled: false,
    messageBn: 'সিস্টেম রক্ষণাবেক্ষণ চলছে। কিছুক্ষণ পর আবার চেষ্টা করুন।',
  },
  aiSettings: {
    enabled: true,
    cacheEnabled: true,
    allowUserModelSwitch: true,
    streamEnabled: true,
  },
});

interface PersistedDatabase {
  user: UserProfile;
  subscription: SubscriptionState;
  quota: QuotaState;
  users?: RegisteredUserRecord[];
  plans?: SubscriptionPlanConfig[];
  payments: PaymentRequest[];
  history: HistoryItem[];
  conversations?: ChatConversation[];
  ads: AdSystemState;
  appSettings?: AppSettingsConfig;
  apiLogs?: ApiLogEntry[];
  adminLogs?: AdminActivityLog[];
  aiModel?: GeminiModelId;
  totalRequests: number;
  activeUsers: number;
}

const DATA_DIR = process.env.VERCEL
  ? path.join('/tmp', 'sathi-data')
  : path.resolve(process.cwd(), '.data');
const DB_FILE = path.join(DATA_DIR, 'sathi-db.json');

const todayIsoDate = () => new Date().toISOString().slice(0, 10);

const createDefaultDb = (): PersistedDatabase => {
  const nowIso = new Date().toISOString();
  const initialUser: UserProfile = {
    id: 'usr_sathi_01',
    name: 'তানভীর আহমেদ',
    phone: '+৮৮০ ১৭১২-৩৪৫৬৭৮',
    email: 'tanvir.sathi@example.com',
    avatarUrl: '/src/assets/images/sathi_avatar_user_1795095210432.jpg',
    location: 'ঢাকা, বাংলাদেশ',
    preferredLanguage: 'en',
    theme: 'light',
  };
  const initialSubscription: SubscriptionState = {
    planId: 'free',
    planNameBn: 'ফ্রি স্টার্টার প্ল্যান',
    status: 'active',
    isPaid: false,
    priceBdt: 0,
    activatedAt: null,
    expiresAt: null,
  };
  const initialQuota: QuotaState = {
    usedToday: 2,
    dailyLimit: 12,
    monthlyUsed: 14,
    monthlyLimit: 150,
    lastResetDate: todayIsoDate(),
  };

  return {
    user: initialUser,
    subscription: initialSubscription,
    quota: initialQuota,
    users: [
      {
        id: initialUser.id,
        name: initialUser.name,
        phone: initialUser.phone,
        email: initialUser.email,
        location: initialUser.location,
        status: 'active',
        role: 'user',
        subscription: { ...initialSubscription },
        quota: { ...initialQuota },
        totalRequests: 14,
        createdAt: nowIso,
        lastActiveAt: nowIso,
      },
    ],
    plans: createDefaultPlans(),
    payments: [
      {
        id: 'PAY-1001',
        userId: 'usr_sathi_01',
        userName: 'তানভীর আহমেদ',
        planId: '1_month',
        planLabel: '১ মাস প্রো প্ল্যান',
        amountBdt: 200,
        method: 'bKash',
        senderNumber: '01712345678',
        transactionId: 'BKS9482DEMO',
        status: 'pending',
        submittedAt: new Date(Date.now() - 1000 * 60 * 42).toISOString(),
        reviewedAt: null,
        reviewNote: 'অ্যাডমিন যাচাইয়ের অপেক্ষায় রয়েছে',
      },
    ],
    history: [
      {
        id: 'HIST-01',
        tool: 'education',
        toolLabelBn: 'শিক্ষা AI',
        title: 'দ্বিঘাত সমীকরণ সমাধান (x² - 5x + 6 = 0)',
        prompt: 'x² - 5x + 6 = 0 সমীকরণটি ধাপে ধাপে সমাধান করো।',
        response:
          '### ধাপ ১: সমীকরণটি লেখা\nপ্রদত্ত দ্বিঘাত সমীকরণ: **x² - 5x + 6 = 0**\n\n### ধাপ ২: মধ্যপদ বিশ্লেষণ (Middle-term Factoring)\nএখানে ৬-কে এমন দুটি সংখ্যায় ভাঙতে হবে যাদের গুণফল +৬ এবং যোগফল -৫ হয়। সংখ্যা দুটি হলো -২ এবং -৩।\n\nx² - 2x - 3x + 6 = 0\n\n### ধাপ ৩: কমন নেওয়া\nx(x - 2) - 3(x - 2) = 0\n(x - 2)(x - 3) = 0\n\n### ধাপ ৪: সমাধান\n- x - 2 = 0 ⇒ **x = 2**\n- x - 3 = 0 ⇒ **x = 3**\n\n**চূড়ান্ত উত্তর:** x = 2 অথবা x = 3।',
        createdAt: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
      },
      {
        id: 'HIST-02',
        tool: 'jobs',
        toolLabelBn: 'বিদেশে চাকরি',
        title: 'সংযুক্ত আরব আমিরাত (UAE) ইলেকট্রিশিয়ান ভিসা গাইড',
        prompt: 'দুবাইতে দক্ষ ইলেকট্রিশিয়ান কাজের যোগ্যতা ও আবেদন প্রক্রিয়া কী?',
        response:
          'দুবাই ও UAE-তে দক্ষ ইলেকট্রিশিয়ানদের চাহিদা নিয়মিত থাকে। অনুমোদিত রিক্রুটিং এজেন্সি ও BMET নিবন্ধনের মাধ্যমে আবেদন করা নিরাপদ।\n\n- **যোগ্যতা:** ট্রেড কোর্স সার্টিফিকেট, ন্যূনতম ২ বছরের বাস্তব অভিজ্ঞতা ও ইংরেজিতে মৌলিক যোগাযোগ দক্ষতা।\n- **সতর্কতা:** দালালদের হাতে পাসপোর্ট বা নগদ টাকা দেওয়ার আগে BMET ও দূতাবাসের ওয়েবসাইটে ভিসা যাচাই করুন।',
        sources: [
          { title: 'BMET - Bureau of Manpower, Employment and Training', uri: 'https://bmet.gov.bd/' },
          { title: 'MOHRE UAE Official Portal', uri: 'https://www.mohre.gov.ae/' },
        ],
        createdAt: new Date(Date.now() - 1000 * 60 * 360).toISOString(),
      },
    ],
    conversations: [
      {
        id: 'CONV-WELCOME',
        title: 'বহুভাষিক সাথী AI পরিচিতি',
        language: 'bn',
        pinned: false,
        createdAt: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
        updatedAt: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
        messages: [
          {
            id: 'MSG-01',
            role: 'user',
            text: 'তুমি কী কী ভাষায় সাহায্য করতে পারো এবং ছবি বা ভয়েস দিয়ে প্রশ্ন করা যাবে কি?',
            language: 'bn',
            createdAt: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
          },
          {
            id: 'MSG-02',
            role: 'assistant',
            text: 'আমি বাংলা, ইংরেজি, হিন্দি, আরবি, উর্দুসহ ২১টির বেশি ভাষায় সহায়তা করতে পারি। আপনি মাইক্রোফোন বাটনে চাপ দিয়ে ভয়েসে প্রশ্ন করতে পারেন, উত্তর কণ্ঠে শুনতে পারেন এবং যেকোনো ছবি আপলোড করে তা বিশ্লেষণ বা ব্যাখ্যা পেতে পারেন।',
            language: 'bn',
            modelUsed: 'gemini-2.5-flash',
            createdAt: new Date(Date.now() - 1000 * 60 * 89).toISOString(),
          },
        ],
      },
    ],
    ads: {
      networkMode: 'admob_ready',
      admobConfig: createDefaultAdMobConfig(),
      realAdSenseV3Applied: true,
      banner: {
        enabled: true,
        title: 'সাথী প্রো আনলক করুন — মাত্র ৳২০০/মাস',
        subtitle: 'বিজ্ঞাপনমুক্ত অভিজ্ঞতা ও দৈনিক ২০০টি এআই কুয়েরি',
        ctaText: 'প্ল্যান দেখুন',
        targetPage: 'subscription',
        sponsorLabel: 'স্পন্সরড বার্তা',
      },
      interstitial: {
        enabled: true,
        maxPerSession: 2,
        title: 'বিদেশি চাকরির প্রস্তুতি ও সিভি গাইড',
        description: 'বিনা বাধায় দ্রুত এআই সমাধান ও প্রিমিয়াম টুলস ব্যবহার করতে সাথী প্রো প্ল্যানে আপগ্রেড করতে পারেন।',
        ctaText: 'সাবস্ক্রিপশন দেখুন',
        targetPage: 'subscription',
      },
      stats: {
        bannerImpressions: 0,
        interstitialImpressions: 0,
        clicks: 0,
      },
    },
    appSettings: createDefaultAppSettings(),
    apiLogs: [],
    adminLogs: [],
    aiModel: resolveInitialModel(),
    totalRequests: 14,
    activeUsers: 1,
  };
};

let cachedDb: PersistedDatabase | null = null;

function ensurePrimaryUserInList(db: PersistedDatabase): RegisteredUserRecord {
  if (!Array.isArray(db.users)) {
    db.users = [];
  }
  let primary = db.users.find((u) => u.id === db.user.id);
  const nowIso = new Date().toISOString();
  if (!primary) {
    primary = {
      id: db.user.id,
      name: db.user.name,
      phone: db.user.phone,
      email: db.user.email,
      location: db.user.location,
      status: 'active',
      role: 'user',
      subscription: { ...db.subscription },
      quota: { ...db.quota },
      totalRequests: db.quota.monthlyUsed,
      createdAt: nowIso,
      lastActiveAt: nowIso,
    };
    db.users.unshift(primary);
  } else {
    primary.name = db.user.name;
    primary.phone = db.user.phone;
    primary.email = db.user.email;
    primary.location = db.user.location;
    primary.subscription = { ...db.subscription };
    primary.quota = { ...db.quota };
  }
  return primary;
}

function expireSubscriptionsIfNeeded(db: PersistedDatabase): boolean {
  let changed = false;
  const freePlan = (db.plans ?? createDefaultPlans()).find((p) => p.id === 'free');
  const defaultFreeDaily = freePlan?.dailyLimit ?? 12;
  const defaultFreeMonthly = freePlan?.monthlyLimit ?? 150;

  if (
    db.subscription.isPaid &&
    db.subscription.expiresAt &&
    new Date(db.subscription.expiresAt).getTime() < Date.now()
  ) {
    db.subscription = {
      planId: 'free',
      planNameBn: 'ফ্রি স্টার্টার প্ল্যান (মেয়াদোত্তীর্ণ)',
      status: 'expired',
      isPaid: false,
      priceBdt: 0,
      activatedAt: null,
      expiresAt: db.subscription.expiresAt,
    };
    db.quota.dailyLimit = defaultFreeDaily;
    db.quota.monthlyLimit = defaultFreeMonthly;
    changed = true;
  }

  for (const userRec of db.users ?? []) {
    if (
      userRec.subscription.isPaid &&
      userRec.subscription.expiresAt &&
      new Date(userRec.subscription.expiresAt).getTime() < Date.now()
    ) {
      userRec.subscription = {
        planId: 'free',
        planNameBn: 'ফ্রি স্টার্টার প্ল্যান (মেয়াদোত্তীর্ণ)',
        status: 'expired',
        isPaid: false,
        priceBdt: 0,
        activatedAt: null,
        expiresAt: userRec.subscription.expiresAt,
      };
      userRec.quota.dailyLimit = defaultFreeDaily;
      userRec.quota.monthlyLimit = defaultFreeMonthly;
      changed = true;
    }
  }

  return changed;
}

function ensureDbLoaded(): PersistedDatabase {
  let dirty = false;
  if (!cachedDb) {
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        cachedDb = JSON.parse(raw) as PersistedDatabase;
      } else {
        cachedDb = createDefaultDb();
        dirty = true;
      }
    } catch {
      cachedDb = createDefaultDb();
      dirty = true;
    }
  }

  // Ensure new fields exist on upgraded databases without losing existing data
  if (!Array.isArray(cachedDb.plans) || cachedDb.plans.length === 0) {
    cachedDb.plans = createDefaultPlans();
    dirty = true;
  } else {
    // Ensure all 4 required plan IDs exist
    const defaults = createDefaultPlans();
    for (const defPlan of defaults) {
      if (!cachedDb.plans.some((p) => p.id === defPlan.id)) {
        cachedDb.plans.push(defPlan);
        dirty = true;
      }
    }
  }

  if (!cachedDb.appSettings) {
    cachedDb.appSettings = createDefaultAppSettings();
    dirty = true;
  } else {
    if (!cachedDb.appSettings.paymentConfig) {
      cachedDb.appSettings.paymentConfig = createDefaultPaymentConfig();
      dirty = true;
    }
    if (!cachedDb.appSettings.aiFeatures) {
      cachedDb.appSettings.aiFeatures = createDefaultAiFeatures();
      dirty = true;
    }
    if (!cachedDb.appSettings.v2DefaultsApplied) {
      cachedDb.appSettings.defaultLanguage = 'en';
      cachedDb.appSettings.paymentConfig = createDefaultPaymentConfig();
      cachedDb.appSettings.aiFeatures = createDefaultAiFeatures();
      cachedDb.appSettings.v2DefaultsApplied = true;
      cachedDb.user.preferredLanguage = 'en';
      dirty = true;
    }
  }

  if (!cachedDb.ads.admobConfig) {
    cachedDb.ads.admobConfig = createDefaultAdMobConfig();
    cachedDb.ads.networkMode = 'admob_ready';
    cachedDb.ads.realAdSenseV3Applied = true;
    dirty = true;
  } else if (!cachedDb.ads.realAdSenseV3Applied) {
    cachedDb.ads.admobConfig = {
      ...cachedDb.ads.admobConfig,
      providerMode: 'live_admob',
      testMode: false,
      adsenseClientId: REAL_ADSENSE_PUBLISHER_ID,
    };
    cachedDb.ads.networkMode = 'admob_ready';
    cachedDb.ads.realAdSenseV3Applied = true;
    dirty = true;
  }

  if (!Array.isArray(cachedDb.apiLogs)) {
    cachedDb.apiLogs = [];
    dirty = true;
  }

  if (!Array.isArray(cachedDb.adminLogs)) {
    cachedDb.adminLogs = [];
    dirty = true;
  }

  if (!Array.isArray(cachedDb.users) || cachedDb.users.length === 0) {
    ensurePrimaryUserInList(cachedDb);
    dirty = true;
  }

  // Daily quota reset across primary user and registered user records
  const today = todayIsoDate();
  if (cachedDb.quota.lastResetDate !== today) {
    cachedDb.quota.usedToday = 0;
    cachedDb.quota.lastResetDate = today;
    dirty = true;
  }
  for (const userRec of cachedDb.users ?? []) {
    if (userRec.quota.lastResetDate !== today) {
      userRec.quota.usedToday = 0;
      userRec.quota.lastResetDate = today;
      dirty = true;
    }
  }

  if (expireSubscriptionsIfNeeded(cachedDb)) {
    dirty = true;
  }

  if (!VALID_LANGUAGE_CHECK(cachedDb.user.preferredLanguage)) {
    cachedDb.user.preferredLanguage = normalizeLanguageCode(cachedDb.user.preferredLanguage);
    dirty = true;
  }

  if (!Array.isArray(cachedDb.conversations)) {
    cachedDb.conversations = createDefaultDb().conversations ?? [];
    dirty = true;
  }

  if (!cachedDb.aiModel || !VALID_MODEL_IDS.has(cachedDb.aiModel)) {
    cachedDb.aiModel = resolveInitialModel();
    dirty = true;
  }

  ensurePrimaryUserInList(cachedDb);

  if (dirty) {
    saveDb(cachedDb);
  }

  return cachedDb;
}

function VALID_LANGUAGE_CHECK(code: string | undefined): code is ResponseLanguageCode {
  return Boolean(code && normalizeLanguageCode(code) === code);
}

function saveDb(db: PersistedDatabase): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to persist store:', err);
  }
}

export function isValidGeminiModelId(modelId: string | undefined): modelId is GeminiModelId {
  return Boolean(modelId && VALID_MODEL_IDS.has(modelId));
}

export function getActiveAiModel(): GeminiModelId {
  const db = ensureDbLoaded();
  if (db.aiModel && VALID_MODEL_IDS.has(db.aiModel)) {
    return db.aiModel;
  }
  return resolveInitialModel();
}

export function updateActiveAiModel(modelId: string): GeminiModelId | null {
  if (!VALID_MODEL_IDS.has(modelId)) {
    return null;
  }
  const db = ensureDbLoaded();
  db.aiModel = modelId as GeminiModelId;
  saveDb(db);
  return db.aiModel;
}

export function getAppSettings(): AppSettingsConfig {
  const db = ensureDbLoaded();
  const base = createDefaultAppSettings();
  const existing = db.appSettings ?? base;
  return {
    ...base,
    ...existing,
    paymentConfig: { ...base.paymentConfig, ...(existing.paymentConfig ?? {}) },
    aiFeatures: { ...base.aiFeatures, ...(existing.aiFeatures ?? {}) },
  };
}

export function getPlans(): SubscriptionPlanConfig[] {
  const db = ensureDbLoaded();
  return db.plans ?? createDefaultPlans();
}

function computeRealOverview(db: PersistedDatabase) {
  const users = db.users ?? [];
  const totalUsers = users.length;
  const activeUsers = users.filter((u) => u.status === 'active').length;
  const suspendedUsers = users.filter((u) => u.status === 'suspended').length;
  const proUsers = users.filter((u) => u.subscription.isPaid && u.subscription.status === 'active').length;
  const freeUsers = Math.max(0, totalUsers - proUsers);

  const today = todayIsoDate();
  const currentMonthPrefix = today.slice(0, 7); // YYYY-MM
  const logs = db.apiLogs ?? [];

  const dailyFromLogs = logs.filter((l) => l.createdAt.startsWith(today)).length;
  const monthlyFromLogs = logs.filter((l) => l.createdAt.startsWith(currentMonthPrefix)).length;
  const dailyAiRequests = Math.max(
    dailyFromLogs,
    users.reduce((sum, u) => sum + u.quota.usedToday, 0)
  );
  const monthlyAiRequests = Math.max(
    monthlyFromLogs,
    users.reduce((sum, u) => sum + u.quota.monthlyUsed, 0)
  );

  const rateLimit429Count = logs.filter((l) => l.status === 'rate_limit_429').length;
  const quotaExhausted429Count = logs.filter((l) => l.status === 'quota_429').length;
  const error429Count = rateLimit429Count + quotaExhausted429Count;
  const totalApiErrors = logs.filter((l) => l.status !== 'success').length;
  const cacheHitCount = logs.filter((l) => l.cached).length;

  const pendingPaymentsCount = db.payments.filter((p) => p.status === 'pending').length;
  const verifiedRevenueBdt = db.payments
    .filter((p) => p.status === 'verified')
    .reduce((sum, p) => sum + p.amountBdt, 0);

  return {
    totalUsers,
    activeUsers,
    suspendedUsers,
    freeUsers,
    proUsers,
    dailyAiRequests,
    monthlyAiRequests,
    totalAiRequests: Math.max(db.totalRequests, monthlyAiRequests),
    error429Count,
    rateLimit429Count,
    quotaExhausted429Count,
    totalApiErrors,
    cacheHitCount,
    pendingPaymentsCount,
    verifiedRevenueBdt,
  };
}

export function getFullState(): AppStateResponse {
  const db = ensureDbLoaded();
  const primaryUser = ensurePrimaryUserInList(db);
  const overview = computeRealOverview(db);
  const userPayments = db.payments.filter((p) => p.userId === db.user.id);

  return {
    user: db.user,
    accountStatus: primaryUser.status,
    subscription: db.subscription,
    quota: db.quota,
    plans: db.plans ?? createDefaultPlans(),
    payments: userPayments,
    history: db.history,
    conversations: sortConversations(db.conversations ?? []),
    ads: db.ads,
    appSettings: getAppSettings(),
    integrations: {
      geminiConnected: Boolean(process.env.GEMINI_API_KEY),
      geminiModel: getActiveAiModel(),
      availableModels: AVAILABLE_GEMINI_MODELS,
      searchGroundingReady: Boolean(process.env.GEMINI_API_KEY),
      imageGenReady: Boolean(process.env.GEMINI_API_KEY),
      videoGenReady: Boolean(process.env.GEMINI_API_KEY),
      videoApiConnected: Boolean(process.env.GEMINI_API_KEY || process.env.VIDEO_API_KEY),
      videoApiLabel: process.env.GEMINI_API_KEY
        ? 'Flow AI Video (Gemini Omni) + Storyboard'
        : 'ডিমো স্টোরিবোর্ড মোড (Veo / Video API প্রস্তুত)',
      photoCloudApiConnected: Boolean(process.env.GEMINI_API_KEY || process.env.PHOTO_CLOUD_API_KEY),
      photoCloudApiLabel: 'Gemini AI Image Studio + Local Canvas Engine',
    },
    analytics: {
      totalRequests: overview.totalAiRequests,
      activeUsers: overview.activeUsers,
      pendingPaymentsCount: userPayments.filter((p) => p.status === 'pending').length,
      verifiedRevenueBdt: overview.verifiedRevenueBdt,
    },
  };
}

export function getAdminDashboardData(): AdminDashboardData {
  const db = ensureDbLoaded();
  const overview = computeRealOverview(db);
  const configStatus = getAdminConfigStatus();

  return {
    overview,
    users: db.users ?? [],
    plans: db.plans ?? createDefaultPlans(),
    payments: db.payments,
    apiLogs: db.apiLogs ?? [],
    adminLogs: db.adminLogs ?? [],
    ads: db.ads,
    appSettings: getAppSettings(),
    integrations: {
      geminiConnected: Boolean(process.env.GEMINI_API_KEY),
      geminiModel: getActiveAiModel(),
      availableModels: AVAILABLE_GEMINI_MODELS,
      searchGroundingReady: Boolean(process.env.GEMINI_API_KEY),
      imageGenReady: Boolean(process.env.GEMINI_API_KEY),
      videoGenReady: Boolean(process.env.GEMINI_API_KEY),
      videoApiConnected: Boolean(process.env.GEMINI_API_KEY || process.env.VIDEO_API_KEY),
      videoApiLabel: process.env.GEMINI_API_KEY
        ? 'Flow AI Video (Gemini Omni) + Storyboard'
        : 'ডিমো স্টোরিবোর্ড মোড (Veo / Video API প্রস্তুত)',
      photoCloudApiConnected: Boolean(process.env.GEMINI_API_KEY || process.env.PHOTO_CLOUD_API_KEY),
      photoCloudApiLabel: 'Gemini AI Image Studio + Local Canvas Engine',
    },
    quota: db.quota,
    adminConfig: {
      configured: configStatus.configured,
      missingVars: configStatus.missingVars,
      adminEmail: configStatus.adminEmail,
    },
  };
}

export function checkQuotaAvailable(): {
  ok: boolean;
  status?: number;
  errorCode?: 'quota_exhausted' | 'overloaded' | 'auth';
  message?: string;
  quota: QuotaState;
} {
  const db = ensureDbLoaded();
  const settings = getAppSettings();
  const primary = ensurePrimaryUserInList(db);

  if (settings.maintenanceMode.enabled) {
    return {
      ok: false,
      status: 503,
      errorCode: 'overloaded',
      message:
        settings.maintenanceMode.messageBn ||
        'সিস্টেমে রক্ষণাবেক্ষণ চলছে। কিছুক্ষণ পর আবার চেষ্টা করুন।',
      quota: db.quota,
    };
  }

  if (!settings.aiSettings.enabled) {
    return {
      ok: false,
      status: 503,
      errorCode: 'overloaded',
      message: 'অ্যাডমিন কর্তৃক এআই সেবা সাময়িকভাবে বন্ধ রাখা হয়েছে।',
      quota: db.quota,
    };
  }

  if (primary.status === 'suspended') {
    return {
      ok: false,
      status: 403,
      errorCode: 'auth',
      message: 'আপনার অ্যাকাউন্টটি সাময়িকভাবে স্থগিত করা হয়েছে। সহায়তার জন্য অ্যাডমিনের সাথে যোগাযোগ করুন।',
      quota: db.quota,
    };
  }

  if (db.quota.usedToday >= db.quota.dailyLimit) {
    return {
      ok: false,
      status: 429,
      errorCode: 'quota_exhausted',
      message:
        'আপনার আজকের ফ্রি/দৈনিক ব্যবহারের কোটা শেষ হয়েছে। নিরবচ্ছিন্ন ব্যবহারের জন্য সাবস্ক্রিপশন প্ল্যান দেখুন অথবা আগামীকাল চেষ্টা করুন।',
      quota: db.quota,
    };
  }
  if (db.quota.monthlyUsed >= db.quota.monthlyLimit) {
    return {
      ok: false,
      status: 429,
      errorCode: 'quota_exhausted',
      message: 'আপনার মাসিক কোটা পূর্ণ হয়েছে। প্রো প্ল্যানে আপগ্রেড করে কোটা বাড়িয়ে নিন।',
      quota: db.quota,
    };
  }
  return { ok: true, quota: db.quota };
}

export function checkFeatureAvailable(feature: keyof AiFeatureFlags): {
  ok: boolean;
  status?: number;
  errorCode?: 'quota_exhausted' | 'overloaded' | 'auth';
  message?: string;
  quota: QuotaState;
} {
  const settings = getAppSettings();
  const base = checkQuotaAvailable();
  if (!base.ok) return base;

  if (!settings.aiFeatures[feature]) {
    const labels: Record<keyof AiFeatureFlags, string> = {
      educationEnabled: 'Education Mode / শিক্ষা AI',
      generalChatEnabled: 'General Chat Mode / সাধারণ চ্যাট',
      imageGenerationEnabled: 'Image Generation / ছবি তৈরি',
      videoGenerationEnabled: 'Video Generation / ভিডিও তৈরি',
    };
    return {
      ok: false,
      status: 403,
      errorCode: 'auth',
      message: `${labels[feature]} অ্যাডমিন কর্তৃক সাময়িকভাবে বন্ধ রাখা হয়েছে। (Disabled by Admin)`,
      quota: base.quota,
    };
  }

  return base;
}

export function consumeQuota(): QuotaState {
  const db = ensureDbLoaded();
  db.quota.usedToday += 1;
  db.quota.monthlyUsed += 1;
  db.totalRequests += 1;

  const primary = ensurePrimaryUserInList(db);
  primary.quota = { ...db.quota };
  primary.totalRequests += 1;
  primary.lastActiveAt = new Date().toISOString();

  saveDb(db);
  return db.quota;
}

export function checkAndConsumeQuota(): { ok: boolean; message?: string; quota: QuotaState } {
  const check = checkQuotaAvailable();
  if (!check.ok) return check;
  return { ok: true, quota: consumeQuota() };
}

export function recordApiLog(input: Omit<ApiLogEntry, 'id' | 'createdAt' | 'userId'> & { userId?: string }): void {
  const db = ensureDbLoaded();
  const entry: ApiLogEntry = {
    id: `LOG-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`,
    endpoint: input.endpoint,
    tool: input.tool,
    model: input.model,
    language: input.language,
    status: input.status,
    httpStatus: input.httpStatus,
    latencyMs: Math.max(0, Math.round(input.latencyMs)),
    cached: Boolean(input.cached),
    errorCode: input.errorCode,
    errorMessage: input.errorMessage?.slice(0, 260),
    userId: input.userId || db.user.id,
    createdAt: new Date().toISOString(),
  };
  db.apiLogs = [entry, ...(db.apiLogs ?? [])].slice(0, 250);
  saveDb(db);
}

export function clearApiLogs(): ApiLogEntry[] {
  const db = ensureDbLoaded();
  db.apiLogs = [];
  saveDb(db);
  return [];
}

export function recordAdminLog(
  action: string,
  summaryBn: string,
  actorEmail: string,
  ip = 'server'
): AdminActivityLog {
  const db = ensureDbLoaded();
  const entry: AdminActivityLog = {
    id: `ADM-${Date.now().toString(36).toUpperCase()}`,
    action,
    summaryBn,
    actorEmail,
    ip,
    createdAt: new Date().toISOString(),
  };
  db.adminLogs = [entry, ...(db.adminLogs ?? [])].slice(0, 200);
  saveDb(db);
  return entry;
}

export function addHistoryItem(item: Omit<HistoryItem, 'id' | 'createdAt'>): HistoryItem {
  const db = ensureDbLoaded();
  const entry: HistoryItem = {
    ...item,
    id: `HIST-${Date.now().toString(36).toUpperCase()}`,
    createdAt: new Date().toISOString(),
  };
  db.history = [entry, ...db.history].slice(0, 60);
  saveDb(db);
  return entry;
}

export function deleteHistoryItem(id: string): HistoryItem[] {
  const db = ensureDbLoaded();
  db.history = db.history.filter((h) => h.id !== id);
  saveDb(db);
  return db.history;
}

export function clearHistoryItems(): HistoryItem[] {
  const db = ensureDbLoaded();
  db.history = [];
  saveDb(db);
  return db.history;
}

function sortConversations(list: ChatConversation[]): ChatConversation[] {
  return [...list].sort((a, b) => {
    if (Boolean(a.pinned) !== Boolean(b.pinned)) {
      return a.pinned ? -1 : 1;
    }
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });
}

export function getConversations(): ChatConversation[] {
  const db = ensureDbLoaded();
  return sortConversations(db.conversations ?? []);
}

export function getConversationById(id: string): ChatConversation | undefined {
  const db = ensureDbLoaded();
  return (db.conversations ?? []).find((c) => c.id === id);
}

export function createConversation(
  title?: string,
  language: ResponseLanguageCode = 'bn'
): ChatConversation {
  const db = ensureDbLoaded();
  const now = new Date().toISOString();
  const conv: ChatConversation = {
    id: `CONV-${Date.now().toString(36).toUpperCase()}`,
    title: title?.trim() || 'নতুন কথোপকথন',
    language: normalizeLanguageCode(language),
    pinned: false,
    messages: [],
    createdAt: now,
    updatedAt: now,
  };
  db.conversations = sortConversations([conv, ...(db.conversations ?? [])]).slice(0, 40);
  saveDb(db);
  return conv;
}

export function appendConversationTurn(input: {
  conversationId?: string;
  userText: string;
  assistantText: string;
  imageDataUrl?: string;
  language: ResponseLanguageCode;
  modelUsed?: string;
  cached?: boolean;
}): { conversation: ChatConversation; conversations: ChatConversation[] } {
  const db = ensureDbLoaded();
  const now = new Date().toISOString();
  const list = db.conversations ?? [];
  let conv = input.conversationId ? list.find((c) => c.id === input.conversationId) : undefined;

  if (!conv) {
    const derivedTitle =
      input.userText.trim().slice(0, 48) || (input.imageDataUrl ? 'ছবি বিশ্লেষণ' : 'নতুন কথোপকথন');
    conv = {
      id: `CONV-${Date.now().toString(36).toUpperCase()}`,
      title: derivedTitle,
      language: normalizeLanguageCode(input.language),
      pinned: false,
      messages: [],
      createdAt: now,
      updatedAt: now,
    };
    list.unshift(conv);
  } else if (conv.messages.length === 0 || conv.title === 'নতুন কথোপকথন') {
    conv.title =
      input.userText.trim().slice(0, 48) || (input.imageDataUrl ? 'ছবি বিশ্লেষণ' : conv.title);
  }

  const safeImagePreview =
    input.imageDataUrl && input.imageDataUrl.length < 260_000 ? input.imageDataUrl : undefined;

  const userMsg: ChatMessage = {
    id: `MSG-${Date.now().toString(36).toUpperCase()}-U`,
    role: 'user',
    text: input.userText,
    imageDataUrl: safeImagePreview,
    language: input.language,
    createdAt: now,
  };

  const assistantMsg: ChatMessage = {
    id: `MSG-${(Date.now() + 1).toString(36).toUpperCase()}-A`,
    role: 'assistant',
    text: input.assistantText,
    language: input.language,
    modelUsed: input.modelUsed,
    cached: input.cached,
    createdAt: new Date(Date.now() + 1).toISOString(),
  };

  conv.messages = [...conv.messages, userMsg, assistantMsg].slice(-60);
  conv.language = normalizeLanguageCode(input.language);
  conv.updatedAt = new Date().toISOString();

  db.conversations = sortConversations(list).slice(0, 40);
  saveDb(db);
  return { conversation: conv, conversations: db.conversations };
}

export function updateConversationMeta(
  id: string,
  patch: { title?: string; pinned?: boolean; language?: ResponseLanguageCode }
): ChatConversation[] | null {
  const db = ensureDbLoaded();
  const list = db.conversations ?? [];
  const conv = list.find((c) => c.id === id);
  if (!conv) return null;

  if (typeof patch.title === 'string' && patch.title.trim()) {
    conv.title = patch.title.trim().slice(0, 80);
  }
  if (typeof patch.pinned === 'boolean') {
    conv.pinned = patch.pinned;
  }
  if (patch.language) {
    conv.language = normalizeLanguageCode(patch.language);
  }
  conv.updatedAt = new Date().toISOString();

  db.conversations = sortConversations(list);
  saveDb(db);
  return db.conversations;
}

export function deleteConversationById(id: string): ChatConversation[] {
  const db = ensureDbLoaded();
  db.conversations = sortConversations((db.conversations ?? []).filter((c) => c.id !== id));
  saveDb(db);
  return db.conversations;
}

export function clearAllConversations(): ChatConversation[] {
  const db = ensureDbLoaded();
  db.conversations = [];
  saveDb(db);
  return db.conversations;
}

export function updateProfile(patch: Partial<UserProfile>): UserProfile {
  const db = ensureDbLoaded();
  db.user = {
    ...db.user,
    name: patch.name?.trim() || db.user.name,
    phone: patch.phone?.trim() || db.user.phone,
    email: patch.email?.trim() || db.user.email,
    location: patch.location?.trim() || db.user.location,
    preferredLanguage: patch.preferredLanguage
      ? normalizeLanguageCode(patch.preferredLanguage)
      : db.user.preferredLanguage,
    theme: patch.theme === 'dark' || patch.theme === 'light' ? patch.theme : db.user.theme,
  };
  ensurePrimaryUserInList(db);
  saveDb(db);
  return db.user;
}

export function submitPaymentRequest(input: {
  planId: '1_month' | '3_months';
  method: PaymentMethod;
  senderNumber: string;
  transactionId: string;
}): PaymentRequest {
  const db = ensureDbLoaded();
  const planConfig = (db.plans ?? createDefaultPlans()).find((p) => p.id === input.planId);
  const amountBdt = planConfig?.priceBdt ?? (input.planId === '3_months' ? 500 : 200);
  const planLabel =
    planConfig?.nameBn ??
    (input.planId === '3_months' ? '৩ মাস প্রো প্ল্যান (৳৫০০)' : '১ মাস প্রো প্ল্যান (৳২০০)');

  // IMPORTANT: Subscription is NOT activated on submission. Must be verified by Admin first.
  const payment: PaymentRequest = {
    id: `PAY-${Math.floor(1000 + Math.random() * 9000)}`,
    userId: db.user.id,
    userName: db.user.name,
    planId: input.planId,
    planLabel,
    amountBdt,
    method: input.method,
    senderNumber: input.senderNumber.trim(),
    transactionId: input.transactionId.trim().toUpperCase(),
    status: 'pending',
    submittedAt: new Date().toISOString(),
    reviewedAt: null,
    reviewNote: 'পেমেন্ট যাচাইয়ের অপেক্ষায় রয়েছে (যাচাই ছাড়া সাবস্ক্রিপশন সক্রিয় হবে না)',
  };

  db.payments = [payment, ...db.payments];
  saveDb(db);
  return payment;
}

export function verifyPaymentAndActivate(paymentId: string): {
  payment: PaymentRequest;
  subscription: SubscriptionState;
  quota: QuotaState;
} | null {
  const db = ensureDbLoaded();
  const payment = db.payments.find((p) => p.id === paymentId);
  if (!payment) return null;

  payment.status = 'verified';
  payment.reviewedAt = new Date().toISOString();
  payment.reviewNote = 'পেমেন্ট সফলভাবে যাচাই ও সাবস্ক্রিপশন সক্রিয় করা হয়েছে';

  const planConfig = (db.plans ?? createDefaultPlans()).find((p) => p.id === payment.planId);
  const days = planConfig?.durationDays || (payment.planId === '3_months' ? 90 : 30);
  const now = new Date();
  const expires = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

  const newSub: SubscriptionState = {
    planId: payment.planId as SubscriptionPlanId,
    planNameBn:
      planConfig?.nameBn || (payment.planId === '3_months' ? 'সাথী প্রো (৩ মাস)' : 'সাথী প্রো (১ মাস)'),
    status: 'active',
    isPaid: true,
    priceBdt: payment.amountBdt,
    activatedAt: now.toISOString(),
    expiresAt: expires.toISOString(),
  };

  const dailyLimit = planConfig?.dailyLimit ?? 200;
  const monthlyLimit = planConfig?.monthlyLimit ?? (payment.planId === '3_months' ? 6000 : 2500);

  // Apply to target user record & primary user if matched
  const targetUser = (db.users ?? []).find((u) => u.id === payment.userId);
  if (targetUser) {
    targetUser.subscription = { ...newSub };
    targetUser.quota.dailyLimit = dailyLimit;
    targetUser.quota.monthlyLimit = monthlyLimit;
  }

  if (payment.userId === db.user.id) {
    db.subscription = { ...newSub };
    db.quota.dailyLimit = dailyLimit;
    db.quota.monthlyLimit = monthlyLimit;
  }

  saveDb(db);

  return { payment, subscription: db.subscription, quota: db.quota };
}

export function rejectPaymentRequest(paymentId: string, reason?: string): PaymentRequest | null {
  const db = ensureDbLoaded();
  const payment = db.payments.find((p) => p.id === paymentId);
  if (!payment) return null;

  payment.status = 'rejected';
  payment.reviewedAt = new Date().toISOString();
  payment.reviewNote = reason?.trim() || 'ট্রানজেকশন আইডি মেলেনি — সঠিক TrxID দিয়ে আবার চেষ্টা করুন';
  saveDb(db);
  return payment;
}

export function adminCreateUser(input: {
  name: string;
  email: string;
  phone?: string;
  location?: string;
  planId?: SubscriptionPlanId;
}): RegisteredUserRecord {
  const db = ensureDbLoaded();
  const nowIso = new Date().toISOString();
  const planId = input.planId ?? 'free';
  const planConfig = (db.plans ?? createDefaultPlans()).find((p) => p.id === planId) ?? createDefaultPlans()[0];
  const expiresAt =
    planConfig.isPaid && planConfig.durationDays > 0
      ? new Date(Date.now() + planConfig.durationDays * 24 * 60 * 60 * 1000).toISOString()
      : null;

  const newUser: RegisteredUserRecord = {
    id: `usr_${Date.now().toString(36)}`,
    name: input.name.trim(),
    email: input.email.trim().toLowerCase(),
    phone: input.phone?.trim() || 'প্রদান করা হয়নি',
    location: input.location?.trim() || 'বাংলাদেশ',
    status: 'active',
    role: 'user',
    subscription: {
      planId: planConfig.id,
      planNameBn: planConfig.nameBn,
      status: 'active',
      isPaid: planConfig.isPaid,
      priceBdt: planConfig.priceBdt,
      activatedAt: planConfig.isPaid ? nowIso : null,
      expiresAt,
    },
    quota: {
      usedToday: 0,
      dailyLimit: planConfig.dailyLimit,
      monthlyUsed: 0,
      monthlyLimit: planConfig.monthlyLimit,
      lastResetDate: todayIsoDate(),
    },
    totalRequests: 0,
    createdAt: nowIso,
    lastActiveAt: nowIso,
  };

  db.users = [...(db.users ?? []), newUser];
  saveDb(db);
  return newUser;
}

export function adminUpdateUserStatus(
  userId: string,
  status: UserAccountStatus
): RegisteredUserRecord | null {
  const db = ensureDbLoaded();
  const user = (db.users ?? []).find((u) => u.id === userId);
  if (!user) return null;
  user.status = status;
  saveDb(db);
  return user;
}

export function adminUpdateUserPlan(
  userId: string,
  planId: SubscriptionPlanId,
  customExpiresAt?: string | null
): RegisteredUserRecord | null {
  const db = ensureDbLoaded();
  const user = (db.users ?? []).find((u) => u.id === userId);
  if (!user) return null;
  const plan = (db.plans ?? createDefaultPlans()).find((p) => p.id === planId);
  if (!plan) return null;

  const nowIso = new Date().toISOString();
  let expiresAt: string | null = null;
  if (plan.isPaid) {
    if (customExpiresAt && !Number.isNaN(new Date(customExpiresAt).getTime())) {
      expiresAt = new Date(customExpiresAt).toISOString();
    } else if (plan.durationDays > 0) {
      expiresAt = new Date(Date.now() + plan.durationDays * 24 * 60 * 60 * 1000).toISOString();
    }
  }

  user.subscription = {
    planId: plan.id,
    planNameBn: plan.nameBn,
    status: 'active',
    isPaid: plan.isPaid,
    priceBdt: plan.priceBdt,
    activatedAt: plan.isPaid ? nowIso : null,
    expiresAt,
  };
  user.quota.dailyLimit = plan.dailyLimit;
  user.quota.monthlyLimit = plan.monthlyLimit;

  if (user.id === db.user.id) {
    db.subscription = { ...user.subscription };
    db.quota.dailyLimit = plan.dailyLimit;
    db.quota.monthlyLimit = plan.monthlyLimit;
  }

  saveDb(db);
  return user;
}

export function adminUpdateUserQuota(
  userId: string,
  input: { dailyLimit?: number; monthlyLimit?: number; resetUsage?: boolean }
): RegisteredUserRecord | null {
  const db = ensureDbLoaded();
  const user = (db.users ?? []).find((u) => u.id === userId);
  if (!user) return null;

  if (typeof input.dailyLimit === 'number' && Number.isFinite(input.dailyLimit)) {
    user.quota.dailyLimit = Math.max(1, Math.min(5000, Math.round(input.dailyLimit)));
  }
  if (typeof input.monthlyLimit === 'number' && Number.isFinite(input.monthlyLimit)) {
    user.quota.monthlyLimit = Math.max(1, Math.min(100000, Math.round(input.monthlyLimit)));
  }
  if (input.resetUsage) {
    user.quota.usedToday = 0;
  }

  if (user.id === db.user.id) {
    db.quota = { ...user.quota };
  }

  saveDb(db);
  return user;
}

export function adminUpdatePlanConfig(
  planId: SubscriptionPlanId,
  patch: Partial<SubscriptionPlanConfig>
): SubscriptionPlanConfig | null {
  const db = ensureDbLoaded();
  const plans = db.plans ?? createDefaultPlans();
  const plan = plans.find((p) => p.id === planId);
  if (!plan) return null;

  if (typeof patch.nameBn === 'string' && patch.nameBn.trim()) {
    plan.nameBn = patch.nameBn.trim();
  }
  if (typeof patch.descriptionBn === 'string' && patch.descriptionBn.trim()) {
    plan.descriptionBn = patch.descriptionBn.trim();
  }
  if (typeof patch.priceBdt === 'number' && Number.isFinite(patch.priceBdt)) {
    plan.priceBdt = Math.max(0, Math.round(patch.priceBdt));
  }
  if (typeof patch.durationDays === 'number' && Number.isFinite(patch.durationDays)) {
    plan.durationDays = Math.max(0, Math.min(3650, Math.round(patch.durationDays)));
  }
  if (typeof patch.dailyLimit === 'number' && Number.isFinite(patch.dailyLimit)) {
    plan.dailyLimit = Math.max(1, Math.min(5000, Math.round(patch.dailyLimit)));
  }
  if (typeof patch.monthlyLimit === 'number' && Number.isFinite(patch.monthlyLimit)) {
    plan.monthlyLimit = Math.max(10, Math.min(100000, Math.round(patch.monthlyLimit)));
  }
  if (typeof patch.enabled === 'boolean') {
    plan.enabled = patch.enabled;
  }

  // Sync current active users on this plan with updated limits
  for (const user of db.users ?? []) {
    if (user.subscription.planId === plan.id) {
      user.quota.dailyLimit = plan.dailyLimit;
      user.quota.monthlyLimit = plan.monthlyLimit;
      if (user.id === db.user.id) {
        db.quota.dailyLimit = plan.dailyLimit;
        db.quota.monthlyLimit = plan.monthlyLimit;
      }
    }
  }

  db.plans = plans;
  saveDb(db);
  return plan;
}

export function adminUpdateAppSettings(patch: {
  defaultLanguage?: 'bn' | 'en';
  paymentConfig?: Partial<PaymentConfig>;
  aiFeatures?: Partial<AiFeatureFlags>;
  announcement?: Partial<AppSettingsConfig['announcement']>;
  maintenanceMode?: Partial<AppSettingsConfig['maintenanceMode']>;
  aiSettings?: Partial<AppSettingsConfig['aiSettings']>;
}): AppSettingsConfig {
  const db = ensureDbLoaded();
  const current = getAppSettings();

  if (patch.defaultLanguage === 'bn' || patch.defaultLanguage === 'en') {
    current.defaultLanguage = patch.defaultLanguage;
  }
  if (patch.paymentConfig) {
    current.paymentConfig = {
      ...current.paymentConfig,
      ...patch.paymentConfig,
      bkashNumber: String(patch.paymentConfig.bkashNumber ?? current.paymentConfig.bkashNumber).trim(),
      nagadNumber: String(patch.paymentConfig.nagadNumber ?? current.paymentConfig.nagadNumber).trim(),
      rocketNumber: String(patch.paymentConfig.rocketNumber ?? current.paymentConfig.rocketNumber).trim(),
    };
  }
  if (patch.aiFeatures) {
    current.aiFeatures = {
      ...current.aiFeatures,
      ...patch.aiFeatures,
    };
  }
  if (patch.announcement) {
    current.announcement = {
      ...current.announcement,
      ...patch.announcement,
    };
  }
  if (patch.maintenanceMode) {
    current.maintenanceMode = {
      ...current.maintenanceMode,
      ...patch.maintenanceMode,
    };
  }
  if (patch.aiSettings) {
    current.aiSettings = {
      ...current.aiSettings,
      ...patch.aiSettings,
    };
  }

  current.v2DefaultsApplied = true;
  db.appSettings = current;
  saveDb(db);
  return current;
}

export function updateAdSystem(patch: Partial<AdSystemState>): AdSystemState {
  const db = ensureDbLoaded();
  if (patch.networkMode) {
    db.ads.networkMode = patch.networkMode;
  }
  if (patch.admobConfig) {
    const currentCfg = db.ads.admobConfig ?? createDefaultAdMobConfig();
    const nextMode =
      patch.admobConfig.providerMode === 'live_admob' ||
      patch.admobConfig.providerMode === 'demo_house' ||
      patch.admobConfig.providerMode === 'test_ad'
        ? patch.admobConfig.providerMode
        : currentCfg.providerMode;
    db.ads.admobConfig = {
      ...currentCfg,
      ...patch.admobConfig,
      providerMode: nextMode,
      testMode:
        typeof patch.admobConfig.testMode === 'boolean'
          ? patch.admobConfig.testMode
          : nextMode === 'test_ad',
      appId: String(patch.admobConfig.appId ?? currentCfg.appId).trim(),
      bannerUnitId: String(patch.admobConfig.bannerUnitId ?? currentCfg.bannerUnitId).trim(),
      entryInterstitialUnitId: String(
        patch.admobConfig.entryInterstitialUnitId ?? currentCfg.entryInterstitialUnitId
      ).trim(),
      studyInterstitialUnitId: String(
        patch.admobConfig.studyInterstitialUnitId ?? currentCfg.studyInterstitialUnitId
      ).trim(),
      adsenseClientId: String(
        patch.admobConfig.adsenseClientId ?? currentCfg.adsenseClientId
      ).trim(),
      adsenseBannerSlot: String(
        patch.admobConfig.adsenseBannerSlot ?? currentCfg.adsenseBannerSlot
      ).trim(),
      adsenseInterstitialSlot: String(
        patch.admobConfig.adsenseInterstitialSlot ?? currentCfg.adsenseInterstitialSlot
      ).trim(),
    };
    db.ads.networkMode = nextMode === 'demo_house' ? 'demo_house' : 'admob_ready';
    db.ads.realAdSenseV3Applied = true;
  }
  if (patch.banner) {
    db.ads.banner = { ...db.ads.banner, ...patch.banner };
  }
  if (patch.interstitial) {
    // Hard cap maximum 2 interstitial ads per session
    const cappedMax = Math.min(2, Math.max(0, Number(patch.interstitial.maxPerSession ?? db.ads.interstitial.maxPerSession)));
    db.ads.interstitial = {
      ...db.ads.interstitial,
      ...patch.interstitial,
      maxPerSession: cappedMax,
    };
  }
  saveDb(db);
  return db.ads;
}

export function trackAdEvent(event: 'banner_impression' | 'interstitial_impression' | 'click'): AdSystemState['stats'] {
  const db = ensureDbLoaded();
  if (event === 'banner_impression') db.ads.stats.bannerImpressions += 1;
  if (event === 'interstitial_impression') db.ads.stats.interstitialImpressions += 1;
  if (event === 'click') db.ads.stats.clicks += 1;
  saveDb(db);
  return db.ads.stats;
}

export function updateQuotaLimits(dailyLimit: number, monthlyLimit: number): QuotaState {
  const db = ensureDbLoaded();
  db.quota.dailyLimit = Math.max(1, Math.min(5000, Math.round(dailyLimit)));
  db.quota.monthlyLimit = Math.max(10, Math.min(100000, Math.round(monthlyLimit)));
  const primary = ensurePrimaryUserInList(db);
  primary.quota = { ...db.quota };
  saveDb(db);
  return db.quota;
}

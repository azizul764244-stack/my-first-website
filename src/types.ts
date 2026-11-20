export type AppPage =
  | 'home'
  | 'assistant'
  | 'tools'
  | 'education'
  | 'jobs'
  | 'health'
  | 'social'
  | 'video'
  | 'photo'
  | 'subscription'
  | 'history'
  | 'profile'
  | 'admin';

export type SubscriptionPlanId = 'free' | 'pro' | '1_month' | '3_months';

export type PaymentMethod = 'bKash' | 'Nagad' | 'Rocket' | 'Card';

export type PaymentStatus = 'pending' | 'verified' | 'rejected';

export type UserAccountStatus = 'active' | 'suspended';

export type ResponseLanguageCode =
  | 'auto'
  | 'bn'
  | 'en'
  | 'ar'
  | 'hi'
  | 'ur'
  | 'zh'
  | 'ja'
  | 'fr'
  | 'es'
  | 'de'
  | 'pt'
  | 'ru'
  | 'ko'
  | 'tr'
  | 'id'
  | 'ms'
  | 'it'
  | 'th'
  | 'vi'
  | 'ta'
  | 'ne';

export interface LanguageOption {
  code: ResponseLanguageCode;
  nativeName: string;
  bengaliName: string;
  englishName: string;
  rtl?: boolean;
}

export interface UserProfile {
  id: string;
  name: string;
  phone: string;
  email: string;
  avatarUrl: string;
  location: string;
  preferredLanguage: ResponseLanguageCode;
  theme: 'light' | 'dark';
}

export interface SubscriptionState {
  planId: SubscriptionPlanId;
  planNameBn: string;
  status: 'active' | 'expired';
  isPaid: boolean;
  priceBdt: number;
  activatedAt: string | null;
  expiresAt: string | null;
}

export interface QuotaState {
  usedToday: number;
  dailyLimit: number;
  monthlyUsed: number;
  monthlyLimit: number;
  lastResetDate: string;
}

export interface RegisteredUserRecord {
  id: string;
  name: string;
  phone: string;
  email: string;
  location: string;
  status: UserAccountStatus;
  role: 'user';
  subscription: SubscriptionState;
  quota: QuotaState;
  totalRequests: number;
  createdAt: string;
  lastActiveAt: string;
}

export interface SubscriptionPlanConfig {
  id: SubscriptionPlanId;
  nameBn: string;
  nameEn: string;
  priceBdt: number;
  durationDays: number;
  dailyLimit: number;
  monthlyLimit: number;
  isPaid: boolean;
  enabled: boolean;
  descriptionBn: string;
}

export interface ApiLogEntry {
  id: string;
  endpoint: string;
  tool: string;
  model: string;
  language: ResponseLanguageCode;
  status: 'success' | 'rate_limit_429' | 'quota_429' | 'error';
  httpStatus: number;
  latencyMs: number;
  cached: boolean;
  errorCode?: AiErrorCode;
  errorMessage?: string;
  userId: string;
  createdAt: string;
}

export interface AdminActivityLog {
  id: string;
  action: string;
  summaryBn: string;
  actorEmail: string;
  ip: string;
  createdAt: string;
}

export interface PaymentConfig {
  bkashEnabled: boolean;
  bkashNumber: string;
  nagadEnabled: boolean;
  nagadNumber: string;
  rocketEnabled: boolean;
  rocketNumber: string;
  cardEnabled: boolean;
  sendMoneyNoteEn: string;
  sendMoneyNoteBn: string;
}

export interface AiFeatureFlags {
  educationEnabled: boolean;
  generalChatEnabled: boolean;
  imageGenerationEnabled: boolean;
  videoGenerationEnabled: boolean;
}

export interface AppSettingsConfig {
  defaultLanguage: 'bn' | 'en';
  v2DefaultsApplied?: boolean;
  paymentConfig: PaymentConfig;
  aiFeatures: AiFeatureFlags;
  announcement: {
    enabled: boolean;
    title: string;
    message: string;
    type: 'info' | 'warning' | 'success';
  };
  maintenanceMode: {
    enabled: boolean;
    messageBn: string;
  };
  aiSettings: {
    enabled: boolean;
    cacheEnabled: boolean;
    allowUserModelSwitch: boolean;
    streamEnabled: boolean;
  };
}

export interface AdminSessionInfo {
  authenticated: boolean;
  role: 'admin' | 'user';
  email: string | null;
  configured: boolean;
  missingVars: string[];
}

export interface PaymentRequest {
  id: string;
  userId: string;
  userName: string;
  planId: '1_month' | '3_months';
  planLabel: string;
  amountBdt: number;
  method: PaymentMethod;
  senderNumber: string;
  transactionId: string;
  status: PaymentStatus;
  submittedAt: string;
  reviewedAt: string | null;
  reviewNote: string | null;
}

export interface HistoryItem {
  id: string;
  tool: 'education' | 'jobs' | 'health' | 'social' | 'video' | 'photo';
  toolLabelBn: string;
  title: string;
  prompt: string;
  response: string;
  sources?: { title: string; uri: string }[];
  createdAt: string;
}

export interface AdBannerConfig {
  enabled: boolean;
  title: string;
  subtitle: string;
  ctaText: string;
  targetPage: AppPage;
  sponsorLabel: string;
}

export interface AdInterstitialConfig {
  enabled: boolean;
  maxPerSession: number;
  title: string;
  description: string;
  ctaText: string;
  targetPage: AppPage;
}

export interface AdMobConfig {
  providerMode: 'test_ad' | 'live_admob' | 'demo_house';
  testMode: boolean;
  appId: string;
  bannerUnitId: string;
  entryInterstitialUnitId: string;
  studyInterstitialUnitId: string;
  adsenseClientId: string;
  adsenseBannerSlot: string;
  adsenseInterstitialSlot: string;
}

export interface AdSystemState {
  networkMode: 'demo_house' | 'admob_ready';
  admobConfig?: AdMobConfig;
  realAdSenseV3Applied?: boolean;
  banner: AdBannerConfig;
  interstitial: AdInterstitialConfig;
  stats: {
    bannerImpressions: number;
    interstitialImpressions: number;
    clicks: number;
  };
}

export type GeminiModelId =
  | 'gemini-4-hydrogen'
  | 'gemini-3.1-flash-lite'
  | 'gemini-4-argon'
  | 'gemini-4-neon'
  | 'gemini-4-carbon';

export type AiErrorCode =
  | 'rate_limit'
  | 'quota_exhausted'
  | 'overloaded'
  | 'auth'
  | 'not_found'
  | 'network'
  | 'unknown';

export interface AiErrorInfo {
  message: string;
  errorCode: AiErrorCode;
  retryable: boolean;
  retryAfterSec?: number;
}

export interface GeminiModelOption {
  id: GeminiModelId;
  labelBn: string;
  descriptionBn: string;
  tierNoteBn: string;
  isFreeTier: boolean;
}

export interface ApiIntegrationStatus {
  geminiConnected: boolean;
  geminiModel: GeminiModelId;
  availableModels: GeminiModelOption[];
  searchGroundingReady: boolean;
  imageGenReady?: boolean;
  videoGenReady?: boolean;
  videoApiConnected: boolean;
  videoApiLabel: string;
  photoCloudApiConnected: boolean;
  photoCloudApiLabel: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  imageDataUrl?: string;
  language?: ResponseLanguageCode;
  modelUsed?: string;
  cached?: boolean;
  createdAt: string;
}

export interface ChatConversation {
  id: string;
  title: string;
  language: ResponseLanguageCode;
  pinned?: boolean;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}

export interface AppStateResponse {
  user: UserProfile;
  accountStatus: UserAccountStatus;
  subscription: SubscriptionState;
  quota: QuotaState;
  plans: SubscriptionPlanConfig[];
  payments: PaymentRequest[];
  history: HistoryItem[];
  conversations: ChatConversation[];
  ads: AdSystemState;
  appSettings: AppSettingsConfig;
  integrations: ApiIntegrationStatus;
  analytics: {
    totalRequests: number;
    activeUsers: number;
    pendingPaymentsCount: number;
    verifiedRevenueBdt: number;
  };
}

export interface AdminDashboardData {
  overview: {
    totalUsers: number;
    activeUsers: number;
    suspendedUsers: number;
    freeUsers: number;
    proUsers: number;
    dailyAiRequests: number;
    monthlyAiRequests: number;
    totalAiRequests: number;
    error429Count: number;
    rateLimit429Count: number;
    quotaExhausted429Count: number;
    totalApiErrors: number;
    cacheHitCount: number;
    pendingPaymentsCount: number;
    verifiedRevenueBdt: number;
  };
  users: RegisteredUserRecord[];
  plans: SubscriptionPlanConfig[];
  payments: PaymentRequest[];
  apiLogs: ApiLogEntry[];
  adminLogs: AdminActivityLog[];
  ads: AdSystemState;
  appSettings: AppSettingsConfig;
  integrations: ApiIntegrationStatus;
  quota: QuotaState;
  adminConfig: {
    configured: boolean;
    missingVars: string[];
    adminEmail: string | null;
  };
}

export interface SocialContentResult {
  platform: string;
  ideas: { title: string; angle: string }[];
  titles: string[];
  script: {
    hook: string;
    body: string;
    cta: string;
  };
  caption: string;
  hashtags: string[];
  aiVideoPrompt: string;
}

export interface VideoStoryboardScene {
  sceneNumber: number;
  durationSec: number;
  visualBn: string;
  cameraMovement: string;
  captionBn: string;
  accentHex: string;
}

export interface VideoPromptResult {
  titleBn: string;
  englishPrompt: string;
  negativePrompt: string;
  styleNotesBn: string;
  aspectRatio: string;
  storyboard: VideoStoryboardScene[];
}

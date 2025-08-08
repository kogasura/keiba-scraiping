// ============================================
// スクレイピングサービス用型定義
// ============================================

import { RaceKey, RaceBasicInfo, PredictionData, AiPredictionData, IndexImageData, RaceResultData, ScrapingResult } from './domains';

// ============================================
// スクレイピングサービス基底インターフェース
// ============================================

export interface BaseScraper {
  init(): Promise<void>;
  login(): Promise<boolean>;
  close(): Promise<void>;
  isInitialized(): boolean;
}

// ============================================
// 予想データスクレイピング用インターフェース
// ============================================

export interface PredictionScraper extends BaseScraper {
  scrape(date: string, trackCode: string, raceKeys?: RaceKey[]): Promise<Record<string, any>>;
  getSupportedDataTypes(): string[];
  getConfig(): ScrapingConfig;
}

export interface ScrapingConfig {
  retryCount: number;
  timeout: number;
  delayBetweenRequests: number;
  enableLogging: boolean;
}

// ============================================
// 各種スクレイピング結果型
// ============================================

// Netkeiba内部データ型
export interface NetkeibaRaceInfo {
  netkeiba_race_id: number;
  course: string;
  raceNumber: number;
  race_name: string;
  date: string;
  trackCode: string;
  track_type: string;
  distance: number;
  weather: string;
  track_condition: string;
  start_time: string;
  entries: NetkeibaHorseEntry[];
}

export interface NetkeibaHorseEntry {
  horse_number: number;
  frame_number: number;
  horse_name: string;
  jockey: string;
  trainer: string;
  weight: number;
  sex_age: string;
  popularity: number;
  odds: number;
  netkeiba_horse_id: string;
}

// WIN競馬内部データ型
export interface WinkeibaRaceInfo {
  DOR: string;
  RacetrackCd: string;
  RaceNum: string;
  RaceName: string;
}

export interface WinkeibaMarkData {
  marks: {
    horseNumber: number;
    mark: string;
    confidence: number;
  }[];
}

export interface WinkeibaAnalysisData {
  bestTime: {
    horseNumber: string;
    horseName: string;
    rank: number;
  }[];
  last3F: {
    horseNumber: string;
    horseName: string;
    rank: number;
  }[];
  rightHandedTrack?: {
    horseNumber: string;
    horseName: string;
    rank: number;
  }[];
  leftHandedTrack?: {
    horseNumber: string;
    horseName: string;
    rank: number;
  }[];
}

// UMAX内部データ型
export interface UmaxRacePrediction {
  date: string;
  trackCode: string;
  raceNumber: string;
  focusedHorseNumbers: number[];
  spValueTop5: number[];
  agValueTop5: number[];
  saValueTop5: number[];
  kiValueTop3: number[];
  confidence: number;
}

// Note画像解析結果型
export interface NoteOcrResult {
  raceNumber: number;
  ai_ranks: (number | null)[];
  confidence: number;
  imageUrl: string;
  extractedText: string;
}

// 指数画像解析結果型
export interface IndexImageResult {
  raceNumber: number;
  horses: {
    number: number;
    rank: number;
    confidence: number;
  }[];
  index_expectation: string;
  imageUrl: string;
  extractedText: string;
}

// ============================================
// 統合スクレイピングサービス用型
// ============================================

export interface RaceDataScrapingOptions {
  date: string;
  trackCode: string;
  sources: ('netkeiba' | 'winkeiba' | 'umax')[];
  apis: ('race-info' | 'predictions' | 'ai-index' | 'index-images' | 'race-results')[];
  noteUrls?: Record<string, string>; // trackCode -> note URL
  imageUrls?: string[];
  parallelProcessing: boolean;
  dryRun: boolean;
}

export interface ScrapingResults {
  raceInfo?: ScrapingResult<RaceBasicInfo[]>;
  predictions?: ScrapingResult<PredictionData[]>;
  aiPredictions?: ScrapingResult<AiPredictionData[]>;
  indexImages?: ScrapingResult<IndexImageData[]>;
  raceResults?: ScrapingResult<RaceResultData[]>;
  processingStats: {
    totalTime: number;
    successfulOperations: number;
    failedOperations: number;
    errors: string[];
  };
}

// ============================================
// エラーハンドリング用型
// ============================================

export interface ScrapingError {
  type: 'network' | 'parsing' | 'authentication' | 'timeout' | 'unknown';
  message: string;
  source: string;
  timestamp: string;
  details?: any;
}

export interface RetryConfig {
  maxRetries: number;
  initialDelay: number;
  maxDelay: number;
  backoffFactor: number;
  retryableErrors: string[];
}

// ============================================
// ログ・モニタリング用型
// ============================================

export interface ScrapingLog {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  source: string;
  message: string;
  data?: any;
  duration?: number;
}

export interface ScrapingMetrics {
  requestCount: number;
  successCount: number;
  errorCount: number;
  averageResponseTime: number;
  lastExecutionTime: string;
  errors: ScrapingError[];
}
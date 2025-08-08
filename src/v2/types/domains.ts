// ============================================
// 最適化された型定義 - ドメイン分離アーキテクチャ
// ============================================

// ============================================
// 基本ドメイン型
// ============================================

export interface RaceKey {
  date: string;         // YYYY-MM-DD形式
  trackCode: string;    // 01-10
  raceNumber: number;   // 1-12
}

export type CourseType = 'turf' | 'dirt' | 'obstacle';
export type Gender = 'male' | 'female' | 'gelding';
export type ExpectationGrade = 'A' | 'B' | 'C' | 'D' | 'E' | 'F';

// ============================================
// 1. レース基本情報API専用型
// ============================================

export interface RaceBasicInfo extends RaceKey {
  name: string;
  startTime: string;
  courseType: CourseType;
  distance: number;
  weather: string;
  trackCondition: string;
  horses: RaceHorse[];
}

export interface RaceHorse {
  number: number;
  name: string;
  jockey: string;
  trainer: string;
  weight: number;
  gender: Gender;
  age: number;
  popularity: number;
  odds: number;
  frameNumber?: number;
  netkeiba_horse_id?: string;
}

// ============================================
// 2. 予想データAPI専用型（完全分離）
// ============================================

export interface PredictionData extends RaceKey {
  sources: PredictionSources;
}

export interface PredictionSources {
  netkeiba?: NetkeibaPrediction;
  winkeiba?: WinKeibaPrediction;
  umax?: UmaxPrediction;
}

// Netkeiba予想データ
export interface NetkeibaPrediction {
  netkeiba_race_id: number;
  cpRanks: [number, number, number, number];
  dataAnalysisRanks: [number, number, number];
  timeIndices: {
    max: [number, number, number, number, number];
    avg: [number, number, number, number, number];
    distance: [number, number, number, number, number];
  };
  analysis: {
    deviationRanks: number[];
    rapidRiseRanks: number[];
    personalBestRanks: number[];
    popularityRisk: number | null;
  };
}

// WIN競馬予想データ
export interface WinKeibaPrediction {
  winPredictionRanks: number[];
  timeRanks: [number?, number?, number?];
  last3fRanks: [number?, number?, number?];
  horseTraitRanks: [number, number, number];
  marks?: {
    horseNumber: number;
    mark: string;
    confidence: number;
  }[];
}

// UMAX予想データ
export interface UmaxPrediction {
  ranks: [number?, number?, number?, number?, number?];
  indices: {
    sp: [number?, number?, number?, number?, number?];
    ag: [number?, number?, number?, number?, number?];
    sa: [number?, number?, number?, number?, number?];
    ki: [number?, number?, number?, number?, number?];
  };
  confidence: number;
}

// ============================================
// 3. AI予想API専用型
// ============================================

export interface AiPredictionData extends RaceKey {
  aiRanks: [number?, number?, number?, number?, number?];
  confidence: number;
  source: string; // note URL
  extractedAt: string; // 抽出日時
}

// ============================================
// 4. 指数画像API専用型
// ============================================

export interface IndexImageData extends RaceKey {
  imageUrl: string;
  indexRanks: [number, number, number, number, number, number, number, number];
  expectationGrade: ExpectationGrade;
  confidence: number;
  processedAt: string;
}

// ============================================
// 5. レース結果API専用型
// ============================================

export interface RaceResultData extends RaceKey {
  results: {
    first: RaceFinisher;
    second: RaceFinisher;
    third: RaceFinisher;
  };
  payouts: {
    win: number;
    place: [number, number, number];
    quinella: number;
    trio: number;
    trifecta: number;
    exacta?: number;
    bracket_quinella?: number;
    quinella_place?: number;
  };
  completedAt: string;
}

export interface RaceFinisher {
  horseNumber: number;
  horseName: string;
  popularity: number;
  odds?: number;
  time?: number;
  margin?: string;
}

// ============================================
// スクレイピングサービス共通型
// ============================================

export interface ScrapingResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  processingTime: number;
}

export interface DomainScrapingConfig {
  enableNetkeiba: boolean;
  enableWinkeiba: boolean;
  enableUmax: boolean;
  enableNote: boolean;
  enableIndexImages: boolean;
  parallelProcessing: boolean;
  retryCount: number;
  timeout: number;
}

// ============================================
// API通信用型
// ============================================

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    code?: string;
    details?: any;
  };
  saved_count?: number;
  processing_time?: number;
}

// ============================================
// CLI用型
// ============================================

export interface CliArgs {
  date: string;
  trackCode?: string;
  apis?: ('race-info' | 'predictions' | 'ai-index' | 'index-images' | 'race-results')[];
  sources?: ('netkeiba' | 'winkeiba' | 'umax')[];
  parallel?: boolean;
  dryRun?: boolean;
}

export interface ProcessingStats {
  totalRaces: number;
  successfulRaces: number;
  failedRaces: number;
  totalTime: number;
  apiCalls: {
    raceInfo: number;
    predictions: number;
    aiIndex: number;
    indexImages: number;
    raceResults: number;
  };
}
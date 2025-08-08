/**
 * API関連型定義 (scraping-api-types.d.ts ベース)
 */

import { BaseRaceInfo, HorseEntry, RankArray } from './common';

// ==============================================
// 共通型 (scraping-api-types.d.ts から)
// ==============================================
export interface ApiErrorDetail {
  index: number;
  field: string;
  reason: string;
}

export interface ApiSuccessResponse {
  success: true;
  saved_count: number;
}

export interface ApiFailureResponse {
  success: false;
  error: {
    message: string;
    details: ApiErrorDetail[];
  };
}

export type ApiResponse = ApiSuccessResponse | ApiFailureResponse;

export type HorseNumber = number;
export type NullableString = string | null;
export type NullableNumber = number | null;

export type CourseType = '芝' | 'ダート' | '障害' | string;
export type TrackCondition = '良' | '稍重' | '重' | '不良' | string;

export type TrackCode = '01' | '02' | '03' | '04' | '05' | '06' | '07' | '08' | '09' | '10';

// ==============================================
// 1. /v1/race-info
// ==============================================
export interface ApiHorseEntry {
  horse_number: HorseNumber;
  horse_name: string;
  jockey_name: string;
  trainer_name: string;
  weight: NullableNumber;
  gender: '牡' | '牝' | 'セ' | string;
  age: number;
  popularity: NullableNumber;
  win_odds: NullableNumber;
}

export interface RaceEntry {
  raceNumber: number;
  race_name: string;
  start_time: `${number}:${number}`; // HH:mm
  course_type: CourseType;
  distance: number;
  weather: NullableString;
  track_condition: NullableString;
  horses: ApiHorseEntry[];
}

export interface RaceInfoRequest {
  date: `${number}-${number}-${number}`;
  trackCode: TrackCode;
  races: RaceEntry[];
}

// ==============================================
// 2. /v1/predictions
// ==============================================
export interface PredictionEntry {
  raceNumber: number;
  win_prediction_ranks: HorseNumber[];          // 3〜8
  jravan_prediction_ranks: RankArray<6>;        // 6 固定（未実装時はnullで埋める）
  cp_ranks: RankArray<4>;                      // 4 固定（データなし時はnullで埋める）
  data_analysis_ranks: RankArray<3>;
  time_ranks: RankArray<3>;                    // 3 固定（未実装時はnullで埋める）
  last_3f_ranks: RankArray<3>;                 // 3 固定（未実装時はnullで埋める）
  horse_trait_ranks: RankArray<3>;             // 3 固定（未実装時はnullで埋める）
  deviation_ranks: HorseNumber[];
  rapid_rise_ranks: HorseNumber[];
  personal_best_ranks: HorseNumber[] | null;
  popularity_risk: string | null;
  time_index_max_ranks: RankArray<5>;          // 5 固定（データなし時はnullで埋める）
  time_index_avg_ranks: RankArray<5>;          // 5 固定（データなし時はnullで埋める）
  time_index_distance_ranks: RankArray<5>;     // 5 固定（データなし時はnullで埋める）
  // --- UMAX 予想 -------------------------------------------------
  /**
   * UMAX 予想馬番号 1〜5 位。null 許可（欠番）
   */
  umax_ranks?: RankArray<5>;
  /** UMAX SP 値 1〜5 */
  umax_sp_values?: RankArray<5>;
  /** UMAX AG 値 1〜5 */
  umax_ag_values?: RankArray<5>;
  /** UMAX SA 値 1〜5 */
  umax_sa_values?: RankArray<5>;
  /** UMAX KI 値 1〜5 */
  umax_ki_values?: RankArray<5>;
}

export interface PredictionsRequest {
  date: `${number}-${number}-${number}`;
  trackCode: TrackCode;
  predictions: PredictionEntry[];
}

// ==============================================
// 3. /v1/ai-index
// ==============================================
export interface AiPredictionEntry {
  raceNumber: number;
  ai_ranks: RankArray<5>;
}

export interface AiIndexRequest {
  date: `${number}-${number}-${number}`;
  trackCode: TrackCode;
  ai_predictions: AiPredictionEntry[];
}

// ==============================================
// 4. /v1/index-images
// ==============================================
export interface IndexImageEntry {
  raceNumber: number;
  url: string;
  index_ranks: RankArray<8>;
  index_expectation: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | string;
}

export interface IndexImagesRequest {
  date: `${number}-${number}-${number}`;
  trackCode: TrackCode;
  images: IndexImageEntry[];
}

// ==============================================
// 5. /v1/race-results
// ==============================================
export interface FinishInfo {
  horse_number: HorseNumber;
  horse_name: string;
  popularity: number;
}

export interface PayoutInfo {
  win: number;
  place: [number, number, number];
  quinella: number;
  trio: number;
  trifecta: number;
}

export interface RaceResultEntry {
  raceNumber: number;
  finish: {
    first: FinishInfo;
    second: FinishInfo;
    third: FinishInfo;
  };
  payouts: PayoutInfo;
}

export interface RaceResultsRequest {
  date: `${number}-${number}-${number}`;
  trackCode: TrackCode;
  results: RaceResultEntry[];
}

// ==============================================
// まとめ
// ==============================================
export type EndpointRequest =
  | { url: '/api/v1/race-info'; body: RaceInfoRequest }
  | { url: '/api/v1/predictions'; body: PredictionsRequest }
  | { url: '/api/v1/ai-index'; body: AiIndexRequest }
  | { url: '/api/v1/index-images'; body: IndexImagesRequest }
  | { url: '/api/v1/race-results'; body: RaceResultsRequest };

export interface ScrapingApiHeaders {
  'Content-Type': 'application/json';
  'X-API-KEY': string;
}

export interface ApiClientConfig {
  baseUrl: string;
  apiKey: string;
  timeout?: number;
  retries?: number;
}
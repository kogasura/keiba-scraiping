/**
 * スクレイピング関連型定義
 */

import { BaseRaceInfo, HorseEntry, RankArray } from './common';
import { OcrHorse } from './ocr';

export interface ScrapingResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}

export interface ScrapingOptions {
  delayRange?: {
    min: number;
    max: number;
  };
  retries?: number;
  timeout?: number;
}

// レース情報スクレイピング結果
export interface RaceInfoScrapingResult extends BaseRaceInfo {
  start_time: string;              // 開始時刻 (HH:mm)
  course_type: string;             // コース種別 (芝/ダート/障害)
  distance: number;                // 距離
  weather?: string;                // 天気
  track_condition?: string;        // 馬場状態
  horses: HorseEntry[];            // 出馬表
}

// 予想データスクレイピング結果
export interface PredictionScrapingResult extends BaseRaceInfo {
  // CP予想
  cp_ranks: RankArray<4>;
  // データ分析詳細
  deviation_ranks: number[];
  rapid_rise_ranks: number[];
  personal_best_ranks: number[];
  popularity_risk: number | null;
  // データ分析ランキング（上位3頭）
  data_analysis_ranks: RankArray<3>;
  // タイム指数
  time_index_max: RankArray<5>;
  time_index_average: RankArray<5>;
  time_index_distance: RankArray<5>;
}

// AI指数スクレイピング結果
export interface AiIndexScrapingResult extends BaseRaceInfo {
  image_url?: string;
  image_path?: string;
  index_expectation?: string;
  ai_index_ranks: number[];
  horses: OcrHorse[];
}

// 指数画像スクレイピング結果
export interface IndexImageScrapingResult extends BaseRaceInfo {
  image_url?: string;
  image_path?: string;
  index_expectation?: string;
  index_image_ranks: number[];
  horses: OcrHorse[];
}

// レース結果スクレイピング結果
export interface RaceResultScrapingResult extends BaseRaceInfo {
  first_place: {
    horse_number: number;
    horse_name: string;
    popularity: number;
  };
  second_place: {
    horse_number: number;
    horse_name: string;
    popularity: number;
  };
  third_place: {
    horse_number: number;
    horse_name: string;
    popularity: number;
  };
  win: {
    horse_number: number;
    popularity: number;
    payout: number;
  };
  place: {
    horses: [
      { horse_number: number; popularity: number; payout: number; },
      { horse_number: number; popularity: number; payout: number; },
      { horse_number: number; popularity: number; payout: number; }
    ]
  };
  bracket_quinella: { combination: string; popularity: number; payout: number; };
  quinella: { combination: string; popularity: number; payout: number; };
  quinella_place: { combinations: string[]; popularity: number[]; payouts: number[]; };
  exacta: { combination: string; popularity: number; payout: number; };
  trio: { combination: string; popularity: number; payout: number; };
  trifecta: { combination: string; popularity: number; payout: number; };
}
/**
 * 共通型定義
 */

import { StageType } from './intermediate';

export interface BaseRaceInfo {
  date: string;                    // YYYYMMDD形式
  trackCode: string;               // 競馬場コード (01-10)
  raceNumber: number;              // レース番号
  netkeiba_race_id: number;        // NetkeibaのレースID
  race_name: string;               // レース名
}

export interface TrackInfo {
  trackCode: string;               // 競馬場コード
  trackName: string;               // 競馬場名
}

export interface HorseEntry {
  horse_number: number;            // 馬番
  horse_name: string;              // 馬名
  jockey_name: string;             // 騎手名
  trainer_name: string;            // 調教師名
  weight?: number;                 // 馬体重
  gender: string;                  // 性別
  age: number;                     // 年齢
  popularity?: number;             // 人気
  win_odds?: number;               // 勝率オッズ
}

export type RankArray<N extends number> = (number | null)[] & { length: N };

// ApiResponse は api.ts で定義されているため削除

export interface DateRange {
  start: string;                   // YYYYMMDD
  end: string;                     // YYYYMMDD
}

export interface ExecutionOptions {
  date: string | string[];         // 実行日付
  trackCodes?: string[];           // 競馬場コード（指定なしの場合はスケジュールから取得）
  dryRun?: boolean;                // テスト実行
  verbose?: boolean;               // 詳細ログ
  batch?: boolean;                 // バッチ処理モード
  stage?: StageType;               // 実行段階（scrape, validate, send, all）
  intermediateFile?: string;       // 中間ファイルパス（直接指定）
}
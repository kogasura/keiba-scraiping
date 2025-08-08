/**
 * OCR関連の型定義
 */

/**
 * OCR結果の型定義
 */
export interface OcrResult {
  index_expectation?: string;
  raceNumber: number;
  horses: OcrHorse[];
}

/**
 * OCR解析で取得される馬の情報
 */
export interface OcrHorse {
  number: number;
  name: string;
  rank: number;
  score: number;
}

/**
 * AI指数スクレイピング結果
 */
export interface AiIndexScrapingResult {
  date: string;
  trackCode: string;
  raceNumber: number;
  netkeiba_race_id: number;
  race_name: string;
  image_url?: string;
  image_path?: string;
  index_expectation?: string;
  ai_index_ranks: number[];
  horses: OcrHorse[];
}

/**
 * 指数画像スクレイピング結果
 */
export interface IndexImageScrapingResult {
  date: string;
  trackCode: string;
  raceNumber: number;
  netkeiba_race_id: number;
  race_name: string;
  image_url?: string;
  image_path?: string;
  index_expectation?: string;
  index_image_ranks: number[];
  horses: OcrHorse[];
}

/**
 * OCR処理オプション
 */
export interface OcrOptions {
  apiKey?: string;
  model?: string;
  maxRetries?: number;
  timeout?: number;
}
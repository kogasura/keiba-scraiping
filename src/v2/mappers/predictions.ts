/**
 * 予想情報APIリクエスト変換マッパー
 */

import { PredictionScrapingResult } from '../types/scraping';
import { PredictionsRequest, PredictionEntry } from '../types/api';
import { logger } from '../utils/logger';

/**
 * データ埋め込み用定数
 */
const PADDING_VALUES = {
  /** データなしを表す馬番号（0 = 該当なし） */
  NO_DATA_HORSE_NUMBER: 0,
} as const;

/**
 * スクレイピング結果をAPI形式に変換
 */
export function mapPredictionsToApi(scrapingResults: PredictionScrapingResult[]): PredictionsRequest[] {
  if (!scrapingResults || scrapingResults.length === 0) {
    return [];
  }

  logger.debug(`予想情報をAPI形式に変換中: ${scrapingResults.length}件`);

  // 日付・競馬場コードでグループ化
  const groupedResults = scrapingResults.reduce((acc, result) => {
    const key = `${result.date}_${result.trackCode}`;
    if (!acc[key]) {
      acc[key] = {
        date: formatDateForApi(result.date),
        trackCode: result.trackCode as any,
        predictions: []
      };
    }
    acc[key].predictions.push(result);
    return acc;
  }, {} as Record<string, { date: string; trackCode: any; predictions: PredictionScrapingResult[] }>);

  // API形式に変換
  const apiRequests: PredictionsRequest[] = [];

  for (const groupKey in groupedResults) {
    const group = groupedResults[groupKey];
    
    const apiRequest: PredictionsRequest = {
      date: group.date as `${number}-${number}-${number}`,
      trackCode: group.trackCode,
      predictions: group.predictions.map(prediction => mapPredictionToApiEntry(prediction))
    };

    apiRequests.push(apiRequest);
  }

  logger.debug(`API形式への変換完了: ${apiRequests.length}件`);
  return apiRequests;
}

/**
 * 単一予想をAPI形式に変換
 */
function mapPredictionToApiEntry(prediction: PredictionScrapingResult): PredictionEntry {
  return {
    raceNumber: prediction.raceNumber,
    win_prediction_ranks: prediction.deviation_ranks || [],
    jravan_prediction_ranks: createEmptyRankArray(6) as any,  // 未実装のため空配列
    cp_ranks: hasValidData(prediction.cp_ranks) ? padArrayToLength(prediction.cp_ranks, 4) as any : createEmptyRankArray(4) as any,
    data_analysis_ranks: padArrayToLength(prediction.data_analysis_ranks, 3) as any,  // 3固定
    time_ranks: createEmptyRankArray(3) as any,  // 未実装のため空配列
    last_3f_ranks: createEmptyRankArray(3) as any,  // 未実装のため空配列
    horse_trait_ranks: createEmptyRankArray(3) as any,  // 未実装のため空配列
    deviation_ranks: prediction.deviation_ranks || [],
    rapid_rise_ranks: prediction.rapid_rise_ranks || [],
    personal_best_ranks: limitArrayLength(prediction.personal_best_ranks || [], 3),  // 最大3件に制限
    popularity_risk: prediction.popularity_risk ? prediction.popularity_risk.toString() : null,
    time_index_max_ranks: hasValidData(prediction.time_index_max) ? padArrayToLength(prediction.time_index_max, 5) as any : createEmptyRankArray(5) as any,
    time_index_avg_ranks: hasValidData(prediction.time_index_average) ? padArrayToLength(prediction.time_index_average, 5) as any : createEmptyRankArray(5) as any,
    time_index_distance_ranks: hasValidData(prediction.time_index_distance) ? padArrayToLength(prediction.time_index_distance, 5) as any : createEmptyRankArray(5) as any,
  };
}

/**
 * 日付をAPI形式に変換 (YYYYMMDD -> YYYY-MM-DD)
 */
function formatDateForApi(date: string): string {
  if (date.length === 8) {
    return `${date.substring(0, 4)}-${date.substring(4, 6)}-${date.substring(6, 8)}`;
  }
  return date;
}

/**
 * 複数のスクレイピング結果を統合してAPI形式に変換
 */
export function mergeAndMapPredictions(
  results: PredictionScrapingResult[][],
  dates: string[],
  trackCodes: string[]
): PredictionsRequest[] {
  logger.info(`複数の予想結果を統合中: ${results.length}件`);

  const allResults: PredictionScrapingResult[] = [];
  
  // 全結果を平坦化
  for (const resultSet of results) {
    if (resultSet && resultSet.length > 0) {
      allResults.push(...resultSet);
    }
  }

  if (allResults.length === 0) {
    logger.warn('統合対象のデータが見つかりませんでした');
    return [];
  }

  // 重複を除去
  const uniqueResults = removeDuplicatePredictions(allResults);
  
  logger.info(`重複除去後: ${uniqueResults.length}件`);

  // API形式に変換
  return mapPredictionsToApi(uniqueResults);
}

/**
 * 重複する予想情報を除去
 */
function removeDuplicatePredictions(results: PredictionScrapingResult[]): PredictionScrapingResult[] {
  const seen = new Set<string>();
  const uniqueResults: PredictionScrapingResult[] = [];

  for (const result of results) {
    const key = `${result.date}_${result.trackCode}_${result.raceNumber}_${result.netkeiba_race_id}`;
    
    if (!seen.has(key)) {
      seen.add(key);
      uniqueResults.push(result);
    }
  }

  return uniqueResults;
}

/**
 * 配列を指定長に調整（不足分はNO_DATA_HORSE_NUMBERで埋める - バリデーション対応）
 */
function padArrayToLength(array: (number | null)[] | undefined, targetLength: number): (number | null)[] {
  const arr = array || [];
  if (arr.length >= targetLength) {
    return arr.slice(0, targetLength);
  }
  
  const result = [...arr];
  while (result.length < targetLength) {
    result.push(PADDING_VALUES.NO_DATA_HORSE_NUMBER);
  }
  
  return result;
}

/**
 * 配列の最大要素数を制限
 */
function limitArrayLength(array: number[], maxLength: number): number[] {
  if (array.length <= maxLength) {
    return array;
  }
  return array.slice(0, maxLength);
}

/**
 * 空のランク配列を作成（指定長でnullで埋める）
 */
function createEmptyRankArray(length: number): (number | null)[] {
  return new Array(length).fill(null);
}

/**
 * 有効なデータが存在するかチェック
 */
function hasValidData(array: (number | null)[] | undefined): boolean {
  return Array.isArray(array) && array.length > 0 && array.some(value => value !== null && value !== 0);
}

/**
 * 配列の最低要素数を保証（不足分はNO_DATA_HORSE_NUMBERで埋める - バリデーション対応）
 */
function ensureMinimumLength(array: number[], minLength: number): number[] {
  if (array.length >= minLength) {
    return array;
  }
  
  const result = [...array];
  while (result.length < minLength) {
    result.push(PADDING_VALUES.NO_DATA_HORSE_NUMBER);
  }
  
  return result;
}
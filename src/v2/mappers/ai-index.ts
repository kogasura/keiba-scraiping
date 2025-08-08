/**
 * AI指数APIリクエスト変換マッパー
 */

import { AiIndexScrapingResult } from '../types/scraping';
import { AiIndexRequest, AiPredictionEntry } from '../types/api';
import { logger } from '../utils/logger';

/**
 * スクレイピング結果をAPI形式に変換
 */
export function mapAiIndexToApi(scrapingResults: AiIndexScrapingResult[]): AiIndexRequest[] {
  if (!scrapingResults || scrapingResults.length === 0) {
    return [];
  }

  logger.debug(`AI指数をAPI形式に変換中: ${scrapingResults.length}件`);

  // 日付・競馬場コードでグループ化
  const groupedResults = scrapingResults.reduce((acc, result) => {
    const key = `${result.date}_${result.trackCode}`;
    if (!acc[key]) {
      acc[key] = {
        date: formatDateForApi(result.date),
        trackCode: result.trackCode,
        aiIndexes: []
      };
    }
    acc[key].aiIndexes.push(result);
    return acc;
  }, {} as Record<string, { date: string; trackCode: string; aiIndexes: AiIndexScrapingResult[] }>);

  // API形式に変換
  const apiRequests: AiIndexRequest[] = [];

  for (const groupKey in groupedResults) {
    const group = groupedResults[groupKey];
    
    const apiRequest: AiIndexRequest = {
      date: group.date as `${number}-${number}-${number}`,
      trackCode: group.trackCode as any,
      ai_predictions: group.aiIndexes.map(aiIndex => mapAiIndexToApiEntry(aiIndex))
    };

    apiRequests.push(apiRequest);
  }

  logger.debug(`API形式への変換完了: ${apiRequests.length}件`);
  return apiRequests;
}

/**
 * 単一AI指数をAPI形式に変換
 */
function mapAiIndexToApiEntry(aiIndex: AiIndexScrapingResult): AiPredictionEntry {
  return {
    raceNumber: aiIndex.raceNumber,
    ai_ranks: aiIndex.ai_index_ranks?.slice(0, 5) as any || [0, 0, 0, 0, 0] as any
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
export function mergeAndMapAiIndex(
  results: AiIndexScrapingResult[][],
  dates: string[],
  trackCodes: string[]
): AiIndexRequest[] {
  logger.info(`複数のAI指数結果を統合中: ${results.length}件`);

  const allResults: AiIndexScrapingResult[] = [];
  
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
  const uniqueResults = removeDuplicateAiIndexes(allResults);
  
  logger.info(`重複除去後: ${uniqueResults.length}件`);

  // API形式に変換
  return mapAiIndexToApi(uniqueResults);
}

/**
 * 重複するAI指数情報を除去
 */
function removeDuplicateAiIndexes(results: AiIndexScrapingResult[]): AiIndexScrapingResult[] {
  const seen = new Set<string>();
  const uniqueResults: AiIndexScrapingResult[] = [];

  for (const result of results) {
    const key = `${result.date}_${result.trackCode}_${result.raceNumber}_${result.netkeiba_race_id}`;
    
    if (!seen.has(key)) {
      seen.add(key);
      uniqueResults.push(result);
    }
  }

  return uniqueResults;
}
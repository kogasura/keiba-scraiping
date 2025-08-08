/**
 * 指数画像APIリクエスト変換マッパー
 */

import { IndexImageScrapingResult } from '../types/scraping';
import { IndexImagesRequest, IndexImageEntry } from '../types/api';
import { logger } from '../utils/logger';

/**
 * スクレイピング結果をAPI形式に変換
 */
export function mapIndexImagesToApi(scrapingResults: IndexImageScrapingResult[]): IndexImagesRequest[] {
  if (!scrapingResults || scrapingResults.length === 0) {
    return [];
  }

  logger.debug(`指数画像をAPI形式に変換中: ${scrapingResults.length}件`);

  // 日付・競馬場コードでグループ化
  const groupedResults = scrapingResults.reduce((acc, result) => {
    const key = `${result.date}_${result.trackCode}`;
    if (!acc[key]) {
      acc[key] = {
        date: formatDateForApi(result.date),
        trackCode: result.trackCode,
        indexImages: []
      };
    }
    acc[key].indexImages.push(result);
    return acc;
  }, {} as Record<string, { date: string; trackCode: string; indexImages: IndexImageScrapingResult[] }>);

  // API形式に変換
  const apiRequests: IndexImagesRequest[] = [];

  for (const groupKey in groupedResults) {
    const group = groupedResults[groupKey];
    
    const apiRequest: IndexImagesRequest = {
      date: group.date as `${number}-${number}-${number}`,
      trackCode: group.trackCode as any,
      images: group.indexImages.map(indexImage => mapIndexImageToApiEntry(indexImage))
    };

    apiRequests.push(apiRequest);
  }

  logger.debug(`API形式への変換完了: ${apiRequests.length}件`);
  return apiRequests;
}

/**
 * 単一指数画像をAPI形式に変換
 */
function mapIndexImageToApiEntry(indexImage: IndexImageScrapingResult): IndexImageEntry {
  return {
    raceNumber: indexImage.raceNumber,
    url: indexImage.image_url || '',
    index_ranks: indexImage.index_image_ranks?.slice(0, 8) as any || [0, 0, 0, 0, 0, 0, 0, 0] as any,
    index_expectation: indexImage.index_expectation || 'F'
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
export function mergeAndMapIndexImages(
  results: IndexImageScrapingResult[][],
  dates: string[],
  trackCodes: string[]
): IndexImagesRequest[] {
  logger.info(`複数の指数画像結果を統合中: ${results.length}件`);

  const allResults: IndexImageScrapingResult[] = [];
  
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
  const uniqueResults = removeDuplicateIndexImages(allResults);
  
  logger.info(`重複除去後: ${uniqueResults.length}件`);

  // API形式に変換
  return mapIndexImagesToApi(uniqueResults);
}

/**
 * 重複する指数画像情報を除去
 */
function removeDuplicateIndexImages(results: IndexImageScrapingResult[]): IndexImageScrapingResult[] {
  const seen = new Set<string>();
  const uniqueResults: IndexImageScrapingResult[] = [];

  for (const result of results) {
    const key = `${result.date}_${result.trackCode}_${result.raceNumber}_${result.netkeiba_race_id}`;
    
    if (!seen.has(key)) {
      seen.add(key);
      uniqueResults.push(result);
    }
  }

  return uniqueResults;
}
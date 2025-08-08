/**
 * レース結果APIリクエスト変換マッパー
 */

import { RaceResultScrapingResult } from '../types/scraping';
import { RaceResultsRequest, RaceResultEntry } from '../types/api';
import { logger } from '../utils/logger';

/**
 * スクレイピング結果をAPI形式に変換
 */
export function mapRaceResultsToApi(scrapingResults: RaceResultScrapingResult[]): RaceResultsRequest[] {
  if (!scrapingResults || scrapingResults.length === 0) {
    return [];
  }

  logger.debug(`レース結果をAPI形式に変換中: ${scrapingResults.length}件`);

  // 日付・競馬場コードでグループ化
  const groupedResults = scrapingResults.reduce((acc, result) => {
    const key = `${result.date}_${result.trackCode}`;
    if (!acc[key]) {
      acc[key] = {
        date: formatDateForApi(result.date),
        trackCode: result.trackCode as any,
        results: []
      };
    }
    acc[key].results.push(result);
    return acc;
  }, {} as Record<string, { date: string; trackCode: any; results: RaceResultScrapingResult[] }>);

  // API形式に変換
  const apiRequests: RaceResultsRequest[] = [];

  for (const groupKey in groupedResults) {
    const group = groupedResults[groupKey];
    
    const apiRequest: RaceResultsRequest = {
      date: group.date as `${number}-${number}-${number}`,
      trackCode: group.trackCode,
      results: group.results.map(result => mapRaceResultToApiEntry(result))
    };

    apiRequests.push(apiRequest);
  }

  logger.debug(`API形式への変換完了: ${apiRequests.length}件`);
  return apiRequests;
}

/**
 * 単一レース結果をAPI形式に変換
 */
function mapRaceResultToApiEntry(result: RaceResultScrapingResult): RaceResultEntry {
  return {
    raceNumber: result.raceNumber,
    finish: {
      first: {
        horse_number: result.first_place.horse_number,
        horse_name: result.first_place.horse_name,
        popularity: result.first_place.popularity
      },
      second: {
        horse_number: result.second_place.horse_number,
        horse_name: result.second_place.horse_name,
        popularity: result.second_place.popularity
      },
      third: {
        horse_number: result.third_place.horse_number,
        horse_name: result.third_place.horse_name,
        popularity: result.third_place.popularity
      }
    },
    payouts: {
      win: result.win.payout,
      place: [
        result.place.horses[0]?.payout || 0,
        result.place.horses[1]?.payout || 0,
        result.place.horses[2]?.payout || 0
      ],
      quinella: result.quinella.payout,
      trio: result.trio.payout,
      trifecta: result.trifecta.payout
    }
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
export function mergeAndMapRaceResults(
  results: RaceResultScrapingResult[][],
  dates: string[],
  trackCodes: string[]
): RaceResultsRequest[] {
  logger.info(`複数のレース結果を統合中: ${results.length}件`);

  const allResults: RaceResultScrapingResult[] = [];
  
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
  const uniqueResults = removeDuplicateRaceResults(allResults);
  
  logger.info(`重複除去後: ${uniqueResults.length}件`);

  // API形式に変換
  return mapRaceResultsToApi(uniqueResults);
}

/**
 * 重複するレース結果を除去
 */
function removeDuplicateRaceResults(results: RaceResultScrapingResult[]): RaceResultScrapingResult[] {
  const seen = new Set<string>();
  const uniqueResults: RaceResultScrapingResult[] = [];

  for (const result of results) {
    const key = `${result.date}_${result.trackCode}_${result.raceNumber}`;
    
    if (!seen.has(key)) {
      seen.add(key);
      uniqueResults.push(result);
    }
  }

  return uniqueResults;
}
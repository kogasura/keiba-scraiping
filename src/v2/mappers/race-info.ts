/**
 * レース情報APIリクエスト変換マッパー
 */

import { RaceInfoScrapingResult } from '../types/scraping';
import { RaceInfoRequest, RaceEntry, ApiHorseEntry } from '../types/api';
import { logger } from '../utils/logger';

/**
 * スクレイピング結果をAPI形式に変換
 */
export function mapRaceInfoToApi(scrapingResults: RaceInfoScrapingResult[]): RaceInfoRequest[] {
  if (!scrapingResults || scrapingResults.length === 0) {
    return [];
  }

  logger.debug(`レース情報をAPI形式に変換中: ${scrapingResults.length}件`);

  // 日付・競馬場コードでグループ化
  const groupedResults = scrapingResults.reduce((acc, result) => {
    const key = `${result.date}_${result.trackCode}`;
    if (!acc[key]) {
      acc[key] = {
        date: formatDateForApi(result.date),
        trackCode: result.trackCode as any,
        races: []
      };
    }
    acc[key].races.push(result);
    return acc;
  }, {} as Record<string, { date: string; trackCode: any; races: RaceInfoScrapingResult[] }>);

  // API形式に変換
  const apiRequests: RaceInfoRequest[] = [];

  for (const groupKey in groupedResults) {
    const group = groupedResults[groupKey];
    
    const apiRequest: RaceInfoRequest = {
      date: group.date as `${number}-${number}-${number}`,
      trackCode: group.trackCode,
      races: group.races.map(race => mapRaceToApiEntry(race))
    };

    apiRequests.push(apiRequest);
  }

  logger.debug(`API形式への変換完了: ${apiRequests.length}件`);
  return apiRequests;
}

/**
 * 単一レースをAPI形式に変換
 */
function mapRaceToApiEntry(race: RaceInfoScrapingResult): RaceEntry {
  return {
    raceNumber: race.raceNumber,
    race_name: race.race_name,
    start_time: race.start_time as `${number}:${number}`,
    course_type: race.course_type,
    distance: race.distance,
    weather: race.weather || null,
    track_condition: race.track_condition || null,
    horses: race.horses.map(horse => ({
      horse_number: horse.horse_number,
      horse_name: horse.horse_name,
      jockey_name: horse.jockey_name,
      trainer_name: horse.trainer_name,
      weight: horse.weight || null,
      gender: horse.gender || '',
      age: horse.age || 0,
      popularity: horse.popularity || null,
      win_odds: horse.win_odds || null
    }))
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
export function mergeAndMapRaceInfo(
  results: RaceInfoScrapingResult[][],
  dates: string[],
  trackCodes: string[]
): RaceInfoRequest[] {
  logger.info(`複数のスクレイピング結果を統合中: ${results.length}件`);

  const allResults: RaceInfoScrapingResult[] = [];
  
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
  const uniqueResults = removeDuplicateRaces(allResults);
  
  logger.info(`重複除去後: ${uniqueResults.length}件`);

  // API形式に変換
  return mapRaceInfoToApi(uniqueResults);
}

/**
 * 重複するレース情報を除去
 */
function removeDuplicateRaces(results: RaceInfoScrapingResult[]): RaceInfoScrapingResult[] {
  const seen = new Set<string>();
  const uniqueResults: RaceInfoScrapingResult[] = [];

  for (const result of results) {
    const key = `${result.date}_${result.trackCode}_${result.raceNumber}_${result.netkeiba_race_id}`;
    
    if (!seen.has(key)) {
      seen.add(key);
      uniqueResults.push(result);
    }
  }

  return uniqueResults;
}
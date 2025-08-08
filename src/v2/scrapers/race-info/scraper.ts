/**
 * レース情報スクレイピングサービス
 */

import { NetkeibaScraper } from '../base/netkeiba';
import { RaceInfoScrapingResult, ScrapingResult } from '../../types/scraping';
import { logger } from '../../utils/logger';
import { randomDelay } from '../../utils/delay';
import { saveScreenshot } from '../../utils/browser';
import { logError } from '../../utils/file';

export class RaceInfoScraper {
  private scraper: NetkeibaScraper;
  
  constructor() {
    this.scraper = new NetkeibaScraper({
      delayRange: { min: 1000, max: 3000 },
      retries: 3,
      timeout: 30000
    });
  }

  /**
   * 指定日付・競馬場のレース情報を取得
   */
  async scrapeRaceInfo(date: string, trackCode: string): Promise<ScrapingResult<RaceInfoScrapingResult[]>> {
    try {
      logger.info(`レース情報スクレイピング開始: ${date} - ${trackCode}`);
      
      await this.scraper.init();
      
      const loginSuccess = await this.scraper.login();
      if (!loginSuccess) {
        throw new Error('Netkeibaログインに失敗しました');
      }

      // レース一覧を取得
      const raceList = await this.scraper.getRaceList(date);
      const targetRaces = raceList.filter(race => race.trackCode === trackCode);

      if (targetRaces.length === 0) {
        logger.warn(`指定された競馬場のレースが見つかりません: ${trackCode}`);
        return {
          success: true,
          data: [],
          timestamp: new Date().toISOString()
        };
      }

      logger.info(`対象レース数: ${targetRaces.length}件`);

      // 各レースの詳細を取得
      const raceInfoResults: RaceInfoScrapingResult[] = [];
      
      for (const race of targetRaces) {
        try {
          logger.debug(`レース詳細取得中: ${race.raceNumber}R ${race.race_name}`);
          
          const raceDetail = await this.scraper.getRaceDetail(race.netkeiba_race_id, date);
          
          const raceInfo: RaceInfoScrapingResult = {
            date: date,
            trackCode: trackCode,
            raceNumber: race.raceNumber,
            netkeiba_race_id: race.netkeiba_race_id,
            race_name: raceDetail.race_name,
            start_time: raceDetail.start_time,
            course_type: raceDetail.track_type,
            distance: raceDetail.distance,
            weather: raceDetail.weather,
            track_condition: raceDetail.track_condition,
            horses: raceDetail.horses.map(horse => ({
              horse_number: horse.horse_number,
              horse_name: horse.horse_name,
              jockey_name: horse.jockey_name,
              trainer_name: horse.trainer_name,
              weight: horse.weight,
              gender: this.extractGender(horse.sex_age),
              age: this.extractAge(horse.sex_age),
              popularity: horse.popularity,
              win_odds: horse.odds,
            }))
          };

          raceInfoResults.push(raceInfo);
          
          // リクエスト間隔を空ける
          await randomDelay(2000, 4000);
          
        } catch (error) {
          logger.error(`レース詳細取得失敗: ${race.raceNumber}R`, error);
          logError(error as Error, `RaceInfo-${race.raceNumber}R`);
          continue;
        }
      }

      logger.success(`レース情報スクレイピング完了: ${raceInfoResults.length}/${targetRaces.length}件`);
      
      return {
        success: true,
        data: raceInfoResults,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      logger.error(`レース情報スクレイピング失敗: ${date} - ${trackCode}`, error);
      logError(error as Error, `RaceInfo-${date}-${trackCode}`);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
    } finally {
      await this.scraper.close();
    }
  }

  /**
   * 複数日付・複数競馬場のレース情報を取得
   */
  async scrapeMultipleRaceInfo(
    dates: string[],
    trackCodes: string[]
  ): Promise<ScrapingResult<RaceInfoScrapingResult[]>> {
    try {
      logger.info(`複数レース情報スクレイピング開始: ${dates.length}日付 x ${trackCodes.length}競馬場`);
      
      const allResults: RaceInfoScrapingResult[] = [];
      
      for (const date of dates) {
        for (const trackCode of trackCodes) {
          const result = await this.scrapeRaceInfo(date, trackCode);
          
          if (result.success && result.data) {
            allResults.push(...result.data);
          }
          
          // 日付間での遅延
          await randomDelay(3000, 5000);
        }
      }

      logger.success(`複数レース情報スクレイピング完了: ${allResults.length}件`);
      
      return {
        success: true,
        data: allResults,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      logger.error('複数レース情報スクレイピング失敗', error);
      logError(error as Error, 'MultipleRaceInfo');
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * 性齢から性別を抽出
   */
  private extractGender(sexAge: string): string {
    if (!sexAge) return '';
    return sexAge.charAt(0) || '';
  }

  /**
   * 性齢から年齢を抽出
   */
  private extractAge(sexAge: string): number {
    if (!sexAge) return 0;
    const ageStr = sexAge.slice(1);
    return parseInt(ageStr) || 0;
  }
}

// 型定義は基盤スクレイパーから使用
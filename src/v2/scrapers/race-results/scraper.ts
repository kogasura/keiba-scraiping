/**
 * レース結果スクレイピングサービス
 */

import { WinkeibaScraper } from '../base/winkeiba';
import { RaceResultScrapingResult, ScrapingResult } from '../../types/scraping';
import { logger } from '../../utils/logger';
import { randomDelay } from '../../utils/delay';

export class RaceResultScraper {
  private scraper: WinkeibaScraper;
  
  constructor() {
    this.scraper = new WinkeibaScraper({
      delayRange: { min: 1000, max: 3000 },
      retries: 3,
      timeout: 30000
    });
  }

  /**
   * 指定日付・競馬場のレース結果を取得
   */
  async scrapeRaceResults(date: string, trackCode: string): Promise<ScrapingResult<RaceResultScrapingResult[]>> {
    try {
      logger.info(`レース結果スクレイピング開始: ${date} - ${trackCode}`);
      
      await this.scraper.init();
      
      const loginSuccess = await this.scraper.login();
      if (!loginSuccess) {
        throw new Error('Winkeibaログインに失敗しました');
      }

      // レース結果を取得
      const raceResults = await this.scraper.getRaceResults(date, trackCode);
      
      if (raceResults.length === 0) {
        logger.warn(`指定された日付・競馬場のレース結果が見つかりません: ${date} - ${trackCode}`);
        return {
          success: true,
          data: [],
          timestamp: new Date().toISOString()
        };
      }

      logger.info(`レース結果を取得しました: ${raceResults.length}件`);

      // スクレイピング結果形式に変換
      const results: RaceResultScrapingResult[] = raceResults.map(result => ({
        date: result.date,
        trackCode: result.trackCode,
        raceNumber: parseInt(result.raceNumber),
        netkeiba_race_id: 0, // TODO: 実装時に設定
        race_name: 'TODO: レース名を取得', // TODO: 実装時に設定
        first_place: result.first_place,
        second_place: result.second_place,
        third_place: result.third_place,
        win: result.win,
        place: result.place,
        bracket_quinella: result.bracket_quinella,
        quinella: result.quinella,
        quinella_place: result.quinella_place,
        exacta: result.exacta,
        trio: result.trio,
        trifecta: result.trifecta,
      }));

      return {
        success: true,
        data: results,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      logger.error('レース結果スクレイピングに失敗しました', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
    } finally {
      await this.scraper.close();
    }
  }
}
/**
 * 予想情報スクレイピングサービス
 */

import { NetkeibaScraper } from '../base/netkeiba';
import { PredictionScrapingResult, ScrapingResult } from '../../types/scraping';
import { logger } from '../../utils/logger';
import { randomDelay } from '../../utils/delay';
import { logError } from '../../utils/file';

export class PredictionScraper {
  private scraper: NetkeibaScraper;
  
  constructor() {
    this.scraper = new NetkeibaScraper({
      delayRange: { min: 1000, max: 3000 },
      retries: 3,
      timeout: 30000
    });
  }

  /**
   * 指定日付・競馬場の予想情報を取得
   */
  async scrapePredictions(date: string, trackCode: string): Promise<ScrapingResult<PredictionScrapingResult[]>> {
    try {
      logger.info(`予想情報スクレイピング開始: ${date} - ${trackCode}`);
      
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

      // 各レースの予想情報を取得
      const predictionResults: PredictionScrapingResult[] = [];
      
      for (const race of targetRaces) {
        try {
          logger.debug(`予想情報取得中: ${race.raceNumber}R ${race.race_name}`);
          
          // CP予想を取得
          const cpPrediction = await this.scraper.getCPPrediction(race.netkeiba_race_id);
          
          // データ分析情報を取得
          const dataAnalysis = await this.scraper.getDataAnalysis(race.netkeiba_race_id);
          
          // データ分析ランキングを取得
          const dataAnalysisRanking = await this.scraper.getDataAnalysisRanking(race.netkeiba_race_id);
          
          // タイム指数を取得
          const timeIndexMax = await this.scraper.getTimeIndexMax(race.netkeiba_race_id);
          const timeIndexAverage = await this.scraper.getTimeIndexAverage(race.netkeiba_race_id);
          const timeIndexDistance = await this.scraper.getTimeIndexDistance(race.netkeiba_race_id);
          
          const prediction: PredictionScrapingResult = {
            date: date,
            trackCode: trackCode,
            raceNumber: race.raceNumber,
            netkeiba_race_id: race.netkeiba_race_id,
            race_name: race.race_name,
            // CP予想
            cp_ranks: cpPrediction.cp_ranks,
            // データ分析詳細
            deviation_ranks: dataAnalysis.deviation_ranks,
            rapid_rise_ranks: dataAnalysis.rapid_rise_ranks,
            personal_best_ranks: dataAnalysis.personal_best_ranks,
            popularity_risk: dataAnalysis.popularity_risk,
            // データ分析ランキング（上位3頭）
            data_analysis_ranks: dataAnalysisRanking?.data_analysis_ranks || [0, 0, 0] as any,
            // タイム指数
            time_index_max: timeIndexMax.time_index_horse_numbers,
            time_index_average: timeIndexAverage.time_index_horse_numbers,
            time_index_distance: timeIndexDistance.time_index_horse_numbers,
          };

          predictionResults.push(prediction);
          
          // リクエスト間隔を空ける
          await randomDelay(2000, 4000);
          
        } catch (error) {
          logger.error(`予想情報取得失敗: ${race.raceNumber}R`, error);
          logError(error as Error, `Predictions-${race.raceNumber}R`);
          continue;
        }
      }

      logger.success(`予想情報スクレイピング完了: ${predictionResults.length}/${targetRaces.length}件`);
      
      return {
        success: true,
        data: predictionResults,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      logger.error(`予想情報スクレイピング失敗: ${date} - ${trackCode}`, error);
      logError(error as Error, `Predictions-${date}-${trackCode}`);
      
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
   * 複数日付・複数競馬場の予想情報を取得
   */
  async scrapeMultiplePredictions(
    dates: string[],
    trackCodes: string[]
  ): Promise<ScrapingResult<PredictionScrapingResult[]>> {
    try {
      logger.info(`複数予想情報スクレイピング開始: ${dates.length}日付 x ${trackCodes.length}競馬場`);
      
      const allResults: PredictionScrapingResult[] = [];
      
      for (const date of dates) {
        for (const trackCode of trackCodes) {
          const result = await this.scrapePredictions(date, trackCode);
          
          if (result.success && result.data) {
            allResults.push(...result.data);
          }
          
          // 日付間での遅延
          await randomDelay(3000, 5000);
        }
      }

      logger.success(`複数予想情報スクレイピング完了: ${allResults.length}件`);
      
      return {
        success: true,
        data: allResults,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      logger.error('複数予想情報スクレイピング失敗', error);
      logError(error as Error, 'MultiplePredictions');
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
    }
  }
}
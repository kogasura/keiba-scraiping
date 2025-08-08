/**
 * AI指数スクレイピングサービス
 */

import { NetkeibaScraper } from '../base/netkeiba';
import { AiIndexScrapingResult, ScrapingResult } from '../../types/scraping';
import { extractIndexRanksFromImage } from '../../utils/ocr';
import { logger } from '../../utils/logger';
import { randomDelay } from '../../utils/delay';
import { logError } from '../../utils/file';
import { createApiClient } from '../../api/client';
import { AiIndexUrlsResponse } from '../../../type/scraping-api-types';

export class AiIndexScraper {
  private apiClient;
  private scraper: NetkeibaScraper;
  
  constructor() {
    this.apiClient = createApiClient();
    this.scraper = new NetkeibaScraper({
      delayRange: { min: 1000, max: 3000 },
      retries: 3,
      timeout: 30000
    });
  }

  /**
   * 指定日付・競馬場のAI指数を取得
   */
  async scrapeAiIndex(date: string, trackCode: string): Promise<ScrapingResult<AiIndexScrapingResult[]>> {
    try {
      logger.info(`AI指数スクレイピング開始: ${date} - ${trackCode}`);
      
      // 日付をYYYY-MM-DD形式に変換
      const formattedDate = `${date.substring(0, 4)}-${date.substring(4, 6)}-${date.substring(6, 8)}`;
      
      // APIから指定日付のAI指数URLを取得
      const aiIndexUrlsResponse = await this.apiClient.get<AiIndexUrlsResponse>(
        `/api/ai-index-urls/${formattedDate}`
      );

      if (!aiIndexUrlsResponse.success) {
        logger.warn(`AI指数URLが見つかりませんでした: ${date}`);
        return {
          success: true,
          data: [],
          timestamp: new Date().toISOString()
        };
      }

      // 指定競馬場のURLを取得
      const targetUrl = aiIndexUrlsResponse.urls[trackCode as keyof typeof aiIndexUrlsResponse.urls];
      
      if (!targetUrl) {
        logger.warn(`指定された競馬場のAI指数URLが見つかりません: ${trackCode}`);
        return {
          success: true,
          data: [],
          timestamp: new Date().toISOString()
        };
      }

      logger.info(`AI指数スクレイピング対象URL: ${targetUrl}`);

      // スクレイパーを初期化
      await this.scraper.init();

      // 対象URLにアクセス
      await this.scraper.goto(targetUrl);

      // AI指数画像を取得
      const imageUrl = await this.scraper.getAiIndexImage();
      
      if (!imageUrl) {
        logger.warn(`AI指数画像が見つかりませんでした: ${trackCode}`);
        return {
          success: true,
          data: [],
          timestamp: new Date().toISOString()
        };
      }

      logger.info(`AI指数画像取得: ${imageUrl}`);

      // OCRで指数ランキングを解析
      const ocrResult = await extractIndexRanksFromImage(
        imageUrl,
        date,
        trackCode,
        'ai-index'
      );

      if (ocrResult.horses.length === 0) {
        logger.warn(`OCR解析に失敗しました: ${trackCode}`);
        return {
          success: true,
          data: [],
          timestamp: new Date().toISOString()
        };
      }

      // AI指数の結果を1つのレースとして処理
      const aiIndexResult: AiIndexScrapingResult = {
        date: date,
        trackCode: trackCode,
        raceNumber: ocrResult.raceNumber || 1,
        netkeiba_race_id: parseInt(`${date}${trackCode}${(ocrResult.raceNumber || 1).toString().padStart(2, '0')}`),
        race_name: `AI指数 ${trackCode}`,
        image_url: imageUrl,
        index_expectation: ocrResult.index_expectation,
        ai_index_ranks: ocrResult.horses.map(h => h.number),
        horses: ocrResult.horses
      };

      const aiIndexResults: AiIndexScrapingResult[] = [aiIndexResult];

      logger.success(`AI指数スクレイピング完了: ${aiIndexResults.length}件`);
      
      return {
        success: true,
        data: aiIndexResults,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      logger.error(`AI指数スクレイピング失敗: ${date} - ${trackCode}`, error);
      logError(error as Error, `AiIndex-${date}-${trackCode}`);
      
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
   * 複数日付・複数競馬場のAI指数を取得
   */
  async scrapeMultipleAiIndex(
    dates: string[],
    trackCodes: string[]
  ): Promise<ScrapingResult<AiIndexScrapingResult[]>> {
    try {
      logger.info(`複数AI指数スクレイピング開始: ${dates.length}日付 x ${trackCodes.length}競馬場`);
      
      const allResults: AiIndexScrapingResult[] = [];
      
      for (const date of dates) {
        for (const trackCode of trackCodes) {
          const result = await this.scrapeAiIndex(date, trackCode);
          
          if (result.success && result.data) {
            allResults.push(...result.data);
          }
          
          // 日付間での遅延
          await randomDelay(3000, 5000);
        }
      }

      logger.success(`複数AI指数スクレイピング完了: ${allResults.length}件`);
      
      return {
        success: true,
        data: allResults,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      logger.error('複数AI指数スクレイピング失敗', error);
      logError(error as Error, 'MultipleAiIndex');
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
    }
  }
}
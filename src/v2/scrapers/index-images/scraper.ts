/**
 * 指数画像スクレイピングサービス
 */

import { IndexImageScrapingResult, ScrapingResult } from '../../types/scraping';
import { extractIndexRanksFromImage } from '../../utils/ocr';
import { logger } from '../../utils/logger';
import { randomDelay } from '../../utils/delay';
import { logError } from '../../utils/file';
import { createApiClient } from '../../api/client';
import { IndexImageListResponse } from '../../../type/scraping-api-types';

export class IndexImageScraper {
  private apiClient;
  
  constructor() {
    this.apiClient = createApiClient();
  }

  /**
   * 指定日付・競馬場の指数画像を取得
   */
  async scrapeIndexImages(date: string, trackCode: string): Promise<ScrapingResult<IndexImageScrapingResult[]>> {
    try {
      logger.info(`指数画像スクレイピング開始: ${date} - ${trackCode}`);
      
      // 日付をYYYY-MM-DD形式に変換
      const formattedDate = `${date.substring(0, 4)}-${date.substring(4, 6)}-${date.substring(6, 8)}`;
      
      // APIから指定日付の画像リストを取得
      const imageListResponse = await this.apiClient.get<IndexImageListResponse>(
        `/api/index-images/list/${formattedDate}`
      );

      if (!imageListResponse.success) {
        logger.warn(`指数画像リストが見つかりませんでした: ${date}`);
        return {
          success: true,
          data: [],
          timestamp: new Date().toISOString()
        };
      }

      // 指定競馬場の画像をフィルタリング
      const targetImages = imageListResponse.images.filter(image => 
        imageListResponse.venue === trackCode
      );

      if (targetImages.length === 0) {
        logger.warn(`指定された競馬場の画像が見つかりません: ${trackCode}`);
        return {
          success: true,
          data: [],
          timestamp: new Date().toISOString()
        };
      }

      logger.info(`対象画像数: ${targetImages.length}件`);

      // 各画像を処理
      const indexImageResults: IndexImageScrapingResult[] = [];
      
      for (const image of targetImages) {
        try {
          logger.debug(`指数画像処理中: ${image.race_no}R`);
          
          // 完全なURLを構築
          const imageUrl = image.image_path.startsWith('http') 
            ? image.image_path 
            : `${this.apiClient.getConfig().baseUrl}${image.image_path}`;

          // OCRで指数ランキングを解析
          const ocrResult = await extractIndexRanksFromImage(
            imageUrl,
            date,
            trackCode,
            image.race_no.toString()
          );

          if (ocrResult.horses.length === 0) {
            logger.warn(`OCR解析に失敗しました: ${image.race_no}R`);
            continue;
          }

          const indexImageResult: IndexImageScrapingResult = {
            date: date,
            trackCode: trackCode,
            raceNumber: image.race_no,
            netkeiba_race_id: parseInt(`${date}${trackCode}${image.race_no.toString().padStart(2, '0')}`),
            race_name: `${image.race_no}R`,
            image_url: imageUrl,
            index_expectation: ocrResult.index_expectation,
            index_image_ranks: ocrResult.horses.map(h => h.number),
            horses: ocrResult.horses
          };

          indexImageResults.push(indexImageResult);
          
          // リクエスト間隔を空ける
          await randomDelay(1000, 2000);
          
        } catch (error) {
          logger.error(`指数画像処理失敗: ${image.race_no}R`, error);
          logError(error as Error, `IndexImage-${image.race_no}R`);
          continue;
        }
      }

      logger.success(`指数画像スクレイピング完了: ${indexImageResults.length}/${targetImages.length}件`);
      
      return {
        success: true,
        data: indexImageResults,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      logger.error(`指数画像スクレイピング失敗: ${date} - ${trackCode}`, error);
      logError(error as Error, `IndexImage-${date}-${trackCode}`);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * 複数日付・複数競馬場の指数画像を取得
   */
  async scrapeMultipleIndexImages(
    dates: string[],
    trackCodes: string[]
  ): Promise<ScrapingResult<IndexImageScrapingResult[]>> {
    try {
      logger.info(`複数指数画像スクレイピング開始: ${dates.length}日付 x ${trackCodes.length}競馬場`);
      
      const allResults: IndexImageScrapingResult[] = [];
      
      for (const date of dates) {
        for (const trackCode of trackCodes) {
          const result = await this.scrapeIndexImages(date, trackCode);
          
          if (result.success && result.data) {
            allResults.push(...result.data);
          }
          
          // 日付間での遅延
          await randomDelay(3000, 5000);
        }
      }

      logger.success(`複数指数画像スクレイピング完了: ${allResults.length}件`);
      
      return {
        success: true,
        data: allResults,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      logger.error('複数指数画像スクレイピング失敗', error);
      logError(error as Error, 'MultipleIndexImages');
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
    }
  }
}
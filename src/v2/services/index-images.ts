/**
 * 指数画像サービス
 */

import { ExecutionOptions } from '../types/common';
import { IndexImageScraper } from '../scrapers/index-images/scraper';
import { IndexImagesEndpoint } from '../api/endpoints/index-images';
import { createApiClient } from '../api/client';
import { mapIndexImagesToApi } from '../mappers/index-images';
import { logger } from '../utils/logger';

/**
 * 指数画像API実行
 */
export async function executeIndexImages(options: ExecutionOptions): Promise<boolean> {
  // 日付を文字列に変換
  const dateStr = Array.isArray(options.date) ? options.date[0] : options.date;
  logger.info(`指数画像API実行開始: ${dateStr}`);

  const scraper = new IndexImageScraper();
  const apiClient = createApiClient();
  const endpoint = new IndexImagesEndpoint(apiClient);
  
  try {
    // 競馬場コードが未指定の場合はエラー
    if (!options.trackCodes || options.trackCodes.length === 0) {
      logger.error('競馬場コードが指定されていません');
      return false;
    }

    // スクレイピング実行
    const scrapingResults = [];
    
    for (const trackCode of options.trackCodes) {
      logger.info(`指数画像スクレイピング: ${trackCode}`);
      const result = await scraper.scrapeIndexImages(dateStr, trackCode);
      
      if (result.success && result.data) {
        scrapingResults.push(...result.data);
      } else {
        logger.warn(`指数画像スクレイピング失敗: ${trackCode} - ${result.error}`);
      }
    }

    if (scrapingResults.length === 0) {
      logger.warn('スクレイピング対象データが見つかりませんでした');
      return false;
    }

    logger.info(`スクレイピング完了: ${scrapingResults.length}件`);

    // API形式に変換
    const apiRequests = mapIndexImagesToApi(scrapingResults);
    
    if (apiRequests.length === 0) {
      logger.warn('API送信対象データが見つかりませんでした');
      return false;
    }

    logger.info(`API送信データ: ${apiRequests.length}件`);

    // API送信
    if (options.dryRun) {
      logger.info('ドライランモード: データ送信をスキップ');
      logger.debug('送信予定データ:', JSON.stringify(apiRequests, null, 2));
      return true;
    }

    let allSuccess = true;
    
    for (const apiRequest of apiRequests) {
      try {
        logger.info(`API送信中: ${apiRequest.date} ${apiRequest.trackCode}`);
        const response = await endpoint.send(apiRequest);
        
        if (response.success) {
          logger.success(`API送信成功: ${apiRequest.trackCode}`);
        } else {
          // response.success === false の場合は ApiFailureResponse として扱う
          const errorResponse = response as any;
          logger.error(`API送信失敗: ${apiRequest.trackCode} - ${errorResponse.error?.message || 'Unknown error'}`);
          allSuccess = false;
        }
      } catch (error) {
        logger.error(`API送信エラー: ${apiRequest.trackCode}`, error);
        allSuccess = false;
      }
    }

    return allSuccess;

  } catch (error) {
    logger.error('指数画像API実行中にエラーが発生しました', error);
    return false;
  }
}
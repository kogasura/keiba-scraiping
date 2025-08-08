/**
 * 予想情報サービス
 */

import { ExecutionOptions } from '../types/common';
import { PredictionScraper } from '../scrapers/predictions/scraper';
import { PredictionsEndpoint } from '../api/endpoints/predictions';
import { createApiClient } from '../api/client';
import { mapPredictionsToApi } from '../mappers/predictions';
import { logger } from '../utils/logger';

/**
 * 予想情報API実行
 */
export async function executePredictions(options: ExecutionOptions): Promise<boolean> {
  // 日付を文字列に変換
  const dateStr = Array.isArray(options.date) ? options.date[0] : options.date;
  logger.info(`予想情報API実行開始: ${dateStr}`);

  const scraper = new PredictionScraper();
  const apiClient = createApiClient();
  const endpoint = new PredictionsEndpoint(apiClient);
  
  try {
    // 競馬場コードが未指定の場合はエラー
    if (!options.trackCodes || options.trackCodes.length === 0) {
      logger.error('競馬場コードが指定されていません');
      return false;
    }

    // 競馬場ごとに個別処理
    let allSuccess = true;
    
    for (const trackCode of options.trackCodes) {
      try {
        logger.info(`予想情報スクレイピング: ${trackCode}`);
        const result = await scraper.scrapePredictions(dateStr, trackCode);
        
        if (!result.success || !result.data || result.data.length === 0) {
          logger.warn(`予想情報スクレイピング失敗: ${trackCode} - ${result.error}`);
          allSuccess = false;
          continue;
        }

        logger.info(`スクレイピング完了: ${trackCode} - ${result.data.length}件`);

        // 即座にAPI形式に変換
        const apiRequests = mapPredictionsToApi(result.data);
        
        if (apiRequests.length === 0) {
          logger.warn(`API送信対象データなし: ${trackCode}`);
          continue;
        }

        // 即座にAPI送信
        for (const apiRequest of apiRequests) {
          try {
            logger.info(`API送信中: ${apiRequest.date} ${apiRequest.trackCode}`);
            const response = await endpoint.send(apiRequest);
            
            if (response.success) {
              logger.success(`API送信成功: ${apiRequest.trackCode} - ${response.saved_count}件保存`);
            } else {
              // response.success === false の場合は ApiErrorResponse として扱う
              const errorResponse = response as any;
              logger.error(`API送信失敗: ${apiRequest.trackCode} - ${errorResponse.error?.message || 'Unknown error'}`);
              allSuccess = false;
            }
          } catch (error) {
            logger.error(`API送信エラー: ${apiRequest.trackCode}`, error);
            allSuccess = false;
          }
        }

        // 競馬場間の遅延（最後の競馬場以外）
        if (trackCode !== options.trackCodes[options.trackCodes.length - 1]) {
          await new Promise(resolve => setTimeout(resolve, 3000));
        }

      } catch (error) {
        logger.error(`競馬場処理エラー: ${trackCode}`, error);
        allSuccess = false;
      }
    }

    return allSuccess;

  } catch (error) {
    logger.error('予想情報API実行中にエラーが発生しました', error);
    return false;
  }
}
/**
 * /api/v1/index-images エンドポイント
 */

import { ApiClient } from '../client';
import { IndexImagesRequest, ApiSuccessResponse } from '../../types/api';
import { logger } from '../../utils/logger';

export class IndexImagesEndpoint {
  constructor(private client: ApiClient) {}

  /**
   * 指数画像データをAPIに送信
   */
  async send(request: IndexImagesRequest): Promise<ApiSuccessResponse> {
    logger.info(`Sending index images for ${request.date}, track ${request.trackCode} (${request.images.length} races)`);
    
    try {
      const response = await this.client.post('/api/v1/index-images', request);
      logger.success(`Index images sent successfully: ${response.saved_count} records saved`);
      return response;
    } catch (error) {
      logger.error(`Failed to send index images: ${error}`);
      throw error;
    }
  }

  /**
   * 複数の指数画像データを一括送信
   */
  async sendBatch(requests: IndexImagesRequest[]): Promise<ApiSuccessResponse[]> {
    logger.info(`Sending ${requests.length} index images requests`);
    
    const results: ApiSuccessResponse[] = [];
    
    for (const request of requests) {
      try {
        const result = await this.send(request);
        results.push(result);
      } catch (error) {
        logger.error(`Failed to send index images for ${request.date}/${request.trackCode}: ${error}`);
        // 一つのリクエストが失敗しても他は続行
        continue;
      }
    }
    
    logger.info(`Index images batch send completed: ${results.length}/${requests.length} successful`);
    return results;
  }
}
/**
 * /api/v1/predictions エンドポイント
 */

import { ApiClient } from '../client';
import { PredictionsRequest, ApiSuccessResponse } from '../../types/api';
import { logger } from '../../utils/logger';

export class PredictionsEndpoint {
  constructor(private client: ApiClient) {}

  /**
   * 予想データをAPIに送信
   */
  async send(request: PredictionsRequest): Promise<ApiSuccessResponse> {
    logger.info(`Sending predictions for ${request.date}, track ${request.trackCode} (${request.predictions.length} races)`);
    
    try {
      const response = await this.client.post('/api/v1/predictions', request);
      logger.success(`Predictions sent successfully: ${response.saved_count} records saved`);
      return response;
    } catch (error) {
      logger.error(`Failed to send predictions: ${error}`);
      throw error;
    }
  }

  /**
   * 複数の予想データを一括送信
   */
  async sendBatch(requests: PredictionsRequest[]): Promise<ApiSuccessResponse[]> {
    logger.info(`Sending ${requests.length} predictions requests`);
    
    const results: ApiSuccessResponse[] = [];
    
    for (const request of requests) {
      try {
        const result = await this.send(request);
        results.push(result);
      } catch (error) {
        logger.error(`Failed to send predictions for ${request.date}/${request.trackCode}: ${error}`);
        // 一つのリクエストが失敗しても他は続行
        continue;
      }
    }
    
    logger.info(`Predictions batch send completed: ${results.length}/${requests.length} successful`);
    return results;
  }
}
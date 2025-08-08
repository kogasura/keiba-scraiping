/**
 * /api/v1/ai-index エンドポイント
 */

import { ApiClient } from '../client';
import { AiIndexRequest, ApiSuccessResponse } from '../../types/api';
import { logger } from '../../utils/logger';

export class AiIndexEndpoint {
  constructor(private client: ApiClient) {}

  /**
   * AI指数データをAPIに送信
   */
  async send(request: AiIndexRequest): Promise<ApiSuccessResponse> {
    logger.info(`Sending AI index for ${request.date}, track ${request.trackCode} (${request.ai_predictions.length} races)`);
    
    try {
      const response = await this.client.post('/api/v1/ai-index', request);
      logger.success(`AI index sent successfully: ${response.saved_count} records saved`);
      return response;
    } catch (error) {
      logger.error(`Failed to send AI index: ${error}`);
      throw error;
    }
  }

  /**
   * 複数のAI指数データを一括送信
   */
  async sendBatch(requests: AiIndexRequest[]): Promise<ApiSuccessResponse[]> {
    logger.info(`Sending ${requests.length} AI index requests`);
    
    const results: ApiSuccessResponse[] = [];
    
    for (const request of requests) {
      try {
        const result = await this.send(request);
        results.push(result);
      } catch (error) {
        logger.error(`Failed to send AI index for ${request.date}/${request.trackCode}: ${error}`);
        // 一つのリクエストが失敗しても他は続行
        continue;
      }
    }
    
    logger.info(`AI index batch send completed: ${results.length}/${requests.length} successful`);
    return results;
  }
}
/**
 * /api/v1/race-results エンドポイント
 */

import { ApiClient } from '../client';
import { RaceResultsRequest, ApiSuccessResponse } from '../../types/api';
import { logger } from '../../utils/logger';

export class RaceResultsEndpoint {
  constructor(private client: ApiClient) {}

  /**
   * レース結果データをAPIに送信
   */
  async send(request: RaceResultsRequest): Promise<ApiSuccessResponse> {
    logger.info(`Sending race results for ${request.date}, track ${request.trackCode} (${request.results.length} races)`);
    
    try {
      const response = await this.client.post('/api/v1/race-results', request);
      logger.success(`Race results sent successfully: ${response.saved_count} records saved`);
      return response;
    } catch (error) {
      logger.error(`Failed to send race results: ${error}`);
      throw error;
    }
  }

  /**
   * 複数のレース結果データを一括送信
   */
  async sendBatch(requests: RaceResultsRequest[]): Promise<ApiSuccessResponse[]> {
    logger.info(`Sending ${requests.length} race results requests`);
    
    const results: ApiSuccessResponse[] = [];
    
    for (const request of requests) {
      try {
        const result = await this.send(request);
        results.push(result);
      } catch (error) {
        logger.error(`Failed to send race results for ${request.date}/${request.trackCode}: ${error}`);
        // 一つのリクエストが失敗しても他は続行
        continue;
      }
    }
    
    logger.info(`Race results batch send completed: ${results.length}/${requests.length} successful`);
    return results;
  }
}
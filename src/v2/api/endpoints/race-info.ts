/**
 * /api/v1/race-info エンドポイント
 */

import { ApiClient } from '../client';
import { RaceInfoRequest, ApiSuccessResponse } from '../../types/api';
import { logger } from '../../utils/logger';

export class RaceInfoEndpoint {
  constructor(private client: ApiClient) {}

  /**
   * レース情報をAPIに送信
   */
  async send(request: RaceInfoRequest): Promise<ApiSuccessResponse> {
    logger.info(`Sending race info for ${request.date}, track ${request.trackCode} (${request.races.length} races)`);
    
    try {
      const response = await this.client.post('/api/v1/race-info', request);
      logger.success(`Race info sent successfully: ${response.saved_count} records saved`);
      return response;
    } catch (error) {
      logger.error(`Failed to send race info: ${error}`);
      throw error;
    }
  }

  /**
   * 複数のレース情報を一括送信
   */
  async sendBatch(requests: RaceInfoRequest[]): Promise<ApiSuccessResponse[]> {
    logger.info(`Sending ${requests.length} race info requests`);
    
    const results: ApiSuccessResponse[] = [];
    
    for (const request of requests) {
      try {
        const result = await this.send(request);
        results.push(result);
      } catch (error) {
        logger.error(`Failed to send race info for ${request.date}/${request.trackCode}: ${error}`);
        // 一つのリクエストが失敗しても他は続行
        continue;
      }
    }
    
    logger.info(`Race info batch send completed: ${results.length}/${requests.length} successful`);
    return results;
  }
}
/**
 * API送信基盤クライアント
 */

import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { ApiClientConfig, ApiSuccessResponse, ApiFailureResponse, ApiResponse } from '../types/api';
import { logger } from '../utils/logger';
import { exponentialBackoff } from '../utils/delay';
import * as fs from 'fs';
import * as path from 'path';

export class ApiClient {
  private client: AxiosInstance;
  private config: ApiClientConfig;
  private debugDir: string = 'debug/api-logs';

  constructor(config: ApiClientConfig) {
    // デバッグディレクトリの作成
    this.ensureDebugDir();
    this.config = config;
    this.client = axios.create({
      baseURL: config.baseUrl,
      timeout: config.timeout || 30000,
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': config.apiKey,
      },
    });

    // レスポンスインターセプター
    this.client.interceptors.response.use(
      response => response,
      error => {
        logger.error(`API request failed: ${error.message}`);
        if (error.response?.data) {
          logger.error('API error response:', JSON.stringify(error.response.data, null, 2));
        }
        return Promise.reject(error);
      }
    );
  }

  /**
   * デバッグディレクトリの作成
   */
  private ensureDebugDir(): void {
    if (!fs.existsSync(this.debugDir)) {
      fs.mkdirSync(this.debugDir, { recursive: true });
    }
  }

  /**
   * デバッグ用にリクエスト/レスポンスを保存
   */
  private saveDebugLog(type: 'request' | 'response', endpoint: string, data: any, trackCode?: string): void {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const trackPart = trackCode ? `_${trackCode}` : '';
    const filename = `${type}_${endpoint.replace(/\//g, '_')}${trackPart}_${timestamp}.json`;
    const filepath = path.join(this.debugDir, filename);
    
    try {
      fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
      logger.debug(`Debug log saved: ${filepath}`);
    } catch (error) {
      logger.warn(`Failed to save debug log: ${error}`);
    }
  }

  /**
   * POST リクエスト送信（リトライ付き）
   */
  async post<T extends object>(
    endpoint: string,
    data: T,
    options: { retries?: number } = {}
  ): Promise<ApiSuccessResponse> {
    const maxRetries = options.retries ?? this.config.retries ?? 3;
    
    // リクエストからtrackCodeを抽出（存在する場合）
    const trackCode = (data as any).trackCode;
    
    // デバッグ用にリクエストを保存
    this.saveDebugLog('request', endpoint, data, trackCode);
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        logger.debug(`API POST request to ${endpoint} (attempt ${attempt + 1}/${maxRetries + 1})`);
        
        const response = await this.client.post<ApiResponse>(endpoint, data);
        
        // デバッグ用にレスポンスを保存
        this.saveDebugLog('response', endpoint, response.data, trackCode);
        
        if (!response.data.success) {
          const errorResponse = response.data as ApiFailureResponse;
          logger.error(`API error: ${errorResponse.error.message}`);
          throw new Error(errorResponse.error.message);
        }
        
        const successResponse = response.data as ApiSuccessResponse;
        logger.info(`API success: ${successResponse.saved_count} records saved`);
        return successResponse;
        
      } catch (error: any) {
        logger.warn(`API request failed (attempt ${attempt + 1}): ${error}`);
        
        // エラーレスポンスも保存
        if (error.response?.data) {
          this.saveDebugLog('response', endpoint, {
            error: true,
            status: error.response.status,
            data: error.response.data
          }, trackCode);
        }
        
        if (attempt === maxRetries) {
          throw error;
        }
        
        // 指数バックオフで待機
        await exponentialBackoff(attempt);
      }
    }
    
    throw new Error(`API request failed after ${maxRetries + 1} attempts`);
  }

  /**
   * GET リクエスト送信（リトライ付き）
   */
  async get<T = any>(
    endpoint: string,
    options: { retries?: number } = {}
  ): Promise<T> {
    const maxRetries = options.retries ?? this.config.retries ?? 3;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        logger.debug(`API GET request to ${endpoint} (attempt ${attempt + 1}/${maxRetries + 1})`);
        
        const response = await this.client.get<T>(endpoint);
        
        logger.debug(`API GET success: ${endpoint}`);
        return response.data;
        
      } catch (error) {
        logger.warn(`API GET request failed (attempt ${attempt + 1}): ${error}`);
        
        if (attempt === maxRetries) {
          throw error;
        }
        
        // 指数バックオフで待機
        await exponentialBackoff(attempt);
      }
    }
    
    throw new Error(`API GET request failed after ${maxRetries + 1} attempts`);
  }

  /**
   * 設定を取得
   */
  getConfig(): ApiClientConfig {
    return { ...this.config };
  }

  /**
   * ベースURLを設定
   */
  setBaseUrl(baseUrl: string): void {
    this.config.baseUrl = baseUrl;
    this.client.defaults.baseURL = baseUrl;
  }

  /**
   * APIキーを設定
   */
  setApiKey(apiKey: string): void {
    this.config.apiKey = apiKey;
    this.client.defaults.headers['X-API-KEY'] = apiKey;
  }
}

/**
 * 環境変数から設定を取得してAPIクライアントを作成
 */
export function createApiClient(): ApiClient {
  const config: ApiClientConfig = {
    baseUrl: process.env.LARAVEL_API_BASE_URL || 'http://localhost:80',
    apiKey: process.env.LARAVEL_API_KEY || '',
    timeout: 30000,
    retries: 3,
  };

  return new ApiClient(config);
}
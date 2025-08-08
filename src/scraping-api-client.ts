import axios from 'axios';
import {
  RaceInfoRequest,
  PredictionsRequest,
  AiIndexRequest,
  IndexImagesRequest,
  RaceResultsRequest,
  ApiResponse,
  ApiSuccessResponse,
  ApiFailureResponse,
} from './type/scraping-api-types';

/**
 * .env から Laravel API ベース URL を取得 (例: http://localhost:8000)
 * 無ければ同階層の .env の既定値が dotenv 経由で読み込まれている想定。
 */
const API_BASE_URL = process.env.LARAVEL_API_BASE_URL || 'http://localhost:80';

/**
 * リクエスト共通ヘッダ
 *  - Content-Type は application/json
 *  - 認証が必要な場合は .env の API_KEY を送る想定
 */
function defaultHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'X-API-KEY': process.env.LARAVEL_API_KEY || '',
  };
}

/** 共通の POST ヘルパー */
async function postJson<T extends object>(url: string, body: T): Promise<ApiSuccessResponse> {
  const { data } = await axios.post<ApiResponse>(`${API_BASE_URL}${url}`, body, {
    headers: defaultHeaders(),
  });
  if (!data.success) {
    console.error(`API Error @ ${url}:`, data.error);
    throw new Error(data.error.message);
  }
  return data;
}

export async function sendRaceInfo(payload: RaceInfoRequest): Promise<ApiSuccessResponse> {
  return postJson('/api/v1/race-info', payload);
}

export async function sendPredictions(payload: PredictionsRequest): Promise<ApiSuccessResponse> {
  return postJson('/api/v1/predictions', payload);
}

export async function sendAiIndex(payload: AiIndexRequest): Promise<ApiSuccessResponse> {
  return postJson('/api/v1/ai-index', payload);
}

export async function sendIndexImages(payload: IndexImagesRequest): Promise<ApiSuccessResponse> {
  return postJson('/api/v1/index-images', payload);
}

export async function sendRaceResults(payload: RaceResultsRequest): Promise<ApiSuccessResponse> {
  return postJson('/api/v1/race-results', payload);
} 
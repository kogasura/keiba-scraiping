// ============================================
// 統合APIクライアントサービス
// ============================================

import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { 
  RaceBasicInfo, 
  PredictionData, 
  AiPredictionData, 
  IndexImageData, 
  RaceResultData,
  ApiResponse 
} from '../types';

export class ScrapingApiClient {
  private axiosInstance: AxiosInstance;
  private baseURL: string;
  private apiKey: string;

  constructor() {
    this.baseURL = process.env.LARAVEL_API_BASE_URL || 'http://localhost:80';
    this.apiKey = process.env.LARAVEL_API_KEY || '';
    
    this.axiosInstance = axios.create({
      baseURL: this.baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': this.apiKey,
        'Accept': 'application/json'
      }
    });

    // レスポンスインターセプター
    this.axiosInstance.interceptors.response.use(
      (response) => {
        return response;
      },
      (error) => {
        console.error('API通信エラー:', error.response?.data || error.message);
        return Promise.reject(error);
      }
    );
  }

  // ============================================
  // 1. レース基本情報送信
  // ============================================

  async sendRaceInfo(raceInfoList: RaceBasicInfo[]): Promise<ApiResponse> {
    try {
      const transformedData = this.transformRaceInfoForApi(raceInfoList);
      
      // デバッグ用: 送信データの件数をログ出力
      console.log(`Sending ${transformedData.length} races to API`);
      
      // APIが期待する形式: トップレベルに date, trackCode を追加
      const payload = {
        date: raceInfoList[0]?.date || '',
        trackCode: raceInfoList[0]?.trackCode || '',
        races: transformedData
      };
      
      const response = await this.axiosInstance.post('/api/v1/race-info', payload);

      return this.handleApiResponse(response.data);
    } catch (error) {
      throw this.handleApiError('race-info', error);
    }
  }

  // ============================================
  // 2. 予想データ送信
  // ============================================

  async sendPredictions(predictionList: PredictionData[]): Promise<ApiResponse> {
    try {
      const transformedData = this.transformPredictionsForApi(predictionList);
      
      const response = await this.axiosInstance.post('/api/v1/predictions', {
        predictions: transformedData
      });

      return this.handleApiResponse(response.data);
    } catch (error) {
      throw this.handleApiError('predictions', error);
    }
  }

  // ============================================
  // 3. AI予想データ送信
  // ============================================

  async sendAiPredictions(aiPredictionList: AiPredictionData[]): Promise<ApiResponse> {
    try {
      const transformedData = this.transformAiPredictionsForApi(aiPredictionList);
      
      const response = await this.axiosInstance.post('/api/v1/ai-index', {
        ai_predictions: transformedData
      });

      return this.handleApiResponse(response.data);
    } catch (error) {
      throw this.handleApiError('ai-index', error);
    }
  }

  // ============================================
  // 4. 指数画像データ送信
  // ============================================

  async sendIndexImages(indexImageList: IndexImageData[]): Promise<ApiResponse> {
    try {
      const transformedData = this.transformIndexImagesForApi(indexImageList);
      
      const response = await this.axiosInstance.post('/api/v1/index-images', {
        images: transformedData
      });

      return this.handleApiResponse(response.data);
    } catch (error) {
      throw this.handleApiError('index-images', error);
    }
  }

  // ============================================
  // 5. レース結果送信
  // ============================================

  async sendRaceResults(raceResultList: RaceResultData[]): Promise<ApiResponse> {
    try {
      const transformedData = this.transformRaceResultsForApi(raceResultList);
      
      const response = await this.axiosInstance.post('/api/v1/race-results', {
        results: transformedData
      });

      return this.handleApiResponse(response.data);
    } catch (error) {
      throw this.handleApiError('race-results', error);
    }
  }

  // ============================================
  // データ変換メソッド
  // ============================================

  private transformRaceInfoForApi(raceInfoList: RaceBasicInfo[]) {
    return raceInfoList.map(race => ({
      date: race.date,
      trackCode: race.trackCode,
      raceNumber: race.raceNumber,
      race_name: race.name, // name → race_name に変更
      start_time: race.startTime,
      course_type: this.mapCourseTypeToApi(race.courseType), // course_type の値をマッピング
      distance: race.distance,
      weather: race.weather,
      track_condition: race.trackCondition,
      horses: race.horses.map(horse => ({
        horse_number: horse.number,
        horse_name: horse.name,
        jockey_name: horse.jockey,
        trainer_name: horse.trainer,
        weight: horse.weight,
        gender: this.mapGenderToApi(horse.gender),
        age: horse.age,
        popularity: horse.popularity,
        win_odds: horse.odds,
        frame_number: horse.frameNumber
      }))
    }));
  }

  private transformPredictionsForApi(predictionList: PredictionData[]) {
    return predictionList.map(prediction => ({
      date: prediction.date,
      trackCode: prediction.trackCode,
      raceNumber: prediction.raceNumber,
      // Netkeiba予想データ
      cp_ranks: prediction.sources.netkeiba?.cpRanks || null,
      data_analysis_ranks: prediction.sources.netkeiba?.dataAnalysisRanks || null,
      time_index_max_ranks: prediction.sources.netkeiba?.timeIndices?.max || null,
      time_index_avg_ranks: prediction.sources.netkeiba?.timeIndices?.avg || null,
      time_index_distance_ranks: prediction.sources.netkeiba?.timeIndices?.distance || null,
      deviation_ranks: prediction.sources.netkeiba?.analysis?.deviationRanks || [],
      rapid_rise_ranks: prediction.sources.netkeiba?.analysis?.rapidRiseRanks || [],
      personal_best_ranks: prediction.sources.netkeiba?.analysis?.personalBestRanks || [],
      popularity_risk: prediction.sources.netkeiba?.analysis?.popularityRisk || null,
      // WIN競馬予想データ
      win_prediction_ranks: prediction.sources.winkeiba?.winPredictionRanks || [],
      time_ranks: prediction.sources.winkeiba?.timeRanks || null,
      last_3f_ranks: prediction.sources.winkeiba?.last3fRanks || null,
      horse_trait_ranks: prediction.sources.winkeiba?.horseTraitRanks || null,
      // UMAX予想データ
      umax_ranks: prediction.sources.umax?.ranks || null,
      umax_sp_values: prediction.sources.umax?.indices?.sp || null,
      umax_ag_values: prediction.sources.umax?.indices?.ag || null,
      umax_sa_values: prediction.sources.umax?.indices?.sa || null,
      umax_ki_values: prediction.sources.umax?.indices?.ki || null
    }));
  }

  private transformAiPredictionsForApi(aiPredictionList: AiPredictionData[]) {
    return aiPredictionList.map(prediction => ({
      date: prediction.date,
      trackCode: prediction.trackCode,
      raceNumber: prediction.raceNumber,
      ai_ranks: prediction.aiRanks
    }));
  }

  private transformIndexImagesForApi(indexImageList: IndexImageData[]) {
    return indexImageList.map(image => ({
      date: image.date,
      trackCode: image.trackCode,
      raceNumber: image.raceNumber,
      url: image.imageUrl,
      index_ranks: image.indexRanks,
      index_expectation: image.expectationGrade
    }));
  }

  private transformRaceResultsForApi(raceResultList: RaceResultData[]) {
    return raceResultList.map(result => ({
      date: result.date,
      trackCode: result.trackCode,
      raceNumber: result.raceNumber,
      finish: {
        first: {
          horse_number: result.results.first.horseNumber,
          horse_name: result.results.first.horseName,
          popularity: result.results.first.popularity
        },
        second: {
          horse_number: result.results.second.horseNumber,
          horse_name: result.results.second.horseName,
          popularity: result.results.second.popularity
        },
        third: {
          horse_number: result.results.third.horseNumber,
          horse_name: result.results.third.horseName,
          popularity: result.results.third.popularity
        }
      },
      payouts: {
        win: result.payouts.win,
        place: result.payouts.place,
        quinella: result.payouts.quinella,
        trio: result.payouts.trio,
        trifecta: result.payouts.trifecta
      }
    }));
  }

  // ============================================
  // ユーティリティメソッド
  // ============================================

  private mapGenderToApi(gender: string): string {
    switch (gender) {
      case 'male': return '牡';
      case 'female': return '牝';
      case 'gelding': return 'セ';
      default: return gender;
    }
  }

  private mapCourseTypeToApi(courseType: string): string {
    switch (courseType) {
      case 'turf': return '芝';
      case 'dirt': return 'ダート';
      case 'obstacle': return '障害';
      default: return courseType;
    }
  }

  private handleApiResponse(data: any): ApiResponse {
    if (!data.success) {
      throw new Error(data.error?.message || 'API処理に失敗しました');
    }
    
    return {
      success: true,
      data: data.data,
      saved_count: data.saved_count,
      processing_time: data.processing_time
    };
  }

  private handleApiError(endpoint: string, error: any): Error {
    const message = error.response?.data?.error?.message || 
                   error.response?.data?.message || 
                   error.message || 
                   'API通信エラーが発生しました';
    
    // Validation エラーの詳細を表示
    if (error.response?.data?.error?.details) {
      console.error(`${endpoint} Validation Details:`, JSON.stringify(error.response.data.error.details, null, 2));
    }
    
    return new Error(`${endpoint} API Error: ${message}`);
  }

  // ============================================
  // バッチ送信メソッド
  // ============================================

  async sendAllData(data: {
    raceInfo?: RaceBasicInfo[];
    predictions?: PredictionData[];
    aiPredictions?: AiPredictionData[];
    indexImages?: IndexImageData[];
    raceResults?: RaceResultData[];
  }): Promise<Record<string, ApiResponse>> {
    const results: Record<string, ApiResponse> = {};
    const promises: Promise<void>[] = [];

    if (data.raceInfo && data.raceInfo.length > 0) {
      promises.push(
        this.sendRaceInfo(data.raceInfo)
          .then(response => { results.raceInfo = response; })
          .catch(error => { results.raceInfo = { success: false, error: error.message }; })
      );
    }

    if (data.predictions && data.predictions.length > 0) {
      promises.push(
        this.sendPredictions(data.predictions)
          .then(response => { results.predictions = response; })
          .catch(error => { results.predictions = { success: false, error: error.message }; })
      );
    }

    if (data.aiPredictions && data.aiPredictions.length > 0) {
      promises.push(
        this.sendAiPredictions(data.aiPredictions)
          .then(response => { results.aiPredictions = response; })
          .catch(error => { results.aiPredictions = { success: false, error: error.message }; })
      );
    }

    if (data.indexImages && data.indexImages.length > 0) {
      promises.push(
        this.sendIndexImages(data.indexImages)
          .then(response => { results.indexImages = response; })
          .catch(error => { results.indexImages = { success: false, error: error.message }; })
      );
    }

    if (data.raceResults && data.raceResults.length > 0) {
      promises.push(
        this.sendRaceResults(data.raceResults)
          .then(response => { results.raceResults = response; })
          .catch(error => { results.raceResults = { success: false, error: error.message }; })
      );
    }

    await Promise.allSettled(promises);
    return results;
  }

  // ============================================
  // 設定メソッド
  // ============================================

  updateConfig(config: { 
    baseURL?: string; 
    apiKey?: string; 
    timeout?: number; 
  }): void {
    if (config.baseURL) {
      this.baseURL = config.baseURL;
      this.axiosInstance.defaults.baseURL = config.baseURL;
    }
    
    if (config.apiKey) {
      this.apiKey = config.apiKey;
      this.axiosInstance.defaults.headers['X-API-KEY'] = config.apiKey;
    }
    
    if (config.timeout) {
      this.axiosInstance.defaults.timeout = config.timeout;
    }
  }

  // ヘルスチェック
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.axiosInstance.get('/api/health');
      return response.status === 200;
    } catch (error) {
      console.error('Health check failed:', error);
      return false;
    }
  }
}
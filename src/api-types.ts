// バッチジョブの種類
export enum BatchJobType {
  RACE_INFO = 'race_info',
  RACE_RESULT = 'race_result',
  PREDICTION = 'prediction',
  INDEX = 'index',
  AI_INDEX = 'ai_index'
}

// バッチジョブのステータス
export enum BatchJobStatus {
  QUEUED = 'queued',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed'
}

// バッチジョブの基本インターフェース
export interface BaseBatchJob {
  id: string;
  status: BatchJobStatus;
  result?: any;
  error?: string;
  started_at?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
}

// レース情報ジョブ
export interface RaceInfoJob extends BaseBatchJob {
  type: BatchJobType.RACE_INFO;
  parameters: {
    date: string;
  };
}

// レース結果ジョブ
export interface RaceResultJob extends BaseBatchJob {
  type: BatchJobType.RACE_RESULT;
  parameters: {
    date: string;
    track_codes: string[];
  };
}

// 予測ジョブ
export interface PredictionJob extends BaseBatchJob {
  type: BatchJobType.PREDICTION;
  parameters: {
    date: string;
    sources: string[];
    track_codes: string[];
  };
}

// 指数ジョブ
export interface IndexJob extends BaseBatchJob {
  type: BatchJobType.INDEX;
  parameters: {
    date: string;
    track_code: string;
    image_urls: string[];
  };
}

// AI指数ジョブ
export interface AiIndexJob extends BaseBatchJob {
  type: BatchJobType.AI_INDEX;
  parameters: {
    date: string;
    track_code: string;
    url: string;
  };
}

// バッチジョブの型
export type BatchJob = 
  | RaceInfoJob
  | RaceResultJob
  | PredictionJob
  | IndexJob
  | AiIndexJob;

// レース情報データのインターフェース
export interface RaceInfoData {
  trackCode: string;
  raceNumber: number;
  name: string;
  date: string;
  start_time: string;
  course_type: string;
  distance: number;
  weather?: string;
  course_condition?: string;
  horses: RaceHorseData[];
}

// 出走馬情報のインターフェース
export interface RaceHorseData {
  horse_number: number;
  frame_number: number;
  horse_name: string;
  jockey_name: string;
  trainer_name: string;
  weight?: number;
  gender: string;
  age: number;
  popularity?: number;
  win_odds?: number;
}

// レース結果データのインターフェース
export interface RaceResultData {
  date: string;                // レース日付
  trackCode: string;           // 競馬場コード
  raceNumber: string;          // レース番号
  // 着順情報
  first_place?: {
    horse_number: number;      // 馬番
    horse_name: string;        // 馬名
    popularity: number;        // 人気
  };
  second_place?: {
    horse_number: number;      // 馬番
    horse_name: string;        // 馬名
    popularity: number;        // 人気
  };
  third_place?: {
    horse_number: number;      // 馬番
    horse_name: string;        // 馬名
    popularity: number;        // 人気
  };
  // 配当情報
  win?: {                      // 単勝
    horse_number: number;      // 馬番
    popularity: number;        // 人気順
    payout: number;            // 払戻金額
  };
  place?: {                    // 複勝
    horses: [
      {
        horse_number: number;  // 馬番
        popularity: number;    // 人気順
        payout: number;        // 払戻金額
      },
      {
        horse_number: number;  // 馬番
        popularity: number;    // 人気順
        payout: number;        // 払戻金額
      },
      {
        horse_number: number;  // 馬番
        popularity: number;    // 人気順
        payout: number;        // 払戻金額
      }
    ]
  };
  bracket_quinella?: {         // 枠連
    combination: string;       // 組み合わせ
    popularity: number;        // 人気順
    payout: number;            // 払戻金額
  };
  quinella?: {                 // 馬連
    combination: string;       // 組み合わせ
    popularity: number;        // 人気順
    payout: number;            // 払戻金額
  };
  quinella_place?: {           // ワイド
    combinations: string[];    // 組み合わせリスト
    popularity: number[];      // 人気順リスト
    payouts: number[];         // 払戻金額リスト
  };
  exacta?: {                   // 馬単
    combination: string;       // 組み合わせ
    popularity: number;        // 人気順
    payout: number;            // 払戻金額
  };
  trio?: {                     // 三連複
    combination: string;       // 組み合わせ
    popularity: number;        // 人気順
    payout: number;            // 払戻金額
  };
  trifecta?: {                 // 三連単
    combination: string;       // 組み合わせ
    popularity: number;        // 人気順
    payout: number;            // 払戻金額
  };
}


// 予測データのインターフェース
export interface PredictionData {
  date: string;
  trackCode: string;
  raceNumber: number;
  win_prediction_ranks?: number[];
  cp_ranks?: [number, number, number, number];
  data_analysis_ranks?: [number, number, number];
  time_ranks?: (number | null)[];
  last_3f_ranks?: (number | null)[];
  horse_trait_ranks?: [number, number, number];
  deviation_ranks?: number[];
  rapid_rise_ranks?: number[];
  personal_best_ranks?: number[];
  popularity_risk?: number | null;
  time_index_max_ranks?: [number, number, number, number, number];
  time_index_avg_ranks?: [number, number, number, number, number];
  time_index_distance_ranks?: [number, number, number, number, number];
  index_ranks?: [number, number, number, number, number, number, number, number];
  index_expectation?: string;
  ai_ranks?: (number | undefined)[];
  jravan_prediction_ranks?: [number, number, number, number, number, number];
  high_expectation_list1?: boolean;
  high_expectation_list2?: boolean;
  netkeiba_race_id?: number;
  raceName?: string;
  trackType?: string;
  distance?: number;
}

// 指数画像処理結果のインターフェース
export interface IndexImageResultData {
  url: string;
  is_processed: boolean;
  date: string;
  trackCode: string;
  raceNumber: number;
  index_ranks: number[];
  index_expectation?: string;
}

// AI指数データのインターフェース
export interface AiIndexData {
  date: string;
  trackCode: string;
  raceNumber: string;
  ai_ranks: (number | null)[];
}

// APIレスポンスの基本インターフェース
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
}

// バッチジョブ更新リクエストのインターフェース
export interface BatchJobUpdateRequest {
  status: BatchJobStatus;
  result?: any;
  error?: string;
}

// 未処理のバッチジョブ一覧レスポンスのインターフェース
export interface QueuedJobsResponse {
  jobs: {
    id: string;
    type: string;
    parameters: {
      date?: string;
      sources?: string[];
      url?: string;
      track_code?: string;
      track_codes?: string[];
      image_urls?: string[];
    };
    created_at: string;
  }[];
}

// レース情報登録レスポンスのインターフェース
export interface RaceInfoRegisterResponse {
  saved_race_count: number;
  saved_horse_count: number;
  batch_job_id: string;
}

// レース結果登録レスポンスのインターフェース
export interface RaceResultRegisterResponse {
  updated_race_count: number;
  updated_horse_count: number;
  batch_job_id: string;
}

// 予測データ登録レスポンスのインターフェース
export interface PredictionRegisterResponse {
  saved_count: number;
  batch_job_id: string;
}

// 指数画像処理結果更新レスポンスのインターフェース
export interface IndexImageResultRegisterResponse {
  updated_count: number;
  batch_job_id: string;
}

// AI指数データ登録レスポンスのインターフェース
export interface AiIndexRegisterResponse {
  saved_count: number;
  batch_job_id: string;
}

// レース情報取得後の返送リクエストのインターフェース
export interface RaceInfoBatchRequest {
  races: RaceInfoData[];
}

// API送信結果の基本インターフェース
export interface ApiSendResult {
  success: boolean;
  message: string;
  data?: any;
  error?: string;
}

// 各バッチジョブ処理結果のインターフェース
export interface RaceInfoJobResult extends ApiSendResult {
  data?: {
    saved_race_count: number;
    saved_horse_count: number;
    batch_job_id: string;
  };
}

export interface RaceResultJobResult extends ApiSendResult {
  data?: {
    updated_race_count: number;
    updated_horse_count: number;
    batch_job_id: string;
  };
}

export interface PredictionJobResult extends ApiSendResult {
  data?: {
    saved_count: number;
    batch_job_id: string;
  };
}

export interface IndexJobResult extends ApiSendResult {
  data?: {
    updated_count: number;
    batch_job_id: string;
  };
}

export interface AiIndexJobResult extends ApiSendResult {
  data?: {
    saved_count: number;
    batch_job_id: string;
  };
}

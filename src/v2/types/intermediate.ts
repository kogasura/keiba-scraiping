/**
 * 中間ファイル関連の型定義
 */

export type ApiType = 'race-info' | 'predictions' | 'ai-index' | 'index-images' | 'race-results';

export type StageType = 'scrape' | 'validate' | 'send' | 'all';

export type IntermediateFileStatus = 'pending' | 'validated' | 'sent' | 'failed';

export interface IntermediateFileMetadata {
  api: ApiType;
  date: string;           // YYYY-MM-DD
  trackCode: string;      // '01'-'10'
  createdAt: string;      // ISO timestamp
  dataCount: number;      // データ件数
  status: IntermediateFileStatus;
  errors?: string[];      // 検証エラー
  version: string;        // フォーマットバージョン
}

export interface IntermediateFile<T = any> {
  metadata: IntermediateFileMetadata;
  data: T[];   // 各APIの送信データ
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface IntermediateFileInfo {
  filePath: string;
  metadata: IntermediateFileMetadata;
}
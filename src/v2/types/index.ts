// ============================================
// 型定義エクスポート
// ============================================

// ドメイン型
export * from './domains';

// スクレイピングサービス型
export * from './scrapers';

// 後方互換性のための型マッピング（必要に応じて）
export { RaceKey as RaceIdentifier } from './domains';
export { PredictionData as PredictionResult } from './domains';
export { RaceBasicInfo as RaceInfo } from './domains';
/**
 * 予想情報データバリデーター
 */

import { ValidationResult } from '../types/intermediate';
import { logger } from '../utils/logger';

/**
 * 予想情報データの検証
 */
export async function validatePredictionsData(data: any[]): Promise<ValidationResult> {
  const result: ValidationResult = {
    isValid: true,
    errors: [],
    warnings: []
  };

  if (!Array.isArray(data)) {
    result.errors.push('データが配列ではありません');
    result.isValid = false;
    return result;
  }

  if (data.length === 0) {
    result.warnings.push('データが空です');
    return result;
  }

  // 各データアイテムの検証
  for (let i = 0; i < data.length; i++) {
    const item = data[i];
    const prefix = `データ[${i}]`;

    // 必須フィールドの検証
    if (!item.date) {
      result.errors.push(`${prefix}: dateが必須です`);
      result.isValid = false;
    } else if (!/^\d{4}-\d{2}-\d{2}$/.test(item.date)) {
      result.errors.push(`${prefix}: dateの形式が正しくありません (YYYY-MM-DD)`);
      result.isValid = false;
    }

    if (!item.trackCode) {
      result.errors.push(`${prefix}: trackCodeが必須です`);
      result.isValid = false;
    } else if (!/^(0[1-9]|10)$/.test(item.trackCode)) {
      result.errors.push(`${prefix}: trackCodeが正しくありません (01-10)`);
      result.isValid = false;
    }

    if (!Array.isArray(item.predictions)) {
      result.errors.push(`${prefix}: predictionsが配列ではありません`);
      result.isValid = false;
      continue;
    }

    // 予想データの検証
    for (let j = 0; j < item.predictions.length; j++) {
      const prediction = item.predictions[j];
      const predictionPrefix = `${prefix}.predictions[${j}]`;

      // レース番号の検証
      if (typeof prediction.raceNumber !== 'number' || prediction.raceNumber < 1 || prediction.raceNumber > 12) {
        result.errors.push(`${predictionPrefix}: raceNumberが正しくありません (1-12)`);
        result.isValid = false;
      }

      // 必須配列フィールドの検証
      validateRankArray(prediction.win_prediction_ranks, `${predictionPrefix}.win_prediction_ranks`, 'win_prediction_ranks', 3, 8, result);
      validateRankArray(prediction.jravan_prediction_ranks, `${predictionPrefix}.jravan_prediction_ranks`, 'jravan_prediction_ranks', 6, 6, result);
      validateRankArray(prediction.cp_ranks, `${predictionPrefix}.cp_ranks`, 'cp_ranks', 4, 4, result);
      validateRankArray(prediction.data_analysis_ranks, `${predictionPrefix}.data_analysis_ranks`, 'data_analysis_ranks', 3, 3, result);
      validateRankArray(prediction.time_ranks, `${predictionPrefix}.time_ranks`, 'time_ranks', 3, 3, result);
      validateRankArray(prediction.last_3f_ranks, `${predictionPrefix}.last_3f_ranks`, 'last_3f_ranks', 3, 3, result);
      validateRankArray(prediction.horse_trait_ranks, `${predictionPrefix}.horse_trait_ranks`, 'horse_trait_ranks', 3, 3, result);
      validateRankArray(prediction.time_index_max_ranks, `${predictionPrefix}.time_index_max_ranks`, 'time_index_max_ranks', 5, 5, result);
      validateRankArray(prediction.time_index_avg_ranks, `${predictionPrefix}.time_index_avg_ranks`, 'time_index_avg_ranks', 5, 5, result);
      validateRankArray(prediction.time_index_distance_ranks, `${predictionPrefix}.time_index_distance_ranks`, 'time_index_distance_ranks', 5, 5, result);

      // 可変長配列フィールドの検証
      if (prediction.deviation_ranks && !Array.isArray(prediction.deviation_ranks)) {
        result.errors.push(`${predictionPrefix}: deviation_ranksが配列ではありません`);
        result.isValid = false;
      }

      if (prediction.rapid_rise_ranks && !Array.isArray(prediction.rapid_rise_ranks)) {
        result.errors.push(`${predictionPrefix}: rapid_rise_ranksが配列ではありません`);
        result.isValid = false;
      }

      if (prediction.personal_best_ranks && !Array.isArray(prediction.personal_best_ranks)) {
        result.errors.push(`${predictionPrefix}: personal_best_ranksが配列ではありません`);
        result.isValid = false;
      }

      // 人気リスクの検証
      if (prediction.popularity_risk !== null && typeof prediction.popularity_risk !== 'string') {
        result.errors.push(`${predictionPrefix}: popularity_riskが文字列またはnullではありません`);
        result.isValid = false;
      }

      // オプション項目（UMAX予想）の検証
      if (prediction.umax_ranks) {
        validateRankArray(prediction.umax_ranks, `${predictionPrefix}.umax_ranks`, 'umax_ranks', 5, 5, result);
      }
      if (prediction.umax_sp_values) {
        validateRankArray(prediction.umax_sp_values, `${predictionPrefix}.umax_sp_values`, 'umax_sp_values', 5, 5, result);
      }
      if (prediction.umax_ag_values) {
        validateRankArray(prediction.umax_ag_values, `${predictionPrefix}.umax_ag_values`, 'umax_ag_values', 5, 5, result);
      }
      if (prediction.umax_sa_values) {
        validateRankArray(prediction.umax_sa_values, `${predictionPrefix}.umax_sa_values`, 'umax_sa_values', 5, 5, result);
      }
      if (prediction.umax_ki_values) {
        validateRankArray(prediction.umax_ki_values, `${predictionPrefix}.umax_ki_values`, 'umax_ki_values', 5, 5, result);
      }

      // 馬番の範囲チェック
      validateHorseNumbers(prediction.win_prediction_ranks, `${predictionPrefix}.win_prediction_ranks`, result);
      validateHorseNumbers(prediction.deviation_ranks, `${predictionPrefix}.deviation_ranks`, result);
      validateHorseNumbers(prediction.rapid_rise_ranks, `${predictionPrefix}.rapid_rise_ranks`, result);
      validateHorseNumbers(prediction.personal_best_ranks, `${predictionPrefix}.personal_best_ranks`, result);
    }

    // 予想数の妥当性チェック
    if (item.predictions.length === 0) {
      result.warnings.push(`${prefix}: 予想データが空です`);
    } else if (item.predictions.length > 12) {
      result.warnings.push(`${prefix}: 予想数が多すぎます (${item.predictions.length}レース)`);
    }
  }

  // 統計情報をログ出力
  const totalPredictions = data.reduce((sum, item) => sum + (item.predictions?.length || 0), 0);
  logger.info(`予想情報検証完了: ${data.length}件, ${totalPredictions}レース`);

  if (result.errors.length > 0) {
    logger.error(`検証エラー: ${result.errors.length}件`);
  }

  if (result.warnings.length > 0) {
    logger.warn(`検証警告: ${result.warnings.length}件`);
  }

  return result;
}

/**
 * ランク配列の検証
 */
function validateRankArray(
  array: any,
  path: string,
  fieldName: string,
  minLength: number,
  maxLength: number,
  result: ValidationResult
): void {
  if (!Array.isArray(array)) {
    result.errors.push(`${path}: ${fieldName}が配列ではありません`);
    result.isValid = false;
    return;
  }

  if (array.length < minLength || array.length > maxLength) {
    if (minLength === maxLength) {
      result.errors.push(`${path}: ${fieldName}の長さが正しくありません (${maxLength}固定)`);
    } else {
      result.errors.push(`${path}: ${fieldName}の長さが正しくありません (${minLength}-${maxLength})`);
    }
    result.isValid = false;
    return;
  }

  // 馬番の範囲チェック（nullは許可）
  for (let i = 0; i < array.length; i++) {
    const value = array[i];
    if (value !== null && (typeof value !== 'number' || value < 1 || value > 18)) {
      result.warnings.push(`${path}[${i}]: 馬番が範囲外です (${value})`);
    }
  }
}

/**
 * 馬番配列の検証
 */
function validateHorseNumbers(array: any, path: string, result: ValidationResult): void {
  if (!Array.isArray(array)) {
    return; // 既に他の検証でエラーになっているはず
  }

  for (let i = 0; i < array.length; i++) {
    const value = array[i];
    if (typeof value !== 'number' || value < 1 || value > 18) {
      result.warnings.push(`${path}[${i}]: 馬番が範囲外です (${value})`);
    }
  }
}
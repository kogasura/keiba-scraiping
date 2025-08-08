/**
 * レース情報データバリデーター
 */

import { ValidationResult } from '../types/intermediate';
import { logger } from '../utils/logger';

/**
 * レース情報データの検証
 */
export async function validateRaceInfoData(data: any[]): Promise<ValidationResult> {
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

    if (!Array.isArray(item.races)) {
      result.errors.push(`${prefix}: racesが配列ではありません`);
      result.isValid = false;
      continue;
    }

    // レースデータの検証
    for (let j = 0; j < item.races.length; j++) {
      const race = item.races[j];
      const racePrefix = `${prefix}.races[${j}]`;

      // レース必須フィールド
      if (typeof race.raceNumber !== 'number' || race.raceNumber < 1 || race.raceNumber > 12) {
        result.errors.push(`${racePrefix}: raceNumberが正しくありません (1-12)`);
        result.isValid = false;
      }

      if (!race.race_name || typeof race.race_name !== 'string') {
        result.errors.push(`${racePrefix}: race_nameが必須です`);
        result.isValid = false;
      }

      // netkeiba_race_idは必須ではない（API形式では含まれない）
      if (race.netkeiba_race_id !== undefined && typeof race.netkeiba_race_id !== 'number') {
        result.errors.push(`${racePrefix}: netkeiba_race_idが数値ではありません`);
        result.isValid = false;
      }

      if (!Array.isArray(race.horses)) {
        result.errors.push(`${racePrefix}: horsesが配列ではありません`);
        result.isValid = false;
        continue;
      }

      // 馬データの検証
      const horseNumbers = new Set<number>();
      for (let k = 0; k < race.horses.length; k++) {
        const horse = race.horses[k];
        const horsePrefix = `${racePrefix}.horses[${k}]`;

        // 馬番の検証
        if (typeof horse.horse_number !== 'number' || horse.horse_number < 1 || horse.horse_number > 18) {
          result.errors.push(`${horsePrefix}: horse_numberが正しくありません (1-18)`);
          result.isValid = false;
        } else {
          // 馬番重複チェック
          if (horseNumbers.has(horse.horse_number)) {
            result.errors.push(`${racePrefix}: 馬番${horse.horse_number}が重複しています`);
            result.isValid = false;
          }
          horseNumbers.add(horse.horse_number);
        }

        // 馬名の検証
        if (!horse.horse_name || typeof horse.horse_name !== 'string') {
          result.errors.push(`${horsePrefix}: horse_nameが必須です`);
          result.isValid = false;
        }

        // 騎手名の検証
        if (!horse.jockey_name || typeof horse.jockey_name !== 'string') {
          result.errors.push(`${horsePrefix}: jockey_nameが必須です`);
          result.isValid = false;
        }

        // 調教師名の検証
        if (!horse.trainer_name || typeof horse.trainer_name !== 'string') {
          result.errors.push(`${horsePrefix}: trainer_nameが必須です`);
          result.isValid = false;
        }

        // 性別の検証
        if (!horse.gender || typeof horse.gender !== 'string') {
          result.errors.push(`${horsePrefix}: genderが必須です`);
          result.isValid = false;
        }

        // 年齢の検証
        if (typeof horse.age !== 'number' || horse.age < 2 || horse.age > 10) {
          result.errors.push(`${horsePrefix}: ageが正しくありません (2-10)`);
          result.isValid = false;
        }

        // オプション項目の検証
        if (horse.weight !== undefined && (typeof horse.weight !== 'number' || horse.weight < 400 || horse.weight > 600)) {
          result.warnings.push(`${horsePrefix}: weightが異常値です (${horse.weight}kg)`);
        }

        if (horse.popularity !== undefined && (typeof horse.popularity !== 'number' || horse.popularity < 1 || horse.popularity > 18)) {
          result.warnings.push(`${horsePrefix}: popularityが異常値です (${horse.popularity})`);
        }

        if (horse.win_odds !== undefined && (typeof horse.win_odds !== 'number' || horse.win_odds < 1.0)) {
          result.warnings.push(`${horsePrefix}: win_oddsが異常値です (${horse.win_odds})`);
        }
      }

      // 馬数の妥当性チェック
      if (race.horses.length === 0) {
        result.errors.push(`${racePrefix}: 馬データが空です`);
        result.isValid = false;
      } else if (race.horses.length > 18) {
        result.warnings.push(`${racePrefix}: 馬数が多すぎます (${race.horses.length}頭)`);
      }
    }

    // レース数の妥当性チェック
    if (item.races.length === 0) {
      result.warnings.push(`${prefix}: レースデータが空です`);
    } else if (item.races.length > 12) {
      result.warnings.push(`${prefix}: レース数が多すぎます (${item.races.length}レース)`);
    }
  }

  // 統計情報をログ出力
  const totalRaces = data.reduce((sum, item) => sum + (item.races?.length || 0), 0);
  const totalHorses = data.reduce((sum, item) => 
    sum + (item.races?.reduce((raceSum: number, race: any) => raceSum + (race.horses?.length || 0), 0) || 0), 0
  );

  logger.info(`レース情報検証完了: ${data.length}件, ${totalRaces}レース, ${totalHorses}頭`);

  if (result.errors.length > 0) {
    logger.error(`検証エラー: ${result.errors.length}件`);
  }

  if (result.warnings.length > 0) {
    logger.warn(`検証警告: ${result.warnings.length}件`);
  }

  return result;
}
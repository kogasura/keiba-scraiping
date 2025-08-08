import { RaceInfoRequest, RankArray, PredictionsRequest } from './type/scraping-api-types';
import { RaceInfo, AnalysisItem } from './types';

/**
 * YYYYMMDD → YYYY-MM-DD
 */
function formatDate(date: string): `${number}-${number}-${number}` {
  if (date.length !== 8) return date as any;
  return `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}` as any;
}

/**
 * Netkeiba などから取得したレース詳細の配列を `RaceInfoRequest` にマッピング
 */
export function toRaceInfoRequest(
  dateYYYYMMDD: string,
  trackCode: string,
  details: RaceInfo[],
): RaceInfoRequest {
  return {
    date: formatDate(dateYYYYMMDD),
    trackCode: trackCode as any,
    races: details.map((d) => ({
      raceNumber: d.raceNumber,
      race_name: d.race_name,
      start_time: d.start_time as `${number}:${number}`,
      course_type: d.track_type,
      distance: d.distance,
      weather: d.weather || null,
      track_condition: d.track_condition || null,
      horses: (d.entries ?? []).map((e) => ({
        horse_number: e.horse_number,
        horse_name: e.horse_name,
        jockey_name: e.jockey,
        trainer_name: e.trainer,
        weight: e.weight ?? null,
        gender: (e.sex_age ?? '').charAt(0) as any,
        age: parseInt((e.sex_age ?? '').slice(1)) || 0,
        popularity: e.popularity ?? null,
        win_odds: e.odds ?? null,
      })),
    })),
  };
}

// =============== Prediction Mapper ===============

// RankArray の長さを満たすように null 埋め
function pad<N extends number>(src: (number | null | undefined)[] | undefined, len: N): RankArray<N> {
  const cleaned = (src ?? []).map(v => (v === undefined ? null : v));
  return ([...cleaned, ...Array(len).fill(null)].slice(0, len) as RankArray<N>);
}

export function toPredictionsRequest(
  dateYYYYMMDD: string,
  trackCode: string,
  items: AnalysisItem[],
): PredictionsRequest {
  return {
    date: formatDate(dateYYYYMMDD),
    trackCode: trackCode as any,
    predictions: items.map((i) => ({
      raceNumber: i.raceNumber,
      win_prediction_ranks: ((i.win_prediction_ranks ?? []).filter((n): n is number => n !== undefined) as number[]),
      jravan_prediction_ranks: pad(i.jravan_prediction_ranks, 6),
      cp_ranks: pad(i.cp_ranks, 4),
      data_analysis_ranks: pad(i.data_analysis_ranks, 3),
      time_ranks: pad(i.time_ranks, 3),
      last_3f_ranks: pad(i.last_3f_ranks, 3),
      horse_trait_ranks: pad(i.horse_trait_ranks, 3),
      deviation_ranks: i.deviation_ranks ?? [],
      rapid_rise_ranks: i.rapid_rise_ranks ?? [],
      personal_best_ranks: i.personal_best_ranks ?? null,
      popularity_risk: i.popularity_risk ?? null,
      time_index_max_ranks: pad(i.time_index_max_ranks, 5),
      time_index_avg_ranks: pad(i.time_index_avg_ranks, 5),
      time_index_distance_ranks: pad(i.time_index_distance_ranks, 5),
      // --- UMAX --------------------------------------------------
      umax_ranks: pad(i.umax_prediction?.focusedHorseNumbers, 5),
      umax_sp_values: pad(i.umax_prediction?.spValueTop5, 5),
      umax_ag_values: pad(i.umax_prediction?.agValueTop5, 5),
      umax_sa_values: pad(i.umax_prediction?.saValueTop5, 5),
      umax_ki_values: pad(i.umax_prediction?.kiValueTop3, 5),
    })),
  };
} 
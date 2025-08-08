import { NetkeibaScraper } from './netkeiba-scraper';
import { WinkeibaScraperService } from './winkeiba-scraper';
import { generateHorseTraitRanking, generateLast3FRanking, generateTimeRanking, generateWinPredictionRanking } from './formatter-utils';
import { randomDelay } from './utils';
import { AnalysisItem } from './types';
import { getTrackName } from './consts';
import { UmaxScraperService } from './umax-scraper';

/**
 * Netkeiba から日付×競馬場の AnalysisItem[] を取得
 */
export async function scrapeNetkeibaAnalysis(dateYYYYMMDD: string, trackCode: string): Promise<AnalysisItem[]> {
  const scraper = new NetkeibaScraper();
  await scraper.init();
  await scraper.login();

  const analysis: AnalysisItem[] = [];
  const raceList = (await scraper.getRaceList(dateYYYYMMDD))
    .filter(r => r.trackCode === trackCode);

  for (const race of raceList) {
    try {
      const timeIndexMax      = await scraper.getTimeIndexMax(race.netkeiba_race_id);
      const timeIndexAverage  = await scraper.getTimeIndexAverage(race.netkeiba_race_id);
      const timeIndexDistance = await scraper.getTimeIndexDistance(race.netkeiba_race_id);
      const dataAnalysis      = await scraper.getDataAnalysis(race.netkeiba_race_id);
      const dataAnalysisRank  = await scraper.getDataAnalysisRanking(race.netkeiba_race_id);
      const cpPrediction      = await scraper.getCPPrediction(race.netkeiba_race_id);

      analysis.push({
        date: dateYYYYMMDD,
        trackCode,
        raceNumber: race.raceNumber,
        netkeiba_race_id: race.netkeiba_race_id,
        raceName: race.race_name,
        trackType: race.track_type,
        distance: race.distance,
        deviation_ranks: dataAnalysis.deviation_ranks,
        rapid_rise_ranks: dataAnalysis.rapid_rise_ranks,
        personal_best_ranks: dataAnalysis.personal_best_ranks,
        popularity_risk: dataAnalysis.popularity_risk,
        data_analysis_ranks: dataAnalysisRank?.data_analysis_ranks,
        cp_ranks: cpPrediction.cp_ranks,
        time_index_max_ranks: timeIndexMax.time_index_horse_numbers,
        time_index_avg_ranks: timeIndexAverage.time_index_horse_numbers,
        time_index_distance_ranks: timeIndexDistance.time_index_horse_numbers,
      });

      await randomDelay(800, 1500);
    } catch (e) {
      console.error(`[netkeiba] ${getTrackName(trackCode)} ${race.raceNumber}R 取得失敗`, e);
    }
  }

  await scraper.close();
  return analysis;
}

/**
 * WIN競馬の分析データを AnalysisItem[] にマージ
 */
export async function scrapeWinKeibaAnalysis(dateYYYYMMDD: string, trackCode: string, base: AnalysisItem[]): Promise<AnalysisItem[]> {
  const service = new WinkeibaScraperService();
  await service.init();
  const login = await service.login();
  if (!login) {
    console.warn('WIN競馬ログイン失敗。スキップします');
    await service.close();
    return base;
  }

  const raceList = await service.getRaceList(dateYYYYMMDD, [trackCode]);

  for (const race of raceList) {
    const { DOR, RacetrackCd, RaceNum } = race;
    try {
      const marks = await service.getRaceMarks(DOR, RacetrackCd, RaceNum);
      const analysisData = await service.getAnalysisData(DOR, RacetrackCd, RaceNum);

      const winRank   = generateWinPredictionRanking(marks.marks);
      const timeRank  = generateTimeRanking(analysisData);
      const last3f    = generateLast3FRanking(analysisData);
      const traitRank = generateHorseTraitRanking(analysisData);

      const idx = base.findIndex(a => a.date === DOR && a.trackCode === RacetrackCd && a.raceNumber === parseInt(RaceNum));
      if (idx !== -1) {
        base[idx] = { ...base[idx], ...winRank, ...timeRank, ...last3f, ...traitRank };
      } else {
        base.push({
          date: DOR,
          trackCode: RacetrackCd,
          raceNumber: parseInt(RaceNum),
          ...winRank,
          ...timeRank,
          ...last3f,
          ...traitRank,
        });
      }

      await randomDelay(800, 1500);
    } catch (e) {
      console.error(`[WIN] ${getTrackName(trackCode)} ${RaceNum}R 取得失敗`, e);
    }
  }

  await service.close();
  return base;
}

/**
 * UMAX 予想を AnalysisItem[] にマージ
 */
export async function scrapeUmaxAnalysis(dateYYYYMMDD: string, trackCode: string, base: AnalysisItem[]): Promise<AnalysisItem[]> {
  const service = new UmaxScraperService();
  await service.init();

  const predictions = await service.getRacePredictionByDate(dateYYYYMMDD);
  await service.close();

  // trackCode フィルタ
  const list = predictions.filter(p => p.trackCode === trackCode);
  for (const p of list) {
    const raceNum = parseInt(p.raceNumber);
    const idx = base.findIndex(a => a.date === dateYYYYMMDD && a.trackCode === trackCode && a.raceNumber === raceNum);
    if (idx !== -1) {
      base[idx] = { ...base[idx], umax_prediction: p };
    } else {
      base.push({
        date: dateYYYYMMDD,
        trackCode,
        raceNumber: raceNum,
        umax_prediction: p,
      });
    }
  }
  return base;
}

/**
 * date, trackCode 単位で Netkeiba + WIN競馬 を統合した AnalysisItem[] を返す
 */
export async function scrapePredictions(dateYYYYMMDD: string, trackCode: string, includeWin = true, includeUmax = false): Promise<AnalysisItem[]> {
  let items = await scrapeNetkeibaAnalysis(dateYYYYMMDD, trackCode);
  if (includeWin) {
    items = await scrapeWinKeibaAnalysis(dateYYYYMMDD, trackCode, items);
  }
  if (includeUmax) {
    items = await scrapeUmaxAnalysis(dateYYYYMMDD, trackCode, items);
  }
  return items;
} 
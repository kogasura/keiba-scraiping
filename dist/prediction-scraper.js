"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.scrapePredictions = exports.scrapeUmaxAnalysis = exports.scrapeWinKeibaAnalysis = exports.scrapeNetkeibaAnalysis = void 0;
const netkeiba_scraper_1 = require("./netkeiba-scraper");
const winkeiba_scraper_1 = require("./winkeiba-scraper");
const formatter_utils_1 = require("./formatter-utils");
const utils_1 = require("./utils");
const consts_1 = require("./consts");
const umax_scraper_1 = require("./umax-scraper");
/**
 * Netkeiba から日付×競馬場の AnalysisItem[] を取得
 */
async function scrapeNetkeibaAnalysis(dateYYYYMMDD, trackCode) {
    const scraper = new netkeiba_scraper_1.NetkeibaScraper();
    await scraper.init();
    await scraper.login();
    const analysis = [];
    const raceList = (await scraper.getRaceList(dateYYYYMMDD))
        .filter(r => r.trackCode === trackCode);
    for (const race of raceList) {
        try {
            const timeIndexMax = await scraper.getTimeIndexMax(race.netkeiba_race_id);
            const timeIndexAverage = await scraper.getTimeIndexAverage(race.netkeiba_race_id);
            const timeIndexDistance = await scraper.getTimeIndexDistance(race.netkeiba_race_id);
            const dataAnalysis = await scraper.getDataAnalysis(race.netkeiba_race_id);
            const dataAnalysisRank = await scraper.getDataAnalysisRanking(race.netkeiba_race_id);
            const cpPrediction = await scraper.getCPPrediction(race.netkeiba_race_id);
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
            await (0, utils_1.randomDelay)(800, 1500);
        }
        catch (e) {
            console.error(`[netkeiba] ${(0, consts_1.getTrackName)(trackCode)} ${race.raceNumber}R 取得失敗`, e);
        }
    }
    await scraper.close();
    return analysis;
}
exports.scrapeNetkeibaAnalysis = scrapeNetkeibaAnalysis;
/**
 * WIN競馬の分析データを AnalysisItem[] にマージ
 */
async function scrapeWinKeibaAnalysis(dateYYYYMMDD, trackCode, base) {
    const service = new winkeiba_scraper_1.WinkeibaScraperService();
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
            const winRank = (0, formatter_utils_1.generateWinPredictionRanking)(marks.marks);
            const timeRank = (0, formatter_utils_1.generateTimeRanking)(analysisData);
            const last3f = (0, formatter_utils_1.generateLast3FRanking)(analysisData);
            const traitRank = (0, formatter_utils_1.generateHorseTraitRanking)(analysisData);
            const idx = base.findIndex(a => a.date === DOR && a.trackCode === RacetrackCd && a.raceNumber === parseInt(RaceNum));
            if (idx !== -1) {
                base[idx] = { ...base[idx], ...winRank, ...timeRank, ...last3f, ...traitRank };
            }
            else {
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
            await (0, utils_1.randomDelay)(800, 1500);
        }
        catch (e) {
            console.error(`[WIN] ${(0, consts_1.getTrackName)(trackCode)} ${RaceNum}R 取得失敗`, e);
        }
    }
    await service.close();
    return base;
}
exports.scrapeWinKeibaAnalysis = scrapeWinKeibaAnalysis;
/**
 * UMAX 予想を AnalysisItem[] にマージ
 */
async function scrapeUmaxAnalysis(dateYYYYMMDD, trackCode, base) {
    const service = new umax_scraper_1.UmaxScraperService();
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
        }
        else {
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
exports.scrapeUmaxAnalysis = scrapeUmaxAnalysis;
/**
 * date, trackCode 単位で Netkeiba + WIN競馬 を統合した AnalysisItem[] を返す
 */
async function scrapePredictions(dateYYYYMMDD, trackCode, includeWin = true, includeUmax = false) {
    let items = await scrapeNetkeibaAnalysis(dateYYYYMMDD, trackCode);
    if (includeWin) {
        items = await scrapeWinKeibaAnalysis(dateYYYYMMDD, trackCode, items);
    }
    if (includeUmax) {
        items = await scrapeUmaxAnalysis(dateYYYYMMDD, trackCode, items);
    }
    return items;
}
exports.scrapePredictions = scrapePredictions;

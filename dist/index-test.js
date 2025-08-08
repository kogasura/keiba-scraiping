"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const h58_ai_1 = require("./h58_ai");
const netkeiba_scraper_1 = require("./netkeiba-scraper");
const utils_1 = require("./utils");
const date = '20250406';
// const url = 'https://note.com/h58_ai/n/n7918c6d7d2e8';
// const trackCode = '06';
const url = 'https://note.com/h58_ai/n/nf293289ed055';
const trackCode = '06';
async function main() {
    // NetkeibaScraperのインスタンスを作成
    const netkeibaScraperService = new netkeiba_scraper_1.NetkeibaScraper();
    try {
        // スクレイパーを初期化
        await netkeibaScraperService.init();
        console.log('netkeiba.comスクレイパーを初期化しました');
        await netkeibaScraperService.login();
        // テスト用のレースID
        const testRaceId = 202509020409; // テスト用のレースID
        // データ分析ランキングを取得
        console.log(`レースID ${testRaceId} のデータ分析ランキングを取得します...`);
        const dataAnalysisRanking = await netkeibaScraperService.getDataAnalysisRanking(testRaceId);
        console.log('データ分析ランキング結果:');
        console.log(JSON.stringify(dataAnalysisRanking, null, 2));
    }
    catch (error) {
        console.error('処理中にエラーが発生しました:', error);
    }
    finally {
        // スクレイパーを終了
        await netkeibaScraperService.close();
        console.log('netkeiba.comスクレイパーを終了しました');
    }
}
// AI予想の項目に関するデータをNoteから取得する
async function getAiPrediction(analysis, url, date, trackCode) {
    try {
        console.log(`${date} ${trackCode} のAI予想画像を取得します...`);
        // noteから画像を取得
        const imagePaths = await (0, h58_ai_1.fetchImagesFromNote)(url, date, trackCode);
        console.log(`${imagePaths.length}枚の画像を取得しました`);
        // // 画像からテキストを抽出
        const ocrResults = await (0, h58_ai_1.extractTextFromImages)(imagePaths);
        console.log('OCR結果:', JSON.stringify(ocrResults, null, 2));
        // // 対応するanalysisアイテムにAI予想結果を追加
        for (const item of analysis) {
            if (item.date === date && item.trackCode === trackCode) {
                // レース番号に対応する結果を見つける
                const matchingResult = ocrResults.find(result => parseInt(result.raceNumber) === item.raceNumber);
                if (matchingResult && matchingResult.ai_ranks) {
                    console.log(`AI予想を取得しました: ${date} ${trackCode} ${item.raceNumber}R`);
                    item.ai_ranks = matchingResult.ai_ranks;
                }
                else {
                    console.log(`AI予想が見つかりませんでした: ${date} ${trackCode} ${item.raceNumber}R`);
                }
            }
        }
        // 連続アクセスを避けるためのランダム待機
        await (0, utils_1.randomDelay)(1000, 2000);
    }
    catch (error) {
        console.error(`${date} ${trackCode} のAI予想取得中にエラーが発生しました:`, error);
    }
    return analysis;
}
// netkeibaから日付を指定し、そのすべてのレース情報を取得し、AnalysisItem配列に格納して返す
async function scrapeNetkeiba(date, analysis) {
    const scraper = new netkeiba_scraper_1.NetkeibaScraper();
    await scraper.init();
    console.log('netkeibaにログイン中...');
    await scraper.login();
    console.log('netkeibaにログイン完了');
    // 単一日付のレース一覧を取得
    const raceList = await scraper.getRaceList(date);
    (0, utils_1.saveToJson)(raceList, `races_${date}.json`);
    (0, utils_1.saveToExcel)(raceList, `races_${date}.xlsx`);
    // 各レースのタイム指数を取得
    console.log(`${raceList.length}件のレースのタイム指数を取得します...`);
    for (const race of raceList) {
        try {
            console.log(`${race.course} ${race.raceNumber}R (${race.race_name}) のタイム指数を取得中...`);
            // const timeIndexMax = await scraper.getTimeIndexMax(race.netkeiba_race_id);
            // const timeIndexAverage = await scraper.getTimeIndexAverage(race.netkeiba_race_id);
            // const timeIndexDistance = await scraper.getTimeIndexDistance(race.netkeiba_race_id);
            // const dataAnalysis = await scraper.getDataAnalysis(race.netkeiba_race_id)
            // const dataAnalysisRanking = await scraper.getDataAnalysisRanking(race.netkeiba_race_id);
            // const cpPrediction = await scraper.getCPPrediction(race.netkeiba_race_id);
            // console.log('timeIndexMax', timeIndexMax);
            // console.log('timeIndexAverage', timeIndexAverage);
            // console.log('timeIndexDistance', timeIndexDistance);
            // console.log('dataAnalysis', dataAnalysis);
            // console.log('dataAnalysisRanking', dataAnalysisRanking);
            // console.log('cpPrediction', cpPrediction);
            console.log(`${race.course} ${race.raceNumber}R のタイム指数を取得しました`);
            analysis.push({
                raceName: race.race_name,
                trackType: race.track_type,
                distance: race.distance,
                date: race.date,
                trackCode: race.trackCode,
                raceNumber: race.raceNumber,
                netkeiba_race_id: race.netkeiba_race_id,
                // deviation_ranks: dataAnalysis.deviation_ranks,
                // rapid_rise_ranks: dataAnalysis.rapid_rise_ranks,
                // personal_best_ranks: dataAnalysis.personal_best_ranks,
                // popularity_risk: dataAnalysis.popularity_risk,
                // data_analysis_ranks: dataAnalysisRanking.data_analysis_ranks,
                // cp_ranks: cpPrediction.cp_ranks,
                // time_index_max_ranks: timeIndexMax.time_index_horse_numbers,
                // time_index_avg_ranks: timeIndexAverage.time_index_horse_numbers,
                // time_index_distance_ranks: timeIndexDistance.time_index_horse_numbers
            });
            console.log(analysis[analysis.length - 1]);
            // 連続アクセスを避けるためのランダム待機
            await (0, utils_1.randomDelay)(1000, 2000);
        }
        catch (error) {
            console.error(`${race.course} ${race.raceNumber}R のタイム指数取得中にエラーが発生しました:`, error);
        }
    }
    // レース詳細情報の取得
    console.log(`${raceList.length}件のレース詳細情報を取得します...`);
    await scraper.close();
    console.log('処理が完了しました');
    return analysis;
}
main();

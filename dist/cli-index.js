"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const netkeiba_scraper_1 = require("./netkeiba-scraper");
const utils_1 = require("./utils");
const winkeiba_scraper_1 = require("./winkeiba-scraper");
const formatter_utils_1 = require("./formatter-utils");
const consts_1 = require("./consts");
const playwright_utlis_1 = require("./playwright-utlis");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const excel_utils_1 = require("./excel-utils");
const note_image_ocr_1 = require("./note-image-ocr");
const h58_ai_1 = require("./h58_ai");
const umax_scraper_1 = require("./umax-scraper");
const umax_excel_utils_1 = require("./umax-excel-utils");
async function main() {
    try {
        // 処理する日付のリスト
        const dates = [
            '20250719',
            // '20250713',
            // '20250712',
            // '20250706',
            // '20250705',
            // '20250629',
            // '20250628',
            // '20250622',
            // '20250621',
            // '20250615',
            // '20250614',
            // '20250608',
            // '20250607',
            // '20250601',
            // '20250531',
            // '20250525',
            // '20250524',
            // '20250518',
            // '20250517',
            // '20250511',
            // '20250510',
            // '20250504',
            // '20250503',
            // '20250427'
            // '20250426',
            // '20250420',
            // '20250419',
            // '20250405',
            // '20250330',
            // '20250329',
            // '20250323',
            // '20250322',
            // '20250316',
            // '20250315',
            // '20250309',
            // '20250308',
            // '20250302',
            // '20250301',
            // '20250223',
            // '20250222',
            // '20250216',
            // '20250215',
            // '20250210',
            // '20250209',
            // '20250208',
            // '20250202',
            // '20250201'
        ];
        // ここを書き換える事。
        const track_codes = [
            '10',
            '03',
            '02', // 函館
        ];
        // 各日付に対して処理を実行
        for (const date of dates) {
            console.log(`${date} の処理を開始します...`);
            const analysis = [];
            await scrapeNetkeiba(date, analysis);
            await getUmaxRacePrediction(date, analysis);
            await scrapeWinKeiba(date, track_codes, analysis);
            // await getIndexRanksFromImage(analysis);
            // await getRaceResult(analysis);
            // await getAiPrediction(analysis, 'https://note.com/h58_ai/n/n1393895832e6', date, '02');
            // await getAiPrediction(analysis, 'https://note.com/h58_ai/n/n4dcafd3a64fc', date, '03');
            // await getAiPrediction(analysis, 'http://note.com/h58_ai/n/n4224813b1d0a', date, '10');
            (0, excel_utils_1.saveAnalysisToExcel)(analysis, `予想_${date}.xlsx`);
            console.log(`${date} の処理が完了しました`);
        }
        // コマンドライン引数の処理
        // const args = process.argv.slice(2);
        // let date = formatDate(new Date());
        // // --date 引数のみ処理
        // for (let i = 0; i < args.length; i++) {
        //     if (args[i] === '--date' && args[i + 1]) {
        //         date = args[i + 1];
        //         i++;
        //     }
        // }
        // const analysis: AnalysisItem[] = [];
        // await scrapeNetkeiba(date, analysis);
        // // await scrapeWinKeiba(date, analysis);
        // // await getIndexRanksFromImage(analysis);
        // // await getRaceResult(analysis);
        // // await getAiPrediction(analysis, 'https://note.com/h58_ai/n/ndb3472cabded', date, '03');
        // // await getAiPrediction(analysis, 'https://note.com/h58_ai/n/n550eac8e1a50', date, '06');
        // // await getAiPrediction(analysis, 'https://note.com/h58_ai/n/n4d7b65c024ae', date, '09');
        // saveAnalysisToExcel(analysis, `analysis_${date}_time_index.xlsx`);
    }
    catch (error) {
        console.error('エラーが発生しました:', error);
        process.exit(1);
    }
}
/**
 * UMA-Xから予想データを取得し、AnalysisItemに追加して返す
 * @param date 日付（YYYYMMDD形式の文字列）
 * @param analysis AnalysisItemの配列
 * @returns 更新されたAnalysisItemの配列
 */
async function getUmaxRacePrediction(date, analysis) {
    const umaxScraper = new umax_scraper_1.UmaxScraperService();
    await umaxScraper.init();
    // UMA-Xから予想データを取得
    const umaxPredictions = await umaxScraper.getRacePredictionByDate(date);
    // Excelに保存（既存コード）
    (0, umax_excel_utils_1.saveUmaxPredictionsToExcel)(umaxPredictions, `umax_predictions_${date}.xlsx`);
    console.log(`UMA-X予想データを${umaxPredictions.length}件取得しました`);
    // UMA-X予想データをAnalysisItemに追加
    for (const umaxData of umaxPredictions) {
        // AnalysisItemの中から同じレースを検索
        const raceNumber = parseInt(umaxData.raceNumber);
        const existingAnalysisIndex = analysis.findIndex(item => item.date === umaxData.date &&
            item.trackCode === umaxData.trackCode &&
            item.raceNumber === raceNumber);
        if (existingAnalysisIndex !== -1) {
            // 既存のデータがある場合は更新
            analysis[existingAnalysisIndex] = {
                ...analysis[existingAnalysisIndex],
                umax_prediction: umaxData
            };
            console.log(`レース情報を更新: ${umaxData.date} ${(0, consts_1.getTrackName)(umaxData.trackCode)} ${raceNumber}R`);
        }
        else {
            // 対応するレースが見つからない場合、新規追加
            analysis.push({
                date: umaxData.date,
                trackCode: umaxData.trackCode,
                raceNumber: raceNumber,
                umax_prediction: umaxData
            });
            console.log(`新規レース情報を追加: ${umaxData.date} ${(0, consts_1.getTrackName)(umaxData.trackCode)} ${raceNumber}R`);
        }
        // 各レースの分析データをJSONファイルに保存
        const analysisFilename = `umax_${umaxData.date}_${umaxData.trackCode}_${raceNumber}.json`;
        const analysisDir = path_1.default.join('data', 'analysis');
        (0, playwright_utlis_1.ensureDirectoryExists)(analysisDir);
        const analysisFilePath = path_1.default.join(analysisDir, analysisFilename);
        fs_1.default.writeFileSync(analysisFilePath, JSON.stringify({
            date: umaxData.date,
            trackCode: umaxData.trackCode,
            raceNumber: raceNumber,
            umax_prediction: umaxData
        }, null, 2));
        console.log(`UMA-X予想データを${analysisFilePath}に保存しました`);
    }
    await umaxScraper.close();
    // 更新されたanalysis配列を返す
    return analysis;
}
async function scrapeWinKeiba(date, track_codes, analysis) {
    // WIN競馬スクレイパーの初期化
    const winkeibaScraperService = new winkeiba_scraper_1.WinkeibaScraperService();
    await winkeibaScraperService.init();
    // WIN競馬サイトにログイン
    console.log('WIN競馬サイトにログイン中...');
    const loginSuccess = await winkeibaScraperService.login();
    if (!loginSuccess) {
        console.error('WIN競馬サイトへのログインに失敗しました。処理を中止します。');
        await winkeibaScraperService.close();
        process.exit(1);
    }
    console.log('WIN競馬サイトへのログインに成功しました。処理を続行します。');
    const raceList = await winkeibaScraperService.getRaceList(date, track_codes);
    console.log('レース一覧:', raceList);
    // 各レースの分析データを取得してAnalysisItem配列に格納
    for (const race of raceList) {
        const { DOR, RacetrackCd, RaceNum } = race;
        console.log(`レース分析データ取得: ${(0, consts_1.getTrackName)(RacetrackCd)} ${RaceNum}R`);
        try {
            // 新聞印情報を取得
            const marks = await winkeibaScraperService.getRaceMarks(DOR, RacetrackCd, RaceNum);
            console.log(`新聞印情報: ${marks.marks.length}件取得`);
            // 分析データを取得
            const analysisData = await winkeibaScraperService.getAnalysisData(DOR, RacetrackCd, RaceNum);
            console.log(`分析データ取得完了`);
            const winPredictionRanking = (0, formatter_utils_1.generateWinPredictionRanking)(marks.marks);
            const timeRanking = (0, formatter_utils_1.generateTimeRanking)(analysisData);
            const last3FRanking = (0, formatter_utils_1.generateLast3FRanking)(analysisData);
            const horseTraitRanking = (0, formatter_utils_1.generateHorseTraitRanking)(analysisData);
            // 分析データをanalysis配列に追加
            if (analysisData) {
                // 既存のデータを探す
                const existingAnalysisIndex = analysis.findIndex(item => item.date === DOR &&
                    item.trackCode === RacetrackCd &&
                    item.raceNumber === parseInt(RaceNum));
                if (existingAnalysisIndex !== -1) {
                    // 既存のデータがある場合は更新
                    analysis[existingAnalysisIndex] = {
                        ...analysis[existingAnalysisIndex],
                        ...winPredictionRanking,
                        ...timeRanking,
                        ...last3FRanking,
                        ...horseTraitRanking
                    };
                }
                else {
                    // 新規データの場合は追加
                    analysis.push({
                        date: DOR,
                        trackCode: RacetrackCd,
                        raceNumber: parseInt(RaceNum),
                        ...winPredictionRanking,
                        ...timeRanking,
                        ...last3FRanking,
                        ...horseTraitRanking
                    });
                }
            }
            // 各レースの分析データをJSONファイルに保存
            const analysisFilename = `analysis_${DOR}_${RacetrackCd}_${RaceNum}.json`;
            const analysisDir = path_1.default.join('data', 'analysis');
            (0, playwright_utlis_1.ensureDirectoryExists)(analysisDir);
            const analysisFilePath = path_1.default.join(analysisDir, analysisFilename);
            fs_1.default.writeFileSync(analysisFilePath, JSON.stringify({
                date: DOR,
                trackCode: RacetrackCd,
                raceNumber: RaceNum,
                ...winPredictionRanking,
                ...timeRanking,
                ...last3FRanking,
                ...horseTraitRanking
            }, null, 2));
            console.log(`分析データを${analysisFilePath}に保存しました`);
        }
        catch (error) {
            console.error(`${(0, consts_1.getTrackName)(RacetrackCd)} ${RaceNum}Rの分析データ取得中にエラーが発生しました:`, error);
        }
    }
    console.log(`${analysis.length}件のレース分析データを取得しました`);
    await winkeibaScraperService.close();
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
    // 各レースのタイム指数を取得
    console.log(`${raceList.length}件のレースのタイム指数を取得します...`);
    for (const race of raceList) {
        try {
            console.log(`${race.course} ${race.raceNumber}R (${race.race_name}) のタイム指数を取得中...`);
            const timeIndexMax = await scraper.getTimeIndexMax(race.netkeiba_race_id);
            const timeIndexAverage = await scraper.getTimeIndexAverage(race.netkeiba_race_id);
            const timeIndexDistance = await scraper.getTimeIndexDistance(race.netkeiba_race_id);
            const dataAnalysis = await scraper.getDataAnalysis(race.netkeiba_race_id);
            const dataAnalysisRanking = await scraper.getDataAnalysisRanking(race.netkeiba_race_id);
            const cpPrediction = await scraper.getCPPrediction(race.netkeiba_race_id);
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
                deviation_ranks: dataAnalysis.deviation_ranks,
                rapid_rise_ranks: dataAnalysis.rapid_rise_ranks,
                personal_best_ranks: dataAnalysis.personal_best_ranks,
                popularity_risk: dataAnalysis.popularity_risk,
                data_analysis_ranks: dataAnalysisRanking?.data_analysis_ranks,
                cp_ranks: cpPrediction.cp_ranks,
                time_index_max_ranks: timeIndexMax.time_index_horse_numbers,
                time_index_avg_ranks: timeIndexAverage.time_index_horse_numbers,
                time_index_distance_ranks: timeIndexDistance.time_index_horse_numbers
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
// analysisのデータを引数として受け取り、そこに含まれているデータに関して、画像から指数ランクを取得する。
async function getIndexRanksFromImage(analysis) {
    for (const item of analysis) {
        const imagePath = `./note_images/${item.date}_${(0, consts_1.getTrackName)(item.trackCode)}_${item.raceNumber.toString()}R.jpg`;
        const result = await (0, note_image_ocr_1.extractIndexRanksFromImage)(imagePath, item.date, item.trackCode, item.raceNumber.toString());
        // index_expectationがあれば保存
        if (result.index_expectation) {
            console.log(`指数期待度: ${result.index_expectation}`);
            item.index_expectation = result.index_expectation;
        }
        // 馬をランク順にソート
        const sortedHorses = [...result.horses].sort((a, b) => a.rank - b.rank);
        // 上位8頭の馬番を配列に格納
        const topEightHorseNumbers = sortedHorses
            .slice(0, 8)
            .map(horse => horse.number);
        console.log(`上位8頭の馬番: ${topEightHorseNumbers.join(', ')}`);
        // 8頭分の馬番を配列として設定
        item.index_ranks = topEightHorseNumbers;
    }
    return analysis;
}
// AI予想の項目に関するデータをNoteから取得する
async function getAiPrediction(analysis, url, date, trackCode) {
    try {
        console.log(`${date} ${trackCode} のAI予想画像を取得します...`);
        // noteから画像を取得
        const imagePaths = await (0, h58_ai_1.fetchImagesFromNote)(url, date, trackCode);
        console.log(`${imagePaths.length}枚の画像を取得しました`);
        // 画像からテキストを抽出
        const ocrResults = await (0, h58_ai_1.extractTextFromImages)(imagePaths);
        console.log('OCR結果:', JSON.stringify(ocrResults, null, 2));
        // 対応するanalysisアイテムにAI予想結果を追加
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
// 前提条件：対象の日付のレースの会場がanalisysに格納されている事。analisysに格納されているレースの会場は、date, trackCodeが特定されている事。analisysを更新してreturnする。
async function getRaceResult(analysis) {
    const scraper = new winkeiba_scraper_1.WinkeibaScraperService();
    await scraper.init();
    await scraper.login();
    // 日付とトラックコードの組み合わせでユニークなレースを特定
    const uniqueRaces = new Map();
    for (const item of analysis) {
        const key = `${item.date}_${item.trackCode}`;
        if (!uniqueRaces.has(key)) {
            uniqueRaces.set(key, { date: item.date, trackCode: item.trackCode });
        }
    }
    // 各ユニークなレースの結果を取得
    for (const [key, { date, trackCode }] of uniqueRaces.entries()) {
        try {
            console.log(`${date} ${trackCode} のレース結果を取得します...`);
            const raceResults = await scraper.getRaceResults(date, trackCode);
            // 対応するanalysisアイテムに結果を追加
            for (const item of analysis) {
                if (item.date === date && item.trackCode === trackCode && item.raceNumber) {
                    // レース番号に対応する結果を見つける
                    const matchingResult = raceResults.find(result => parseInt(result.raceNumber) === item.raceNumber);
                    // マッチするレース結果が見つかった場合のログ出力
                    if (matchingResult) {
                        console.log(`レース結果を取得しました: ${date} ${trackCode} ${item.raceNumber}R`);
                        console.log(`  1着: ${matchingResult.first_place.horse_number}番 ${matchingResult.first_place.horse_name} (${matchingResult.first_place.popularity}人気)`);
                        console.log(`  2着: ${matchingResult.second_place.horse_number}番 ${matchingResult.second_place.horse_name} (${matchingResult.second_place.popularity}人気)`);
                        console.log(`  3着: ${matchingResult.third_place.horse_number}番 ${matchingResult.third_place.horse_name} (${matchingResult.third_place.popularity}人気)`);
                    }
                    else {
                        console.log(`レース結果が見つかりませんでした: ${date} ${trackCode} ${item.raceNumber}R`);
                    }
                    if (matchingResult) {
                        item.race_result = matchingResult;
                    }
                }
            }
            // 連続アクセスを避けるためのランダム待機
            await (0, utils_1.randomDelay)(1000, 2000);
        }
        catch (error) {
            console.error(`${date} ${trackCode} のレース結果取得中にエラーが発生しました:`, error);
        }
    }
    await scraper.close();
    return analysis;
}
main().catch(console.error);

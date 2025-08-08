"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = require("dotenv");
(0, dotenv_1.config)(); // これで .env が process.env に読み込まれる
const netkeiba_scraper_1 = require("./netkeiba-scraper");
const utils_1 = require("./utils");
const winkeiba_scraper_1 = require("./winkeiba-scraper");
const formatter_utils_1 = require("./formatter-utils");
const consts_1 = require("./consts");
const playwright_utlis_1 = require("./playwright-utlis");
const client_s3_1 = require("@aws-sdk/client-s3");
const promises_1 = require("stream/promises");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const note_image_ocr_1 = require("./note-image-ocr");
const h58_ai_1 = require("./h58_ai");
const axios_1 = __importDefault(require("axios"));
const api_types_1 = require("./api-types");
// S3 クライアントを作成（.env の認証情報を自動的に拾う）
const s3 = new client_s3_1.S3Client({
    region: process.env.AWS_DEFAULT_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    }
});
// APIのベースURL
const API_BASE_URL = process.env.LARAVEL_API_BASE_URL || 'http://localhost:80';
async function main() {
    try {
        // 処理するジョブを取得
        const jobs = await fetchPendingJobs();
        if (jobs.length === 0) {
            console.log('処理するジョブがありません');
            return;
        }
        console.log(`${jobs.length}件のジョブを処理します`);
        // 各ジョブを処理
        for (const job of jobs) {
            await processJob(job);
        }
    }
    catch (error) {
        console.error('エラーが発生しました:', error);
        process.exit(1);
    }
}
// S3 からストリームとして取り出し、直接ファイルに書き込む関数
async function downloadFromS3(key, destPath) {
    const cmd = new client_s3_1.GetObjectCommand({
        Bucket: process.env.AWS_BUCKET,
        Key: key,
    });
    const { Body } = await s3.send(cmd);
    // ReadableStream をファイルストリームにパイプ
    if (Body) {
        await (0, promises_1.pipeline)(Body, fs_1.default.createWriteStream(destPath));
    }
    else {
        throw new Error('S3オブジェクトのBodyが存在しません');
    }
}
// 処理待ちのジョブを取得する
async function fetchPendingJobs() {
    try {
        const response = await axios_1.default.get(`${API_BASE_URL}/api/batch-register/queued-jobs`, {
            headers: {
                'accept': 'application/json',
                'X-CSRF-TOKEN': ''
            }
        });
        if (response.data.success) {
            // ジョブを変換
            const jobs = response.data.data.jobs.map((job) => {
                // ジョブタイプに基づいて適切な型に変換
                switch (job.type) {
                    case api_types_1.BatchJobType.RACE_INFO:
                        return {
                            ...job,
                            type: api_types_1.BatchJobType.RACE_INFO,
                            status: api_types_1.BatchJobStatus.QUEUED,
                            parameters: {
                                date: job.parameters.date || ''
                            },
                            updated_at: job.created_at
                        };
                    case api_types_1.BatchJobType.RACE_RESULT:
                        return {
                            ...job,
                            type: api_types_1.BatchJobType.RACE_RESULT,
                            status: api_types_1.BatchJobStatus.QUEUED,
                            parameters: {
                                date: job.parameters.date || '',
                                track_codes: job.parameters.track_codes || []
                            },
                            updated_at: job.created_at
                        };
                    case api_types_1.BatchJobType.PREDICTION:
                        return {
                            ...job,
                            type: api_types_1.BatchJobType.PREDICTION,
                            status: api_types_1.BatchJobStatus.QUEUED,
                            parameters: {
                                date: job.parameters.date || '',
                                sources: job.parameters.sources || [],
                                track_codes: job.parameters.track_codes || []
                            },
                            updated_at: job.created_at
                        };
                    case api_types_1.BatchJobType.INDEX:
                        return {
                            ...job,
                            type: api_types_1.BatchJobType.INDEX,
                            status: api_types_1.BatchJobStatus.QUEUED,
                            parameters: {
                                date: job.parameters.date || '',
                                track_code: job.parameters.track_code || '',
                                image_urls: job.parameters.image_urls || []
                            },
                            updated_at: job.created_at
                        };
                    case api_types_1.BatchJobType.AI_INDEX:
                        return {
                            ...job,
                            type: api_types_1.BatchJobType.AI_INDEX,
                            status: api_types_1.BatchJobStatus.QUEUED,
                            parameters: {
                                date: job.parameters.date || '',
                                track_code: job.parameters.track_code || '',
                                url: job.parameters.url || ''
                            },
                            updated_at: job.created_at
                        };
                    default:
                        throw new Error(`未対応のジョブタイプ: ${job.type}`);
                }
            });
            // RACE_INFOタイプを優先的に処理するために並べ替え。RACE_INFOのバッチを実行していないと、レース情報が無く、登録する事ができなくなるから。
            return jobs.sort((a, b) => {
                if (a.type === api_types_1.BatchJobType.RACE_INFO && b.type !== api_types_1.BatchJobType.RACE_INFO) {
                    return -1; // aをbより前に
                }
                else if (a.type !== api_types_1.BatchJobType.RACE_INFO && b.type === api_types_1.BatchJobType.RACE_INFO) {
                    return 1; // aをbより後に
                }
                else {
                    return 0; // 順序を変えない
                }
            });
        }
        else {
            console.error('ジョブ取得エラー:', response.data.error);
            return [];
        }
    }
    catch (error) {
        console.error('ジョブ取得中にエラーが発生しました:', error);
        return [];
    }
}
// ジョブを処理する
async function processJob(job) {
    console.log(`ジョブ処理開始: ${job.id} (${job.type})`);
    try {
        // ジョブのステータスを処理中に更新
        await updateJobStatus(job.id, api_types_1.BatchJobStatus.PROCESSING);
        // ジョブタイプに応じた処理を実行
        let result;
        switch (job.type) {
            case api_types_1.BatchJobType.RACE_INFO:
                result = await processRaceInfoJob(job);
                break;
            case api_types_1.BatchJobType.RACE_RESULT:
                result = await processRaceResultJob(job);
                break;
            case api_types_1.BatchJobType.PREDICTION:
                result = await processPredictionJob(job);
                break;
            case api_types_1.BatchJobType.INDEX:
                result = await processIndexJob(job);
                break;
            case api_types_1.BatchJobType.AI_INDEX:
                result = await processAiIndexJob(job);
                break;
            default:
                throw new Error(`未対応のジョブタイプ`);
        }
        // ジョブのステータスを完了に更新
        await updateJobStatus(job.id, api_types_1.BatchJobStatus.COMPLETED, result);
        console.log(`ジョブ処理完了: ${job.id}`);
    }
    catch (error) {
        console.error(`ジョブ処理エラー (${job.id}):`, error);
        // ジョブのステータスを失敗に更新
        const errorMessage = error instanceof Error ? error.message : '不明なエラー';
        await updateJobStatus(job.id, api_types_1.BatchJobStatus.FAILED, null, errorMessage);
    }
}
// ジョブのステータスを更新する
async function updateJobStatus(jobId, status, result = null, error = '') {
    try {
        await axios_1.default.put(`${API_BASE_URL}/api/batch-register/status/${jobId}`, {
            status,
            result,
            error
        }, {
            headers: {
                'accept': 'application/json',
                'Content-Type': 'application/json',
                'X-CSRF-TOKEN': ''
            }
        });
    }
    catch (error) {
        console.error(`ジョブステータス更新エラー (${jobId}):`, error);
        // ステータス更新に失敗しても処理は続行
    }
}
// レース情報取得ジョブの処理
async function processRaceInfoJob(job) {
    const { date: dateWithHyphens } = job.parameters;
    const date = dateWithHyphens.replace(/-/g, '');
    console.log(`レース情報取得ジョブ: ${date}`);
    try {
        const scraper = new netkeiba_scraper_1.NetkeibaScraper();
        await scraper.init();
        console.log('netkeibaにログイン中...');
        await scraper.login();
        console.log('netkeibaにログイン完了');
        // 単一日付のレース一覧を取得
        const raceList = await scraper.getRaceList(date);
        (0, utils_1.saveToJson)(raceList, `races_${date}.json`);
        // 各レースの詳細情報を取得してRaceInfoDataを作成
        const raceInfoData = [];
        for (const race of raceList) {
            console.log(`レース詳細取得中: ${race.course} ${race.raceNumber}R`);
            try {
                // 詳細情報を取得
                const raceDetail = await scraper.getRaceDetail(race.netkeiba_race_id, date);
                // 日付を YYYY-MM-DD 形式に変換
                const formattedDate = `${raceDetail.date.substring(0, 4)}-${raceDetail.date.substring(4, 6)}-${raceDetail.date.substring(6, 8)}`;
                // trackCodeが空でないことを確認
                if (!raceDetail.trackCode) {
                    console.warn(`警告: ${race.course} ${race.raceNumber}Rの trackCode が空です。race.trackCode を使用します。`);
                }
                // RaceInfoDataオブジェクトを作成
                raceInfoData.push({
                    trackCode: raceDetail.trackCode || race.trackCode,
                    raceNumber: raceDetail.raceNumber,
                    name: raceDetail.race_name,
                    date: formattedDate,
                    start_time: raceDetail.start_time,
                    course_type: raceDetail.track_type,
                    distance: raceDetail.distance,
                    weather: raceDetail.weather,
                    course_condition: raceDetail.track_condition,
                    horses: raceDetail.entries ? raceDetail.entries.map(entry => ({
                        horse_number: entry.horse_number,
                        frame_number: entry.frame_number,
                        horse_name: entry.horse_name,
                        jockey_name: entry.jockey,
                        trainer_name: entry.trainer,
                        weight: entry.weight,
                        gender: entry.sex_age.charAt(0),
                        age: parseInt(entry.sex_age.substring(1)),
                        popularity: entry.popularity,
                        win_odds: entry.odds
                    })) : []
                });
            }
            catch (error) {
                console.error(`レース詳細取得エラー (${race.course} ${race.raceNumber}R):`, error);
            }
        }
        console.log(raceInfoData);
        const response = await axios_1.default.post(`${API_BASE_URL}/api/race-info/batch/${job.id}`, {
            races: raceInfoData
        }, {
            headers: {
                'accept': 'application/json',
                'Content-Type': 'application/json',
                'X-CSRF-TOKEN': ''
            }
        });
        await scraper.close();
        console.log(response.data);
        // レスポンスの内容を確認して判断
        if (response.data.success) {
            return {
                success: true,
                message: `${raceInfoData.length}件のレース情報を送信しました`,
                data: response.data.data
            };
        }
        else {
            console.log(response.data);
            return {
                success: false,
                message: response.data.message || 'APIからエラーが返されました',
                error: response.data.error || '詳細なエラー情報がありません'
            };
        }
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : '不明なエラー';
        return {
            success: false,
            message: 'レース情報の取得・送信に失敗しました',
            error: errorMessage
        };
    }
}
// レース結果取得ジョブの処理
async function processRaceResultJob(job) {
    const { date, track_codes } = job.parameters;
    // track_codesのデバッグ出力
    console.log('レース結果取得ジョブのパラメータ:', job.parameters);
    console.log('track_codes:', track_codes);
    console.log('track_codesの型:', typeof track_codes);
    console.log('track_codesは配列か:', Array.isArray(track_codes));
    // track_codesが配列でない場合の対処
    const validTrackCodes = Array.isArray(track_codes)
        ? track_codes
        : (typeof track_codes === 'string' ? [track_codes] : []);
    console.log('使用するtrack_codes:', validTrackCodes);
    // ハイフンを削除してフォーマット
    const formattedDate = date.replace(/-/g, '');
    console.log(`レース結果取得ジョブ: ${formattedDate}`);
    const scraper = new winkeiba_scraper_1.WinkeibaScraperService();
    await scraper.init();
    await scraper.login();
    const results = [];
    // 各競馬場のレース結果を取得
    for (const trackCode of track_codes) {
        console.log(`レース結果取得: ${(0, consts_1.getTrackName)(trackCode)} (${formattedDate})`);
        try {
            const raceResults = await scraper.getRaceResults(formattedDate, trackCode);
            // 取得した結果をresultsに追加
            for (const raceResult of raceResults) {
                results.push({
                    date: date,
                    trackCode: trackCode,
                    raceNumber: raceResult.raceNumber,
                    first_place: raceResult.first_place,
                    second_place: raceResult.second_place,
                    third_place: raceResult.third_place,
                    win: raceResult.win,
                    place: raceResult.place,
                    bracket_quinella: raceResult.bracket_quinella,
                    quinella: raceResult.quinella,
                    quinella_place: raceResult.quinella_place,
                    exacta: raceResult.exacta,
                    trio: raceResult.trio,
                    trifecta: raceResult.trifecta
                });
            }
            // 連続アクセスを避けるためのランダム待機
            await (0, utils_1.randomDelay)(1000, 2000);
        }
        catch (error) {
            console.error(`${(0, consts_1.getTrackName)(trackCode)}のレース結果取得中にエラーが発生しました:`, error);
        }
    }
    // APIにデータを送信する前にリクエストボディをデバッグ出力
    const requestBody = {
        results
    };
    console.log('APIリクエストボディ:', JSON.stringify(requestBody, null, 2));
    // APIにデータを送信
    const response = await axios_1.default.post(`${API_BASE_URL}/api/race-result/batch/${job.id}`, requestBody, {
        headers: {
            'accept': 'application/json',
            'Content-Type': 'application/json',
            'X-CSRF-TOKEN': ''
        }
    });
    await scraper.close();
    return {
        success: response.data.success,
        message: response.data.message,
        data: response.data.data
    };
}
// 予想情報取得ジョブの処理
async function processPredictionJob(job) {
    const { date, sources = ['win_keiba', 'netkeiba'], track_codes } = job.parameters;
    // デバッグ情報の出力
    console.log('ジョブパラメータのデバッグ:');
    console.log('date:', date);
    console.log('sources:', sources);
    console.log('track_codes:', track_codes);
    console.log('track_codes type:', typeof track_codes);
    console.log('track_codes is array:', Array.isArray(track_codes));
    // ハイフンを削除してフォーマット
    const formattedDate = date.replace(/-/g, '');
    console.log(`予想情報取得ジョブ: ${formattedDate}, ソース: ${sources.join(', ')}`);
    const analysis = [];
    // netkeibaからの予想情報取得
    if (sources.includes('netkeiba')) {
        await scrapeNetkeiba(formattedDate, analysis);
    }
    // netkeibaからの取得が完了した時点でのanalysisのログを出力
    console.log('netkeibaからの取得が完了しました。現在のanalysis:');
    for (const item of analysis) {
        console.log(`${item.date} ${(0, consts_1.getTrackName)(item.trackCode)} ${item.raceNumber}R:`, JSON.stringify(item, null, 2));
    }
    // WIN競馬からの予想情報取得
    if (sources.includes('win_keiba')) {
        await scrapeWinKeiba(formattedDate, track_codes, analysis);
    }
    // WIN競馬からの取得が完了した時点でのanalysisのログを出力
    console.log('WIN競馬からの取得が完了しました。現在のanalysis:');
    for (const item of analysis) {
        console.log(`${item.date} ${(0, consts_1.getTrackName)(item.trackCode)} ${item.raceNumber}R:`, JSON.stringify(item, null, 2));
    }
    // APIにデータを送信
    const predictions = analysis.map(item => ({
        date: item.date,
        trackCode: item.trackCode,
        raceNumber: item.raceNumber,
        win_prediction_ranks: item.win_prediction_ranks?.filter((n) => n !== undefined),
        cp_ranks: item.cp_ranks,
        data_analysis_ranks: item.data_analysis_ranks,
        time_ranks: item.time_ranks?.map(n => n === undefined ? null : n),
        last_3f_ranks: item.last_3f_ranks?.map(n => n === undefined ? null : n),
        horse_trait_ranks: item.horse_trait_ranks,
        deviation_ranks: item.deviation_ranks,
        rapid_rise_ranks: item.rapid_rise_ranks,
        personal_best_ranks: item.personal_best_ranks,
        popularity_risk: item.popularity_risk,
        time_index_max_ranks: item.time_index_max_ranks,
        time_index_avg_ranks: item.time_index_avg_ranks,
        time_index_distance_ranks: item.time_index_distance_ranks
    }));
    // 予想情報のログを出力
    console.log('APIに送信する予想情報:predictions');
    for (const prediction of predictions) {
        console.log(`${prediction.date} ${(0, consts_1.getTrackName)(prediction.trackCode)} ${prediction.raceNumber}R:`, JSON.stringify({
            win_prediction_ranks: prediction.win_prediction_ranks,
            cp_ranks: prediction.cp_ranks,
            data_analysis_ranks: prediction.data_analysis_ranks,
            time_ranks: prediction.time_ranks,
            last_3f_ranks: prediction.last_3f_ranks,
            horse_trait_ranks: prediction.horse_trait_ranks,
            deviation_ranks: prediction.deviation_ranks,
            rapid_rise_ranks: prediction.rapid_rise_ranks,
            personal_best_ranks: prediction.personal_best_ranks,
            popularity_risk: prediction.popularity_risk,
            time_index_max_ranks: prediction.time_index_max_ranks,
            time_index_avg_ranks: prediction.time_index_avg_ranks,
            time_index_distance_ranks: prediction.time_index_distance_ranks
        }, null, 2));
    }
    const response = await axios_1.default.post(`${API_BASE_URL}/api/predictions/batch/${job.id}`, {
        predictions
    }, {
        headers: {
            'accept': 'application/json',
            'Content-Type': 'application/json',
            'X-CSRF-TOKEN': ''
        }
    });
    return {
        success: response.data.success,
        message: response.data.message,
        data: response.data.data
    };
}
// 指数情報取得ジョブの処理
async function processIndexJob(job) {
    const { date, track_code, image_urls } = job.parameters;
    console.log(`指数情報取得ジョブ: ${date} ${track_code}, 画像数: ${image_urls?.length || 0}`);
    const indexResults = [];
    // 画像URLが指定されていない場合は処理をスキップ
    if (!image_urls || image_urls.length === 0) {
        console.log('処理する画像がありません');
        return {
            success: true,
            message: '処理する画像がありません',
            data: { updated_count: 0, batch_job_id: job.id }
        };
    }
    // 各画像を処理
    for (const imageUrl of image_urls) {
        try {
            console.log(`画像処理: ${imageUrl}`);
            // URL から S3 のキー部分を抽出
            const urlObj = new URL(imageUrl);
            const key = urlObj.pathname.replace(/^\//, ''); // 先頭スラッシュ削除
            // 一時ディレクトリ準備
            const tempDir = path_1.default.join('temp', 'images');
            (0, playwright_utlis_1.ensureDirectoryExists)(tempDir);
            const imagePath = path_1.default.join(tempDir, path_1.default.basename(key));
            // S3 から直接ダウンロード
            await downloadFromS3(key, imagePath);
            // 既存のOCR/解析処理へ渡す
            const result = await (0, note_image_ocr_1.extractIndexRanksFromImage)(imagePath, 
            /* date */ date, 
            /* track_code */ track_code, 
            /* source */ imageUrl);
            console.log('抽出結果:', result);
            if (!result?.horses?.length) {
                console.log(`指数情報取得失敗: ${imagePath}`);
                continue;
            }
            // 上位8頭を抜き出し
            const sorted = [...result.horses].sort((a, b) => a.rank - b.rank);
            const top8 = sorted.slice(0, 8).map(h => h.number);
            console.log(`上位8頭: ${top8.join(', ')}`);
            indexResults.push({
                url: imageUrl,
                is_processed: true,
                date,
                trackCode: track_code,
                raceNumber: result.raceNumber,
                index_ranks: top8,
                index_expectation: result.index_expectation,
            });
        }
        catch (error) {
            console.error(`画像処理エラー (${imageUrl}):`, error);
        }
    }
    // APIにデータを送信
    const response = await axios_1.default.post(`${API_BASE_URL}/api/index-images/batch/${job.id}`, {
        image_results: indexResults
    }, {
        headers: {
            'accept': 'application/json',
            'Content-Type': 'application/json',
            'X-CSRF-TOKEN': ''
        }
    });
    return {
        success: response.data.success,
        message: response.data.message,
        data: response.data.data
    };
}
// AI指数情報取得ジョブの処理
async function processAiIndexJob(job) {
    const { date, track_code, url } = job.parameters;
    console.log(`AI指数情報取得ジョブ: ${date} ${track_code}, URL: ${url}`);
    const aiIndexData = [];
    try {
        // noteから画像を取得
        const imagePaths = await (0, h58_ai_1.fetchImagesFromNote)(url, date, track_code);
        console.log(`${imagePaths.length}枚の画像を取得しました`);
        // 画像からテキストを抽出
        const ocrResults = await (0, h58_ai_1.extractTextFromImages)(imagePaths);
        console.log('OCR結果:', JSON.stringify(ocrResults, null, 2));
        // 結果をaiIndexDataに追加
        for (const result of ocrResults) {
            if (result.raceNumber && result.ai_ranks) {
                aiIndexData.push({
                    date,
                    trackCode: track_code,
                    raceNumber: result.raceNumber,
                    ai_ranks: result.ai_ranks.map(rank => rank || null)
                });
            }
        }
    }
    catch (error) {
        console.error(`AI指数取得中にエラーが発生しました:`, error);
    }
    // APIにデータを送信
    const response = await axios_1.default.post(`${API_BASE_URL}/ai-index/batch/${job.id}`, {
        ai_predictions: aiIndexData
    }, {
        headers: {
            'accept': 'application/json',
            'Content-Type': 'application/json',
            'X-CSRF-TOKEN': ''
        }
    });
    return {
        success: response.data.success,
        message: response.data.message,
        data: response.data.data
    };
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
            console.log(`${race.course} ${race.raceNumber}R のタイム指数を取得しました`);
            const analysisData = {
                raceName: race.race_name,
                trackType: race.track_type,
                distance: race.distance,
                date: date,
                trackCode: race.trackCode,
                raceNumber: race.raceNumber,
                netkeiba_race_id: race.netkeiba_race_id,
                deviation_ranks: dataAnalysis.deviation_ranks,
                rapid_rise_ranks: dataAnalysis.rapid_rise_ranks,
                personal_best_ranks: dataAnalysis.personal_best_ranks,
                popularity_risk: dataAnalysis.popularity_risk,
                data_analysis_ranks: dataAnalysisRanking ? dataAnalysisRanking.data_analysis_ranks : undefined,
                cp_ranks: cpPrediction.cp_ranks,
                time_index_max_ranks: timeIndexMax.time_index_horse_numbers,
                time_index_avg_ranks: timeIndexAverage.time_index_horse_numbers,
                time_index_distance_ranks: timeIndexDistance.time_index_horse_numbers
            };
            analysis.push(analysisData);
            console.log(analysisData);
            // 連続アクセスを避けるためのランダム待機
            await (0, utils_1.randomDelay)(1000, 2000);
        }
        catch (error) {
            console.error(`${race.course} ${race.raceNumber}R のタイム指数取得中にエラーが発生しました:`, error);
        }
    }
    await scraper.close();
    console.log('処理が完了しました');
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
    // 指定した日付のレースを取得。Win競馬で検索するための、date, trackCode, raceNumberを取得する
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
main().catch(console.error);

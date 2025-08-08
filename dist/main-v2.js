"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = require("dotenv");
(0, dotenv_1.config)();
const netkeiba_scraper_1 = require("./netkeiba-scraper");
const scraping_api_client_1 = require("./scraping-api-client");
const scraping_api_client_2 = require("./scraping-api-client");
const mapper_1 = require("./mapper");
const mapper_2 = require("./mapper");
const utils_1 = require("./utils");
const yargs_1 = __importDefault(require("yargs"));
const helpers_1 = require("yargs/helpers");
const prediction_scraper_1 = require("./prediction-scraper");
const schedule_utils_1 = require("./schedule-utils");
// ---------- CLI パーサ ----------
const argv = (0, yargs_1.default)((0, helpers_1.hideBin)(process.argv))
    .options({
    date: { type: 'string', demandOption: true, describe: '対象日付 (YYYYMMDD), カンマ区切り可' },
    tracks: { type: 'string', demandOption: false, describe: '対象競馬場コード (例: 02,03,10) ※省略時はスケジュールファイルから自動取得' },
})
    .parseSync();
const dates = argv.date.split(',');
// 競馬場コードの取得
function getTrackCodesForDate(date) {
    if (argv.tracks) {
        // 明示的に指定された場合
        return argv.tracks.split(',');
    }
    else {
        // スケジュールファイルから自動取得
        const scheduleTracks = (0, schedule_utils_1.getTrackCodesFromSchedule)(date);
        if (scheduleTracks.length === 0) {
            console.error(`${date}: スケジュールファイルから競馬場コードを取得できませんでした`);
            return [];
        }
        console.log(`${date}: スケジュールから競馬場コード取得 -> ${scheduleTracks.join(', ')}`);
        return scheduleTracks;
    }
}
async function run() {
    const scraper = new netkeiba_scraper_1.NetkeibaScraper();
    await scraper.init();
    await scraper.login();
    for (const date of dates) {
        console.log(`==== ${date} 処理開始 ====`);
        // 競馬場コードを取得
        const trackCodes = getTrackCodesForDate(date);
        if (trackCodes.length === 0) {
            console.log(`  -> ${date}: 処理対象の競馬場なし、スキップ`);
            continue;
        }
        // レース一覧を取得
        const raceList = await scraper.getRaceList(date);
        for (const trackCode of trackCodes) {
            const summaries = raceList.filter((r) => r.trackCode === trackCode);
            if (summaries.length === 0) {
                console.log(`  -> トラック ${trackCode} のレース無し`);
                continue;
            }
            console.log(`  -> ${trackCode}: 詳細取得 (${summaries.length}件)`);
            const details = [];
            for (const sum of summaries) {
                try {
                    const detail = await scraper.getRaceDetail(sum.netkeiba_race_id, date);
                    details.push(detail);
                    await (0, utils_1.randomDelay)(1000, 2000);
                }
                catch (err) {
                    console.error('レース詳細取得失敗:', err);
                }
            }
            if (details.length === 0) {
                console.warn(`  -> ${trackCode}: 詳細ゼロ件、送信スキップ`);
                continue;
            }
            // API 送信
            try {
                const req = (0, mapper_1.toRaceInfoRequest)(date, trackCode, details);
                const res = await (0, scraping_api_client_1.sendRaceInfo)(req);
                console.log(`  -> ${trackCode}: RaceInfo saved ${res.saved_count}`);
            }
            catch (e) {
                console.error(`  -> ${trackCode}: RaceInfo 送信失敗`, e);
            }
            // ---------------- Predictions 送信 ----------------
            try {
                const analysisItems = await (0, prediction_scraper_1.scrapePredictions)(date, trackCode, true, true);
                const predReq = (0, mapper_2.toPredictionsRequest)(date, trackCode, analysisItems);
                const pr = await (0, scraping_api_client_2.sendPredictions)(predReq);
                console.log(`  -> ${trackCode}: Predictions saved ${pr.saved_count}`);
            }
            catch (err) {
                console.error(`  -> ${trackCode}: Predictions 送信失敗`, err);
            }
        }
    }
    await scraper.close();
    console.log('==== 完了 ====');
}
run().catch((e) => {
    console.error(e);
    process.exit(1);
});

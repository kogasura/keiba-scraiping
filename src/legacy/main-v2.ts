import { config as loadEnv } from 'dotenv';
loadEnv();

import { NetkeibaScraper } from './netkeiba-scraper';
import { sendRaceInfo } from './scraping-api-client';
import { sendPredictions } from './scraping-api-client';
import { toRaceInfoRequest } from './mapper';
import { toPredictionsRequest } from './mapper';
import type { AnalysisItem } from './types';
import { randomDelay } from './utils';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { scrapePredictions } from './prediction-scraper';
import { getTrackCodesFromSchedule } from './schedule-utils';

interface CliArgs {
  date: string;          // YYYYMMDD もしくはカンマ区切り
  tracks?: string;       // 02,03,... (オプショナル)
}

// ---------- CLI パーサ ----------
const argv = yargs(hideBin(process.argv))
  .options({
    date:   { type: 'string', demandOption: true, describe: '対象日付 (YYYYMMDD), カンマ区切り可' },
    tracks: { type: 'string', demandOption: false, describe: '対象競馬場コード (例: 02,03,10) ※省略時はスケジュールファイルから自動取得' },
  })
  .parseSync() as unknown as CliArgs;

const dates = argv.date.split(',');

// 競馬場コードの取得
function getTrackCodesForDate(date: string): string[] {
  if (argv.tracks) {
    // 明示的に指定された場合
    return argv.tracks.split(',');
  } else {
    // スケジュールファイルから自動取得
    const scheduleTracks = getTrackCodesFromSchedule(date);
    if (scheduleTracks.length === 0) {
      console.error(`${date}: スケジュールファイルから競馬場コードを取得できませんでした`);
      return [];
    }
    console.log(`${date}: スケジュールから競馬場コード取得 -> ${scheduleTracks.join(', ')}`);
    return scheduleTracks;
  }
}

async function run() {
  const scraper = new NetkeibaScraper();
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
          await randomDelay(1000, 2000);
        } catch (err) {
          console.error('レース詳細取得失敗:', err);
        }
      }

      if (details.length === 0) {
        console.warn(`  -> ${trackCode}: 詳細ゼロ件、送信スキップ`);
        continue;
      }

      // API 送信
      try {
        const req = toRaceInfoRequest(date, trackCode, details);
        const res = await sendRaceInfo(req);
        console.log(`  -> ${trackCode}: RaceInfo saved ${res.saved_count}`);
      } catch (e) {
        console.error(`  -> ${trackCode}: RaceInfo 送信失敗`, e);
      }

      // ---------------- Predictions 送信 ----------------
      try {
        const analysisItems: AnalysisItem[] = await scrapePredictions(date, trackCode, true, true);
        const predReq = toPredictionsRequest(date, trackCode, analysisItems);
        const pr = await sendPredictions(predReq);
        console.log(`  -> ${trackCode}: Predictions saved ${pr.saved_count}`);
      } catch (err) {
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
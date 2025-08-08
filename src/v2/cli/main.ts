#!/usr/bin/env ts-node

/**
 * メインCLIエントリポイント
 * 使用例: ts-node src/v2/cli/main.ts 20250125 --apis race-info,predictions
 */

import { config } from 'dotenv';
config();

import { logger } from '../utils/logger';
import { getTrackCodesFromSchedule } from '../utils/schedule';
import { executeRaceInfo } from '../services/race-info';
import { executePredictions } from '../services/predictions';
import { executeAiIndex } from '../services/ai-index';
import { executeIndexImages } from '../services/index-images';
import { executeRaceResults } from '../services/race-results';
import { ExecutionOptions } from '../types/common';

// APIタイプ定義
const API_TYPES = ['race-info', 'predictions', 'ai-index', 'index-images', 'race-results'] as const;
type ApiType = typeof API_TYPES[number];

interface CliArgs {
  date: string;
  apis?: ApiType[];
  tracks?: string[];
}

/**
 * コマンドライン引数をパース
 */
function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    showHelp();
    process.exit(0);
  }

  // 最初の引数は日付（必須）
  const date = args[0];
  if (!/^\d{8}$/.test(date)) {
    console.error('エラー: 日付はYYYYMMDD形式で指定してください');
    showHelp();
    process.exit(1);
  }

  // オプション解析
  const result: CliArgs = { date };
  
  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--apis' && i + 1 < args.length) {
      const apisStr = args[++i];
      const apis = apisStr.split(',').map(a => a.trim()) as ApiType[];
      
      // API名の検証
      for (const api of apis) {
        if (!API_TYPES.includes(api)) {
          console.error(`エラー: 無効なAPI名 '${api}'`);
          console.error(`有効なAPI: ${API_TYPES.join(', ')}`);
          process.exit(1);
        }
      }
      result.apis = apis;
    } else if (arg === '--tracks' && i + 1 < args.length) {
      const tracksStr = args[++i];
      const tracks = tracksStr.split(',').map(t => t.trim());
      
      // 競馬場コードの検証（2桁の数字）
      for (const track of tracks) {
        if (!/^(0[1-9]|10)$/.test(track)) {
          console.error(`エラー: 無効な競馬場コード '${track}'`);
          console.error(`有効な競馬場コード: 01-10`);
          process.exit(1);
        }
      }
      result.tracks = tracks;
    }
  }

  // デフォルトAPI
  if (!result.apis) {
    result.apis = ['race-info', 'predictions'];
  }

  return result;
}

/**
 * ヘルプ表示
 */
function showHelp() {
  console.log(`
使用方法:
  ts-node src/v2/cli/main.ts <date> [options]

引数:
  date    対象日付 (YYYYMMDD形式)

オプション:
  --apis <api1,api2,...>    実行するAPIを指定
                            デフォルト: race-info,predictions
                            利用可能: ${API_TYPES.join(', ')}
  --tracks <track1,track2,...>  競馬場を指定（カンマ区切り）
                            指定しない場合は開催情報から自動判定
                            競馬場コード: 01-10

例:
  ts-node src/v2/cli/main.ts 20250125                 # race-info,predictionsを実行
  ts-node src/v2/cli/main.ts 20250125 --apis race-info # race-infoのみ実行
  ts-node src/v2/cli/main.ts 20250125 --apis race-results # race-resultsのみ実行
  ts-node src/v2/cli/main.ts 20250125 --tracks 06,10  # 中山と小倉のみ
`);
}

/**
 * 競馬場コードを取得（スケジュールから自動判定）
 */
function getTrackCodes(date: string): string[] {
  // スケジュールファイルから自動取得
  const scheduleTracks = getTrackCodesFromSchedule(date);
  if (scheduleTracks.length > 0) {
    return scheduleTracks;
  }

  // デフォルト（全競馬場）
  const defaultTracks = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10'];
  return defaultTracks;
}

/**
 * API実行
 */
async function executeApi(api: ApiType, options: ExecutionOptions): Promise<boolean> {
  try {
    switch (api) {
      case 'race-info':
        return await executeRaceInfo(options);
      
      case 'predictions':
        return await executePredictions(options);
      
      case 'ai-index':
        return await executeAiIndex(options);
      
      case 'index-images':
        return await executeIndexImages(options);
      
      case 'race-results':
        return await executeRaceResults(options);
      
      default:
        logger.error(`未対応のAPI: ${api}`);
        return false;
    }
  } catch (error) {
    logger.error(`${api} 実行エラー:`, error);
    return false;
  }
}

/**
 * メイン処理
 */
async function main() {
  try {
    const args = parseArgs();
    
    logger.info(`実行開始: ${args.date}`);
    logger.info(`対象API: ${args.apis!.join(', ')}`);
    
    // 競馬場コードの決定（手動指定 or 自動判定）
    const trackCodes = args.tracks || getTrackCodes(args.date);
    logger.info(`対象競馬場: ${trackCodes.join(', ')}`);
    
    // 実行オプション作成
    const options: ExecutionOptions = {
      date: args.date,
      trackCodes,
      dryRun: false,
      batch: false
    };

    let allSuccess = true;

    // 各APIを順次実行
    for (const api of args.apis!) {
      logger.info(`\n${api} 実行中...`);
      const success = await executeApi(api, options);
      
      if (!success) {
        logger.error(`${api} 実行失敗`);
        allSuccess = false;
      } else {
        logger.success(`${api} 実行完了`);
      }

      // API間の遅延（最後以外）
      if (api !== args.apis![args.apis!.length - 1]) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    if (allSuccess) {
      logger.success('\n全API実行完了');
      process.exit(0);
    } else {
      logger.error('\n一部のAPI実行に失敗しました');
      process.exit(1);
    }

  } catch (error) {
    logger.error('実行中にエラーが発生しました:', error);
    process.exit(1);
  }
}

// エラーハンドラー
process.on('unhandledRejection', (reason) => {
  logger.error('未処理のPromise拒否:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  logger.error('未処理の例外:', error);
  process.exit(1);
});

// 実行
main();
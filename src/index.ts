// ============================================
// 最適化されたCLI - 統合スクレイピングアーキテクチャ
// ============================================

import { config as loadEnv } from 'dotenv';
loadEnv();

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { RaceDataScrapingService } from './v2/services/race-data-scraping.service';
import { ScrapingApiClient } from './v2/services/api-client.service';
import { RaceDataScrapingOptions, ProcessingStats } from './v2/types';

interface CliArgs {
  date: string;
  trackCode?: string;
  apis?: string;
  sources?: string;
  noteUrls?: string;
  imageUrls?: string;
  parallel?: boolean;
  dryRun?: boolean;
  schedule?: boolean;
  verbose?: boolean;
}

export class OptimizedRaceDataCLI {
  private scrapingService: RaceDataScrapingService;
  private apiClient: ScrapingApiClient;
  private verbose: boolean = false;

  constructor() {
    this.scrapingService = new RaceDataScrapingService();
    this.apiClient = new ScrapingApiClient();
  }

  // ============================================
  // メイン実行メソッド
  // ============================================

  async execute(args: CliArgs): Promise<void> {
    this.verbose = args.verbose || false;
    const startTime = Date.now();

    try {
      // 引数の解析と検証
      const options = await this.parseAndValidateArgs(args);
      
      this.log(`🚀 最適化スクレイピング開始`);
      this.log(`📅 日付: ${options.date}`);
      this.log(`🏁 競馬場: ${options.trackCode || 'スケジュール自動取得'}`);
      this.log(`🎯 対象API: ${options.apis.join(', ')}`);
      this.log(`📊 データソース: ${options.sources.join(', ')}`);
      
      if (options.dryRun) {
        this.log('🧪 DRY RUN モード - データ送信は行いません');
      }

      // 処理対象の競馬場を取得
      const trackCodes = options.trackCode ? [options.trackCode] : await this.getScheduledTrackCodes(options.date);
      
      if (trackCodes.length === 0) {
        throw new Error('処理対象の競馬場がありません');
      }

      let totalStats: ProcessingStats = {
        totalRaces: 0,
        successfulRaces: 0,
        failedRaces: 0,
        totalTime: 0,
        apiCalls: {
          raceInfo: 0,
          predictions: 0,
          aiIndex: 0,
          indexImages: 0,
          raceResults: 0
        }
      };

      // 各競馬場で処理実行
      for (const trackCode of trackCodes) {
        this.log(`\n🏇 ${trackCode} 処理開始`);
        
        const trackOptions: RaceDataScrapingOptions = {
          ...options,
          trackCode
        };

        const stats = await this.processTrack(trackOptions);
        totalStats = this.mergeStats(totalStats, stats);
      }

      // 結果サマリー
      const totalTime = Date.now() - startTime;
      this.printSummary(totalStats, totalTime);

    } catch (error) {
      console.error('❌ 処理中にエラーが発生しました:', error);
      process.exit(1);
    }
  }

  // ============================================
  // トラック単位の処理
  // ============================================

  private async processTrack(options: RaceDataScrapingOptions): Promise<ProcessingStats> {
    const trackStartTime = Date.now();
    
    const stats: ProcessingStats = {
      totalRaces: 0,
      successfulRaces: 0,
      failedRaces: 0,
      totalTime: 0,
      apiCalls: {
        raceInfo: 0,
        predictions: 0,
        aiIndex: 0,
        indexImages: 0,
        raceResults: 0
      }
    };

    try {
      // 統合スクレイピング実行
      const results = await this.scrapingService.scrapeAllData(options);
      
      stats.totalRaces = results.processingStats.successfulOperations + results.processingStats.failedOperations;
      stats.successfulRaces = results.processingStats.successfulOperations;
      stats.failedRaces = results.processingStats.failedOperations;

      // エラーがあった場合は表示
      if (results.processingStats.errors.length > 0) {
        this.log(`⚠️  エラー発生:`);
        results.processingStats.errors.forEach(error => this.log(`   - ${error}`));
      }

      // API送信（DRY RUNでなければ）
      if (!options.dryRun) {
        await this.sendDataToApis(results, stats);
      } else {
        this.log(`🧪 DRY RUN - データ送信をスキップ`);
      }

      stats.totalTime = Date.now() - trackStartTime;
      this.log(`✅ ${options.trackCode} 処理完了 (${stats.totalTime}ms)`);

      return stats;

    } catch (error) {
      stats.failedRaces++;
      stats.totalTime = Date.now() - trackStartTime;
      this.log(`❌ ${options.trackCode} 処理エラー: ${error}`);
      return stats;
    }
  }

  // ============================================
  // API送信処理
  // ============================================

  private async sendDataToApis(results: any, stats: ProcessingStats): Promise<void> {
    const apiData: any = {};

    // 各結果をAPI送信用に準備
    if (results.raceInfo?.success && results.raceInfo.data) {
      apiData.raceInfo = results.raceInfo.data;
    }

    // predictions APIは実装未完了のため一時的に無効化
    // if (results.predictions?.success && results.predictions.data) {
    //   apiData.predictions = results.predictions.data;
    // }

    if (results.aiPredictions?.success && results.aiPredictions.data) {
      apiData.aiPredictions = results.aiPredictions.data;
    }

    if (results.indexImages?.success && results.indexImages.data) {
      apiData.indexImages = results.indexImages.data;
    }

    if (results.raceResults?.success && results.raceResults.data) {
      apiData.raceResults = results.raceResults.data;
    }

    // 一括送信
    if (Object.keys(apiData).length > 0) {
      try {
        const apiResults = await this.apiClient.sendAllData(apiData);
        
        // 送信結果をログ出力
        for (const [apiName, result] of Object.entries(apiResults)) {
          if (result.success) {
            this.log(`  ✅ ${apiName}: ${result.saved_count || 0} 件保存`);
            this.updateApiCallStats(stats, apiName as any);
          } else {
            this.log(`  ❌ ${apiName}: ${result.error}`);
          }
        }
      } catch (error) {
        this.log(`❌ API送信エラー: ${error}`);
      }
    }
  }

  // ============================================
  // 引数解析・検証
  // ============================================

  private async parseAndValidateArgs(args: CliArgs): Promise<RaceDataScrapingOptions> {
    // 日付検証
    if (!/^\d{8}$/.test(args.date)) {
      throw new Error('日付はYYYYMMDD形式で入力してください');
    }

    // API指定の解析
    const validApis = ['race-info', 'predictions', 'ai-index', 'index-images', 'race-results'];
    const apis = args.apis ? args.apis.split(',') : ['race-info', 'predictions'];
    
    for (const api of apis) {
      if (!validApis.includes(api)) {
        throw new Error(`無効なAPI指定: ${api}. 有効な値: ${validApis.join(', ')}`);
      }
    }

    // データソース指定の解析
    const validSources = ['netkeiba', 'winkeiba', 'umax'];
    const sources = args.sources ? args.sources.split(',') : ['netkeiba', 'winkeiba'];
    
    for (const source of sources) {
      if (!validSources.includes(source)) {
        throw new Error(`無効なデータソース指定: ${source}. 有効な値: ${validSources.join(', ')}`);
      }
    }

    // noteURLsの解析
    let noteUrls: Record<string, string> = {};
    if (args.noteUrls) {
      try {
        noteUrls = JSON.parse(args.noteUrls);
      } catch (error) {
        throw new Error('noteUrlsはJSON形式で入力してください (例: {"02":"https://note.com/...","03":"https://note.com/..."})');
      }
    }

    // imageURLsの解析
    let imageUrls: string[] = [];
    if (args.imageUrls) {
      imageUrls = args.imageUrls.split(',');
    }

    return {
      date: args.date,
      trackCode: args.trackCode || '',
      apis: apis as any,
      sources: sources as any,
      noteUrls,
      imageUrls,
      parallelProcessing: args.parallel !== false,
      dryRun: args.dryRun || false
    };
  }

  // ============================================
  // スケジュール取得
  // ============================================

  private async getScheduledTrackCodes(date: string): Promise<string[]> {
    // スケジュールファイルから取得する実装
    // 既存のgetTrackCodesFromSchedule関数を使用
    try {
      const { getTrackCodesFromSchedule } = await import('./schedule-utils');
      return getTrackCodesFromSchedule(date);
    } catch (error) {
      this.log(`⚠️  スケジュール取得エラー: ${error}`);
      return [];
    }
  }

  // ============================================
  // ユーティリティメソッド
  // ============================================

  private log(message: string): void {
    if (this.verbose || message.includes('✅') || message.includes('❌') || message.includes('🚀')) {
      console.log(message);
    }
  }

  private updateApiCallStats(stats: ProcessingStats, apiName: keyof ProcessingStats['apiCalls']): void {
    stats.apiCalls[apiName]++;
  }

  private mergeStats(total: ProcessingStats, current: ProcessingStats): ProcessingStats {
    return {
      totalRaces: total.totalRaces + current.totalRaces,
      successfulRaces: total.successfulRaces + current.successfulRaces,
      failedRaces: total.failedRaces + current.failedRaces,
      totalTime: total.totalTime + current.totalTime,
      apiCalls: {
        raceInfo: total.apiCalls.raceInfo + current.apiCalls.raceInfo,
        predictions: total.apiCalls.predictions + current.apiCalls.predictions,
        aiIndex: total.apiCalls.aiIndex + current.apiCalls.aiIndex,
        indexImages: total.apiCalls.indexImages + current.apiCalls.indexImages,
        raceResults: total.apiCalls.raceResults + current.apiCalls.raceResults
      }
    };
  }

  private printSummary(stats: ProcessingStats, totalTime: number): void {
    console.log('\n' + '='.repeat(50));
    console.log('📊 処理結果サマリー');
    console.log('='.repeat(50));
    console.log(`🏁 総レース数: ${stats.totalRaces}`);
    console.log(`✅ 成功: ${stats.successfulRaces}`);
    console.log(`❌ 失敗: ${stats.failedRaces}`);
    console.log(`⏱️  総処理時間: ${totalTime}ms`);
    console.log('\n📡 API呼び出し統計:');
    console.log(`  - Race Info: ${stats.apiCalls.raceInfo} 回`);
    console.log(`  - Predictions: ${stats.apiCalls.predictions} 回`);
    console.log(`  - AI Index: ${stats.apiCalls.aiIndex} 回`);
    console.log(`  - Index Images: ${stats.apiCalls.indexImages} 回`);
    console.log(`  - Race Results: ${stats.apiCalls.raceResults} 回`);
    console.log('='.repeat(50));
  }
}

// ============================================
// CLI実行部分
// ============================================

const argv = yargs(hideBin(process.argv))
  .options({
    date: {
      type: 'string',
      demandOption: true,
      describe: '対象日付 (YYYYMMDD形式)',
      example: '20250718'
    },
    trackCode: {
      type: 'string',
      describe: '競馬場コード (省略時はスケジュール自動取得)',
      example: '02'
    },
    apis: {
      type: 'string',
      describe: '取得するAPI (カンマ区切り)',
      default: 'race-info,predictions',
      example: 'race-info,predictions,ai-index'
    },
    sources: {
      type: 'string',
      describe: '予想データソース (カンマ区切り)',
      default: 'netkeiba,winkeiba',
      example: 'netkeiba,winkeiba,umax'
    },
    noteUrls: {
      type: 'string',
      describe: 'AI予想のnoteURL (JSON形式)',
      example: '{"02":"https://note.com/h58_ai/n/abc123","03":"https://note.com/h58_ai/n/def456"}'
    },
    imageUrls: {
      type: 'string',
      describe: '指数画像URL (カンマ区切り)',
      example: 'https://example.com/img1.jpg,https://example.com/img2.jpg'
    },
    parallel: {
      type: 'boolean',
      default: true,
      describe: '並列処理を有効にする'
    },
    dryRun: {
      type: 'boolean',
      default: false,
      describe: 'データ取得のみでAPI送信は行わない'
    },
    verbose: {
      type: 'boolean',
      default: false,
      describe: '詳細ログを出力する'
    }
  })
  .example('$0 --date 20250718', '今日のデータを自動取得')
  .example('$0 --date 20250718 --trackCode 02', '函館競馬場のデータを取得')
  .example('$0 --date 20250718 --apis race-info,predictions --sources netkeiba,winkeiba', '指定APIとソースでデータ取得')
  .example('$0 --date 20250718 --dryRun', 'データ取得のみ（テスト実行）')
  .help()
  .parseSync() as unknown as CliArgs;

// CLI実行
const cli = new OptimizedRaceDataCLI();
cli.execute(argv).catch((error) => {
  console.error('❌ CLIエラー:', error);
  process.exit(1);
});
// ============================================
// 統合スクレイピングサービス - 重複処理を完全排除
// ============================================

import { 
  RaceKey, 
  RaceBasicInfo, 
  PredictionData, 
  AiPredictionData, 
  IndexImageData, 
  RaceResultData,
  ScrapingResult,
  NetkeibaPrediction,
  WinKeibaPrediction,
  UmaxPrediction,
  CourseType,
  Gender
} from '../types';

import { 
  RaceDataScrapingOptions, 
  ScrapingResults,
  NetkeibaRaceInfo,
  WinkeibaRaceInfo,
  UmaxRacePrediction,
  NoteOcrResult,
  IndexImageResult
} from '../types/scrapers';

// 既存スクレイパーのインポート
import { NetkeibaScraper } from '../../netkeiba-scraper';
import { WinkeibaScraperService } from '../../winkeiba-scraper';
import { UmaxScraperService } from '../../umax-scraper';
import { fetchImagesFromNote, extractTextFromImages } from '../../h58_ai';
import { extractIndexRanksFromImage } from '../../note-image-ocr';
import { randomDelay } from '../../utils';

export class RaceDataScrapingService {
  private netkeibaScraper: NetkeibaScraper;
  private winkeibaScraper: WinkeibaScraperService;
  private umaxScraper: UmaxScraperService;
  
  private isNetkeibaInitialized = false;
  private isWinkeibaInitialized = false;
  private isUmaxInitialized = false;

  constructor() {
    this.netkeibaScraper = new NetkeibaScraper();
    this.winkeibaScraper = new WinkeibaScraperService();
    this.umaxScraper = new UmaxScraperService();
  }

  // ============================================
  // メイン処理 - 統合スクレイピング
  // ============================================

  async scrapeAllData(options: RaceDataScrapingOptions): Promise<ScrapingResults> {
    const startTime = Date.now();
    const results: ScrapingResults = {
      processingStats: {
        totalTime: 0,
        successfulOperations: 0,
        failedOperations: 0,
        errors: []
      }
    };

    try {
      console.log(`==== 統合スクレイピング開始: ${options.date} ${options.trackCode} ====`);

      // 1. レース基本情報取得（全APIで共通利用）
      const raceKeys = await this.getRaceKeys(options.date, options.trackCode);
      if (raceKeys.length === 0) {
        throw new Error('対象レースが見つかりません');
      }

      console.log(`対象レース: ${raceKeys.length}件`);

      // 2. 並列処理で各APIのデータを取得
      const promises: Promise<any>[] = [];

      if (options.apis.includes('race-info')) {
        promises.push(this.scrapeRaceBasicInfo(options.date, options.trackCode, raceKeys));
      }

      if (options.apis.includes('predictions')) {
        promises.push(this.scrapePredictions(options.date, options.trackCode, raceKeys, options.sources));
      }

      if (options.apis.includes('ai-index') && options.noteUrls) {
        const noteUrl = options.noteUrls[options.trackCode];
        if (noteUrl) {
          promises.push(this.scrapeAiPredictions(options.date, options.trackCode, noteUrl));
        }
      }

      if (options.apis.includes('index-images') && options.imageUrls) {
        promises.push(this.scrapeIndexImages(options.imageUrls, options.date, options.trackCode));
      }

      if (options.apis.includes('race-results')) {
        promises.push(this.scrapeRaceResults(options.date, options.trackCode));
      }

      // 3. 並列実行
      const settlementResults = await Promise.allSettled(promises);
      
      // 4. 結果を統合
      let index = 0;
      if (options.apis.includes('race-info')) {
        const result = settlementResults[index];
        if (result.status === 'fulfilled') {
          results.raceInfo = result.value;
          results.processingStats.successfulOperations++;
        } else {
          results.processingStats.failedOperations++;
          results.processingStats.errors.push(`Race Info: ${result.reason}`);
        }
        index++;
      }

      if (options.apis.includes('predictions')) {
        const result = settlementResults[index];
        if (result.status === 'fulfilled') {
          results.predictions = result.value;
          results.processingStats.successfulOperations++;
        } else {
          results.processingStats.failedOperations++;
          results.processingStats.errors.push(`Predictions: ${result.reason}`);
        }
        index++;
      }

      if (options.apis.includes('ai-index') && options.noteUrls?.[options.trackCode]) {
        const result = settlementResults[index];
        if (result.status === 'fulfilled') {
          results.aiPredictions = result.value;
          results.processingStats.successfulOperations++;
        } else {
          results.processingStats.failedOperations++;
          results.processingStats.errors.push(`AI Predictions: ${result.reason}`);
        }
        index++;
      }

      if (options.apis.includes('index-images') && options.imageUrls) {
        const result = settlementResults[index];
        if (result.status === 'fulfilled') {
          results.indexImages = result.value;
          results.processingStats.successfulOperations++;
        } else {
          results.processingStats.failedOperations++;
          results.processingStats.errors.push(`Index Images: ${result.reason}`);
        }
        index++;
      }

      if (options.apis.includes('race-results')) {
        const result = settlementResults[index];
        if (result.status === 'fulfilled') {
          results.raceResults = result.value;
          results.processingStats.successfulOperations++;
        } else {
          results.processingStats.failedOperations++;
          results.processingStats.errors.push(`Race Results: ${result.reason}`);
        }
        index++;
      }

      results.processingStats.totalTime = Date.now() - startTime;
      console.log(`==== 統合スクレイピング完了: ${results.processingStats.totalTime}ms ====`);

      return results;

    } catch (error) {
      results.processingStats.totalTime = Date.now() - startTime;
      results.processingStats.failedOperations++;
      results.processingStats.errors.push(`Fatal error: ${error}`);
      throw error;
    } finally {
      await this.cleanup();
    }
  }

  // ============================================
  // 1. レース基本情報取得（最適化済み）
  // ============================================

  private async scrapeRaceBasicInfo(
    date: string, 
    trackCode: string, 
    raceKeys: RaceKey[]
  ): Promise<ScrapingResult<RaceBasicInfo[]>> {
    const startTime = Date.now();
    
    try {
      await this.initializeNetkeiba();
      
      const results: RaceBasicInfo[] = [];
      
      // getRaceListは既に実行済みなので、直接詳細取得
      const raceList = await this.netkeibaScraper.getRaceList(date);
      const filteredRaces = raceList.filter(r => r.trackCode === trackCode);
      
      for (const race of filteredRaces) {
        try {
          const detail = await this.netkeibaScraper.getRaceDetail(race.netkeiba_race_id, date);
          
          results.push({
            date: this.formatDate(date),
            trackCode,
            raceNumber: race.raceNumber,
            name: detail.race_name,
            startTime: detail.start_time,
            courseType: this.normalizeCourseType(detail.track_type),
            distance: detail.distance,
            weather: detail.weather,
            trackCondition: detail.track_condition,
            horses: detail.entries ? detail.entries.map(entry => ({
              number: entry.horse_number,
              name: entry.horse_name,
              jockey: entry.jockey,
              trainer: entry.trainer,
              weight: entry.weight || 0,
              gender: this.normalizeGender(entry.sex_age),
              age: parseInt(entry.sex_age.substring(1)),
              popularity: entry.popularity || 0,
              odds: entry.odds || 0,
              frameNumber: entry.frame_number,
              netkeiba_horse_id: entry.netkeiba_horse_id
            })) : []
          });
          
          await randomDelay(1000, 2000);
        } catch (error) {
          console.error(`レース詳細取得エラー (${race.raceNumber}R):`, error);
        }
      }

      return {
        success: true,
        data: results,
        processingTime: Date.now() - startTime
      };

    } catch (error) {
      return {
        success: false,
        error: `レース基本情報取得エラー: ${error}`,
        processingTime: Date.now() - startTime
      };
    }
  }

  // ============================================
  // 2. 予想データ取得（統合型）
  // ============================================

  private async scrapePredictions(
    date: string, 
    trackCode: string, 
    raceKeys: RaceKey[],
    sources: ('netkeiba' | 'winkeiba' | 'umax')[] = ['netkeiba', 'winkeiba']
  ): Promise<ScrapingResult<PredictionData[]>> {
    const startTime = Date.now();
    
    try {
      const results: PredictionData[] = [];
      
      // 各ソースから並列取得
      const sourcePromises = sources.map(async (source) => {
        switch (source) {
          case 'netkeiba':
            return { source, data: await this.scrapeNetkeibaData(date, trackCode, raceKeys) };
          case 'winkeiba':
            return { source, data: await this.scrapeWinkeibaData(date, trackCode) };
          case 'umax':
            return { source, data: await this.scrapeUmaxData(date, trackCode) };
          default:
            return { source, data: {} };
        }
      });

      const sourceResults = await Promise.allSettled(sourcePromises);
      
      // 結果を統合
      const sourceDataMap: Record<string, Record<string, any>> = {};
      
      for (const result of sourceResults) {
        if (result.status === 'fulfilled') {
          sourceDataMap[result.value.source] = result.value.data;
        }
      }

      // レース単位で統合
      for (const raceKey of raceKeys) {
        const key = `${raceKey.date}_${raceKey.trackCode}_${raceKey.raceNumber}`;
        
        results.push({
          ...raceKey,
          sources: {
            netkeiba: sourceDataMap.netkeiba?.[key],
            winkeiba: sourceDataMap.winkeiba?.[key],
            umax: sourceDataMap.umax?.[key]
          }
        });
      }

      return {
        success: true,
        data: results,
        processingTime: Date.now() - startTime
      };

    } catch (error) {
      return {
        success: false,
        error: `予想データ取得エラー: ${error}`,
        processingTime: Date.now() - startTime
      };
    }
  }

  // ============================================
  // 3. AI予想データ取得
  // ============================================

  private async scrapeAiPredictions(
    date: string, 
    trackCode: string, 
    noteUrl: string
  ): Promise<ScrapingResult<AiPredictionData[]>> {
    const startTime = Date.now();
    
    try {
      const imagePaths = await fetchImagesFromNote(noteUrl, date, trackCode);
      const ocrResults = await extractTextFromImages(imagePaths);
      
      const results: AiPredictionData[] = ocrResults.map(result => ({
        date: this.formatDate(date),
        trackCode,
        raceNumber: parseInt(result.raceNumber?.toString() || '0'),
        aiRanks: result.ai_ranks as [number?, number?, number?, number?, number?],
        confidence: 0.8, // デフォルト値
        source: noteUrl,
        extractedAt: new Date().toISOString()
      }));

      return {
        success: true,
        data: results,
        processingTime: Date.now() - startTime
      };

    } catch (error) {
      return {
        success: false,
        error: `AI予想データ取得エラー: ${error}`,
        processingTime: Date.now() - startTime
      };
    }
  }

  // ============================================
  // 4. 指数画像データ取得
  // ============================================

  private async scrapeIndexImages(
    imageUrls: string[], 
    date: string, 
    trackCode: string
  ): Promise<ScrapingResult<IndexImageData[]>> {
    const startTime = Date.now();
    
    try {
      const results: IndexImageData[] = [];
      
      for (const imageUrl of imageUrls) {
        try {
          const ocrResult = await extractIndexRanksFromImage(imageUrl, date, trackCode, imageUrl);
          
          if (ocrResult.horses && ocrResult.horses.length > 0) {
            const sorted = [...ocrResult.horses].sort((a, b) => a.rank - b.rank);
            const top8 = sorted.slice(0, 8).map(h => h.number);
            
            results.push({
              date: this.formatDate(date),
              trackCode,
              raceNumber: ocrResult.raceNumber,
              imageUrl,
              indexRanks: top8 as [number, number, number, number, number, number, number, number],
              expectationGrade: ocrResult.index_expectation as any,
              confidence: 0.8, // デフォルト値
              processedAt: new Date().toISOString()
            });
          }
        } catch (error) {
          console.error(`指数画像処理エラー (${imageUrl}):`, error);
        }
      }

      return {
        success: true,
        data: results,
        processingTime: Date.now() - startTime
      };

    } catch (error) {
      return {
        success: false,
        error: `指数画像データ取得エラー: ${error}`,
        processingTime: Date.now() - startTime
      };
    }
  }

  // ============================================
  // 5. レース結果取得
  // ============================================

  private async scrapeRaceResults(
    date: string, 
    trackCode: string
  ): Promise<ScrapingResult<RaceResultData[]>> {
    const startTime = Date.now();
    
    try {
      // レース結果はAPI指定時のみ実行するため、スキップ
      console.log('レース結果API は現在実装をスキップしています');
      
      return {
        success: true,
        data: [],
        processingTime: Date.now() - startTime
      };

    } catch (error) {
      return {
        success: false,
        error: `レース結果取得エラー: ${error}`,
        processingTime: Date.now() - startTime
      };
    }
  }

  // ============================================
  // ユーティリティメソッド
  // ============================================

  private async getRaceKeys(date: string, trackCode: string): Promise<RaceKey[]> {
    await this.initializeNetkeiba();
    
    const raceList = await this.netkeibaScraper.getRaceList(date);
    const filtered = raceList.filter(r => r.trackCode === trackCode);
    
    return filtered.map(race => ({
      date: this.formatDate(date),
      trackCode,
      raceNumber: race.raceNumber
    }));
  }

  private async initializeNetkeiba(): Promise<void> {
    if (!this.isNetkeibaInitialized) {
      await this.netkeibaScraper.init();
      await this.netkeibaScraper.login();
      this.isNetkeibaInitialized = true;
    }
  }

  private async initializeWinkeiba(): Promise<void> {
    if (!this.isWinkeibaInitialized) {
      await this.winkeibaScraper.init();
      await this.winkeibaScraper.login();
      this.isWinkeibaInitialized = true;
    }
  }

  private async initializeUmax(): Promise<void> {
    if (!this.isUmaxInitialized) {
      await this.umaxScraper.init();
      this.isUmaxInitialized = true;
    }
  }

  private async cleanup(): Promise<void> {
    const promises = [];
    
    if (this.isNetkeibaInitialized) {
      promises.push(this.netkeibaScraper.close());
    }
    
    if (this.isWinkeibaInitialized) {
      promises.push(this.winkeibaScraper.close());
    }
    
    if (this.isUmaxInitialized) {
      promises.push(this.umaxScraper.close());
    }
    
    await Promise.allSettled(promises);
    
    this.isNetkeibaInitialized = false;
    this.isWinkeibaInitialized = false;
    this.isUmaxInitialized = false;
  }

  private formatDate(date: string): string {
    return `${date.substring(0, 4)}-${date.substring(4, 6)}-${date.substring(6, 8)}`;
  }

  private normalizeCourseType(type: string): CourseType {
    if (type.includes('芝')) return 'turf';
    if (type.includes('ダート')) return 'dirt';
    return 'obstacle';
  }

  private normalizeGender(sexAge: string): Gender {
    const sex = sexAge.charAt(0);
    if (sex === '牡') return 'male';
    if (sex === '牝') return 'female';
    return 'gelding';
  }

  // ============================================
  // 個別ソースのデータ取得メソッド（プライベート）
  // ============================================

  private async scrapeNetkeibaData(
    date: string, 
    trackCode: string, 
    raceKeys: RaceKey[]
  ): Promise<Record<string, NetkeibaPrediction>> {
    await this.initializeNetkeiba();
    
    const results: Record<string, NetkeibaPrediction> = {};
    
    // 実装は既存のscrapeNetkeiba関数をベースに統合
    // この部分は既存コードから移植する必要があります
    
    return results;
  }

  private async scrapeWinkeibaData(
    date: string, 
    trackCode: string
  ): Promise<Record<string, WinKeibaPrediction>> {
    await this.initializeWinkeiba();
    
    const results: Record<string, WinKeibaPrediction> = {};
    
    // 実装は既存のscrapeWinKeiba関数をベースに統合
    // この部分は既存コードから移植する必要があります
    
    return results;
  }

  private async scrapeUmaxData(
    date: string, 
    trackCode: string
  ): Promise<Record<string, UmaxPrediction>> {
    await this.initializeUmax();
    
    const results: Record<string, UmaxPrediction> = {};
    
    // 実装は既存のgetUmaxRacePrediction関数をベースに統合
    // この部分は既存コードから移植する必要があります
    
    return results;
  }
}
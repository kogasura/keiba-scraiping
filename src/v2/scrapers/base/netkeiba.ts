/**
 * Netkeiba基盤スクレイパー (v2移植版)
 */

import { chromium, Browser, Page } from 'playwright';
import { logger } from '../../utils/logger';
import { randomDelay } from '../../utils/delay';
import { ScrapingOptions } from '../../types/scraping';

export class NetkeibaScraper {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private executionDate: string;
  
  constructor(private options: ScrapingOptions = {}) {
    this.executionDate = this.getCurrentDate();
  }
  
  async init(): Promise<void> {
    try {
      logger.info('Netkeiba スクレイパーを初期化中...');
      
      this.browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      
      const context = await this.browser.newContext({
        userAgent: this.getRandomUserAgent(),
        viewport: { width: 1920, height: 1080 }
      });
      
      this.page = await context.newPage();
      this.executionDate = this.getCurrentDate();
      
      logger.info('Netkeiba スクレイパーを初期化しました');
    } catch (error) {
      logger.error('Netkeiba スクレイパーの初期化に失敗しました', error);
      throw error;
    }
  }
  
  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
      logger.info('Netkeiba スクレイパーを終了しました');
    }
  }

  async login(): Promise<boolean> {
    try {
      logger.info('netkeiba サイトにログイン中...');
      
      const loginUrl = `https://regist.netkeiba.com/account/?pid=login`;
      await this.page!.goto(loginUrl, { waitUntil: 'domcontentloaded' });
      await this.delay(4000, 5000);

      // ログイン情報入力
      const username = process.env.NETKEIBA_USERNAME;
      const password = process.env.NETKEIBA_PASSWORD;
      
      if (!username || !password) {
        throw new Error('NETKEIBA_USERNAME または NETKEIBA_PASSWORD が設定されていません');
      }

      await this.page!.fill('input[name="login_id"]', username);
      await this.page!.fill('input[name="pswd"]', password);
      await this.delay(1000, 2000);
      
      await this.page!.click('input[type="image"][alt="ログイン"]');
      await this.delay(2000, 3000);
      
      // ログイン成功の確認
      const currentUrl = this.page!.url();
      logger.info(`ログイン後のURL: ${currentUrl}`);
      
      // より広範囲なログイン成功の確認
      if (currentUrl.includes('mypage') || currentUrl.includes('account') || !currentUrl.includes('login')) {
        logger.success('netkeiba ログイン成功');
        return true;
      } else {
        logger.error('netkeiba ログイン失敗');
        return false;
      }
    } catch (error) {
      logger.error('netkeiba ログインエラー:', error);
      return false;
    }
  }

  /**
   * レース一覧を取得
   */
  async getRaceList(date: string): Promise<RaceListItem[]> {
    try {
      logger.info(`レース一覧を取得中: ${date}`);
      
      // まず通常のトップページにアクセス
      await this.page!.goto('https://www.netkeiba.com/', { waitUntil: 'load' });
      await this.page!.waitForTimeout(1000);
      
      // 目的のURLにアクセス
      const url = `https://race.netkeiba.com/top/race_list.html?kaisai_date=${date}`;
      await this.page!.goto(url, { waitUntil: 'domcontentloaded' });
      logger.debug(`現在のページURL: ${this.page!.url()}`);
      
      // ページが完全に読み込まれるまで待機
      await this.page!.waitForTimeout(2000);
      
      // 実際のページ構造を確認
      const hasDateList = await this.page!.$('#date_list');
      const hasRaceList = await this.page!.$('#race_list');
      const hasRaceListArea = await this.page!.$('.RaceList_Area');
      
      logger.debug(`#date_listが存在するか: ${!!hasDateList}`);
      logger.debug(`#race_listが存在するか: ${!!hasRaceList}`);
      logger.debug(`.RaceList_Areaが存在するか: ${!!hasRaceListArea}`);
      
      if (!hasDateList) {
        logger.warn('レース一覧が見つかりません');
        return [];
      }
      
      // 各競馬場のセクションを取得（複数のセレクタを試す）
      let venueHeaders = await this.page!.$$('#date_list .RaceList_DataList');
      if (venueHeaders.length === 0) {
        venueHeaders = await this.page!.$$('#date_list .RaceList_Area');
      }
      if (venueHeaders.length === 0) {
        venueHeaders = await this.page!.$$('#race_list .RaceList_DataList');
      }
      
      logger.info(`競馬場セクション数: ${venueHeaders.length}`);
      
      const allRaces: RaceListItem[] = [];
      
      // 各競馬場の情報を処理
      for (let i = 0; i < venueHeaders.length; i++) {
        const venueSection = venueHeaders[i];
        
        // レース行を取得
        const raceRows = await venueSection.$$('.RaceList_DataItem, .RaceList_Item');
        
        // 各レースの情報を取得
        for (const row of raceRows) {
          try {
            // レース情報を抽出
            const raceInfo = await row.evaluate((element) => {
              // レース番号を取得
              const numElement = element.querySelector('[class*="Num"], span:first-child');
              const numText = numElement?.textContent || '';
              const numMatch = numText.match(/(\d+)/);
              const raceNumber = numMatch ? parseInt(numMatch[1]) : 0;
              
              // レースリンクとID
              const linkElement = element.querySelector('a[href*="race"]');
              const href = linkElement?.getAttribute('href') || '';
              const raceIdMatch = href.match(/race_id=(\d+)/);
              const raceId = raceIdMatch ? parseInt(raceIdMatch[1]) : 0;
              
              // レース名
              const raceName = linkElement?.textContent?.trim() || '';
              
              return {
                raceNumber,
                raceId,
                raceName
              };
            });
            
            if (raceInfo.raceId && raceInfo.raceNumber) {
              // 競馬場コードを取得
              const trackCode = this.extractTrackCodeFromRaceId(raceInfo.raceId);
              
              allRaces.push({
                netkeiba_race_id: raceInfo.raceId,
                raceNumber: raceInfo.raceNumber,
                trackCode: trackCode,
                race_name: raceInfo.raceName,
                track_type: '', // 詳細取得時に設定
                distance: 0,    // 詳細取得時に設定
              });
            }
          } catch (error) {
            logger.debug('レース情報の取得に失敗:', error);
            continue;
          }
        }
      }

      logger.info(`レース一覧を取得しました: ${allRaces.length}件`);
      return allRaces;
    } catch (error) {
      logger.error('レース一覧の取得に失敗しました:', error);
      throw error;
    }
  }

  /**
   * レース詳細を取得
   */
  async getRaceDetail(raceId: number, date: string): Promise<RaceDetailInfo> {
    try {
      logger.debug(`レース詳細を取得中: ${raceId}`);
      
      const url = `https://race.netkeiba.com/race/shutuba.html?race_id=${raceId}`;
      await this.page!.goto(url, { waitUntil: 'domcontentloaded' });
      await this.delay(1000, 2000);

      const raceDetail = await this.page!.evaluate(() => {
        // レース情報の取得（複数のセレクタを試す）
        let raceNameElement = document.querySelector('.RaceName');
        if (!raceNameElement) raceNameElement = document.querySelector('.racename');
        if (!raceNameElement) raceNameElement = document.querySelector('[class*="RaceName"]');
        
        let raceInfoElement = document.querySelector('.RaceData01');
        if (!raceInfoElement) raceInfoElement = document.querySelector('.racedata');
        if (!raceInfoElement) raceInfoElement = document.querySelector('[class*="RaceData"]');
        
        const raceName = raceNameElement?.textContent?.trim() || '';
        const raceInfo = raceInfoElement?.textContent?.trim() || '';
        
        console.log('レース名:', raceName);
        console.log('レース情報:', raceInfo);
        
        // レース情報からコース種別、距離等を抽出
        const distanceMatch = raceInfo.match(/(\d+)m/);
        const distance = distanceMatch ? parseInt(distanceMatch[1]) : 0;
        
        const trackType = raceInfo.includes('芝') ? '芝' : 
                         raceInfo.includes('ダ') ? 'ダート' : 
                         raceInfo.includes('障') ? '障害' : '芝'; // デフォルトを芝に設定
        
        // 開始時刻の取得
        const timeMatch = raceInfo.match(/(\d{2}:\d{2})/);
        const startTime = timeMatch ? timeMatch[1] : '';
        
        // 天候・馬場状態の取得
        const weatherMatch = raceInfo.match(/天候:(\S+)/);
        const weather = weatherMatch ? weatherMatch[1] : '';
        
        // 馬場状態の取得（「不良」などの2文字を正しく取得）
        const trackConditionMatch = raceInfo.match(/馬場:(\S+)/);
        let trackCondition = trackConditionMatch ? trackConditionMatch[1] : '';
        
        // 馬場状態の標準化（データベース制約に対応）
        if (trackCondition === '不' || trackCondition === '不良') trackCondition = '重'; // 不良は重として扱う
        if (trackCondition === '稍' || trackCondition === '稍重') trackCondition = '稍重';
        if (trackCondition === '重') trackCondition = '重';
        if (trackCondition === '良') trackCondition = '良';
        
        // データベースが受け入れる値のみに制限
        if (!['良', '稍重', '重'].includes(trackCondition)) {
          trackCondition = '良'; // デフォルト値
        }
        
        // 出馬表の取得（複数のセレクタを試す）
        const horses: HorseEntryInfo[] = [];
        let horseRows = document.querySelectorAll('.HorseList');
        if (horseRows.length === 0) horseRows = document.querySelectorAll('.shutuba_table tbody tr');
        if (horseRows.length === 0) horseRows = document.querySelectorAll('[class*="HorseList"]');
        
        console.log('出馬表の行数:', horseRows.length);
        
        horseRows.forEach((row, index) => {
          // 各セルの取得方法を改善
          const cells = row.querySelectorAll('td');
          if (cells.length >= 8) {
            const horseNumber = parseInt(cells[1]?.textContent?.trim() || cells[0]?.textContent?.trim() || '0');
            const horseName = cells[3]?.querySelector('a')?.textContent?.trim() || cells[3]?.textContent?.trim() || '';
            const jockeyName = cells[6]?.querySelector('a')?.textContent?.trim() || cells[6]?.textContent?.trim() || '';
            const trainerName = cells[7]?.querySelector('a')?.textContent?.trim() || cells[7]?.textContent?.trim() || '';
            const weightText = cells[4]?.textContent?.trim() || '';
            const sexAgeText = cells[4]?.textContent?.trim() || '';
            const popularityText = cells[10]?.textContent?.trim() || '';
            const oddsText = cells[10]?.textContent?.trim() || '';
            
            horses.push({
              horse_number: horseNumber,
              horse_name: horseName,
              jockey_name: jockeyName,
              trainer_name: trainerName,
              weight: weightText ? parseInt(weightText) : undefined,
              sex_age: sexAgeText,
              popularity: popularityText ? parseInt(popularityText) : undefined,
              odds: oddsText ? parseFloat(oddsText) : undefined,
            });
          }
        });
        
        return {
          race_name: raceName,
          track_type: trackType,
          distance: distance,
          start_time: startTime,
          weather: weather,
          track_condition: trackCondition,
          horses: horses,
        };
      });

      logger.debug(`レース詳細を取得しました: ${raceDetail.race_name}`);
      return raceDetail;
    } catch (error) {
      logger.error(`レース詳細の取得に失敗しました: ${raceId}`, error);
      throw error;
    }
  }

  /**
   * 指定URLにアクセス
   */
  async goto(url: string): Promise<void> {
    await this.page!.goto(url, { waitUntil: 'domcontentloaded' });
    await this.delay(1000, 2000);
  }

  /**
   * AI指数画像を取得
   */
  async getAiIndexImage(): Promise<string | null> {
    try {
      const imageUrl = await this.page!.evaluate(() => {
        // 複数のセレクターを試す
        const selectors = [
          '.ai-index-image img',
          '.ai_index_image img',
          'img[src*="ai_index"]',
          'img[src*="ai-index"]',
          'img[alt*="AI指数"]',
          'img[alt*="AI指数"]',
          '#ai_index_image',
          '.index_image img',
          '.race_index_image img',
          'img[src*="index"]'
        ];
        
        for (const selector of selectors) {
          const element = document.querySelector(selector);
          if (element) {
            const src = element.getAttribute('src');
            if (src) {
              return src;
            }
          }
        }
        
        // より広範囲に画像を検索
        const allImages = document.querySelectorAll('img');
        for (const img of allImages) {
          const src = img.getAttribute('src') || '';
          const alt = img.getAttribute('alt') || '';
          if (src.includes('ai') || src.includes('index') || alt.includes('AI') || alt.includes('指数')) {
            return src;
          }
        }
        
        return null;
      });

      if (imageUrl) {
        // 相対URLを絶対URLに変換
        const absoluteUrl = new URL(imageUrl, 'https://race.netkeiba.com').toString();
        return absoluteUrl;
      }

      return null;
    } catch (error) {
      logger.error('AI指数画像の取得に失敗しました', error);
      return null;
    }
  }

  /**
   * 指数画像を取得
   */
  async getIndexImage(): Promise<string | null> {
    try {
      const imageUrl = await this.page!.evaluate(() => {
        // 複数のセレクターを試す
        const selectors = [
          '.index-image img',
          '.index_image img',
          'img[src*="index"]',
          'img[src*="指数"]',
          'img[alt*="指数"]',
          'img[alt*="INDEX"]',
          '#index_image',
          '.race_index img',
          '.netkeiba_index img',
          'img[src*="netkeiba_index"]'
        ];
        
        for (const selector of selectors) {
          const element = document.querySelector(selector);
          if (element) {
            const src = element.getAttribute('src');
            if (src) {
              return src;
            }
          }
        }
        
        // より広範囲に画像を検索
        const allImages = document.querySelectorAll('img');
        for (const img of allImages) {
          const src = img.getAttribute('src') || '';
          const alt = img.getAttribute('alt') || '';
          if (src.includes('index') || src.includes('指数') || alt.includes('指数') || alt.includes('INDEX')) {
            return src;
          }
        }
        
        return null;
      });

      if (imageUrl) {
        // 相対URLを絶対URLに変換
        const absoluteUrl = new URL(imageUrl, 'https://race.netkeiba.com').toString();
        return absoluteUrl;
      }

      return null;
    } catch (error) {
      logger.error('指数画像の取得に失敗しました', error);
      return null;
    }
  }

  /**
   * データ分析情報を取得
   */
  async getDataAnalysis(raceId: number): Promise<DataAnalysisInfo> {
    try {
      const url = `https://race.sp.netkeiba.com/barometer/score.html?race_id=${raceId}&rf=rs`;
      await this.page!.goto(url, { waitUntil: 'domcontentloaded' });
      await this.delay(1000, 2000);

      const analysisData = await this.page!.evaluate(() => {
        const result: any = {
          deviation_ranks: [] as number[],
          rapid_rise_ranks: [] as number[],
          personal_best_ranks: [] as number[],
          popularity_risk: null
        };
        
        // 偏差値上位を取得
        const deviationTable = document.querySelector('.PickupHorseTableTitle:has(.IconRankTop01)')?.closest('table');
        if (deviationTable) {
          const horseNumbers = deviationTable.querySelectorAll('.Umaban_Num');
          horseNumbers.forEach(element => {
            const horseNumber = parseInt(element.textContent?.trim() || '0');
            if (horseNumber > 0) {
              result.deviation_ranks.push(horseNumber);
            }
          });
        }
        
        // 急上昇を取得
        const rapidRiseTable = document.querySelector('.PickupHorseTableTitle:has(.IconRankUp01)')?.closest('table');
        if (rapidRiseTable) {
          const horseNumbers = rapidRiseTable.querySelectorAll('.Umaban_Num');
          horseNumbers.forEach(element => {
            const horseNumber = parseInt(element.textContent?.trim() || '0');
            if (horseNumber > 0) {
              result.rapid_rise_ranks.push(horseNumber);
            }
          });
        }
        
        // 自己ベストを取得
        const personalBestTable = document.querySelector('.PickupHorseTableTitle:has(.IconRankBest01)')?.closest('table');
        if (personalBestTable) {
          const horseNumbers = personalBestTable.querySelectorAll('.Umaban_Num');
          horseNumbers.forEach(element => {
            const horseNumber = parseInt(element.textContent?.trim() || '0');
            if (horseNumber > 0) {
              result.personal_best_ranks.push(horseNumber);
            }
          });
        }

        // 人気危険を取得
        const popularityRiskTable = document.querySelector('.PickupHorseTableTitle:has(.IconDanger01)')?.closest('table');
        if (popularityRiskTable) {
          const horseNumber = popularityRiskTable.querySelector('.Umaban_Num');
          if (horseNumber) {
            const horseNum = parseInt(horseNumber.textContent?.trim() || '0');
            if (horseNum > 0) {
              result.popularity_risk = horseNum;
            }
          }
        }
        
        return result;
      });

      return analysisData;
    } catch (error) {
      logger.error(`データ分析の取得に失敗しました: ${raceId}`, error);
      throw error;
    }
  }

  /**
   * データ分析の上位3頭を取得
   */
  async getDataAnalysisRanking(raceId: number): Promise<DataAnalysisRanking | undefined> {
    try {
      const url = `https://race.sp.netkeiba.com/race/data_top.html?race_id=${raceId}&rf=race_toggle_menu`;
      await this.page!.goto(url, { waitUntil: 'domcontentloaded' });
      await this.delay(1000, 2000);

      const dataAnalysisRanking = await this.page!.evaluate(() => {
        const result = {
          netkeiba_race_id: 0,
          data_analysis_ranks: [0, 0, 0] as [number, number, number]
        };

        // URLからレースIDを取得
        const urlParams = new URLSearchParams(window.location.search);
        const raceId = urlParams.get('race_id');
        result.netkeiba_race_id = raceId ? parseInt(raceId) : 0;

        // データ分析の馬番を取得
        const dlElements = document.querySelectorAll('.DataPickupHorseWrap dl');

        // 上位3頭の馬番を取得
        for (let i = 0; i < 3; i++) {
          if (dlElements.length >= i + 1) {
            const horseNumber = dlElements[i].querySelector('.Umaban_Num');
            if (horseNumber) {
              result.data_analysis_ranks[i] = parseInt(horseNumber.textContent?.trim() || '0');
            }
          }
        }

        return result;
      });

      // 全て0なら undefined を返す
      if (dataAnalysisRanking.data_analysis_ranks.every(n => n === 0)) {
        return undefined;
      }

      return dataAnalysisRanking;
    } catch (error) {
      logger.error(`データ分析ランキングの取得に失敗しました: ${raceId}`, error);
      return undefined;
    }
  }

  /**
   * CP予想を取得
   */
  async getCPPrediction(raceId: number): Promise<CPPrediction> {
    try {
      const url = `https://race.sp.netkeiba.com/?pid=yoso_pro_opinion_detail&race_id=${raceId}&yosoka_id=266992`;
      await this.page!.goto(url, { waitUntil: 'domcontentloaded' });
      await this.delay(1000, 2000);

      const cpPrediction = await this.page!.evaluate((raceId) => {
        const result = {
          netkeiba_race_id: raceId,
          cp_ranks: [0, 0, 0, 0] as [number, number, number, number]
        };

        const tableRows = document.querySelectorAll('.YosoDetailTable.YosoShirushiTable01 tbody tr');

        // 上位4頭の馬番を取得
        for (let i = 0; i < 4; i++) {
          if (tableRows.length >= i + 1) {
            const horseNumber = tableRows[i].querySelector('.Num');
            if (horseNumber) {
              result.cp_ranks[i] = parseInt(horseNumber.textContent?.trim() || '0');
            }
          }
        }
        return result;
      }, raceId);

      return cpPrediction;
    } catch (error) {
      logger.error(`CP予想の取得に失敗しました: ${raceId}`, error);
      return {
        netkeiba_race_id: raceId,
        cp_ranks: [0, 0, 0, 0]
      };
    }
  }

  /**
   * タイム指数 最高値を取得
   */
  async getTimeIndexMax(raceId: number): Promise<TimeIndex> {
    try {
      const url = `https://race.netkeiba.com/race/speed.html?race_id=${raceId}&type=rank&mode=max`;
      await this.page!.goto(url, { waitUntil: 'domcontentloaded' });
      await this.delay(1000, 2000);

      const timeIndexData = await this.page!.evaluate(() => {
        const result: number[] = [];
        const rows = document.querySelectorAll('.SpeedIndex_Table.RankMax tbody tr');
        const maxRows = Math.min(5, rows.length);

        for (let i = 0; i < maxRows; i++) {
          const row = rows[i];
          const horseNumber = row.querySelector('.UmaBan div')?.textContent?.trim() || '';
          if (horseNumber) {
            result.push(parseInt(horseNumber));
          }
        }

        while (result.length < 5) {
          result.push(0);
        }

        return result;
      });

      return {
        netkeiba_race_id: raceId,
        time_index_horse_numbers: timeIndexData as [number, number, number, number, number]
      };
    } catch (error) {
      logger.error(`タイム指数（最高値）の取得に失敗しました: ${raceId}`, error);
      return {
        netkeiba_race_id: raceId,
        time_index_horse_numbers: [0, 0, 0, 0, 0]
      };
    }
  }

  /**
   * タイム指数 平均値を取得
   */
  async getTimeIndexAverage(raceId: number): Promise<TimeIndex> {
    try {
      const url = `https://race.netkeiba.com/race/speed.html?race_id=${raceId}&type=rank&mode=average`;
      await this.page!.goto(url, { waitUntil: 'domcontentloaded' });
      await this.delay(1000, 2000);

      const timeIndexData = await this.page!.evaluate(() => {
        const result: number[] = [];
        const rows = document.querySelectorAll('.SpeedIndex_Table.RankAverage tbody tr');
        const maxRows = Math.min(5, rows.length);

        for (let i = 0; i < maxRows; i++) {
          const row = rows[i];
          const horseNumber = row.querySelector('.UmaBan div')?.textContent?.trim() || '';
          if (horseNumber) {
            result.push(parseInt(horseNumber));
          }
        }

        while (result.length < 5) {
          result.push(0);
        }

        return result;
      });

      return {
        netkeiba_race_id: raceId,
        time_index_horse_numbers: timeIndexData as [number, number, number, number, number]
      };
    } catch (error) {
      logger.error(`タイム指数（平均値）の取得に失敗しました: ${raceId}`, error);
      return {
        netkeiba_race_id: raceId,
        time_index_horse_numbers: [0, 0, 0, 0, 0]
      };
    }
  }

  /**
   * タイム指数 当該距離を取得
   */
  async getTimeIndexDistance(raceId: number): Promise<TimeIndex> {
    try {
      const url = `https://race.netkeiba.com/race/speed.html?race_id=${raceId}&type=rank&mode=distance`;
      await this.page!.goto(url, { waitUntil: 'domcontentloaded' });
      await this.delay(1000, 2000);

      const timeIndexData = await this.page!.evaluate(() => {
        const result: number[] = [];
        const rows = document.querySelectorAll('.SpeedIndex_Table.RankDistance tbody tr');
        const maxRows = Math.min(5, rows.length);

        for (let i = 0; i < maxRows; i++) {
          const row = rows[i];
          const horseNumber = row.querySelector('.UmaBan div')?.textContent?.trim() || '';
          if (horseNumber) {
            result.push(parseInt(horseNumber));
          }
        }

        while (result.length < 5) {
          result.push(0);
        }

        return result;
      });

      return {
        netkeiba_race_id: raceId,
        time_index_horse_numbers: timeIndexData as [number, number, number, number, number]
      };
    } catch (error) {
      logger.error(`タイム指数（当該距離）の取得に失敗しました: ${raceId}`, error);
      return {
        netkeiba_race_id: raceId,
        time_index_horse_numbers: [0, 0, 0, 0, 0]
      };
    }
  }

  // ユーティリティメソッド
  private async delay(min: number, max: number): Promise<void> {
    const delayRange = this.options.delayRange || { min: min, max: max };
    await randomDelay(delayRange.min, delayRange.max);
  }

  private getCurrentDate(): string {
    return new Date().toISOString().split('T')[0].replace(/-/g, '');
  }

  private getRandomUserAgent(): string {
    const userAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    ];
    return userAgents[Math.floor(Math.random() * userAgents.length)];
  }

  private extractTrackCodeFromRaceId(raceId: number): string {
    // NetkeibaのレースIDから競馬場コードを抽出
    const raceIdStr = raceId.toString();
    if (raceIdStr.length >= 10) {
      return raceIdStr.substring(4, 6);
    }
    return '01'; // デフォルト値
  }
}

// 型定義
interface RaceListItem {
  netkeiba_race_id: number;
  raceNumber: number;
  trackCode: string;
  race_name: string;
  track_type: string;
  distance: number;
}

interface RaceDetailInfo {
  race_name: string;
  track_type: string;
  distance: number;
  start_time: string;
  weather?: string;
  track_condition?: string;
  horses: HorseEntryInfo[];
}

interface HorseEntryInfo {
  horse_number: number;
  horse_name: string;
  jockey_name: string;
  trainer_name: string;
  weight?: number;
  sex_age: string;
  popularity?: number;
  odds?: number;
}

interface DataAnalysisInfo {
  deviation_ranks: number[];
  rapid_rise_ranks: number[];
  personal_best_ranks: number[];
  popularity_risk: number | null;
}

interface DataAnalysisRanking {
  netkeiba_race_id: number;
  data_analysis_ranks: [number, number, number];
}

interface CPPrediction {
  netkeiba_race_id: number;
  cp_ranks: [number, number, number, number];
}

interface TimeIndex {
  netkeiba_race_id: number;
  time_index_horse_numbers: [number, number, number, number, number];
}
/**
 * Netkeiba詳細スクレイパー (v2移植版)
 * 既存のNetkeibaScraper.tsをv2用に完全移植
 */

import { chromium, Browser, Page } from 'playwright';
import { logger } from '../../utils/logger';
import { randomDelay } from '../../utils/delay';
import { initBrowser, saveScreenshot } from '../../utils/browser';
import { ensureDirectoryExists, getCurrentDate } from '../../utils/file';
import { CONFIG, getTrackCode } from '../../utils/config';
import { ScrapingOptions } from '../../types/scraping';
import path from 'path';

// v2型定義
interface TimeIndex {
  netkeiba_race_id: number;
  time_index_horse_numbers: [number, number, number, number, number];
}

interface NetkeibaDataAnalysis {
  netkeiba_race_id: number;
  deviation_ranks: number[];
  rapid_rise_ranks: number[];
  personal_best_ranks: number[];
  popularity_risk: number | null;
}

interface NetkeibaDataAnalysisSimple {
  netkeiba_race_id: number;
  data_analysis_ranks: [number, number, number];
}

interface NetkeibaCPPrediction {
  netkeiba_race_id: number;
  cp_ranks: [number, number, number, number];
}

interface RaceInfo {
  date: string;
  trackCode: string;
  raceNumber: number;
  race_name: string;
  course: string;
  venue: string;
  start_time: string;
  track_type: '芝' | 'ダート' | '障害';
  distance: number;
  entries_count: number;
  weather: string;
  track_condition: string;
  prize_money: number;
  netkeiba_race_id: number;
  is_finished: boolean;
  entries?: any[];
}

export class NetkeibaFullScraper {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private executionDate: string;
  
  constructor(private options: ScrapingOptions = {}) {
    this.executionDate = getCurrentDate();
  }
  
  async init(): Promise<void> {
    try {
      logger.info('Netkeiba詳細スクレイパーを初期化中...');
      const { browser, context, page } = await initBrowser();
      this.browser = browser;
      this.page = page;
      this.executionDate = getCurrentDate();
      
      logger.info('Netkeiba詳細スクレイパーを初期化しました');
    } catch (error) {
      logger.error('Netkeiba詳細スクレイパーの初期化に失敗しました', error);
      throw error;
    }
  }
  
  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
      logger.info('Netkeiba詳細スクレイパーを終了しました');
    }
  }

  async login(): Promise<boolean> {
    try {
      logger.info('netkeiba サイトにログイン中...');
      
      const loginUrl = `https://regist.netkeiba.com/account/?pid=login`;
      await this.page!.goto(loginUrl, { waitUntil: 'domcontentloaded' });
      await randomDelay(4000, 5000);

      // ログイン情報入力
      const username = CONFIG.NETKEIBA.USERNAME;
      const password = CONFIG.NETKEIBA.PASSWORD;
      
      if (!username || !password) {
        throw new Error('NETKEIBA_USERNAME または NETKEIBA_PASSWORD が設定されていません');
      }

      await randomDelay(500, 800);
      await this.page!.fill('input[name="login_id"]', username);
      await randomDelay(500, 800);
      await this.page!.fill('input[name="pswd"]', password);

      await randomDelay(500, 800);
      await this.page!.click('input[type="image"][alt="ログイン"]');

      await randomDelay(2000, 3000);
      
      // ログイン成功の確認
      const currentUrl = this.page!.url();
      if (currentUrl.includes('mypage')) {
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
  
  async getRaceList(date: string): Promise<RaceInfo[]> {
    if (!this.page) {
      throw new Error('ブラウザが初期化されていません');
    }
    
    try {
      // まず通常のトップページにアクセス
      await this.page.goto('https://www.netkeiba.com/', { waitUntil: 'load' });
      await this.page.waitForTimeout(1000);
      
      // 目的のURLにアクセス
      const url = `${CONFIG.NETKEIBA.BASE_URL}?kaisai_date=${date}`;
      await this.page.goto(url, { waitUntil: 'domcontentloaded' });
      logger.info('現在のページURL:', this.page.url());
      
      // ページが完全に読み込まれるまで待機
      await this.page.waitForTimeout(2000);
      
      // 実際のページ構造を確認
      logger.info('ページ構造を確認中...');
      
      // 各種コンテナの存在確認
      const hasRaceList = await this.page.$('#race_list');
      const hasDateList = await this.page.$('#date_list');
      const hasRaceListArea = await this.page.$('.RaceList_Area');
      
      logger.info('#race_listが存在するか:', !!hasRaceList);
      logger.info('#date_listが存在するか:', !!hasDateList);
      logger.info('.RaceList_Areaが存在するか:', !!hasRaceListArea);
      
      // 実際のページ構造に基づいてレース情報を抽出
      const allRaces: RaceInfo[] = [];
      
      // 新しいセレクタでレース情報を取得
      if (hasDateList) {
        logger.info('date_listからレース情報を取得します');
        
        // 各競馬場のセクションをより具体的なセレクタで取得
        const venueHeaders = await this.page.$$('#date_list .RaceList_DataList');
        logger.info(`競馬場セクション数: ${venueHeaders.length}`);
        
        // 各競馬場の情報を保存する配列
        const venueInfos: {venue: string, round: string, day: string}[] = [];
        
        // まず各競馬場の情報を取得
        for (let i = 0; i < venueHeaders.length; i++) {
          try {
            const venueSection = venueHeaders[i];
            
            // 競馬場ヘッダー情報を取得
            const headerInfo = await venueSection.evaluate((node: Element) => {
              const titleElement = node.querySelector('.RaceList_DataTitle');
              if (!titleElement) return null;
              
              // HTMLの構造を詳細に分析
              const html = titleElement.innerHTML;
              // デバッグ用にHTMLを出力
              console.log('競馬場ヘッダーHTML:', html);
              
              // smallタグを除去して純粋なテキストを取得
              let cleanHtml = html.replace(/<small[^>]*>.*?<\/small>/g, '');
              // HTMLタグを除去
              let venue = cleanHtml.replace(/<[^>]*>/g, '').trim();
              
              // 回数と日目を取得
              const roundElement = titleElement.querySelector('small:first-child');
              const round = roundElement ? roundElement.textContent?.trim() || '' : '';
              
              const dayElement = titleElement.querySelector('small:last-child');
              const day = dayElement ? dayElement.textContent?.trim() || '' : '';
              
              return { round, venue, day };
            });
            
            if (!headerInfo) {
              logger.warn(`競馬場セクション ${i+1}: ヘッダー情報が取得できませんでした`);
              continue;
            }
            
            const venue = headerInfo.venue || '';
            const round = headerInfo.round.replace(/回$/, '') || '';
            const day = headerInfo.day.replace(/日目$/, '') || '';
            
            if (!venue) {
              logger.warn(`競馬場セクション ${i+1}: 競馬場名が取得できませんでした`);
              continue;
            }
            
            logger.info(`競馬場セクション ${i+1}: 第${round}回 ${venue} ${day}日目`);
            
            // 競馬場情報を保存
            venueInfos.push({ venue, round, day });
            
            // レース行を取得
            const raceRows = await venueSection.$$('.RaceList_DataItem, .RaceList_Item');
            logger.info(`${venue}のレース数: ${raceRows.length}`);
            
            // 各レースの情報を取得
            for (const row of raceRows) {
              try {
                // レース番号を取得
                let raceNumber = 0;
                const numSelectors = [
                  '[class*="Num"]', 
                  'span:first-child', 
                  'td:first-child'
                ];
                
                for (const selector of numSelectors) {
                  try {
                    const numElement = await row.$(selector);
                    if (numElement) {
                      const numText = await numElement.textContent();
                      if (numText) {
                        // 数字部分だけを抽出
                        const numMatch = numText.match(/(\d+)/);
                        if (numMatch) {
                          raceNumber = parseInt(numMatch[1], 10);
                          break;
                        }
                      }
                    }
                  } catch (error) {
                    continue;
                  }
                }
                
                if (raceNumber === 0) {
                  logger.warn('レース番号の取得に失敗しました。スキップします。');
                  continue;
                }
                
                // レース名を取得
                let raceName = '';
                const nameSelectors = [
                  'a[href*="race"]', 
                  '[class*="Title"] a', 
                  'a', 
                  'td:nth-child(2)'
                ];
                
                for (const selector of nameSelectors) {
                  try {
                    const nameElement = await row.$(selector);
                    if (nameElement) {
                      const fullText = await nameElement.textContent() || '';
                      const trimmedText = fullText.trim();
                      
                      const parts = trimmedText.split(/\s+/);
                      if (parts.length >= 2) {
                        raceName = parts[1];
                        if (raceName) break;
                      } else {
                        raceName = trimmedText;
                        if (raceName) break;
                      }
                    }
                  } catch (error) {
                    continue;
                  }
                }
                
                // 発走時刻を取得
                let startTime = '';
                const timeSelectors = [
                  '[class*="time"]', 
                  'span:nth-child(2)', 
                  'td:nth-child(3)'
                ];
                
                for (const selector of timeSelectors) {
                  try {
                    const timeElement = await row.$(selector);
                    if (timeElement) {
                      startTime = await timeElement.textContent() || '';
                      startTime = startTime.trim();
                      if (startTime) break;
                    }
                  } catch (error) {
                    continue;
                  }
                }
                
                // コース情報（芝/ダート、距離）
                let trackType: '芝' | 'ダート' | '障害' = '芝';
                let distance = 0;
                
                const courseSelectors = [
                  '[class*="Long"]', 
                  'span:nth-child(3)', 
                  'td:nth-child(4)'
                ];
                
                for (const selector of courseSelectors) {
                  try {
                    const courseElement = await row.$(selector);
                    if (courseElement) {
                      const courseText = await courseElement.textContent() || '';
                      
                      // 芝/ダート/障を判定
                      if (courseText.includes('芝')) {
                        trackType = '芝';
                      } else if (courseText.includes('ダ')) {
                        trackType = 'ダート';
                      } else if (courseText.includes('障')) {
                        trackType = '障害';
                      }
                      
                      // 距離を抽出
                      const distanceMatch = courseText.match(/(\d+)m/);
                      if (distanceMatch) {
                        distance = parseInt(distanceMatch[1], 10);
                      }
                      
                      if (trackType && distance > 0) break;
                    }
                  } catch (error) {
                    continue;
                  }
                }
                
                // 出走頭数
                let entriesCount = 0;
                const entriesSelectors = [
                  '[class*="Post"]', 
                  'span:nth-child(4)', 
                  'td:nth-child(5)'
                ];
                
                for (const selector of entriesSelectors) {
                  try {
                    const entriesElement = await row.$(selector);
                    if (entriesElement) {
                      const entriesText = await entriesElement.textContent() || '';
                      const entriesMatch = entriesText.match(/(\d+)/);
                      if (entriesMatch) {
                        entriesCount = parseInt(entriesMatch[1], 10);
                        break;
                      }
                    }
                  } catch (error) {
                    continue;
                  }
                }
                
                // 天候・馬場状態
                let weather = '';
                let trackCondition = '';
                
                const conditionSelectors = [
                  '[class*="condition"]', 
                  '[class*="Condition"]', 
                  'span:nth-child(5)', 
                  'td:nth-child(6)'
                ];
                
                for (const selector of conditionSelectors) {
                  try {
                    const conditionElement = await row.$(selector);
                    if (conditionElement) {
                      const conditionText = await conditionElement.textContent() || '';
                      
                      const weatherMatch = (conditionText ?? '').match(/天候:([^\s]+)/);
                      if (weatherMatch) {
                        weather = weatherMatch[1];
                      }
                      
                      const trackConditionMatch = (conditionText ?? '').match(/馬場:([^\s]+)/);
                      if (trackConditionMatch) {
                        trackCondition = trackConditionMatch[1];
                      }
                      
                      if (weather || trackCondition) break;
                    }
                  } catch (error) {
                    continue;
                  }
                }
                
                // 賞金
                let prizeMoney = 0;
                const prizeSelectors = [
                  '[class*="Prize"]', 
                  'span:nth-child(6)', 
                  'td:nth-child(7)'
                ];
                
                for (const selector of prizeSelectors) {
                  try {
                    const prizeElement = await row.$(selector);
                    if (prizeElement) {
                      const prizeText = await prizeElement.textContent() || '';
                      const prizeMatch = prizeText.match(/(\d+),*(\d+)万円/);
                      if (prizeMatch) {
                        prizeMoney = parseInt(prizeText.replace(/[^0-9]/g, ''), 10) * 10000;
                        break;
                      }
                    }
                  } catch (error) {
                    continue;
                  }
                }
                
                // netkeiba_race_idを取得
                let netkeibaRaceId = 0;
                try {
                  // リンク要素からレースIDを取得
                  const linkElement = await row.$('a[href*="race_id="]');
                  if (linkElement) {
                    const href = await linkElement.getAttribute('href') || '';
                    const raceIdMatch = href.match(/race_id=(\d+)/);
                    if (raceIdMatch && raceIdMatch[1]) {
                      netkeibaRaceId = parseInt(raceIdMatch[1], 10);
                    }
                  }
                  
                  // リンクからIDが取得できない場合は、data属性などから取得を試みる
                  if (netkeibaRaceId === 0) {
                    const dataRaceId = await row.evaluate((node: Element) => {
                      return node.getAttribute('data-race-id') || 
                             node.getAttribute('data-id') || 
                             '';
                    });
                    
                    if (dataRaceId && /^\d+$/.test(dataRaceId)) {
                      netkeibaRaceId = parseInt(dataRaceId, 10);
                    }
                  }
                  
                  // IDが取得できない場合は0のままにする（仮のID生成は行わない）
                } catch (error) {
                  logger.error('レースID取得中にエラー:', error);
                  // エラー時も0のままにする
                }
                
                // レース情報を追加
                allRaces.push({
                  date: date,
                  trackCode: getTrackCode(venue),
                  raceNumber: parseInt(raceNumber.toString().padStart(2, '0'), 10),
                  race_name: raceName || `第${raceNumber}レース`,
                  course: venue, // 競馬場名（中山、阪神、東京など）
                  venue: `${round}回 ${venue} ${day}日目`, // 完全な会場情報
                  start_time: startTime || '00:00',
                  track_type: trackType,
                  distance: distance || 0,
                  entries_count: entriesCount || 0,
                  weather: weather || '',
                  track_condition: trackCondition || '',
                  prize_money: prizeMoney || 0,
                  netkeiba_race_id: netkeibaRaceId, // 追加したフィールド
                  is_finished: false // デフォルトではレースは未完了と設定
                });
                
                logger.info(`レース情報を追加: ${raceNumber} - ${venue} (ID: ${netkeibaRaceId})`);
              } catch (error) {
                logger.error(`${venue}のレース情報処理中にエラー:`, error);
                continue;
              }
            }
          } catch (error) {
            logger.error(`競馬場セクション ${i+1} の処理中にエラー:`, error);
            continue;
          }
        }
      } else {
        logger.warn('date_listが見つかりません。別の方法でレース情報を取得します。');
        
        // ページ全体からレース情報を探す
        const allRaceElements = await this.page.$$('[class*="Race"]');
        logger.info(`ページ内のレース関連要素数: ${allRaceElements.length}`);
      }
      
      logger.info(`合計 ${allRaces.length} 件のレース情報を取得しました`);
      
      // レース情報の重複を排除
      const uniqueRaces: RaceInfo[] = [];
      const seenRaces = new Set<string>();

      for (const race of allRaces) {
        // レース番号、競馬場、開始時間の組み合わせで一意性を確保
        const key = `${race.course}_${race.raceNumber}_${race.start_time}`;
        
        // レース名が「払戻一覧」を含む場合や、明らかに不正確なデータはスキップ
        if (race.race_name.includes('払戻一覧') || race.start_time === '00:00') {
          continue;
        }
        
        // 改行文字を削除してレース名を整形
        race.race_name = race.race_name.replace(/\n+/g, ' ').trim();
        
        if (!seenRaces.has(key)) {
          seenRaces.add(key);
          uniqueRaces.push(race);
        }
      }

      logger.info(`重複排除後のレース数: ${uniqueRaces.length}`);
      return uniqueRaces;
    } catch (error) {
      logger.error('エラーの詳細:', error);
      return []; // エラー時は空配列を返す
    }
  }

  // 以下、既存のメソッドを続けて移植...
  // (getTimeIndexMax, getTimeIndexAverage, getTimeIndexDistance, getDataAnalysis, etc.)
  
  // タイム指数 最高値を取得する関数
  async getTimeIndexMax(raceId: number): Promise<TimeIndex> {
    if (!this.page) {
      throw new Error('ブラウザが初期化されていません');
    }
    
    try {
      // タイム指数ページにアクセス
      const url = `https://race.netkeiba.com/race/speed.html?race_id=${raceId}&type=rank&mode=max`;
      await this.page.goto(url, { waitUntil: 'domcontentloaded' });
      await this.page.waitForTimeout(1500);
      
      // スクリーンショットを取得（デバッグ用）
      const screenshotDir = path.join('screenshots', this.executionDate);
      ensureDirectoryExists(screenshotDir);
      const screenshotPath = path.join(screenshotDir, `time-index-max-${raceId}.png`);
      await this.page.screenshot({ path: screenshotPath });
      
      // テーブルから上位5頭のデータを取得
      const timeIndexData = await this.page.evaluate(() => {
        const result: number[] = [];
        
        const rows = document.querySelectorAll('.SpeedIndex_Table.RankMax tbody tr');
        
        // 上位5頭のみ取得
        const maxRows = Math.min(5, rows.length);
        
        for (let i = 0; i < maxRows; i++) {
          const row = rows[i];
          const horseNumber = row.querySelector('.UmaBan div')?.textContent?.trim() || '';
          
          if (horseNumber) {
            result.push(parseInt(horseNumber));
          }
        }
        
        // 配列が5未満の場合、0で埋める
        while (result.length < 5) {
          result.push(0);
        }
        
        return result;
      });
      
      // URLからレースIDを取得
      const timeIndex: TimeIndex = {
        netkeiba_race_id: raceId,
        time_index_horse_numbers: timeIndexData as [number, number, number, number, number]
      };
      
      logger.info(`タイム指数（最高値）上位${timeIndexData.filter(n => n > 0).length}頭を取得しました`);
      return timeIndex;
    } catch (error) {
      logger.error('タイム指数（最高値）取得中にエラーが発生しました:', error);
      return {
        netkeiba_race_id: raceId,
        time_index_horse_numbers: [0, 0, 0, 0, 0]
      };
    }
  }

  // タイム指数 近走平均を取得する関数
  async getTimeIndexAverage(raceId: number): Promise<TimeIndex> {
    if (!this.page) {
      throw new Error('ブラウザが初期化されていません');
    }
    
    try {
      // タイム指数平均ページにアクセス
      const url = `https://race.netkeiba.com/race/speed.html?race_id=${raceId}&type=rank&mode=average`;
      await this.page.goto(url, { waitUntil: 'domcontentloaded' });
      await this.page.waitForTimeout(1500);
      
      // スクリーンショットを取得（デバッグ用）
      await saveScreenshot(this.page, `time-index-average-${raceId}.png`, this.executionDate);
      
      // テーブルから上位5頭のデータを取得
      const timeIndexData = await this.page.evaluate(() => {
        const result: number[] = [];
        
        const rows = document.querySelectorAll('.SpeedIndex_Table.RankAverage tbody tr');
        
        // 上位5頭のみ取得
        const maxRows = Math.min(5, rows.length);
        
        for (let i = 0; i < maxRows; i++) {
          const row = rows[i];
          const horseNumber = row.querySelector('.UmaBan div')?.textContent?.trim() || '';
          
          if (horseNumber) {
            result.push(parseInt(horseNumber));
          }
        }
        
        // 配列が5未満の場合、0で埋める
        while (result.length < 5) {
          result.push(0);
        }
        
        return result;
      });
      
      // URLからレースIDを取得
      const timeIndex: TimeIndex = {
        netkeiba_race_id: raceId,
        time_index_horse_numbers: timeIndexData as [number, number, number, number, number]
      };
      
      logger.info(`タイム指数（平均値）上位${timeIndexData.filter(n => n > 0).length}頭を取得しました`);
      return timeIndex;
    } catch (error) {
      logger.error('タイム指数（平均値）取得中にエラーが発生しました:', error);
      return {
        netkeiba_race_id: raceId,
        time_index_horse_numbers: [0, 0, 0, 0, 0]
      };
    }
  }

  // タイム指数 当該距離を取得する関数
  async getTimeIndexDistance(raceId: number): Promise<TimeIndex> {
    if (!this.page) {
      throw new Error('ブラウザが初期化されていません');
    }
    
    try {
      // タイム指数ページにアクセス（当該距離モード）
      const url = `https://race.netkeiba.com/race/speed.html?race_id=${raceId}&type=rank&mode=distance`;
      logger.info(`タイム指数（当該距離）ページにアクセス: ${url}`);
      await this.page.goto(url, { waitUntil: 'domcontentloaded' });
      
      // ランダムな待機時間を設定
      await randomDelay(800, 1200);
      
      // スクリーンショットを取得（デバッグ用）
      await saveScreenshot(this.page, `time-index-distance-${raceId}.png`, this.executionDate);
      
      // テーブルから上位5頭のデータを取得
      const timeIndexData = await this.page.evaluate(() => {
        const result: number[] = [];
        
        const rows = document.querySelectorAll('.SpeedIndex_Table.RankDistance tbody tr');
        
        // 上位5頭のみ取得
        const maxRows = Math.min(5, rows.length);
        
        for (let i = 0; i < maxRows; i++) {
          const row = rows[i];
          const horseNumber = row.querySelector('.UmaBan div')?.textContent?.trim() || '';
          
          if (horseNumber) {
            result.push(parseInt(horseNumber));
          }
        }
        
        // 配列が5未満の場合、0で埋める
        while (result.length < 5) {
          result.push(0);
        }
        
        return result;
      });
      
      // URLからレースIDを取得
      const timeIndex: TimeIndex = {
        netkeiba_race_id: raceId,
        time_index_horse_numbers: timeIndexData as [number, number, number, number, number]
      };
      
      logger.info(`タイム指数（当該距離）上位${timeIndexData.filter(n => n > 0).length}頭を取得しました`);
      return timeIndex;
    } catch (error) {
      logger.error('タイム指数（当該距離）取得中にエラーが発生しました:', error);
      return {
        netkeiba_race_id: raceId,
        time_index_horse_numbers: [0, 0, 0, 0, 0]
      };
    }
  }

  // 調子偏差値　偏差値上位5頭、急上昇上位最大5頭、自己ベスト最大5頭、人気危険最大1頭を取得する関数
  async getDataAnalysis(raceId: number): Promise<NetkeibaDataAnalysis> {
    if (!this.page) {
      throw new Error('ブラウザが初期化されていません');
    }
    
    try {
      // データ分析ページにアクセス
      const url = `https://race.sp.netkeiba.com/barometer/score.html?race_id=${raceId}&rf=rs`;
      logger.info(`データ分析ページにアクセス: ${url}`);
      await this.page.goto(url, { waitUntil: 'domcontentloaded' });
      
      // ランダムな待機時間を設定
      await randomDelay(800, 1200);
      
      // データ分析情報を取得
      const dataAnalysis = await this.page.evaluate(() => {
        const result: any = {
          netkeiba_race_id: 0,
          deviation_ranks: [] as number[],
          rapid_rise_ranks: [] as number[],
          personal_best_ranks: [] as number[],
          popularity_risk: null
        };
        
        // URLからレースIDを取得
        const urlParams = new URL(window.location.href).searchParams;
        result.netkeiba_race_id = parseInt(urlParams.get('race_id') || '0');
        
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
      
      logger.info(`データ分析情報を取得しました: 偏差値上位${dataAnalysis.deviation_ranks.length}頭、急上昇${dataAnalysis.rapid_rise_ranks.length}頭、自己ベスト${dataAnalysis.personal_best_ranks.length}頭`);
      return dataAnalysis as NetkeibaDataAnalysis;
    } catch (error) {
      logger.error('データ分析情報取得中にエラーが発生しました:', error);
      return {
        netkeiba_race_id: raceId,
        deviation_ranks: [],
        rapid_rise_ranks: [],
        personal_best_ranks: [],
        popularity_risk: null
      };
    }
  }

  /**
   * データ分析の上位3頭を取得する関数
   */
  async getDataAnalysisRanking(raceId: number): Promise<NetkeibaDataAnalysisSimple | undefined> {
    if (!this.page) {
      throw new Error('ブラウザが初期化されていません');
    }

    try {
      const url = `https://race.sp.netkeiba.com/race/data_top.html?race_id=${raceId}&rf=race_toggle_menu`;
      await this.page.goto(url, { waitUntil: 'domcontentloaded' });
      await randomDelay(1000, 2000);

      const dataAnalysisRanking = await this.page.evaluate(() => {
        const result: {
          netkeiba_race_id: number;
          data_analysis_ranks: [number, number, number];
        } = {
          netkeiba_race_id: 0,
          data_analysis_ranks: [0, 0, 0]
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

      // 「すべて 0」ならデータなしと判断して undefined を返す
      if (dataAnalysisRanking.data_analysis_ranks.every(n => n === 0)) {
        logger.warn(`getDataAnalysisRanking: 有効なデータ分析ランキングが見つかりませんでした (raceId=${raceId})`);
        return undefined;
      }

      logger.info(
        `データ分析ランキングを取得しました: ` +
        `1位=${dataAnalysisRanking.data_analysis_ranks[0]}, ` +
        `2位=${dataAnalysisRanking.data_analysis_ranks[1]}, ` +
        `3位=${dataAnalysisRanking.data_analysis_ranks[2]}`
      );
      return dataAnalysisRanking as NetkeibaDataAnalysisSimple;
    } catch (error) {
      logger.error('データ分析ランキング取得中にエラーが発生しました:', error);
      // エラー時も undefined を返し、呼び出し元でスキップ可能にする
      return undefined;
    }
  }

  // CP予想の4頭を取得する関数
  async getCPPrediction(raceId: number): Promise<NetkeibaCPPrediction> {
    if (!this.page) {
      throw new Error('ブラウザが初期化されていません');
    }
    
    try {
      const url = `https://race.sp.netkeiba.com/?pid=yoso_pro_opinion_detail&race_id=${raceId}&yosoka_id=266992`;
      logger.info(`CP予想ページにアクセス: ${url}`);
      await this.page.goto(url, { waitUntil: 'domcontentloaded' });
      
      // ランダムな待機時間
      await randomDelay(1000, 2000);
      
      const cpPrediction = await this.page.evaluate((raceId) => {
        const result: NetkeibaCPPrediction = {
          netkeiba_race_id: raceId,
          cp_ranks: [0,0,0,0]
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
      
      logger.info(`CP予想を取得しました: 1位=${cpPrediction.cp_ranks[0]}, 2位=${cpPrediction.cp_ranks[1]}, 3位=${cpPrediction.cp_ranks[2]}, 4位=${cpPrediction.cp_ranks[3]}`);
      return cpPrediction as NetkeibaCPPrediction;
    } catch (error) {
      logger.error('CP予想取得中にエラーが発生しました:', error);
      return {
        netkeiba_race_id: raceId,
        cp_ranks: [0,0,0,0]
      };
    }
  }

  // 続く... (getRaceDetailメソッドなど)
}

// 型定義のエクスポート
export type { TimeIndex, NetkeibaDataAnalysis, NetkeibaDataAnalysisSimple, NetkeibaCPPrediction, RaceInfo };
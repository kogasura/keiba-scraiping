/**
 * Winkeiba基盤スクレイパー (v2移植版)
 */

import { chromium, Browser, Page, ElementHandle } from 'playwright';
import { logger } from '../../utils/logger';
import { randomDelay } from '../../utils/delay';
import { ScrapingOptions } from '../../types/scraping';

export class WinkeibaScraper {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private executionDate: string;
  
  constructor(private options: ScrapingOptions = {}) {
    this.executionDate = this.getCurrentDate();
  }
  
  async init(): Promise<void> {
    try {
      logger.info('Winkeiba スクレイパーを初期化中...');
      
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
      
      logger.info('Winkeiba スクレイパーを初期化しました');
    } catch (error) {
      logger.error('Winkeiba スクレイパーの初期化に失敗しました', error);
      throw error;
    }
  }
  
  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
      logger.info('Winkeiba スクレイパーを終了しました');
    }
  }

  async login(): Promise<boolean> {
    try {
      logger.info('WIN競馬サイトにログイン中...');
      // ログインページへアクセス
      const loginUrl = 'https://www.winkeiba.jp/login';
      await this.page!.goto(loginUrl, { waitUntil: 'domcontentloaded' });
      await this.delay(800, 1200);

      // ログイン情報入力
      await this.delay(400, 800);
      const username = process.env.WINKEIBA_USERNAME || 'motomurakensaku@gmail.com';
      const password = process.env.WINKEIBA_PASSWORD || 'Motomura11';
      
      await this.page!.fill('input[type="text"].form-text', username);
      await this.page!.fill('input[type="password"].form-text', password);

      // ランダムな待機時間を設定（人間らしい動きを再現）
      await this.delay(400, 800);
      // ログインボタンクリック
      await this.page!.click('.btn-basic.-center');

      await this.delay(2000, 3000);
      return true;
    } catch (error) {
      logger.error('ログイン処理中にエラーが発生しました:', error);
      return false;
    }
  }

  /**
   * レース結果を取得する
   */
  async getRaceResults(date: string, trackCode: string): Promise<RaceResultInfo[]> {
    try {
      logger.info(`レース結果取得中: ${date} - ${trackCode}`);
      
      const url = `https://www.winkeiba.jp/race/odds/payout?RacetrackCd=${trackCode}&DOR=${date}`;
      
      await this.delay(1000, 2000);
      await this.page!.goto(url, { waitUntil: 'domcontentloaded' });
      await this.delay(1000, 2000);

      const allRaceResults: RaceResultInfo[] = [];

      // 汎用ユーティリティ関数
      const getTextSafe = async (
        root: ElementHandle<Element> | null,
        selector: string,
        transform: (t: string) => any = (t) => t.trim()
      ): Promise<string> => {
        try {
          if (!root) return '';
          const el = await root.$(selector);
          if (!el) return '';
          const txt = await el.evaluate((e) => e.textContent || '');
          return transform(typeof txt === 'string' ? txt : '');
        } catch {
          return '';
        }
      };

      // ページ内のすべてのレース結果セクションを取得
      const raceSections = await this.page!.$$('.container-box .inner');
      
      for (const section of raceSections) {
        // レース番号を取得
        const raceNumberText = await section.$eval('.heading-circle', el => el.textContent?.trim() || '');
        const raceNumberMatch = raceNumberText.match(/^(\d+)R/);
        if (!raceNumberMatch) continue;
        
        const raceNumber = raceNumberMatch[1];
        
        // 空のレース結果オブジェクトを作成
        const results: RaceResultInfo = {
          date: date,
          trackCode: trackCode,
          raceNumber: raceNumber.padStart(2, '0'),
          first_place: { horse_number: 0, horse_name: '', popularity: 0 },
          second_place: { horse_number: 0, horse_name: '', popularity: 0 },
          third_place: { horse_number: 0, horse_name: '', popularity: 0 },
          win: { horse_number: 0, popularity: 0, payout: 0 },
          place: { 
            horses: [
              { horse_number: 0, popularity: 0, payout: 0 },
              { horse_number: 0, popularity: 0, payout: 0 },
              { horse_number: 0, popularity: 0, payout: 0 }
            ] 
          },
          bracket_quinella: { combination: '', popularity: 0, payout: 0 },
          quinella: { combination: '', popularity: 0, payout: 0 },
          quinella_place: { combinations: [], popularity: [], payouts: [] },
          exacta: { combination: '', popularity: 0, payout: 0 },
          trio: { combination: '', popularity: 0, payout: 0 },
          trifecta: { combination: '', popularity: 0, payout: 0 }
        };
        
        // 着順テーブルを取得
        const rankingTable = await section.$('.table-grid.-ranking');
        if (rankingTable) {
          const rankingRows = await rankingTable.$$('tbody tr');
          const parseRankRow = async (row: ElementHandle<Element>) => ({
            horse_number: parseInt(await getTextSafe(row, '.umaban')) || 0,
            horse_name: await getTextSafe(row, 'td.-left'),
            popularity: parseInt((await getTextSafe(row, 'td:last-child')).replace(/人気/, '')) || 0
          });
          
          if (rankingRows[0]) results.first_place = await parseRankRow(rankingRows[0]);
          if (rankingRows[1]) results.second_place = await parseRankRow(rankingRows[1]);
          if (rankingRows[2]) results.third_place = await parseRankRow(rankingRows[2]);
        }
        
        // 配当情報を取得
        const payoutTable = await section.$('.table-grid.-results');
        if (payoutTable) {
          const payoutTbody = await payoutTable.$('tbody');
          if (payoutTbody) {
            const rows = await payoutTbody.$$('tr');

            // 単勝
            const winRow = await this.findRow(rows, '単勝', getTextSafe);
            if (winRow) {
              const winHorseNumber = parseInt(await getTextSafe(winRow, 'td:nth-child(2)')) || 0;
              const winPopularity = parseInt(await getTextSafe(winRow, 'td:nth-child(3)')) || 0;
              const winPayout = parseInt((await getTextSafe(winRow, 'td:nth-child(4)')).replace(/,/g, '')) || 0;
              results.win = { horse_number: winHorseNumber, popularity: winPopularity, payout: winPayout };
            }

            // 複勝
            const placeRow = await this.findRow(rows, '複勝', getTextSafe);
            if (placeRow) {
              const placeNumbers = (await getTextSafe(placeRow, 'td:nth-child(2)')).split('-').map(n => parseInt(n) || 0);
              const placePayouts = (await getTextSafe(placeRow, 'td:nth-child(4)')).split('-').map(p => parseInt(p.replace(/,/g, '')) || 0);
              
              for (let i = 0; i < Math.min(3, placeNumbers.length); i++) {
                results.place.horses[i] = {
                  horse_number: placeNumbers[i],
                  popularity: 0, // 複勝の人気は取得困難
                  payout: placePayouts[i] || 0
                };
              }
            }
          }
        }
        
        allRaceResults.push(results);
      }

      logger.info(`レース結果を取得しました: ${allRaceResults.length}件`);
      return allRaceResults;
    } catch (error) {
      logger.error('レース結果の取得に失敗しました', error);
      throw error;
    }
  }

  /**
   * 行を検索するヘルパー関数
   */
  private async findRow(
    rows: ElementHandle<Element>[], 
    keyword: string, 
    getTextSafe: (root: ElementHandle<Element> | null, selector: string, transform?: (t: string) => any) => Promise<string>
  ): Promise<ElementHandle<Element> | null> {
    for (const row of rows) {
      const lineText = await getTextSafe(row, 'td.line');
      if (lineText.includes(keyword)) {
        return row;
      }
    }
    return null;
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
}

// レース結果情報の型定義
export interface RaceResultInfo {
  date: string;
  trackCode: string;
  raceNumber: string;
  first_place: {
    horse_number: number;
    horse_name: string;
    popularity: number;
  };
  second_place: {
    horse_number: number;
    horse_name: string;
    popularity: number;
  };
  third_place: {
    horse_number: number;
    horse_name: string;
    popularity: number;
  };
  win: {
    horse_number: number;
    popularity: number;
    payout: number;
  };
  place: {
    horses: [
      { horse_number: number; popularity: number; payout: number; },
      { horse_number: number; popularity: number; payout: number; },
      { horse_number: number; popularity: number; payout: number; }
    ]
  };
  bracket_quinella: { combination: string; popularity: number; payout: number; };
  quinella: { combination: string; popularity: number; payout: number; };
  quinella_place: { combinations: string[]; popularity: number[]; payouts: number[]; };
  exacta: { combination: string; popularity: number; payout: number; };
  trio: { combination: string; popularity: number; payout: number; };
  trifecta: { combination: string; popularity: number; payout: number; };
}
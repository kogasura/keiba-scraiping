import * as fs from 'fs';
import * as path from 'path';
import { Browser, BrowserContext, ElementHandle, Page } from 'playwright';
import { HorseMarkArray, AnalysisData, RaceResult } from './types';
import { USER_AGENTS } from './config';
import { randomDelay } from './utils';
import { initBrowser, saveScreenshot, getCurrentDate, ensureDirectoryExists } from './playwright-utlis';
import { CONFIG } from './config';
import { waitForDebugger } from 'inspector';

interface HorseEntry {
  PedigreeNum: string;
  HorseNum: number;
  BracketNum: number;
  HorseName: string;
  odds?: number;
  popular?: number;
}

export class WinkeibaScraperService {
  private baseUrl = CONFIG.WINKEIBA.BASE_URL;
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private executionDate: string;

  constructor() {
    this.executionDate = getCurrentDate();
  }

  /**
   * ブラウザを初期化する
   */
  async init(): Promise<void> {
    try {
      const { browser, context, page } = await initBrowser();
      this.browser = browser;
      this.context = context;
      this.page = page;

      console.log('WIN競馬スクレイパーを初期化しました');
    } catch (error) {
      console.error('ブラウザの初期化に失敗しました:', error);
      throw error;
    }
  }

  /**
   * ブラウザを閉じる
   */
  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.context = null;
      this.page = null;
      console.log('WIN競馬スクレイパーを終了しました');
    }
  }

  /**
   * 指定された日付のレース一覧を取得する
   * @param date 日付（YYYYMMDD形式）
   * @param track_codes 競馬場コード
   */
  async getRaceList(date: string, track_codes: string[]): Promise<{ DOR: string, RacetrackCd: string, RaceNum: string }[]> {
    try {
      if (!this.page) {
        await this.init();
      }

      // トップページにアクセス
      await this.page!.goto(this.baseUrl, { waitUntil: 'domcontentloaded' });
      await randomDelay(2000, 4000);

      let allRaceList: { DOR: string; RacetrackCd: string; RaceNum: string }[] = [];

      for (const trackCode of track_codes) {
        // 正しいレース一覧ページ
        const trackUrl = `${this.baseUrl}/race?DOR=${date}&RacetrackCd=${trackCode}`;
        console.log(`→ レース一覧ページにアクセス: ${trackUrl}`);
        await this.page!.goto(trackUrl, { waitUntil: 'domcontentloaded' });

        // 必要なテーブル行が存在するか待機（なければタイムアウトして catch）
        try {
          await this.page!.waitForSelector('.-racelist tbody tr', { timeout: 10000 });
        } catch {
          console.warn(`⚠️ .race-list tbody tr が見つかりませんでした（${trackCode}）`);
          // デバッグ用 HTML を保存
          const dump = await this.page!.content();
          fs.writeFileSync(
            `debug/racelist-${date}-${trackCode}.html`,
            dump,
            'utf-8'
          );
        }

        await randomDelay(1000, 2000);
        
        // テーブルからレース情報を取得
        const raceLinks = await this.page!.locator('.-racelist tbody tr td.race a').all();
        const raceList = [];
        console.log(`→ リンク要素数: ${raceLinks.length}`);

        for (const link of raceLinks) {
          const href = await link.getAttribute('href');
          console.log(`  リンク href=${href}`);
          if (href) {
            const matches = href.match(/DOR=([^&]+)&RacetrackCd=([^&]+)&RaceNum=([^&]+)/);
            
            if (matches && matches.length === 4) {
              const DOR = matches[1];
              const RacetrackCd = matches[2];
              const RaceNum = matches[3];
              
              console.log(`レースリンク: ${href}`);
              console.log(`パラメータ: DOR=${DOR}, RacetrackCd=${RacetrackCd}, RaceNum=${RaceNum}`);
              
              // 必要なパラメータが揃っているものだけ追加
              raceList.push({
                DOR,
                RacetrackCd,
                RaceNum,
              });
            } else {
              console.warn('URLからレース情報を正しく抽出できませんでした:', href);
            }
          }
        }
        
        // 取得したレース一覧を全体のリストに追加
        allRaceList = [...allRaceList, ...raceList];
        
        console.log(`${trackCode}競馬場: ${raceList.length}件のレースリンクを取得しました`);
      }

      console.log(`合計${allRaceList.length}件のレースリンクを取得しました`);

      return allRaceList;
    } catch (error) {
      console.error('レース一覧の取得に失敗しました:', error);
      return [];
    }
  }

  /**
   * 指定されたレースの新聞印情報を取得する
   * @param date 日付（YYYYMMDD形式）
   * @param trackCode 競馬場コード
   * @param raceNumber レース番号
   */
  async getRaceMarks(date: string, trackCode: string, raceNumber: string): Promise<HorseMarkArray> {
    try {
      if (!this.page) {
        await this.init();
      }

      const url = `${this.baseUrl}/race/marks?DOR=${date}&RacetrackCd=${trackCode}&RaceNum=${raceNumber.padStart(2, '0')}`;
      console.log(`新聞印ページにアクセス: ${url}`);
      await this.page!.goto(url, { waitUntil: 'domcontentloaded' });
      
      // ランダムな待機時間を設定
      await randomDelay(4000, 5000);
      
      // スクリーンショットを取得（デバッグ用）
      const screenshotDir = path.join('image', this.executionDate);
      ensureDirectoryExists(screenshotDir);
      const screenshotPath = path.join(screenshotDir, `winkeiba-marks-${date}-${trackCode}-${raceNumber}.png`);
      await this.page!.screenshot({ path: screenshotPath });
      console.log(`スクリーンショットを保存しました: ${screenshotPath}`);

      // デバッグ情報: ページのHTMLを保存
      const htmlContent = await this.page!.content();
      const htmlPath = path.join(screenshotDir, `winkeiba-marks-${date}-${trackCode}-${raceNumber}.html`);
      fs.writeFileSync(htmlPath, htmlContent);
      console.log(`ページのHTMLを保存しました: ${htmlPath}`);
      
      // ページが完全に読み込まれるまで待機
      try {
        // 正しいセレクタを使用
        await this.page!.waitForSelector('.table-grid.-marks', { timeout: 30000 });

        // 新聞印情報をページから抽出
        const horseMarks: HorseMarkArray = await this.page!.evaluate(() => {
          // evaluate内で使用する型定義
          interface HorseMarkInfo {
            horseNumber: string;
            frameNumber: string;
            horseName: string;
            horseId: string;
            honmeiCount: number;
            honmeiRank: number;
            taikouCount: number;
            taikouRank: number;
            tananaCount: number;
            tananaRank: number;
            renkaCount: number;
            renkaRank: number;
            otherCount: number;
            otherRank: number;
            odds: number;
            popularity: number;
          }

          const horseMarkArray: HorseMarkArray = {
            date: '',
            trackCode: '',
            raceNumber: '',
            marks: []
          };

          // 正しいセレクタを使用
          const rows = document.querySelectorAll('.table-grid.-marks tbody tr');
          console.log(`テーブル行数: ${rows.length}`);

          // 行は2行ごとに1頭の馬情報を表す
          for (let i = 0; i < rows.length; i += 2) {
            try {
              const row1 = rows[i];
              const row2 = rows[i + 1];

              if (!row1 || !row2) continue;

              // 馬番と枠番の取得
              const umabanEl = row1.querySelector('.icon-umaban');
              const horseNumber = umabanEl?.textContent?.trim() || '';
              console.log(`馬番取得: ${horseNumber}`);

              // 枠番をクラス名から取得
              let frameNumber = '';
              const wakuMatch = umabanEl?.className.match(/-waku(\d+)/);
              if (wakuMatch) {
                frameNumber = wakuMatch[1];
              }
              console.log(`枠番取得: ${frameNumber}`);

              // 馬名と馬IDの取得
              const horseNameEl = row1.querySelector('.name a');
              const horseName = horseNameEl?.textContent?.trim() || '';
              console.log(`馬名取得: ${horseName}`);

              // 馬IDの取得
              let horseId = '';
              const horseIdHref = horseNameEl?.getAttribute('href') || '';
              const idMatch = horseIdHref.match(/PedigreeNum=(\d+)/);
              if (idMatch) {
                horseId = idMatch[1];
              }
              console.log(`馬ID取得: ${horseId}`);

              // 印の数を取得
              const predictCells = row2.querySelectorAll('.predict dl');
              let honmeiCount = 0;
              let taikouCount = 0;
              let tananaCount = 0;
              let renkaCount = 0;
              let otherCount = 0;
              let honmeiRank = 4;
              let taikouRank = 4;
              let tananaRank = 4;
              let renkaRank = 4;
              let otherRank = 4;

              // 各予想セルを処理
              for (let j = 0; j < predictCells.length; j++) {
                const cell = predictCells[j];
                // td要素（親要素）を取得
                const tdElement = cell.closest('td');
                const dtElement = cell.querySelector('dt');
                const ddElement = cell.querySelector('dd');

                if (!dtElement || !ddElement) continue;

                const dtHtml = dtElement.innerHTML || '';
                const count = parseInt(ddElement.textContent?.trim() || '0', 10) || 0;

                // ランクの取得
                let rank = 4; // デフォルト値
                if (tdElement) {
                  const tdClass = tdElement.getAttribute('class') || '';
                  if (tdClass.includes('bg-rank01')) {
                    rank = 1;
                  } else if (tdClass.includes('bg-rank02')) {
                    rank = 2;
                  } else if (tdClass.includes('bg-rank03')) {
                    rank = 3;
                  }
                }

                if (dtHtml.includes('stamp-mark -honmei')) {
                  honmeiCount = count;
                  honmeiRank = rank;
                } else if (dtHtml.includes('stamp-mark -taikou')) {
                  taikouCount = count;
                  taikouRank = rank;
                } else if (dtHtml.includes('stamp-mark -tanana')) {
                  tananaCount = count;
                  tananaRank = rank;
                } else if (dtHtml.includes('stamp-mark -renka')) {
                  renkaCount = count;
                  renkaRank = rank;
                } else if (dtHtml.includes('その他')) {
                  otherCount = count;
                  otherRank = rank;
                }


                console.log(`ランク取得: ${rank}`);
              }
              console.log(`印取得: ◎${honmeiCount} ○${taikouCount} ▲${tananaCount} △${renkaCount} その他${otherCount}`);

              // オッズの取得
              const oddsEl = row1.querySelector('.txt-odds');
              let odds = 0;
              if (oddsEl) {
                const oddsText = oddsEl.textContent?.trim() || '';
                if (oddsText !== '---.-') {
                  odds = parseFloat(oddsText) || 0;
                }
              }
              console.log(`オッズ取得: ${odds}`);
              // 人気順は現在のページには表示されていないようなので0を設定
              const popularity = 0;

              // 必須項目が取得できた場合のみ追加
              if (horseNumber && horseName) {
                horseMarkArray.marks.push({
              horseNumber,
                  frameNumber,
              horseName,
              horseId,
                  honmeiCount,
                  honmeiRank,
                  taikouCount,
                  taikouRank,
                  tananaCount,
                  tananaRank,
                  renkaCount,
                  renkaRank,
                  otherCount,
                  otherRank,
              odds,
              popularity
            });
              }
            } catch (e) {
              console.error(`馬情報の処理中にエラーが発生しました:`, e);
            }
          }

          return horseMarkArray;
        });

        console.log(`取得した馬の数: ${horseMarks.marks.length}`);
        horseMarks.date = date;
        horseMarks.trackCode = trackCode;
        horseMarks.raceNumber = raceNumber;
        return horseMarks;
      } catch (error) {
        console.error('新聞印テーブルが見つかりませんでした:', error);

        // エラー時にもページ内容を確認
        const bodyContent = await this.page!.evaluate(() => {
          return document.body.innerHTML;
        });

        const errorHtmlPath = path.join(screenshotDir, `winkeiba-marks-error-${date}-${trackCode}-${raceNumber}.html`);
        fs.writeFileSync(errorHtmlPath, bodyContent);
        console.log(`エラー時のHTML内容を保存しました: ${errorHtmlPath}`);

        return {
          date: '',
          trackCode: '',
          raceNumber: '',
          marks: []
        }; // 空配列を返す
      }
    } catch (error) {
      console.error('新聞印情報の取得に失敗しました:', error);
      return {
        date: '',
        trackCode: '',
        raceNumber: '',
        marks: []
      };
    }
  }


  /**
   * WIN競馬サイトにログインする
   */
  async login(): Promise<boolean> {
    try {
      console.log('WIN競馬サイトにログイン中...');
      // ログインページへアクセス
      const loginUrl = `${this.baseUrl}/login`;
      await this.page!.goto(loginUrl, { waitUntil: 'domcontentloaded' });
      await randomDelay(800, 1200);

      // ログイン情報入力
      await randomDelay(400, 800);
      await this.page!.fill('input[type="text"].form-text', CONFIG.WINKEIBA.USERNAME);
      await this.page!.fill('input[type="password"].form-text', CONFIG.WINKEIBA.PASSWORD);

      // ログイン前のスクリーンショット（デバッグ用）
      await randomDelay(400, 800);
      const loginScreenshotPath = path.join('image', this.executionDate, 'winkeiba-login-before.png');
      await this.page!.screenshot({ path: loginScreenshotPath });
      console.log(`ログイン前のスクリーンショットを保存しました: ${loginScreenshotPath}`);

      // ランダムな待機時間を設定（人間らしい動きを再現）
      await randomDelay(400, 800);
      // ログインボタンクリック
      await this.page!.click('.btn-basic.-center');

      await randomDelay(2000, 3000);
      return true;
    } catch (error) {
      console.error('ログイン処理中にエラーが発生しました:', error);
      return false;
    }
  }

  /**
   * 指定されたレースの分析データを取得する
   * @param date 日付（YYYYMMDD形式）
   * @param trackCode 競馬場コード
   * @param raceNumber レース番号
   */
  async getAnalysisData(date: string, trackCode: string, raceNumber: string): Promise<AnalysisData> {
    try {
      if (!this.page) {
        console.log('ページが初期化されていないため、初期化を行います');
        await this.init();
      }
      
      if (!this.page) {
        console.error('ページの初期化に失敗しました');
        return {
          date: '',
          trackCode: '',
          raceNumber: '',
          bestTime: [],
          last3F: [],
          rightHandedTrack: [],
          leftHandedTrack: []
        };
      }

      await randomDelay(1000, 2000);

      const url = `${this.baseUrl}/race/analysis?DOR=${date}&RacetrackCd=${trackCode}&RaceNum=${raceNumber.padStart(2, '0')}`;
      console.log(`レース分析ページにアクセス: ${url}`);
      await this.page.goto(url, { waitUntil: 'domcontentloaded' });

      // ランダムな待機時間を設定
      await randomDelay(2000, 3000);

      // スクリーンショットを取得（デバッグ用）
      const screenshotDir = path.join('image', this.executionDate);
      ensureDirectoryExists(screenshotDir);
      const screenshotPath = path.join(screenshotDir, `winkeiba-analysis-${date}-${trackCode}-${raceNumber}.png`);
      await this.page.screenshot({ path: screenshotPath });
      console.log(`スクリーンショットを保存しました: ${screenshotPath}`);

      await randomDelay(2000, 3000);
      // HTMLの内容を保存
      const htmlContent = await this.page.content();
      const htmlDir = path.join('html', this.executionDate);
      ensureDirectoryExists(htmlDir);
      const htmlPath = path.join(htmlDir, `winkeiba-analysis-${date}-${trackCode}-${raceNumber}.html`);
      fs.writeFileSync(htmlPath, htmlContent);
      console.log(`HTMLコンテンツを保存しました: ${htmlPath}`);

      // 分析データをページから抽出
      const analysisData = await this.page.evaluate(() => {
        const data: AnalysisData = {
          date: '',
          trackCode: '',
          raceNumber: '',
          bestTime: [],
          last3F: [],
          rightHandedTrack: [],
          leftHandedTrack: []
        };

        // 各種テーブル要素を取得する
        const headings = Array.from(document.querySelectorAll('.inner h3.heading-bar'));
        let bestTimeSection = null;
        let last3FSection = null;
        let rightTrackSection = null;
        let leftTrackSection = null;

        for (const heading of headings) {
          if (heading.textContent) {
            if (heading.textContent.includes('持ち時計')) {
              bestTimeSection = heading;
            } else if (heading.textContent.includes('上がり3F')) {
              last3FSection = heading;
            } else if (heading.textContent.includes('平均1F')) {
              // 平均1Fも上がり3Fとして扱う
              last3FSection = heading;
            } else if (heading.textContent.includes('右回実績')) {
              rightTrackSection = heading;
            } else if (heading.textContent.includes('左回実績')) {
              leftTrackSection = heading;
            }
          }
        }



        // 持ち時計上位順の取得
        try {

          // 見出しが見つかった場合は、その親の.inner内のテーブル行を取得
          // 見つからなかった場合は、すべての.innerからテーブル行を取得
          let bestTimeTable;
          if (bestTimeSection) {
            const innerSection = bestTimeSection.closest('.inner');
            bestTimeTable = innerSection ?
              Array.from(innerSection.querySelectorAll('table.table-grid tbody tr')) :
              Array.from(document.querySelectorAll('.inner table.table-grid tbody tr'));
          } else {
            bestTimeTable = Array.from(document.querySelectorAll('.inner table.table-grid tbody tr'));
          }

          // 各行からデータを抽出
          let rank = 0;
          bestTimeTable.forEach(row => {
            const horseNumber = row.querySelector('.umaban')?.textContent?.trim() || '';
            const horseName = row.querySelector('td.-left')?.textContent?.trim() || '';
            rank += 1;

            data.bestTime.push({
              horseNumber,
              horseName,
              rank: rank
            });

          });
        } catch (error) {
          console.error('持ち時計データ抽出エラー:', error);
        }

        // 上がり3F上位順の取得
        try {
          let last3FTable;
          if (last3FSection) {
            const innerSection = last3FSection.closest('.inner');
            last3FTable = innerSection ?
              Array.from(innerSection.querySelectorAll('table.table-grid tbody tr')) :
              Array.from(document.querySelectorAll('.inner table.table-grid tbody tr'));
          } else {
            last3FTable = Array.from(document.querySelectorAll('.inner table.table-grid tbody tr'));
          }

          // 各行からデータを抽出
          let rank = 0;
          last3FTable.forEach(row => {
            const horseNumber = row.querySelector('.umaban')?.textContent?.trim() || '';
            const horseName = row.querySelector('td.-left')?.textContent?.trim() || '';
            rank += 1;

            data.last3F.push({
              horseNumber,
              horseName,
              rank: rank
            });
          });
        } catch (error) {
          console.error('上がり3Fデータ抽出エラー:', error);
        }

        // 右回り実績上位順の取得
        try {
          let rightTrackTable;
          if (rightTrackSection) {
            const innerSection = rightTrackSection.closest('.inner');
            rightTrackTable = innerSection ?
              Array.from(innerSection.querySelectorAll('table.table-grid tbody tr')) :
              Array.from(document.querySelectorAll('.right-track-table tbody tr'));
          } else {
            rightTrackTable = Array.from(document.querySelectorAll('.right-track-table tbody tr'));
          }

          // 各行からデータを抽出
          let rank = 0;
          rightTrackTable.forEach(row => {
            const horseNumber = row.querySelector('.umaban')?.textContent?.trim() || '';
            const horseName = row.querySelector('td.-left')?.textContent?.trim() || '';
            rank += 1;

            if (!data.rightHandedTrack) {
              data.rightHandedTrack = [];
            }

            data.rightHandedTrack.push({
              horseNumber,
              horseName,
              rank: rank
            });
          });
        } catch (error) {
          console.error('右回り実績データ抽出エラー:', error);
        }

        // 左回り実績上位順の取得
        try {
          let leftTrackTable;
          if (leftTrackSection) {
            const innerSection = leftTrackSection.closest('.inner');
            leftTrackTable = innerSection ?
              Array.from(innerSection.querySelectorAll('table.table-grid tbody tr')) :
              Array.from(document.querySelectorAll('.left-track-table tbody tr'));
          } else {
            leftTrackTable = Array.from(document.querySelectorAll('.left-track-table tbody tr'));
          }

          // 各行からデータを抽出
          let rank = 0;
          leftTrackTable.forEach(row => {
            const horseNumber = row.querySelector('.umaban')?.textContent?.trim() || '';
            const horseName = row.querySelector('td.-left')?.textContent?.trim() || '';
            rank += 1;

            if (!data.leftHandedTrack) {
              data.leftHandedTrack = [];
            }

            data.leftHandedTrack.push({
              horseNumber,
              horseName,
              rank: rank
            });
          });
        } catch (error) {
          console.error('左回り実績データ抽出エラー:', error);
        }

        return data;
      });
      analysisData.date = date;
      analysisData.trackCode = trackCode;
      analysisData.raceNumber = raceNumber;
      console.log('分析データ:', analysisData);

      return analysisData;
    } catch (error) {
      console.error('分析データの取得に失敗しました:', error);
      return {
        date: '',
        trackCode: '',
        raceNumber: '',
        bestTime: [],
        last3F: [],
        rightHandedTrack: [],
        leftHandedTrack: []
      };
    }
  }

  /**
   * レース結果を取得する
   * @param date 日付（YYYYMMDD形式）
   * @param RacetrackCd レースコード
   * @returns レース結果情報
   */
  async getRaceResults(date: string, RacetrackCd: string): Promise<RaceResult[]> {
    try {
      // URLを構築
      const DOR = date;
      const url = `https://www.winkeiba.jp/race/odds/payout?RacetrackCd=${RacetrackCd}&DOR=${DOR}`;

      // ページにアクセス
      await randomDelay(1000, 2000);
      await this.page!.goto(url, { waitUntil: 'domcontentloaded' });

      await randomDelay(1000, 2000);

      // すべてのレース結果を格納する配列
      const allRaceResults: RaceResult[] = [];

      // ---------- 汎用ユーティリティ ----------
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
        const results: RaceResult = {
          date: date,
          trackCode: RacetrackCd,
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
          // ---------- 着順テーブル ----------
          const rankingRows = await rankingTable.$$('tbody tr');
          const parseRankRow = async (row: ElementHandle<Element>) => ({
            horse_number: parseInt(await getTextSafe(row, '.umaban')) || 0,
            horse_name: await getTextSafe(row, 'td.-left'),
            popularity:
              parseInt((await getTextSafe(row, 'td:last-child')).replace(/人気/, '')) || 0
          });
          if (rankingRows[0]) results.first_place = await parseRankRow(rankingRows[0]);
          if (rankingRows[1]) results.second_place = await parseRankRow(rankingRows[1]);
          if (rankingRows[2]) results.third_place = await parseRankRow(rankingRows[2]);
        }
        
        // 配当情報を取得
        const payoutTable = await section.$('.table-grid.-results');
        if (payoutTable) {
          // tbody要素を正しく取得し、その中のtr要素を行として扱う
          const payoutTbody = await payoutTable.$('tbody');
          if (!payoutTbody) continue;

          // ---------- 配当テーブル ----------
          const rows = await payoutTbody.$$('tr');

          // 文字ラベルで行を取る
          const findRow = async (keyword: string): Promise<ElementHandle<Element> | null> =>
            (await Promise.all(
              rows.map(async (r) =>
                ((await getTextSafe(r, 'td.line')) || '').includes(keyword) ? r : null
              )
            )).find(Boolean) ?? null;

          const parseCombo = async (row: ElementHandle<Element>): Promise<string> =>
            (await row.$$eval('i.icon-umaban', (els) =>
              els.map((e) => (e.textContent || '').trim()).join('-')
            )) || '';

          const parsePayout = async (row: ElementHandle<Element>): Promise<number> =>
            parseInt(
              (
                await row.$eval(
                  'td.-right',
                  (el) => (el.textContent || '').replace(/[^0-9]/g, '')
                )
              ) || '0'
            ) || 0;

          const parsePopularity = async (row: ElementHandle<Element>): Promise<number> =>
            parseInt(
              (
                (await getTextSafe(row, 'td.-center')).match(/(\d+)/)?.[1] || '0'
              ).trim()
            ) || 0;

          /* 単勝 */
          const winRow = await findRow('単勝');
          if (winRow) {
            results.win.horse_number =
              parseInt(await getTextSafe(winRow, 'i.icon-umaban')) || 0;
            results.win.payout =
              parseInt((await getTextSafe(winRow, 'td.-right')).replace(/[^0-9]/g, '')) ||
              0;
            results.win.popularity =
              parseInt(
                ((await getTextSafe(winRow, 'td.-center')).match(/(\d+)/)?.[1] || '0')
              ) || 0;
          }

          /* 複勝（連続 1〜3 行） */
          const placeRow = await findRow('複勝');
          if (placeRow) {
            // findIndexをやめて、より単純なアプローチに変更
            let idx = 0;
            
            // placeRowの位置を特定
            for (let i = 0; i < rows.length; i++) {
              const row = rows[i];
              const text = await getTextSafe(row, 'td.line');
              if (text && text.includes('複勝')) {
                idx = i;
                break;
              }
            }
            
            const placeArr: { horse_number: number; popularity: number; payout: number; }[] = [];
            while (idx < rows.length && placeArr.length < 3) {
              const row = rows[idx];
              // 行が複勝ブロックか確認
              const lineCls = await getTextSafe(row, 'td.line');
              if (lineCls && !lineCls.includes('複勝') && placeArr.length) break;

              placeArr.push({
                horse_number: parseInt(await getTextSafe(row, 'i.icon-umaban')) || 0,
                payout:
                  parseInt(
                    (await getTextSafe(row, 'td.-right')).replace(/[^0-9]/g, '')
                  ) || 0,
                popularity:
                  parseInt(
                    ((await getTextSafe(row, 'td.-center')).match(/(\d+)/)?.[1] || '0')
                  ) || 0
              });
              idx++;
            }
            // 配列の長さが3未満の場合、デフォルト値で埋める
            while (placeArr.length < 3)
              placeArr.push({ horse_number: 0, payout: 0, popularity: 0 });

            // 明示的にタプルとしてキャスト
            results.place.horses = [
              placeArr[0] || { horse_number: 0, payout: 0, popularity: 0 },
              placeArr[1] || { horse_number: 0, payout: 0, popularity: 0 },
              placeArr[2] || { horse_number: 0, payout: 0, popularity: 0 }
            ] as [
              { horse_number: number; popularity: number; payout: number; },
              { horse_number: number; popularity: number; payout: number; },
              { horse_number: number; popularity: number; payout: number; }
            ];
          }

          /* 枠連 */
          const bracketQuinella = await findRow('枠連');
          if (bracketQuinella) {
            results.bracket_quinella = {
              combination: await parseCombo(bracketQuinella),
              payout: await parsePayout(bracketQuinella),
              popularity: await parsePopularity(bracketQuinella)
            };
          }

          /* 馬連 */
          const quinella = await findRow('馬連');
          if (quinella) {
            results.quinella = {
              combination: await parseCombo(quinella),
              payout: await parsePayout(quinella),
              popularity: await parsePopularity(quinella)
            };
          }

          /* 馬単 */
          const exacta = await findRow('馬単');
          if (exacta) {
            results.exacta = {
              combination: await parseCombo(exacta),
              payout: await parsePayout(exacta),
              popularity: await parsePopularity(exacta)
            };
          }

          /* 3連複 */
          const trio = await findRow('3連複');
          if (trio) {
            results.trio = {
              combination: await parseCombo(trio),
              payout: await parsePayout(trio),
              popularity: await parsePopularity(trio)
            };
          }

          /* 3連単 */
          const trifecta = await findRow('3連単');
          if (trifecta) {
            const comboText = await trifecta.$$eval('i.icon-umaban', (els) =>
              els.map((e) => (e.textContent || '').trim()).join('→')
            );
            results.trifecta = {
              combination: comboText,
              payout: await parsePayout(trifecta),
              popularity: await parsePopularity(trifecta)
            };
          }
        }
        
        // 結果を配列に追加
        allRaceResults.push(results);
      }
      
      return allRaceResults;
    } catch (error) {
      console.error('レース結果の取得に失敗しました:', error);
      // 空のRaceResult配列を返す
      return [{
        date: '',
        trackCode: '',
        raceNumber: '',
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
      }];
    }
  }

}


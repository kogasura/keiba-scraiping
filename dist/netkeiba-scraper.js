"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NetkeibaScraper = void 0;
const config_1 = require("./config");
const utils_1 = require("./utils");
const path = __importStar(require("path"));
const playwright_utlis_1 = require("./playwright-utlis");
const consts_1 = require("./consts");
class NetkeibaScraper {
    constructor() {
        this.browser = null;
        this.page = null;
        this.executionDate = (0, playwright_utlis_1.getCurrentDate)();
    }
    async init() {
        try {
            const { browser, context, page } = await (0, playwright_utlis_1.initBrowser)();
            this.browser = browser;
            this.page = page;
            this.executionDate = (0, playwright_utlis_1.getCurrentDate)();
            console.log('Netkeiba スクレイパーを初期化しました');
        }
        catch (error) {
            throw error;
        }
    }
    async close() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
            this.page = null;
        }
    }
    async login() {
        try {
            console.log('netkeiba サイトにログイン中...');
            // ログインページへアクセス
            const loginUrl = `https://regist.netkeiba.com/account/?pid=login`;
            await this.page.goto(loginUrl, { waitUntil: 'domcontentloaded' });
            await (0, utils_1.randomDelay)(4000, 5000);
            // ログイン情報入力
            await (0, utils_1.randomDelay)(500, 800);
            await this.page.fill('input[name="login_id"]', config_1.CONFIG.NETKEIBA.USERNAME);
            await (0, utils_1.randomDelay)(500, 800);
            await this.page.fill('input[name="pswd"]', config_1.CONFIG.NETKEIBA.PASSWORD);
            // ランダムな待機時間を設定（人間らしい動きを再現）
            await (0, utils_1.randomDelay)(500, 800);
            // ログインボタンクリック
            await this.page.click('input[type="image"][alt="ログイン"]');
            await (0, utils_1.randomDelay)(2000, 3000);
            return true;
        }
        catch (error) {
            console.error('ログイン処理中にエラーが発生しました:', error);
            return false;
        }
    }
    async getRaceList(date) {
        if (!this.page) {
            throw new Error('ブラウザが初期化されていません');
        }
        try {
            // まず通常のトップページにアクセス
            await this.page.goto('https://www.netkeiba.com/', { waitUntil: 'load' });
            await this.page.waitForTimeout(1000);
            // 目的のURLにアクセス
            const url = `${config_1.CONFIG.NETKEIBA.BASE_URL}?kaisai_date=${date}`;
            await this.page.goto(url, { waitUntil: 'domcontentloaded' });
            console.log('現在のページURL:', this.page.url());
            // ページが完全に読み込まれるまで待機
            await this.page.waitForTimeout(2000);
            // 実際のページ構造を確認
            console.log('ページ構造を確認中...');
            // 各種コンテナの存在確認
            const hasRaceList = await this.page.$('#race_list');
            const hasDateList = await this.page.$('#date_list');
            const hasRaceListArea = await this.page.$('.RaceList_Area');
            console.log('#race_listが存在するか:', !!hasRaceList);
            console.log('#date_listが存在するか:', !!hasDateList);
            console.log('.RaceList_Areaが存在するか:', !!hasRaceListArea);
            // 実際のページ構造に基づいてレース情報を抽出
            const allRaces = [];
            // 新しいセレクタでレース情報を取得
            if (hasDateList) {
                console.log('date_listからレース情報を取得します');
                // 各競馬場のセクションをより具体的なセレクタで取得
                const venueHeaders = await this.page.$$('#date_list .RaceList_DataList');
                console.log(`競馬場セクション数: ${venueHeaders.length}`);
                // 各競馬場の情報を保存する配列
                const venueInfos = [];
                // まず各競馬場の情報を取得
                for (let i = 0; i < venueHeaders.length; i++) {
                    try {
                        const venueSection = venueHeaders[i];
                        // 競馬場ヘッダー情報を取得
                        const headerInfo = await venueSection.evaluate((node) => {
                            const titleElement = node.querySelector('.RaceList_DataTitle');
                            if (!titleElement)
                                return null;
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
                            console.log(`競馬場セクション ${i + 1}: ヘッダー情報が取得できませんでした`);
                            continue;
                        }
                        const venue = headerInfo.venue || '';
                        const round = headerInfo.round.replace(/回$/, '') || '';
                        const day = headerInfo.day.replace(/日目$/, '') || '';
                        if (!venue) {
                            console.log(`競馬場セクション ${i + 1}: 競馬場名が取得できませんでした`);
                            continue;
                        }
                        console.log(`競馬場セクション ${i + 1}: 第${round}回 ${venue} ${day}日目`);
                        // 競馬場情報を保存
                        venueInfos.push({ venue, round, day });
                        // レース行を取得
                        const raceRows = await venueSection.$$('.RaceList_DataItem, .RaceList_Item');
                        console.log(`${venue}のレース数: ${raceRows.length}`);
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
                                    }
                                    catch (error) {
                                        continue;
                                    }
                                }
                                if (raceNumber === 0) {
                                    console.log('レース番号の取得に失敗しました。スキップします。');
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
                                                if (raceName)
                                                    break;
                                            }
                                            else {
                                                raceName = trimmedText;
                                                if (raceName)
                                                    break;
                                            }
                                        }
                                    }
                                    catch (error) {
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
                                            if (startTime)
                                                break;
                                        }
                                    }
                                    catch (error) {
                                        continue;
                                    }
                                }
                                // コース情報（芝/ダート、距離）
                                let trackType = '芝';
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
                                            }
                                            else if (courseText.includes('ダ')) {
                                                trackType = 'ダート';
                                            }
                                            else if (courseText.includes('障')) {
                                                trackType = '障';
                                            }
                                            // 距離を抽出
                                            const distanceMatch = courseText.match(/(\d+)m/);
                                            if (distanceMatch) {
                                                distance = parseInt(distanceMatch[1], 10);
                                            }
                                            if (trackType && distance > 0)
                                                break;
                                        }
                                    }
                                    catch (error) {
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
                                    }
                                    catch (error) {
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
                                            if (weather || trackCondition)
                                                break;
                                        }
                                    }
                                    catch (error) {
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
                                    }
                                    catch (error) {
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
                                        const dataRaceId = await row.evaluate((node) => {
                                            return node.getAttribute('data-race-id') ||
                                                node.getAttribute('data-id') ||
                                                '';
                                        });
                                        if (dataRaceId && /^\d+$/.test(dataRaceId)) {
                                            netkeibaRaceId = parseInt(dataRaceId, 10);
                                        }
                                    }
                                    // IDが取得できない場合は0のままにする（仮のID生成は行わない）
                                }
                                catch (error) {
                                    console.error('レースID取得中にエラー:', error);
                                    // エラー時も0のままにする
                                }
                                // レース情報を追加
                                allRaces.push({
                                    date: date,
                                    trackCode: (0, consts_1.getTrackCode)(venue),
                                    raceNumber: parseInt(raceNumber.toString().padStart(2, '0'), 10),
                                    race_name: raceName || `第${raceNumber}レース`,
                                    course: venue,
                                    venue: `${round}回 ${venue} ${day}日目`,
                                    start_time: startTime || '00:00',
                                    track_type: trackType,
                                    distance: distance || 0,
                                    entries_count: entriesCount || 0,
                                    weather: weather || '',
                                    track_condition: trackCondition || '',
                                    prize_money: prizeMoney || 0,
                                    netkeiba_race_id: netkeibaRaceId,
                                    is_finished: false // デフォルトではレースは未完了と設定
                                });
                                console.log(`レース情報を追加: ${raceNumber} - ${venue} (ID: ${netkeibaRaceId})`);
                            }
                            catch (error) {
                                console.error(`${venue}のレース情報処理中にエラー:`, error);
                                continue;
                            }
                        }
                    }
                    catch (error) {
                        console.error(`競馬場セクション ${i + 1} の処理中にエラー:`, error);
                        continue;
                    }
                }
            }
            else {
                console.log('date_listが見つかりません。別の方法でレース情報を取得します。');
                // ページ全体からレース情報を探す
                const allRaceElements = await this.page.$$('[class*="Race"]');
                console.log(`ページ内のレース関連要素数: ${allRaceElements.length}`);
            }
            console.log(`合計 ${allRaces.length} 件のレース情報を取得しました`);
            // レース情報の重複を排除
            const uniqueRaces = [];
            const seenRaces = new Set();
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
            console.log(`重複排除後のレース数: ${uniqueRaces.length}`);
            return uniqueRaces;
        }
        catch (error) {
            console.error('エラーの詳細:', error);
            return []; // エラー時は空配列を返す
        }
    }
    // タイム指数 最高値を取得する関数
    async getTimeIndexMax(raceId) {
        if (!this.page) {
            throw new Error('ブラウザが初期化されていません');
        }
        try {
            // タイム指数ページにアクセス
            const url = `https://race.netkeiba.com/race/speed.html?race_id=${raceId}&type=rank&mode=max`;
            await this.page.goto(url, { waitUntil: 'domcontentloaded' });
            await this.page.waitForTimeout(1500);
            // スクリーンショットを取得（デバッグ用）
            const screenshotDir = path.join('image', this.executionDate);
            (0, playwright_utlis_1.ensureDirectoryExists)(screenshotDir);
            const screenshotPath = path.join(screenshotDir, `time-index-max-${raceId}.png`);
            await this.page.screenshot({ path: screenshotPath });
            // テーブルから上位5頭のデータを取得
            const timeIndexData = await this.page.evaluate(() => {
                const result = [];
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
            const timeIndex = {
                netkeiba_race_id: raceId,
                time_index_horse_numbers: timeIndexData
            };
            console.log(`タイム指数（最高値）上位${timeIndexData.filter(n => n > 0).length}頭を取得しました`);
            return timeIndex;
        }
        catch (error) {
            console.error('タイム指数（最高値）取得中にエラーが発生しました:', error);
            return {
                netkeiba_race_id: raceId,
                time_index_horse_numbers: [0, 0, 0, 0, 0]
            };
        }
    }
    // タイム指数　近走平均を取得する関数
    async getTimeIndexAverage(raceId) {
        if (!this.page) {
            throw new Error('ブラウザが初期化されていません');
        }
        try {
            // タイム指数平均ページにアクセス
            const url = `https://race.netkeiba.com/race/speed.html?race_id=${raceId}&type=rank&mode=average`;
            await this.page.goto(url, { waitUntil: 'domcontentloaded' });
            await this.page.waitForTimeout(1500);
            // スクリーンショットを取得（デバッグ用）
            const screenshotDir = path.join('image', this.executionDate);
            (0, playwright_utlis_1.ensureDirectoryExists)(screenshotDir);
            const screenshotPath = path.join(screenshotDir, `time-index-average-${raceId}.png`);
            await this.page.screenshot({ path: screenshotPath });
            // テーブルから上位5頭のデータを取得
            const timeIndexData = await this.page.evaluate(() => {
                const result = [];
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
            const timeIndex = {
                netkeiba_race_id: raceId,
                time_index_horse_numbers: timeIndexData
            };
            console.log(`タイム指数（平均値）上位${timeIndexData.filter(n => n > 0).length}頭を取得しました`);
            return timeIndex;
        }
        catch (error) {
            console.error('タイム指数（平均値）取得中にエラーが発生しました:', error);
            return {
                netkeiba_race_id: raceId,
                time_index_horse_numbers: [0, 0, 0, 0, 0]
            };
        }
    }
    // タイム指数　当該距離を取得する関数
    async getTimeIndexDistance(raceId) {
        if (!this.page) {
            throw new Error('ブラウザが初期化されていません');
        }
        try {
            // タイム指数ページにアクセス（当該距離モード）
            const url = `https://race.netkeiba.com/race/speed.html?race_id=${raceId}&type=rank&mode=distance`;
            console.log(`タイム指数（当該距離）ページにアクセス: ${url}`);
            await this.page.goto(url, { waitUntil: 'domcontentloaded' });
            // ランダムな待機時間を設定
            await (0, utils_1.randomDelay)(800, 1200);
            // スクリーンショットを取得（デバッグ用）
            const screenshotDir = path.join('image', this.executionDate);
            (0, playwright_utlis_1.ensureDirectoryExists)(screenshotDir);
            const screenshotPath = path.join(screenshotDir, `time-index-distance-${raceId}.png`);
            await this.page.screenshot({ path: screenshotPath });
            console.log(`スクリーンショットを保存しました: ${screenshotPath}`);
            // テーブルから上位5頭のデータを取得
            const timeIndexData = await this.page.evaluate(() => {
                const result = [];
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
            const timeIndex = {
                netkeiba_race_id: raceId,
                time_index_horse_numbers: timeIndexData
            };
            console.log(`タイム指数（当該距離）上位${timeIndexData.filter(n => n > 0).length}頭を取得しました`);
            return timeIndex;
        }
        catch (error) {
            console.error('タイム指数（当該距離）取得中にエラーが発生しました:', error);
            return {
                netkeiba_race_id: raceId,
                time_index_horse_numbers: [0, 0, 0, 0, 0]
            };
        }
    }
    // 調子偏差値　偏差値上位5頭、急上昇上位最大5頭、自己ベスト最大5頭、人気危険最大1頭を取得する関数
    async getDataAnalysis(raceId) {
        if (!this.page) {
            throw new Error('ブラウザが初期化されていません');
        }
        try {
            // データ分析ページにアクセス
            const url = `https://race.sp.netkeiba.com/barometer/score.html?race_id=${raceId}&rf=rs`;
            console.log(`データ分析ページにアクセス: ${url}`);
            await this.page.goto(url, { waitUntil: 'domcontentloaded' });
            // ランダムな待機時間を設定
            await (0, utils_1.randomDelay)(800, 1200);
            // データ分析情報を取得
            const dataAnalysis = await this.page.evaluate(() => {
                const result = {
                    netkeiba_race_id: 0,
                    deviation_ranks: [],
                    rapid_rise_ranks: [],
                    personal_best_ranks: [],
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
            console.log(`データ分析情報を取得しました: 偏差値上位${dataAnalysis.deviation_ranks.length}頭、急上昇${dataAnalysis.rapid_rise_ranks.length}頭、自己ベスト${dataAnalysis.personal_best_ranks.length}頭`);
            return dataAnalysis;
        }
        catch (error) {
            console.error('データ分析情報取得中にエラーが発生しました:', error);
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
    async getDataAnalysisRanking(raceId) {
        if (!this.page) {
            throw new Error('ブラウザが初期化されていません');
        }
        try {
            const url = `https://race.sp.netkeiba.com/race/data_top.html?race_id=${raceId}&rf=race_toggle_menu`;
            await this.page.goto(url, { waitUntil: 'domcontentloaded' });
            await (0, utils_1.randomDelay)(1000, 2000);
            const dataAnalysisRanking = await this.page.evaluate(() => {
                const result = {
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
                console.warn(`getDataAnalysisRanking: 有効なデータ分析ランキングが見つかりませんでした (raceId=${raceId})`);
                return undefined;
            }
            console.log(`データ分析ランキングを取得しました: ` +
                `1位=${dataAnalysisRanking.data_analysis_ranks[0]}, ` +
                `2位=${dataAnalysisRanking.data_analysis_ranks[1]}, ` +
                `3位=${dataAnalysisRanking.data_analysis_ranks[2]}`);
            return dataAnalysisRanking;
        }
        catch (error) {
            console.error('データ分析ランキング取得中にエラーが発生しました:', error);
            // エラー時も undefined を返し、呼び出し元でスキップ可能にする
            return undefined;
        }
    }
    // CP予想の4頭を取得する関数
    async getCPPrediction(raceId) {
        if (!this.page) {
            throw new Error('ブラウザが初期化されていません');
        }
        try {
            const url = `https://race.sp.netkeiba.com/?pid=yoso_pro_opinion_detail&race_id=${raceId}&yosoka_id=266992`;
            console.log(`CP予想ページにアクセス: ${url}`);
            await this.page.goto(url, { waitUntil: 'domcontentloaded' });
            // ランダムな待機時間
            await (0, utils_1.randomDelay)(1000, 2000);
            const cpPrediction = await this.page.evaluate((raceId) => {
                const result = {
                    netkeiba_race_id: raceId,
                    cp_ranks: [0, 0, 0, 0]
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
            console.log(`CP予想を取得しました: 1位=${cpPrediction.cp_ranks[0]}, 2位=${cpPrediction.cp_ranks[1]}, 3位=${cpPrediction.cp_ranks[2]}, 4位=${cpPrediction.cp_ranks[3]}`);
            return cpPrediction;
        }
        catch (error) {
            console.error('CP予想取得中にエラーが発生しました:', error);
            return {
                netkeiba_race_id: raceId,
                cp_ranks: [0, 0, 0, 0]
            };
        }
    }
    /**
     * 特定のレースの詳細情報を取得する
     * @param raceId netkeiba_race_id
     * @param date 日付
     * @returns 詳細情報を含むRaceInfoオブジェクト
     */
    async getRaceDetail(raceId, date) {
        if (!this.page) {
            throw new Error('ブラウザが初期化されていません');
        }
        if (!raceId) {
            throw new Error('有効なレースIDが指定されていません');
        }
        try {
            // まず結果ページにアクセスしてレースが終了しているかを確認
            const resultUrl = `https://race.netkeiba.com/race/result.html?race_id=${raceId}`;
            console.log(`レース結果ページにアクセス: ${resultUrl}`);
            await this.page.goto(resultUrl, { waitUntil: 'domcontentloaded' });
            // ランダムな待機時間を設定（サーバー負荷軽減とブロック回避）
            await (0, utils_1.randomDelay)(1000, 3000);
            // レースが終了しているかどうかを確認
            const isFinished = await this.page.evaluate(() => {
                // 結果テーブルが存在するか確認
                return document.querySelector('.ResultTableWrap') !== null;
            });
            console.log(`レース終了状態: ${isFinished ? '完了' : '未完了'}`);
            // スクリーンショットを取得（デバッグ用）
            const screenshotDir = path.join('image', this.executionDate);
            (0, playwright_utlis_1.ensureDirectoryExists)(screenshotDir);
            let raceDetail;
            if (isFinished) {
                // レースが終了している場合は結果ページから情報を取得
                const screenshotPath = path.join(screenshotDir, `race-result-${raceId}.png`);
                await this.page.screenshot({ path: screenshotPath });
                console.log(`スクリーンショットを保存しました: ${screenshotPath}`);
                // 既存の処理を続行（結果ページからの情報取得）
                raceDetail = await this.getFinishedRaceDetail(raceId, date);
            }
            else {
                // レースが未完了の場合は出馬表ページにアクセス
                const shutubaUrl = `https://race.netkeiba.com/race/shutuba.html?race_id=${raceId}&rf=race_submenu`;
                console.log(`出馬表ページにアクセス: ${shutubaUrl}`);
                await this.page.goto(shutubaUrl, { waitUntil: 'domcontentloaded' });
                // ランダムな待機時間を設定
                await (0, utils_1.randomDelay)(1000, 3000);
                const screenshotPath = path.join(screenshotDir, `race-shutuba-${raceId}.png`);
                await this.page.screenshot({ path: screenshotPath });
                console.log(`スクリーンショットを保存しました: ${screenshotPath}`);
                // 出馬表ページから情報を取得
                raceDetail = await this.getUpcomingRaceDetail(raceId, date);
            }
            return raceDetail;
        }
        catch (error) {
            console.error('レース詳細取得中にエラー:', error);
            // エラー時は最低限の情報を含むオブジェクトを返す
            return {
                date: '',
                trackCode: '',
                raceNumber: 0,
                race_name: '',
                course: '',
                venue: '',
                start_time: '',
                track_type: '芝',
                distance: 0,
                entries_count: 0,
                weather: '',
                track_condition: '',
                prize_money: 0,
                netkeiba_race_id: raceId,
                is_finished: false
            };
        }
    }
    /**
     * 終了したレースの詳細情報を取得する（結果ページから）
     */
    async getFinishedRaceDetail(raceId, date) {
        // レース基本情報の取得
        const raceInfo = await this.page.evaluate(() => {
            // レース名
            const raceTitleElement = document.querySelector('.RaceName');
            const raceName = raceTitleElement ? raceTitleElement.textContent?.trim() : '';
            // レース番号
            const raceNumberElement = document.querySelector('.RaceNum');
            let raceNumber = 0;
            if (raceNumberElement) {
                const raceNumText = raceNumberElement.textContent?.trim() || '';
                const raceNumMatch = raceNumText.match(/(\d+)/);
                if (raceNumMatch) {
                    raceNumber = parseInt(raceNumMatch[1], 10);
                }
            }
            // レース条件（コース、距離など）
            const raceDataElement = document.querySelector('.RaceData01');
            const raceDataText = raceDataElement ? raceDataElement.textContent?.trim() : '';
            // コース情報を抽出
            let trackType = '芝';
            let distance = 0;
            if (raceDataText) {
                if (raceDataText.includes('ダ')) {
                    trackType = 'ダート';
                }
                const distanceMatch = raceDataText.match(/(\d+)m/);
                if (distanceMatch) {
                    distance = parseInt(distanceMatch[1], 10);
                }
            }
            // 天候・馬場状態を抽出
            let weather = '';
            let trackCondition = '';
            const weatherMatch = (raceDataText ?? '').match(/天候:([^\s\/]+)/);
            if (weatherMatch) {
                weather = weatherMatch[1];
            }
            const trackConditionMatch = (raceDataText ?? '').match(/馬場:([^\s\/]+)/);
            if (trackConditionMatch) {
                trackCondition = trackConditionMatch[1];
            }
            // 開催情報（会場、ラウンド、日目）
            const venueElements = document.querySelectorAll('.RaceData02 span');
            let venue = '';
            let course = '';
            if (venueElements.length >= 3) {
                course = venueElements[1]?.textContent?.trim() || '';
                const roundText = venueElements[0]?.textContent?.trim() || '';
                const dayText = venueElements[2]?.textContent?.trim() || '';
                venue = `${roundText} ${course} ${dayText}`;
            }
            // 発走時刻
            let startTime = '';
            const startTimeElement = document.querySelector('.RaceData01');
            if (startTimeElement) {
                const timeMatch = (startTimeElement.textContent ?? '').match(/(\d{1,2}:\d{2})発走/);
                if (timeMatch) {
                    startTime = timeMatch[1];
                }
            }
            // 賞金
            let prizeMoney = 0;
            const prizeElement = Array.from(document.querySelectorAll('.RaceData02 span')).find(span => span.textContent?.includes('本賞金:'));
            if (prizeElement) {
                const prizeText = prizeElement.textContent?.trim() || '';
                const prizeMatch = prizeText.match(/本賞金:([\d,]+)/);
                if (prizeMatch) {
                    prizeMoney = parseInt(prizeMatch[1].replace(/,/g, ''), 10) * 10000;
                }
            }
            return {
                raceName,
                raceNumber,
                course,
                venue,
                startTime,
                trackType,
                distance,
                weather,
                trackCondition,
                prizeMoney
            };
        });
        // 出走馬情報の取得
        const entries = await this.page.evaluate(() => {
            const horses = [];
            // より具体的なセレクタを使用
            const rows = document.querySelectorAll('.ResultTableWrap tbody tr, .ResultTableWrap tr.HorseList');
            rows.forEach(row => {
                try {
                    // 馬番
                    const horseNumberElement = row.querySelector('.Num.Txt_C');
                    const horse_number = horseNumberElement ? parseInt(horseNumberElement.textContent?.trim() || '0', 10) : 0;
                    // 枠番 - 属性セレクタを使用
                    const frameNumberElement = row.querySelector('.Num[class*="Waku"]');
                    let frame_number = frameNumberElement ? parseInt(frameNumberElement.textContent?.trim() || '0', 10) : 0;
                    // 枠番が取得できない場合は代替方法を試す
                    if (!frame_number) {
                        // 枠番は通常、背景色や枠の色で表現されるので、クラス名から抽出を試みる
                        const wakuClassMatch = Array.from(row.classList).find(cls => cls.match(/Waku\d+/));
                        if (wakuClassMatch) {
                            const wakuMatch = wakuClassMatch.match(/Waku(\d+)/);
                            if (wakuMatch && wakuMatch[1]) {
                                frame_number = parseInt(wakuMatch[1], 10);
                            }
                        }
                    }
                    // 馬名
                    const horseNameElement = row.querySelector('.Horse_Name a');
                    const horse_name = horseNameElement ? horseNameElement.textContent?.trim() || '' : '';
                    // 馬IDの取得 - 正規表現を修正
                    let netkeiba_horse_id = '';
                    if (horseNameElement) {
                        const href = horseNameElement.getAttribute('href') || '';
                        const horseIdMatch = href.match(/\/horse\/(\d+)/);
                        if (horseIdMatch) {
                            netkeiba_horse_id = horseIdMatch[1];
                        }
                    }
                    // 騎手
                    const jockeyElement = row.querySelector('.Jockey a');
                    const jockey = jockeyElement ? jockeyElement.textContent?.trim() || '' : '';
                    // 斤量 - Dredgingクラスから取得
                    let weight_carried = 0;
                    const weightElement = row.querySelector('.Dredging');
                    if (weightElement) {
                        const weightText = weightElement.textContent?.trim() || '';
                        // 数値のみを抽出して変換
                        const weightMatch = weightText.match(/(\d+\.?\d*)/);
                        if (weightMatch) {
                            weight_carried = parseFloat(weightMatch[1]);
                        }
                    }
                    // 人気 - セレクタを修正
                    const popularityElement = row.querySelector('td.Odds.Txt_C');
                    const popularity = popularityElement ? parseInt(popularityElement.textContent?.trim() || '0', 10) : undefined;
                    // オッズ - セレクタを修正
                    const oddsElement = row.querySelector('td.Odds.Txt_R');
                    const odds = oddsElement ? parseFloat(oddsElement.textContent?.trim() || '0') : undefined;
                    // 調教師
                    const trainerElement = row.querySelector('.Trainer a');
                    const trainer = trainerElement ? trainerElement.textContent?.trim() || '' : '';
                    // 性齢 - セレクタを修正
                    const sexAgeElement = row.querySelector('td:nth-child(5)');
                    const sex_age = sexAgeElement ? sexAgeElement.textContent?.trim() || '' : '';
                    // 馬体重 - セレクタを修正
                    const weightElement2 = row.querySelector('td.Weight');
                    let weight = undefined;
                    if (weightElement2) {
                        const weightText = weightElement2.textContent?.trim() || '';
                        const weightMatch = weightText.match(/(\d+)/);
                        if (weightMatch) {
                            weight = parseInt(weightMatch[1], 10);
                        }
                    }
                    // 着順
                    const resultElement = row.querySelector('.Result_Num');
                    let result_position = undefined;
                    if (resultElement) {
                        const resultText = resultElement.textContent?.trim() || '';
                        if (/^\d+$/.test(resultText)) {
                            result_position = parseInt(resultText, 10);
                        }
                    }
                    // タイム - セレクタを修正
                    const timeElement = row.querySelector('td:nth-child(8)');
                    let result_time = undefined;
                    if (timeElement) {
                        const timeText = timeElement.textContent?.trim() || '';
                        // 1:23.4 形式のタイムを秒に変換
                        const timeMatch = timeText.match(/(\d+):(\d+)\.(\d+)/);
                        if (timeMatch) {
                            const minutes = parseInt(timeMatch[1], 10);
                            const seconds = parseInt(timeMatch[2], 10);
                            const tenths = parseInt(timeMatch[3], 10);
                            result_time = minutes * 60 + seconds + tenths / 10;
                        }
                    }
                    // 着差 - セレクタを修正
                    const marginElement = row.querySelector('td:nth-child(9)');
                    const margin = marginElement ? marginElement.textContent?.trim() || '' : '';
                    // 備考 - 実際のHTMLに存在しない場合は空文字を設定
                    const remarks = '';
                    horses.push({
                        horse_number,
                        frame_number,
                        horse_name,
                        jockey,
                        weight_carried,
                        popularity,
                        odds,
                        trainer,
                        sex_age,
                        weight,
                        result_position,
                        result_time,
                        margin,
                        remarks,
                        netkeiba_horse_id
                    });
                }
                catch (error) {
                    console.error('馬情報の抽出中にエラー:', error);
                }
            });
            return horses;
        });
        // 出走頭数
        const entriesCount = entries.length;
        // 最終的なレース情報を構築
        return {
            date: date,
            trackCode: (0, consts_1.getTrackCode)(raceInfo.venue),
            raceNumber: parseInt(raceInfo.raceNumber.toString().padStart(2, '0'), 10),
            race_name: raceInfo.raceName || '',
            course: raceInfo.course || '',
            venue: raceInfo.venue || '',
            start_time: raceInfo.startTime || '',
            track_type: raceInfo.trackType,
            distance: raceInfo.distance,
            entries_count: entriesCount,
            weather: raceInfo.weather || '',
            track_condition: raceInfo.trackCondition || '',
            prize_money: raceInfo.prizeMoney,
            netkeiba_race_id: raceId,
            is_finished: true,
            entries: entries
        };
    }
    /**
     * 未完了のレースの詳細情報を取得する（出馬表ページから）
     */
    async getUpcomingRaceDetail(raceId, date) {
        // レース基本情報の取得
        const raceInfo = await this.page.evaluate(() => {
            // レース名 
            const raceTitleElement = document.querySelector('.RaceName');
            const raceName = raceTitleElement ? raceTitleElement.textContent?.trim() : '';
            // レース番号 - タイトルタグから取得
            let raceNumber = 0;
            const titleElement = document.querySelector('title');
            if (titleElement) {
                const titleText = titleElement.textContent || '';
                // 「中山1R」のような形式からレース番号を抽出
                const raceNumMatch = titleText.match(/(\d+)R/);
                if (raceNumMatch) {
                    raceNumber = parseInt(raceNumMatch[1], 10);
                }
            }
            // レース条件（コース、距離など）
            const raceDataElement = document.querySelector('.RaceData01');
            const raceDataText = raceDataElement ? raceDataElement.textContent?.trim() : '';
            // コース情報を抽出
            let trackType = '芝';
            let distance = 0;
            let weather = '';
            let trackCondition = '';
            let startTime = '';
            if (raceDataText) {
                if (raceDataText.includes('障')) {
                    trackType = '障害';
                }
                else if (raceDataText.includes('ダ')) {
                    trackType = 'ダート';
                }
                const distanceMatch = raceDataText.match(/(\d+)m/);
                if (distanceMatch) {
                    distance = parseInt(distanceMatch[1], 10);
                }
                // 天候・馬場状態を抽出
                const weatherMatch = raceDataText.match(/天候:([^\s\/]+)/);
                if (weatherMatch) {
                    weather = weatherMatch[1];
                }
                const trackConditionMatch = raceDataText.match(/馬場:([^\s\/]+)/);
                if (trackConditionMatch) {
                    trackCondition = trackConditionMatch[1];
                }
                // 発走時刻
                const timeMatch = raceDataText.match(/(\d{1,2}:\d{2})発走/);
                if (timeMatch) {
                    startTime = timeMatch[1];
                }
            }
            // 開催情報（会場、ラウンド、日目）
            const venueElement = document.querySelector('.RaceData02');
            let venue = '';
            let course = '';
            if (venueElement) {
                const venueText = venueElement.textContent?.trim() || '';
                // 「3回 中山 1日目」のような形式から情報を抽出
                const venueMatch = venueText.match(/(\d+)回\s+([^\s]+)\s+(\d+)日/);
                if (venueMatch) {
                    const round = venueMatch[1];
                    course = venueMatch[2];
                    const day = venueMatch[3];
                    venue = `${round}回 ${course} ${day}日目`;
                }
                else {
                    // 正規表現にマッチしない場合はテキスト全体を設定
                    venue = venueText;
                    // コースだけを抽出する試み
                    const courseMatch = venueText.match(/([^\s\d]+)/);
                    if (courseMatch) {
                        course = courseMatch[1];
                    }
                }
            }
            // 賞金
            let prizeMoney = 0;
            if (venueElement) {
                const venueText = venueElement.textContent?.trim() || '';
                // 「本賞金:560,220,140,84,56万円」のような形式から最初の賞金額を抽出
                const prizeMatch = venueText.match(/本賞金:([\d,]+)/);
                if (prizeMatch) {
                    prizeMoney = parseInt(prizeMatch[1].replace(/,/g, ''), 10) * 10000;
                }
            }
            return {
                raceName,
                raceNumber,
                course,
                venue,
                startTime,
                trackType,
                distance,
                weather,
                trackCondition,
                prizeMoney
            };
        });
        // 出走馬情報の取得（出馬表ページ用）
        const entries = await this.page.evaluate(() => {
            const horses = [];
            // 出馬表のテーブル行を取得
            const rows = document.querySelectorAll('.Shutuba_Table tr.HorseList');
            rows.forEach(row => {
                try {
                    // 馬番 - Umabanクラスから取得
                    let horse_number = 0;
                    const horseNumberElement = row.querySelector('td[class^="Umaban"]');
                    if (horseNumberElement) {
                        const numText = horseNumberElement.textContent?.trim() || '';
                        if (/^\d+$/.test(numText)) {
                            horse_number = parseInt(numText, 10);
                        }
                    }
                    // 枠番 - Wakuクラスから取得
                    let frame_number = 0;
                    const wakuElement = row.querySelector('td[class^="Waku"]');
                    if (wakuElement) {
                        const wakuText = wakuElement.textContent?.trim() || '';
                        if (/^\d+$/.test(wakuText)) {
                            frame_number = parseInt(wakuText, 10);
                        }
                        else {
                            // テキストから取得できない場合はクラス名から抽出
                            const wakuClass = Array.from(wakuElement.classList).find(cls => cls.match(/Waku\d+/));
                            if (wakuClass) {
                                const wakuMatch = wakuClass.match(/Waku(\d+)/);
                                if (wakuMatch) {
                                    frame_number = parseInt(wakuMatch[1], 10);
                                }
                            }
                        }
                    }
                    // 馬名
                    const horseNameElement = row.querySelector('.HorseName a');
                    const horse_name = horseNameElement ? horseNameElement.textContent?.trim() || '' : '';
                    // 馬IDの取得
                    let netkeiba_horse_id = '';
                    if (horseNameElement) {
                        const href = horseNameElement.getAttribute('href') || '';
                        const horseIdMatch = href.match(/\/horse\/(\d+)/);
                        if (horseIdMatch) {
                            netkeiba_horse_id = horseIdMatch[1];
                        }
                    }
                    // 騎手
                    const jockeyElement = row.querySelector('.Jockey a');
                    const jockey = jockeyElement ? jockeyElement.textContent?.trim() || '' : '';
                    // 斤量 - Dredgingクラスから取得
                    let weight_carried = 0;
                    const weightElement = row.querySelector('.Dredging');
                    if (weightElement) {
                        const weightText = weightElement.textContent?.trim() || '';
                        // 数値のみを抽出して変換
                        const weightMatch = weightText.match(/(\d+\.?\d*)/);
                        if (weightMatch) {
                            weight_carried = parseFloat(weightMatch[1]);
                        }
                    }
                    // 調教師
                    const trainerElement = row.querySelector('.Trainer a');
                    const trainer = trainerElement ? trainerElement.textContent?.trim() || '' : '';
                    // 性齢
                    const sexAgeElement = row.querySelector('.Barei');
                    const sex_age = sexAgeElement ? sexAgeElement.textContent?.trim() || '' : '';
                    // 馬体重 - Weightクラスから取得 (例: "490(-2)")
                    let weight = undefined;
                    let weight_diff = undefined;
                    const weightElement2 = row.querySelector('.Weight');
                    if (weightElement2) {
                        const weightText = weightElement2.textContent?.trim() || '';
                        const weightMatch = weightText.match(/(\d+)\(([+-]?\d+)\)/);
                        if (weightMatch) {
                            weight = parseInt(weightMatch[1], 10);
                            weight_diff = parseInt(weightMatch[2], 10);
                        }
                        else {
                            // 単純な数値のみの場合
                            const simpleMatch = weightText.match(/(\d+)/);
                            if (simpleMatch) {
                                weight = parseInt(simpleMatch[1], 10);
                            }
                        }
                    }
                    // オッズ（単勝）
                    let odds = undefined;
                    const oddsElement = row.querySelector('.Popular');
                    if (oddsElement) {
                        const oddsText = oddsElement.textContent?.trim() || '';
                        // "---.-"のような場合は除外
                        if (oddsText !== '---.-' && !isNaN(parseFloat(oddsText))) {
                            odds = parseFloat(oddsText);
                        }
                    }
                    // 人気
                    let popularity = undefined;
                    const popularityElement = row.querySelector('.Popular_Ninki');
                    if (popularityElement) {
                        const popText = popularityElement.textContent?.trim() || '';
                        // "**"のような場合は除外
                        if (popText !== '**' && !isNaN(parseInt(popText))) {
                            popularity = parseInt(popText, 10);
                        }
                    }
                    horses.push({
                        horse_number,
                        frame_number,
                        horse_name,
                        jockey,
                        weight_carried,
                        popularity,
                        odds,
                        trainer,
                        sex_age,
                        weight,
                        weight_diff,
                        result_position: undefined,
                        result_time: undefined,
                        margin: '',
                        remarks: '',
                        netkeiba_horse_id
                    });
                }
                catch (error) {
                    console.error('馬情報の抽出中にエラー:', error);
                }
            });
            return horses;
        });
        // 出走頭数
        const entriesCount = entries.length;
        // 最終的なレース情報を構築
        return {
            date: date,
            trackCode: (0, consts_1.getTrackCode)(raceInfo.venue),
            raceNumber: raceInfo.raceNumber,
            race_name: raceInfo.raceName || '',
            course: raceInfo.course || '',
            venue: raceInfo.venue || '',
            start_time: raceInfo.startTime || '',
            track_type: raceInfo.trackType,
            distance: raceInfo.distance,
            entries_count: entriesCount,
            weather: raceInfo.weather || '',
            track_condition: raceInfo.trackCondition || '',
            prize_money: raceInfo.prizeMoney,
            netkeiba_race_id: raceId,
            is_finished: true,
            entries: entries
        };
    }
}
exports.NetkeibaScraper = NetkeibaScraper;

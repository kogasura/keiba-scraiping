"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UmaxScraperService = void 0;
const playwright_utlis_1 = require("./playwright-utlis");
const consts_1 = require("./consts");
class UmaxScraperService {
    constructor() {
        this.baseUrl = 'https://uma-x.jp';
        this.browser = null;
        this.context = null;
        this.page = null;
        this.executionDate = (0, playwright_utlis_1.getCurrentDate)();
    }
    /**
     * ブラウザを初期化する
     */
    async init() {
        try {
            const { browser, context, page } = await (0, playwright_utlis_1.initBrowser)();
            this.browser = browser;
            this.context = context;
            this.page = page;
            console.log('UMA-Xスクレイパーを初期化しました');
        }
        catch (error) {
            console.error('ブラウザの初期化に失敗しました:', error);
            throw error;
        }
    }
    /**
     * ブラウザを閉じる
     */
    async close() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
            this.context = null;
            this.page = null;
            console.log('UMA-Xスクレイパーを終了しました');
        }
    }
    async getRacePrediction(date, trackCode, raceNumber, raceId) {
        const racePrediction = {
            date: date,
            trackCode: trackCode,
            raceNumber: raceNumber,
            focusedHorseNumbers: [],
            timeDeviationTop3: [],
            lastSpurtDeviationTop3: [],
            spValueTop5: [],
            agValueTop5: [],
            saValueTop5: [],
            kiValueTop3: [],
        };
        await this.navigateToRacePage(date, trackCode, raceNumber, `https://uma-x.jp/race_result/${raceId}`);
        racePrediction.focusedHorseNumbers = await this.getFocusedHorseNumbers();
        racePrediction.timeDeviationTop3 = await this.getTimeDeviationTop3();
        racePrediction.lastSpurtDeviationTop3 = await this.getLastSpurtDeviationTop3();
        racePrediction.spValueTop5 = await this.getSpValueTop5();
        racePrediction.agValueTop5 = await this.getAgValueTop5();
        racePrediction.saValueTop5 = await this.getSaValueTop5();
        racePrediction.kiValueTop3 = await this.getKiValueTop3();
        console.log('racePrediction', racePrediction);
        return racePrediction;
    }
    /**
     * 指定された年月のすべてのレースの予想を取得
     * @param year 年
     * @param month 月
     * @returns 指定された年月のすべてのレースの予想
     * https://uma-x.jp/race/202502のような月ごとのレース一覧のページを取得
     * そのページからレース一覧を取得
     * そのレース一覧からレース予想を取得
     */
    async getRacePredictionMonthly(year, month) {
        if (!this.page)
            return [];
        /* ---------------- 0) 月次ページへ ---------------- */
        const ym = `${year}${month.padStart(2, '0')}`; // "202502"
        const monthlyUrl = `${this.baseUrl}/race/${ym}`;
        await this.page.goto(monthlyUrl, { waitUntil: 'load' });
        /* ---------------- 1) レース結果リンク一覧を取得 ----------------
           形式: <a class="top_race_menu" href="/race_result/5202501080120250223">…</a>
        ----------------------------------------------------------------- */
        const hrefs = await this.page.$$eval('a.top_race_menu[href^="/race_result/"]', (as) => Array.from(as).map(a => a.getAttribute('href') || ''));
        /* uniq にして raceId セットを作成 */
        const raceIdSet = new Set();
        hrefs.forEach(href => {
            const id = href.split('/').pop();
            if (id && /^\d{19}$/.test(id))
                raceIdSet.add(id); // 19桁のみ対象
        });
        /* ---------------- 1.5) レース一覧を出力 ---------------- */
        console.log(`${year}年${month}月のレース一覧:`);
        // raceIdからレース情報を抽出して表示
        const raceInfoList = Array.from(raceIdSet).map(raceId => {
            const trackCode = raceId.charAt(0); // 1桁
            const raceNumber = raceId.substring(9, 11); // 2桁
            const date = raceId.substring(11, 19); // YYYYMMDD
            // 日付をフォーマット
            const formattedDate = `${date.substring(0, 4)}/${date.substring(4, 6)}/${date.substring(6, 8)}`;
            // 競馬場名を取得
            // trackCodeが0の場合は10を渡す
            const paddedTrackCode = trackCode === '0' ? '10' : trackCode.padStart(2, '0');
            const trackName = (0, consts_1.getTrackName)(paddedTrackCode);
            return {
                raceId,
                date,
                formattedDate,
                trackCode: paddedTrackCode,
                trackName,
                raceNumber,
                raceNumberInt: parseInt(raceNumber)
            };
        });
        // 日付順、競馬場コード順、レース番号順にソート
        raceInfoList.sort((a, b) => {
            if (a.date !== b.date)
                return a.date.localeCompare(b.date);
            if (a.trackCode !== b.trackCode)
                return a.trackCode.localeCompare(b.trackCode);
            return a.raceNumberInt - b.raceNumberInt;
        });
        // 整形して出力
        raceInfoList.forEach(info => {
            console.log(`${info.formattedDate} ${info.trackName}(${info.trackCode}) ${info.raceNumberInt}R`);
        });
        const predictions = [];
        /* ---------------- 2) 各レース結果ページを順に処理 ---------------- */
        const errorRaces = [];
        for (const raceInfo of raceInfoList) {
            try {
                // レース情報をログ出力
                console.log(`処理中: ${raceInfo.formattedDate} ${raceInfo.trackName}(${raceInfo.trackCode}) ${raceInfo.raceNumberInt}R (ID: ${raceInfo.raceId})`);
                /* b) URL を組み立ててページ遷移 */
                const raceUrl = `${this.baseUrl}/race_result/${raceInfo.raceId}`;
                await this.navigateToRacePage(raceInfo.date, raceInfo.trackCode, raceInfo.raceNumber, raceUrl);
                /* c) 予想情報を収集 */
                const prediction = {
                    date: raceInfo.date,
                    trackCode: raceInfo.trackCode,
                    raceNumber: raceInfo.raceNumber,
                    focusedHorseNumbers: await this.getFocusedHorseNumbers(),
                    timeDeviationTop3: await this.getTimeDeviationTop3(),
                    lastSpurtDeviationTop3: await this.getLastSpurtDeviationTop3(),
                    spValueTop5: await this.getSpValueTop5(),
                    agValueTop5: await this.getAgValueTop5(),
                    saValueTop5: await this.getSaValueTop5(),
                    kiValueTop3: await this.getKiValueTop3()
                };
                predictions.push(prediction);
            }
            catch (error) {
                // エラーが発生したレースの情報を記録
                errorRaces.push({
                    raceId: raceInfo.raceId,
                    trackName: raceInfo.trackName,
                    date: raceInfo.date,
                    raceNumber: raceInfo.raceNumber,
                    error: error instanceof Error ? error.message : String(error)
                });
                console.error(`エラー発生: ${raceInfo.raceId} の処理中にエラーが発生しました`);
            }
            /* d) サーバ負荷軽減用にランダムウェイト (任意) */
            await this.page.waitForTimeout(Math.floor(Math.random() * 500) + 300); // 0.3–0.8 秒スリープ
        }
        // エラーが発生したレースの情報をまとめて報告
        if (errorRaces.length > 0) {
            console.error(`\n処理中に ${errorRaces.length} 件のエラーが発生しました:`);
            errorRaces.forEach(race => {
                const formattedDate = `${race.date.substring(0, 4)}/${race.date.substring(4, 6)}/${race.date.substring(6, 8)}`;
                console.error(`- ${formattedDate} ${race.trackName} ${parseInt(race.raceNumber)}R (ID: ${race.raceId}): ${race.error}`);
            });
        }
        return predictions;
    }
    /**
     * 指定された日付のレースの予想を取得
     * @param date 日付（YYYYMMDD形式の文字列）
     * @returns 指定された日付のレースの予想
     */
    async getRacePredictionByDate(date) {
        if (!this.page)
            return [];
        /* 日付を分解 */
        const year = date.substring(0, 4);
        const month = date.substring(4, 6);
        const day = date.substring(6, 8);
        const targetDate = date; // YYYYMMDD形式
        console.log(`${year}年${month}月${day}日のレース予想を取得します`);
        /* ---------------- 0) 月次ページへ ---------------- */
        const ym = `${year}${month}`; // "202502"
        const monthlyUrl = `${this.baseUrl}/race/${ym}`;
        await this.page.goto(monthlyUrl, { waitUntil: 'load' });
        /* ---------------- 1) レース結果リンク一覧を取得 ---------------- */
        const hrefs = await this.page.$$eval('a.top_race_menu[href^="/race_result/"]', (as) => Array.from(as).map(a => a.getAttribute('href') || ''));
        /* uniq にして raceId セットを作成 */
        const raceIdSet = new Set();
        hrefs.forEach(href => {
            const id = href.split('/').pop();
            if (id && /^\d{19}$/.test(id))
                raceIdSet.add(id);
        });
        /* ---------------- 1.5) レース情報を抽出して対象日付でフィルタリング ---------------- */
        console.log(`${year}年${month}月${day}日のレース一覧を取得中...`);
        // raceIdからレース情報を抽出、日付でフィルタリング
        const raceInfoList = Array.from(raceIdSet)
            .map(raceId => {
            const trackCode = raceId.charAt(0); // 1桁
            const raceNumber = raceId.substring(9, 11); // 2桁
            const date = raceId.substring(11, 19); // YYYYMMDD
            // 日付をフォーマット
            const formattedDate = `${date.substring(0, 4)}/${date.substring(4, 6)}/${date.substring(6, 8)}`;
            // 競馬場名を取得
            const paddedTrackCode = trackCode === '0' ? '10' : trackCode.padStart(2, '0');
            const trackName = (0, consts_1.getTrackName)(paddedTrackCode);
            return {
                raceId,
                date,
                formattedDate,
                trackCode: paddedTrackCode,
                trackName,
                raceNumber,
                raceNumberInt: parseInt(raceNumber)
            };
        })
            // 指定した日付でフィルタリング
            .filter(info => info.date === targetDate);
        // 日付順、競馬場コード順、レース番号順にソート
        raceInfoList.sort((a, b) => {
            if (a.trackCode !== b.trackCode)
                return a.trackCode.localeCompare(b.trackCode);
            return a.raceNumberInt - b.raceNumberInt;
        });
        console.log(`${year}年${month}月${day}日に実施されるレース: ${raceInfoList.length}件`);
        // 整形して出力
        raceInfoList.forEach(info => {
            console.log(`${info.formattedDate} ${info.trackName}(${info.trackCode}) ${info.raceNumberInt}R`);
        });
        const predictions = [];
        /* ---------------- 2) 各レース結果ページを順に処理 ---------------- */
        const errorRaces = [];
        for (const raceInfo of raceInfoList) {
            try {
                // レース情報をログ出力
                console.log(`処理中: ${raceInfo.formattedDate} ${raceInfo.trackName}(${raceInfo.trackCode}) ${raceInfo.raceNumberInt}R (ID: ${raceInfo.raceId})`);
                /* URL を組み立ててページ遷移 */
                const raceUrl = `${this.baseUrl}/race_result/${raceInfo.raceId}`;
                await this.navigateToRacePage(raceInfo.date, raceInfo.trackCode, raceInfo.raceNumber, raceUrl);
                /* 予想情報を収集 */
                const prediction = {
                    date: raceInfo.date,
                    trackCode: raceInfo.trackCode,
                    raceNumber: raceInfo.raceNumber,
                    focusedHorseNumbers: await this.getFocusedHorseNumbers(),
                    timeDeviationTop3: await this.getTimeDeviationTop3(),
                    lastSpurtDeviationTop3: await this.getLastSpurtDeviationTop3(),
                    spValueTop5: await this.getSpValueTop5(),
                    agValueTop5: await this.getAgValueTop5(),
                    saValueTop5: await this.getSaValueTop5(),
                    kiValueTop3: await this.getKiValueTop3()
                };
                predictions.push(prediction);
            }
            catch (error) {
                // エラーが発生したレースの情報を記録
                errorRaces.push({
                    raceId: raceInfo.raceId,
                    trackName: raceInfo.trackName,
                    date: raceInfo.date,
                    raceNumber: raceInfo.raceNumber,
                    error: error instanceof Error ? error.message : String(error)
                });
                console.error(`エラー発生: ${raceInfo.raceId} の処理中にエラーが発生しました`);
            }
            /* サーバ負荷軽減用にランダムウェイト */
            await this.page.waitForTimeout(Math.floor(Math.random() * 500) + 300);
        }
        // エラーが発生したレースの情報をまとめて報告
        if (errorRaces.length > 0) {
            console.error(`\n処理中に ${errorRaces.length} 件のエラーが発生しました:`);
            errorRaces.forEach(race => {
                const formattedDate = `${race.date.substring(0, 4)}/${race.date.substring(4, 6)}/${race.date.substring(6, 8)}`;
                console.error(`- ${formattedDate} ${race.trackName} ${parseInt(race.raceNumber)}R (ID: ${race.raceId}): ${race.error}`);
            });
        }
        return predictions;
    }
    async navigateToRacePage(date, trackCode, raceNumber, url) {
        await this.page?.goto(url);
        await this.page?.waitForLoadState('load');
        await this.page?.waitForTimeout(1000);
    }
    // 注目馬の馬番を取得
    async getFocusedHorseNumbers() {
        if (!this.page) {
            throw new Error('ページが初期化されていません');
        }
        try {
            // 注目馬セクションがロードされるまで待機する
            await this.page.waitForSelector('section.contents.tyumoku');
            // セクション内の全ての<span class="waku">要素を取得し、そのテキストを配列で取り出す
            const numberTexts = await this.page.$$eval('section.contents.tyumoku span.waku', spans => spans.map(span => span.textContent?.trim() || ''));
            // 文字列として取得した馬番を数値に変換する
            const horseNumbers = numberTexts
                .filter(text => text !== '') // 空文字（要素なし）の除外
                .map(text => Number(text)) // 数字文字列を数値型に変換
                .filter(num => !isNaN(num)); // 数値変換に失敗した項目を除外
            console.log('注目馬の馬番:', horseNumbers);
            return horseNumbers;
        }
        catch (error) {
            console.error('注目馬の馬番取得に失敗しました:', error);
            return [];
        }
    }
    /** ──────────────────────────────
     * ① 左側テーブルから馬番配列を取得
     * ────────────────────────────── */
    async getHorseNumbers() {
        return this.page
            ? await this.page.$$eval('div.table-midasi table tbody tr td.uma_no', tds => tds.map(td => Number((td.textContent || '').trim())))
            : [];
    }
    /** ──────────────────────────────
     * ② 右側 thead を見て "〇〇" 列インデックスを取得
     *    その列の tbody セル文字列をすべて返す
     * ────────────────────────────── */
    async getColumnTextsByHeader(headerKeyword, firstTextOnly = false) {
        if (!this.page)
            return [];
        // ★ page.$eval の第3引数は 1 個だけ ⇒ [kw, firstOnly] のタプルを渡す
        // page.$evalの引数の問題を修正
        const colTexts = await this.page.evaluate(({ selector, kw, firstOnly }) => {
            const tbl = document.querySelector(selector);
            if (!tbl)
                return [];
            /* 1) ヘッダー列番号を取得 */
            const headers = Array.from(tbl.querySelectorAll('thead th'));
            const idx = headers.findIndex(th => (th.textContent || '').replace(/\s+/g, '').includes(kw));
            if (idx === -1) {
                console.error(`列「${kw}」が見つかりません`);
                return [];
            }
            /* 2) tbody 行ごとに該当セル文字列を取り出す */
            const rows = Array.from(tbl.querySelectorAll('tbody tr'));
            return rows.map((tr) => {
                const cell = tr.querySelectorAll('td')[idx];
                if (!cell)
                    return '';
                if (firstOnly) {
                    const rel = cell.querySelector('div.relative');
                    const textNode = rel?.firstChild;
                    return (textNode?.textContent || '').trim();
                }
                return (cell.textContent || '').trim();
            });
        }, { selector: 'div.table-body table', kw: headerKeyword, firstOnly: firstTextOnly });
        return colTexts;
    }
    /**
     * -------------------------------------------------------
     * ヘッダー文字列に一致する列の値を数値化して
     * ・ascending = true  ➜ 小さい順
     * ・ascending = false ➜ 大きい順
     * で並べ替え、上位 topN 件の馬番を返す
     * -------------------------------------------------------
     */
    async getTopNByColumn(headerKeyword, parser, topN, ascending = true) {
        const horses = await this.getHorseNumbers();
        const colTexts = await this.getColumnTextsByHeader(headerKeyword);
        const pairs = [];
        const len = Math.min(horses.length, colTexts.length);
        for (let i = 0; i < len; i++) {
            const h = horses[i];
            const v = parser(colTexts[i]);
            if (!isNaN(h) && !isNaN(v))
                pairs.push({ horse: h, value: v });
        }
        pairs.sort((a, b) => ascending ? a.value - b.value : b.value - a.value);
        // デバッグ出力
        console.log(`「${headerKeyword}」列の値:`, pairs.map(p => ({
            馬番: p.horse,
            値: p.value,
            元の文字列: colTexts[horses.indexOf(p.horse)]
        })));
        return pairs.slice(0, topN).map(p => p.horse);
    }
    // タイム偏差上位3頭の馬番を取得
    async getTimeDeviationTop3() {
        // "mm:ss.s" → 秒数 に変換
        const toSec = (t) => {
            const clean = t.replace(/\s+/g, '');
            if (!clean || clean === '-' || clean === '--')
                return NaN;
            const m = clean.match(/^(\d+):(\d+\.\d+)$/);
            return m ? Number(m[1]) * 60 + Number(m[2]) : Number(clean);
        };
        return this.getTopNByColumn('タイム', toSec, 3, true);
    }
    /**
     * 「馬番」「アガリ」を取得し、
     * アガリ（上がり3F）の速い順に並べ替えて
     * 上位3頭の馬番を返す
     */
    async getLastSpurtDeviationTop3() {
        const toNum = (t) => parseFloat(t.replace(/\s+/g, '')); // 例 "37.2"
        return this.getTopNByColumn('アガリ', toNum, 3, true);
    }
    /**
     * SP値（スピード指数?）が高い順トップ5の馬番を取得
     */
    async getSpValueTop5() {
        if (!this.page)
            return [];
        /* a) 馬番リスト */
        const horses = await this.getHorseNumbers();
        /* b) SP列の値だけ抽出 ─ 先頭テキストノードだけ取る extractor */
        const spTexts = await this.getColumnTextsByHeader('SP値', true);
        /* c) 数値化＆ペア化 */
        const pairs = [];
        const len = Math.min(horses.length, spTexts.length);
        for (let i = 0; i < len; i++) {
            const v = parseFloat(spTexts[i]);
            if (!isNaN(horses[i]) && !isNaN(v))
                pairs.push({ horse: horses[i], sp: v });
        }
        /* d) 大きい順に並べ替え → 上位5頭 */
        pairs.sort((a, b) => b.sp - a.sp);
        // SP値が0のデータを除外
        const filteredPairs = pairs.filter(p => p.sp > 0);
        return filteredPairs.slice(0, 5).map(p => p.horse);
    }
    async getAgValueTop5() {
        if (!this.page)
            return [];
        /* a) 馬番リスト */
        const horses = await this.getHorseNumbers();
        /* b) AG列の値だけ抽出 ─ 先頭テキストノードだけ取る extractor */
        const agTexts = await this.getColumnTextsByHeader('AG値', true);
        /* c) 数値化＆ペア化 */
        const pairs = [];
        const len = Math.min(horses.length, agTexts.length);
        for (let i = 0; i < len; i++) {
            const v = parseFloat(agTexts[i]);
            if (!isNaN(horses[i]) && !isNaN(v))
                pairs.push({ horse: horses[i], ag: v });
        }
        /* d) 大きい順に並べ替え → 上位5頭 */
        pairs.sort((a, b) => b.ag - a.ag);
        // AG値が0のデータを除外
        const filteredPairs = pairs.filter(p => p.ag > 0);
        return filteredPairs.slice(0, 5).map(p => p.horse);
    }
    async getSaValueTop5() {
        if (!this.page)
            return [];
        /* a) 馬番リスト */
        const horses = await this.getHorseNumbers();
        /* b) SA列の値だけ抽出 ─ 先頭テキストノードだけ取る extractor */
        const saTexts = await this.getColumnTextsByHeader('SA値', true);
        /* c) 数値化＆ペア化 */
        const pairs = [];
        const len = Math.min(horses.length, saTexts.length);
        for (let i = 0; i < len; i++) {
            const v = parseFloat(saTexts[i]);
            if (!isNaN(horses[i]) && !isNaN(v))
                pairs.push({ horse: horses[i], sa: v });
        }
        /* d) 大きい順に並べ替え → 上位5頭 */
        pairs.sort((a, b) => b.sa - a.sa);
        // SA値が0のデータを除外
        const filteredPairs = pairs.filter(p => p.sa > 0);
        return filteredPairs.slice(0, 5).map(p => p.horse);
    }
    /**
     * KI値が高い順トップ3の馬番を取得
     */
    async getKiValueTop3() {
        const toNum = (t) => parseInt(t, 10);
        return this.getTopNByColumn('KI値', toNum, 3, false);
    }
}
exports.UmaxScraperService = UmaxScraperService;

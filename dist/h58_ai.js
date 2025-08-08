"use strict";
// https://note.com/h58_ai/n/nf293289ed055
// 上記のLINKの形式のnoteから、データを取得する
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatOcrResults = exports.extractTextFromImages = exports.processImage = exports.fetchImagesFromNote = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const playwright_utlis_1 = require("./playwright-utlis");
const utils_1 = require("./utils");
const openai_1 = __importDefault(require("openai"));
const dotenv_1 = __importDefault(require("dotenv"));
const sharp_1 = __importDefault(require("sharp"));
// 環境変数の読み込み
dotenv_1.default.config();
/**
 * URLから記事中の画像（元画像）をすべて取得して保存する
 * @param url Note 記事の URL
 * @param date YYYYMMDD 形式の日付
 * @param trackCode レースコード
 * @returns 保存した元画像のファイルパス配列
 */
async function fetchImagesFromNote(url, date, trackCode) {
    let browser = null;
    let context = null;
    let page = null;
    const imagePaths = [];
    try {
        // ブラウザ起動
        const browserInit = await (0, playwright_utlis_1.initBrowser)();
        browser = browserInit.browser;
        context = browserInit.context;
        page = browserInit.page;
        console.log(`noteページにアクセス: ${url}`);
        await page.goto(url, { waitUntil: 'domcontentloaded' });
        await (0, utils_1.randomDelay)(2000, 3000);
        // 保存ディレクトリ準備
        const imageDir = path.join('ai-note-images', date);
        (0, playwright_utlis_1.ensureDirectoryExists)(imageDir);
        // 記事内の画像 URL を取得（先頭末尾のプロフィール画像を除外）
        const imageUrls = await page.evaluate(() => {
            const imgs = Array.from(document.querySelectorAll('article img'));
            const urls = imgs
                .map((img) => img.getAttribute('src'))
                .filter((src) => !!src);
            return urls.length > 2 ? urls.slice(1, -1) : urls;
        });
        console.log(`${imageUrls.length} 枚の画像を検出`);
        // 画像ダウンロード＆保存（元画像のみ）
        for (let i = 0; i < imageUrls.length; i++) {
            const imageUrl = imageUrls[i];
            try {
                const res = await fetch(imageUrl);
                if (!res.ok) {
                    console.warn(`ダウンロード失敗: ${imageUrl}`);
                    continue;
                }
                const buffer = Buffer.from(await res.arrayBuffer());
                const originalImagePath = path.join(imageDir, `${date}-${trackCode}-${i + 1}-original.jpg`);
                fs.writeFileSync(originalImagePath, buffer);
                console.log(`元画像を保存: ${originalImagePath}`);
                imagePaths.push(originalImagePath);
            }
            catch (err) {
                console.error(`画像のダウンロードに失敗しました: ${imageUrl}`, err);
            }
            await (0, utils_1.randomDelay)(500, 1000);
        }
        return imagePaths;
    }
    catch (error) {
        console.error('画像の取得に失敗しました:', error);
        return imagePaths;
    }
    finally {
        if (browser) {
            await browser.close();
        }
    }
}
exports.fetchImagesFromNote = fetchImagesFromNote;
/**
 * 元画像を切り取り・結合して新たな画像を作成し、そのパスを返す
 * @param originalImagePath 元画像のパス
 * @returns 切り取り・結合後の画像パス
 */
async function processImage(originalImagePath) {
    const buffer = fs.readFileSync(originalImagePath);
    const { dir, base } = path.parse(originalImagePath);
    const match = base.match(/(\d+)-([^-]+)-(\d+)-original\.jpg/);
    if (!match) {
        throw new Error(`ファイル名のパースに失敗しました: ${base}`);
    }
    const [, date, trackCode, idxStr] = match;
    const idx = parseInt(idxStr, 10);
    // メタデータ取得
    const meta = await (0, sharp_1.default)(buffer).metadata();
    const width = meta.width || 800;
    const height = meta.height || 600;
    const topHeight = Math.floor(height * 0.04);
    // 上部切り取り
    const topBuffer = await (0, sharp_1.default)(buffer)
        .extract({
        left: Math.floor(width * 0.25),
        top: 0,
        width: Math.floor(width * 0.75),
        height: topHeight,
    })
        .toBuffer();
    // 上部画像保存
    const topImagePath = path.join(dir, `${date}-${trackCode}-${idx}-top.jpg`);
    await (0, sharp_1.default)(topBuffer).toFile(topImagePath);
    // 下部左側切り取り
    const bottomBuffer = await (0, sharp_1.default)(buffer)
        .extract({
        left: 0,
        top: topHeight,
        width: Math.floor(width * 0.07),
        height: height - topHeight,
    })
        .toBuffer();
    // 下部画像保存
    const bottomImagePath = path.join(dir, `${date}-${trackCode}-${idx}-bottom.jpg`);
    await (0, sharp_1.default)(bottomBuffer).toFile(bottomImagePath);
    // 結合画像作成
    const combinedImagePath = path.join(dir, `${date}-${trackCode}-${idx}.jpg`);
    await (0, sharp_1.default)({
        create: {
            width: Math.max(Math.floor(width * 0.75), Math.floor(width * 0.25)),
            height: topHeight + (height - topHeight),
            channels: 3,
            background: { r: 255, g: 255, b: 255 },
        },
    })
        .composite([
        { input: topBuffer, top: 0, left: 0 },
        { input: bottomBuffer, top: topHeight, left: 0 },
    ])
        .toFile(combinedImagePath);
    return combinedImagePath;
}
exports.processImage = processImage;
/**
 * 画像から OCR（OpenAI）を使ってテキストを取得する
 * @param imagePaths 元画像のパス配列
 */
async function extractTextFromImages(imagePaths) {
    const results = [];
    const client = new openai_1.default({
        apiKey: process.env['OPENAI_API_KEY'],
    });
    for (const originalImagePath of imagePaths) {
        try {
            console.log(`画像処理開始: ${originalImagePath}`);
            // 1) 切り取り・結合処理
            let targetImagePath;
            let topImagePath;
            let bottomImagePath;
            try {
                targetImagePath = await processImage(originalImagePath);
                // 画像パスから上部と下部の画像パスを取得
                const { dir, base } = path.parse(originalImagePath);
                const match = base.match(/(\d+)-([^-]+)-(\d+)-original\.jpg/);
                if (!match) {
                    throw new Error(`ファイル名のパースに失敗しました: ${base}`);
                }
                const [, date, trackCode, idxStr] = match;
                const idx = parseInt(idxStr, 10);
                topImagePath = path.join(dir, `${date}-${trackCode}-${idx}-top.jpg`);
                bottomImagePath = path.join(dir, `${date}-${trackCode}-${idx}-bottom.jpg`);
                // 画像の存在確認
                if (!fs.existsSync(topImagePath) || !fs.existsSync(bottomImagePath)) {
                    throw new Error('上部または下部の画像が見つかりません');
                }
            }
            catch (error) {
                console.warn(`切り取り処理に失敗したため元画像を使用します: ${originalImagePath}`, error);
                targetImagePath = originalImagePath;
                topImagePath = originalImagePath;
                bottomImagePath = originalImagePath;
            }
            // 2) ファイル名から日付・トラックコードを解析
            const filename = path.basename(targetImagePath);
            const match = filename.match(/(\d+)-([^-]+)-\d+\.jpg/);
            if (!match) {
                console.error(`ファイル名のフォーマットが不正です: ${filename}`);
                continue;
            }
            const date = match[1];
            const trackCode = match[2];
            // 3) 上部画像からレース番号を取得
            console.log(`上部画像OCR: ${topImagePath}`);
            const topBase64Image = fs.readFileSync(topImagePath, 'base64');
            const topResponse = await client.responses.create({
                model: 'gpt-4.1',
                input: [
                    {
                        role: 'system',
                        content: '画像上部に表示されている日付、競馬場名、レース番号を抽出してください。'
                    },
                    {
                        role: 'user',
                        content: [
                            {
                                type: 'input_text',
                                text: '画像から日付、競馬場名、レース番号を抽出してください。'
                            },
                            {
                                type: 'input_image',
                                image_url: `data:image/jpeg;base64,${topBase64Image}`,
                                detail: 'auto',
                            },
                        ],
                    },
                ],
                text: {
                    format: {
                        type: 'json_schema',
                        name: 'race_info',
                        schema: {
                            type: 'object',
                            properties: {
                                date: { type: 'string' },
                                trackName: { type: 'string' },
                                raceNumber: { type: 'number' },
                            },
                            required: ['date', 'trackName', 'raceNumber'],
                            additionalProperties: false,
                        },
                        strict: true,
                    },
                },
            });
            console.log(`上部OCR結果: ${topResponse.output_text}`);
            const topParsed = JSON.parse(topResponse.output_text);
            // 4) 下部画像から予想マークと馬番を取得
            console.log(`下部画像OCR: ${bottomImagePath}`);
            const bottomBase64Image = fs.readFileSync(bottomImagePath, 'base64');
            const bottomResponse = await client.responses.create({
                model: 'gpt-4.1',
                input: [
                    {
                        role: 'system',
                        content: '画像左側の ◎ 〇 ☆ ▲ △ と馬番を抽出して JSON で返してください。\
             ・マークが画像に存在しない → horse_number は null。\
             ・マークはあるが数字が読めない／自信が無い → horse_number は 99、\
               confidence を 0〜1 1が自信あり（0が自信なし）で返し、可能性がある数字を candidates に配列で入れてください。\
             5 つのマークすべてについて必ず返してください。'
                    },
                    {
                        role: 'user',
                        content: [
                            {
                                type: 'input_text',
                                text: '画像から予想マーク（◎、〇、☆、▲、△）と対応する馬番を抽出してください。'
                            },
                            {
                                type: 'input_image',
                                image_url: `data:image/jpeg;base64,${bottomBase64Image}`,
                                detail: 'auto',
                            },
                        ],
                    },
                ],
                text: {
                    format: {
                        type: 'json_schema',
                        name: 'horse_marks',
                        schema: {
                            type: 'object',
                            properties: {
                                horses: {
                                    type: 'array',
                                    items: {
                                        type: 'object',
                                        properties: {
                                            mark: {
                                                type: 'string',
                                                enum: ['◎', '〇', '☆', '▲', '△'],
                                            },
                                            horse_number: { type: ['number', 'null'] },
                                            confidence: { type: ['number', 'null'] },
                                            candidates: {
                                                type: 'array',
                                                items: { type: 'number' },
                                                nullable: true
                                            }
                                        },
                                        required: ['mark', 'horse_number', 'confidence', 'candidates'],
                                        additionalProperties: false,
                                    },
                                },
                            },
                            required: ['horses'],
                            additionalProperties: false,
                        },
                        strict: true,
                    },
                },
            });
            console.log(`下部OCR結果: ${bottomResponse.output_text}`);
            // 5) 結果の統合と整形
            try {
                const bottomParsed = JSON.parse(bottomResponse.output_text);
                // マーク→ランクマッピング
                const markToRank = {
                    '◎': 1, '〇': 2, '☆': 3, '▲': 4, '△': 5,
                };
                const UNKNOWN = 99;
                const requiredMarks = Object.keys(markToRank);
                const horses = bottomParsed.horses.map((h) => ({
                    rank: markToRank[h.mark],
                    horse_number: h.horse_number === UNKNOWN ? null : h.horse_number,
                    raw_number: h.horse_number,
                    confidence: h.confidence ?? null,
                    candidates: h.candidates ?? []
                }));
                // 全マークを確認して、不足しているマークを null で補完
                const foundMarks = new Set(bottomParsed.horses.map((h) => h.mark));
                for (const mark of requiredMarks) {
                    if (!foundMarks.has(mark)) {
                        horses.push({
                            rank: markToRank[mark],
                            horse_number: null,
                            raw_number: null,
                            confidence: null,
                            candidates: []
                        });
                    }
                }
                const topHorseNumbers = horses
                    .sort((a, b) => a.rank - b.rank)
                    .map((h) => h.horse_number);
                const noteAI = {
                    date,
                    trackCode,
                    raceNumber: String(topParsed.raceNumber || '').padStart(2, '0'),
                    ai_ranks: topHorseNumbers,
                };
                // 不確実な結果をログに出力
                const uncertainResults = horses.filter((h) => h.raw_number === UNKNOWN || (h.confidence ?? 1) < 0.8);
                if (uncertainResults.length > 0) {
                    console.log(`不確実な結果があります: ${JSON.stringify(uncertainResults, null, 2)}`);
                }
                console.log(`AI予想結果: ${JSON.stringify(noteAI, null, 2)}`);
                results.push(noteAI);
            }
            catch (parseErr) {
                console.error('APIレスポンスの解析中にエラーが発生しました:', parseErr);
            }
            // 6) リクエスト間遅延
            await (0, utils_1.randomDelay)(1000, 2000);
        }
        catch (error) {
            console.error(`画像 ${originalImagePath} の処理中にエラーが発生しました:`, error);
        }
    }
    return results;
}
exports.extractTextFromImages = extractTextFromImages;
/**
 * OCR結果をフォーマットする関数
 */
function formatOcrResults(ocrResults, date, raceCode) {
    // 実装予定
}
exports.formatOcrResults = formatOcrResults;

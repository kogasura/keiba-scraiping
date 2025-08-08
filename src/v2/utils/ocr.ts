/**
 * OCR画像解析ユーティリティ (v2移植版)
 */

import fs from 'fs';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import { logger } from './logger';
import { OcrResult } from '../types/ocr';

// 環境変数の読み込み
dotenv.config();

/**
 * DeepSeek R1 APIを使用して画像からテキストを抽出し、指数ランキングを取得する
 */
export async function extractIndexRanksFromImage(
    imagePath: string | URL,
    date: string,
    trackCode: string,
    raceNumber: string
): Promise<OcrResult> {
    try {
        let base64Image: string;
        
        // URLかファイルパスかを判断して処理を分岐
        if (imagePath instanceof URL) {
            // URLの場合は存在確認をスキップ
            base64Image = imagePath.toString();
        } else {
            // ファイルパスの場合
            if (!fs.existsSync(imagePath)) {
                logger.error(`画像ファイルが見つかりません: ${imagePath}`);
                return { horses: [], raceNumber: 0 };
            }
            
            // ファイルを読み込む
            base64Image = fs.readFileSync(imagePath, "base64");
        }

        const apiKey = process.env.DEEPSEEK_API_KEY;

        if (!apiKey) {
            throw new Error('DEEPSEEK_API_KEYが設定されていません');
        }

        const client = new OpenAI({
            apiKey: process.env['OPENAI_API_KEY'],
        });

        const response = await client.responses.create({
            model: "o3",
            input: [
                {
                    "role": "system",
                    "content": "画像から競馬の情報を抽出してください。表から馬番、馬名、得点、順位の情報を抽出し、すべての馬のデータをJSON形式で返してください。また、画像内に「指数期待度」と記載されている場合はその値も抽出してください。画像内に複数のテーブルが存在する場合は、メインですべての情報が映っている表だけを対象として読み取ってください。対象の「指数期待度」は対象の表の上部に記載されています。"
                },
                {
                    role: "user",
                    content: [
                        {
                            type: "input_text",
                            text: `この競馬新聞の画像から、得点順にすべての馬のデータを抽出してください。日付: ${date}, 競馬場: ${trackCode}, レース番号: ${raceNumber}。各馬の馬番、馬名、得点、順位情報をJSON形式で返してください。また、画像内に「指数期待度」の記載があればその値も抽出してください。画像内に複数のテーブルがある場合は、メインの完全な情報が含まれている表のみを対象としてください。指数期待度は対象の表の上部に記載されています。`
                        },
                        {
                            type: "input_image",
                            image_url: `data:image/jpeg;base64,${base64Image}`,
                            detail: "auto"
                        },
                    ],
                },
            ],
            text: {
                format: {
                    type: "json_schema",
                    name: "horse_data",
                    schema: {
                        type: "object",
                        properties: {
                            index_expectation: { type: "string" },
                            raceNumber: { type: "number" },
                            horses: {
                                type: "array",
                                items: {
                                    type: "object",
                                    properties: {
                                        number: { type: "number" },
                                        name: { type: "string" },
                                        rank: { type: "number" },
                                        score: { type: "number" }
                                    },
                                    required: ["number", "name", "rank", "score"],
                                    additionalProperties: false
                                }
                            }
                        },
                        required: ["horses", "index_expectation", "raceNumber"],
                        additionalProperties: false
                    }
                }
            }
        });

        logger.debug(`OCR解析結果: ${response.output_text}`);

        try {
            // APIレスポンスをJSONとしてパース
            const parsedResponse = JSON.parse(response.output_text);
            
            // 馬番を抽出して配列に格納
            if (parsedResponse.horses && parsedResponse.horses.length > 0) {
                return {
                    index_expectation: parsedResponse.index_expectation,
                    raceNumber: parseInt(parsedResponse.raceNumber),
                    horses: parsedResponse.horses
                };
            }
            
            // 十分な馬番が抽出できなかった場合
            logger.warn('十分な馬番を抽出できませんでした:', parsedResponse.horses?.map((h: { number: number }) => h.number) || []);
            return { horses: [], raceNumber: 0 };
        } catch (error) {
            logger.error('APIレスポンスの解析中にエラーが発生しました:', error);
            return { horses: [], raceNumber: 0 };
        }
    } catch (error) {
        logger.error('DeepSeek APIテスト中にエラーが発生しました:', error);
        return { horses: [], raceNumber: 0 };
    }
}

/**
 * 複数の画像から指数ランキングを一括取得
 */
export async function extractMultipleIndexRanks(
    imagePaths: string[],
    date: string,
    trackCode: string,
    raceNumbers: string[]
): Promise<OcrResult[]> {
    const results: OcrResult[] = [];
    
    for (let i = 0; i < imagePaths.length; i++) {
        const imagePath = imagePaths[i];
        const raceNumber = raceNumbers[i] || '1';
        
        try {
            logger.info(`OCR処理中: ${imagePath} (${raceNumber}R)`);
            const result = await extractIndexRanksFromImage(imagePath, date, trackCode, raceNumber);
            results.push(result);
            
            // API制限を考慮した遅延
            await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
            logger.error(`OCR処理失敗: ${imagePath}`, error);
            results.push({ horses: [], raceNumber: parseInt(raceNumber) });
        }
    }
    
    return results;
}
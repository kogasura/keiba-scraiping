import fs from 'fs';
import path from 'path';
import { AnalysisItem, NoteImageOCRResponse } from './types';

import OpenAI, { toFile } from 'openai';
import dotenv from 'dotenv';

// 環境変数の読み込み
dotenv.config();

/**
 * DeepSeek APIをテストするための関数
 * @returns APIレスポンス
 */
// export async function testDeepSeekAPI(): Promise<string> {
//     try {
//         const apiKey = process.env.DEEPSEEK_API_KEY;

//         if (!apiKey) {
//             throw new Error('DEEPSEEK_API_KEYが設定されていません');
//         }

//         const openai = new OpenAI({
//             baseURL: 'https://api.deepseek.com',
//             apiKey: apiKey
//         });

//         const completion = await openai.chat.completions.create({
//             messages: [{ role: "system", content: "You are a helpful assistant." }],
//             model: "deepseek-chat",
//         });

//         return completion.choices[0].message.content || 'レスポンスが空です';
//     } catch (error) {
//         console.error('DeepSeek APIテスト中にエラーが発生しました:', error);
//         return `エラー: ${error instanceof Error ? error.message : String(error)}`;
//     }
// }

/**
 * DeepSeek R1 APIを使用して画像からテキストを抽出し、指数ランキングを取得する
 * @param imagePath 画像のパス
 * @param date 日付（YYYYMMDD形式）
 * @param trackCode 競馬場コード
 * @param raceNumber レース番号
 * @returns 指数ランキング（上位8頭の馬番）
 */
export async function extractIndexRanksFromImage(
    imagePath: string | URL,
    date: string,
    trackCode: string,
    raceNumber: string
): Promise<NoteImageOCRResponse> {
    try {
        let base64Image: string;
        let imageStream;
        
        // URLかファイルパスかを判断して処理を分岐
        if (imagePath instanceof URL) {
            // URLの場合は存在確認をスキップ
            // URLからの画像取得は後続のOpenAI APIで直接処理される
            base64Image = imagePath.toString();
        } else {
            // ファイルパスの場合
            // 画像ファイルの存在確認
            if (!fs.existsSync(imagePath)) {
                console.error(`画像ファイルが見つかりません: ${imagePath}`);
                return { horses: [], raceNumber: 0 };
            }
            
            // ファイルを読み込む
            base64Image = fs.readFileSync(imagePath, "base64");
            imageStream = fs.createReadStream(imagePath);
        }

        const apiKey = process.env.DEEPSEEK_API_KEY;

        if (!apiKey) {
            throw new Error('DEEPSEEK_API_KEYが設定されていません');
        }

        const openai = new OpenAI({
            baseURL: 'https://api.deepseek.com',
            apiKey: apiKey
        });

        const client = new OpenAI({
            apiKey: process.env['OPENAI_API_KEY'], // This is the default and can be omitted
        });

        const response = await client.responses.create({
            model: "gpt-4.1",
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

        console.log(response.output_text);

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
            console.warn('十分な馬番を抽出できませんでした:', parsedResponse.horses?.map((h: { number: number }) => h.number) || []);
            return { horses: [], raceNumber: 0 };
        } catch (error) {
            console.error('APIレスポンスの解析中にエラーが発生しました:', error);
            return { horses: [], raceNumber: 0 };
        }
    } catch (error) {
        console.error('DeepSeek APIテスト中にエラーが発生しました:', error);
        return { horses: [], raceNumber: 0 };
    }
}

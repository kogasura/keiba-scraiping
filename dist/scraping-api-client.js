"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendRaceResults = exports.sendIndexImages = exports.sendAiIndex = exports.sendPredictions = exports.sendRaceInfo = void 0;
const axios_1 = __importDefault(require("axios"));
/**
 * .env から Laravel API ベース URL を取得 (例: http://localhost:8000)
 * 無ければ同階層の .env の既定値が dotenv 経由で読み込まれている想定。
 */
const API_BASE_URL = process.env.LARAVEL_API_BASE_URL || 'http://localhost:80';
/**
 * リクエスト共通ヘッダ
 *  - Content-Type は application/json
 *  - 認証が必要な場合は .env の API_KEY を送る想定
 */
function defaultHeaders() {
    return {
        'Content-Type': 'application/json',
        'X-API-KEY': process.env.LARAVEL_API_KEY || '',
    };
}
/** 共通の POST ヘルパー */
async function postJson(url, body) {
    const { data } = await axios_1.default.post(`${API_BASE_URL}${url}`, body, {
        headers: defaultHeaders(),
    });
    if (!data.success) {
        console.error(`API Error @ ${url}:`, data.error);
        throw new Error(data.error.message);
    }
    return data;
}
async function sendRaceInfo(payload) {
    return postJson('/api/v1/race-info', payload);
}
exports.sendRaceInfo = sendRaceInfo;
async function sendPredictions(payload) {
    return postJson('/api/v1/predictions', payload);
}
exports.sendPredictions = sendPredictions;
async function sendAiIndex(payload) {
    return postJson('/api/v1/ai-index', payload);
}
exports.sendAiIndex = sendAiIndex;
async function sendIndexImages(payload) {
    return postJson('/api/v1/index-images', payload);
}
exports.sendIndexImages = sendIndexImages;
async function sendRaceResults(payload) {
    return postJson('/api/v1/race-results', payload);
}
exports.sendRaceResults = sendRaceResults;

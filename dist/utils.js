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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.randomDelay = exports.logError = exports.saveToExcel = exports.saveToJson = exports.sleep = exports.formatDate = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const XLSX = __importStar(require("xlsx"));
// RaceInfoのプロパティと日本語ヘッダーのマッピング
const raceInfoHeaders = {
    race_number: 'レース番号',
    race_name: 'レース名',
    course: '競馬場',
    venue: '開催',
    start_time: '発走時刻',
    track_type: 'コース種別',
    distance: '距離',
    entries_count: '出走頭数',
    weather: '天候',
    track_condition: '馬場状態',
    prize_money: '賞金',
    netkeiba_race_id: 'netkeibaレースID',
    is_finished: 'レース終了'
};
// HorseEntryのプロパティと日本語ヘッダーのマッピング
const horseEntryHeaders = {
    horse_number: '馬番',
    frame_number: '枠番',
    horse_name: '馬名',
    jockey: '騎手',
    weight_carried: '斤量',
    popularity: '人気',
    odds: 'オッズ',
    trainer: '調教師',
    sex_age: '性齢',
    weight: '馬体重',
    result_position: '着順',
    result_time: 'タイム(秒)',
    margin: '着差',
    remarks: '備考',
    netkeiba_horse_id: '馬ID'
};
function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
}
exports.formatDate = formatDate;
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
exports.sleep = sleep;
function saveToJson(data, filename) {
    const dirPath = path_1.default.join('data');
    if (!fs_1.default.existsSync(dirPath)) {
        fs_1.default.mkdirSync(dirPath, { recursive: true });
    }
    const filePath = path_1.default.join(dirPath, filename);
    fs_1.default.writeFileSync(filePath, JSON.stringify(data, null, 2));
    console.log(`JSONファイルを保存しました: ${filePath}`);
}
exports.saveToJson = saveToJson;
function saveToExcel(data, filename) {
    const dirPath = path_1.default.join('data');
    if (!fs_1.default.existsSync(dirPath)) {
        fs_1.default.mkdirSync(dirPath, { recursive: true });
    }
    // Excelワークブックを作成
    const wb = XLSX.utils.book_new();
    if (Array.isArray(data)) {
        // ファイル名に "race_details" が含まれる場合、レースごとにシートを分割
        if (filename.includes('race_details')) {
            // レースごとにシートを作成
            data.forEach((race, index) => {
                // レース情報のコピーを作成
                const raceData = { ...race };
                const entries = raceData.entries || [];
                delete raceData.entries;
                // レース情報を日本語ヘッダーに変換
                const translatedRaceData = {};
                Object.entries(raceData).forEach(([key, value]) => {
                    const japaneseHeader = raceInfoHeaders[key] || key;
                    translatedRaceData[japaneseHeader] = value;
                });
                // レース基本情報をシートに追加
                const raceInfoSheet = XLSX.utils.json_to_sheet([translatedRaceData]);
                // 出走馬情報を同じシートに追加（データがある場合のみ）
                if (entries.length > 0) {
                    // 空白行を追加
                    XLSX.utils.sheet_add_json(raceInfoSheet, [{}], { origin: -1 });
                    // 「出走馬情報」というヘッダー行を追加
                    XLSX.utils.sheet_add_json(raceInfoSheet, [{ A: '出走馬情報' }], { origin: -1, skipHeader: true });
                    // 出走馬情報を日本語ヘッダーに変換
                    const translatedEntries = entries.map((entry) => {
                        const translatedEntry = {};
                        Object.entries(entry).forEach(([key, value]) => {
                            const japaneseHeader = horseEntryHeaders[key] || key;
                            translatedEntry[japaneseHeader] = value;
                        });
                        return translatedEntry;
                    });
                    // 出走馬情報を追加
                    XLSX.utils.sheet_add_json(raceInfoSheet, translatedEntries, { origin: -1 });
                }
                // シート名を設定（競馬場名、レース番号、レース名を含める）
                const sheetName = `${race.course}_R${race.race_number}_${race.race_name}`.substring(0, 28);
                // 重複を避けるためにインデックスを追加
                let finalSheetName = sheetName;
                let counter = 1;
                while (wb.SheetNames.includes(finalSheetName)) {
                    counter++;
                    finalSheetName = `${sheetName}_${counter}`;
                    if (finalSheetName.length > 31) {
                        finalSheetName = `${sheetName.substring(0, 27)}_${counter}`;
                    }
                }
                // ワークブックにシートを追加
                XLSX.utils.book_append_sheet(wb, raceInfoSheet, finalSheetName);
            });
        }
        else {
            // 通常のレース一覧の場合
            // レース情報をExcel用にフラット化し、日本語ヘッダーに変換
            const excelData = data.map(race => {
                const raceData = { ...race };
                delete raceData.entries;
                // 日本語ヘッダーに変換
                const translatedRaceData = {};
                Object.entries(raceData).forEach(([key, value]) => {
                    const japaneseHeader = raceInfoHeaders[key] || key;
                    translatedRaceData[japaneseHeader] = value;
                });
                return translatedRaceData;
            });
            // 馬情報を別シートに出力するためのデータを準備
            const entriesData = [];
            data.forEach(race => {
                if (race.entries && Array.isArray(race.entries)) {
                    race.entries.forEach((entry) => {
                        const entryData = {
                            'レースID': race.netkeiba_race_id,
                            'レース名': race.race_name,
                            'レース番号': race.race_number,
                            '競馬場': race.course
                        };
                        // 馬情報を日本語ヘッダーに変換
                        Object.entries(entry).forEach(([key, value]) => {
                            const japaneseHeader = horseEntryHeaders[key] || key;
                            entryData[japaneseHeader] = value;
                        });
                        entriesData.push(entryData);
                    });
                }
            });
            // レース情報シートを追加
            const wsRaces = XLSX.utils.json_to_sheet(excelData);
            XLSX.utils.book_append_sheet(wb, wsRaces, 'レース一覧');
            // 馬情報シートを追加（データがある場合のみ）
            if (entriesData.length > 0) {
                const wsEntries = XLSX.utils.json_to_sheet(entriesData);
                XLSX.utils.book_append_sheet(wb, wsEntries, '出走馬一覧');
            }
        }
    }
    else {
        // 単一レースの詳細情報の場合
        const raceData = { ...data };
        const entries = raceData.entries || [];
        delete raceData.entries;
        // レース情報を日本語ヘッダーに変換
        const translatedRaceData = {};
        Object.entries(raceData).forEach(([key, value]) => {
            const japaneseHeader = raceInfoHeaders[key] || key;
            translatedRaceData[japaneseHeader] = value;
        });
        // レース情報シートを追加
        const wsRace = XLSX.utils.json_to_sheet([translatedRaceData]);
        XLSX.utils.book_append_sheet(wb, wsRace, 'レース情報');
        // 馬情報シートを追加（データがある場合のみ）
        if (entries.length > 0) {
            // 出走馬情報を日本語ヘッダーに変換
            const translatedEntries = entries.map((entry) => {
                const translatedEntry = {};
                Object.entries(entry).forEach(([key, value]) => {
                    const japaneseHeader = horseEntryHeaders[key] || key;
                    translatedEntry[japaneseHeader] = value;
                });
                return translatedEntry;
            });
            const wsEntries = XLSX.utils.json_to_sheet(translatedEntries);
            XLSX.utils.book_append_sheet(wb, wsEntries, '出走馬情報');
        }
    }
    // ファイルに保存
    const filePath = path_1.default.join(dirPath, filename);
    XLSX.writeFile(wb, filePath);
    console.log(`Excelファイルを保存しました: ${filePath}`);
}
exports.saveToExcel = saveToExcel;
function logError(error, context) {
    const timestamp = new Date().toISOString();
    const message = `[${timestamp}] ${context ? `[${context}] ` : ''}${error.message}\n${error.stack}\n`;
    const logDir = path_1.default.join(process.cwd(), 'logs');
    if (!fs_1.default.existsSync(logDir)) {
        fs_1.default.mkdirSync(logDir, { recursive: true });
    }
    const logPath = path_1.default.join(logDir, 'error.log');
    fs_1.default.appendFileSync(logPath, message, 'utf8');
    console.error(`エラーが発生しました: ${error.message}`);
}
exports.logError = logError;
function randomDelay(min, max) {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    return new Promise(resolve => setTimeout(resolve, delay));
}
exports.randomDelay = randomDelay;

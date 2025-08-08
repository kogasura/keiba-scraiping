"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTrackCodesFromSchedule = void 0;
const fs_1 = require("fs");
const path_1 = require("path");
/**
 * スケジュールファイルから日付に対応する競馬場コードを取得
 * @param dateYYYYMMDD YYYYMMDD形式の日付
 * @returns 競馬場コードの配列
 */
function getTrackCodesFromSchedule(dateYYYYMMDD) {
    const scheduleFilePath = (0, path_1.join)(process.cwd(), '2025_kaihai_schedule_full.json');
    if (!(0, fs_1.existsSync)(scheduleFilePath)) {
        console.warn(`スケジュールファイルが見つかりません: ${scheduleFilePath}`);
        return [];
    }
    try {
        const scheduleData = JSON.parse((0, fs_1.readFileSync)(scheduleFilePath, 'utf-8'));
        // YYYYMMDD -> YYYY, MM-DD に変換
        const year = dateYYYYMMDD.slice(0, 4);
        const month = dateYYYYMMDD.slice(4, 6);
        const day = dateYYYYMMDD.slice(6, 8);
        const eventDate = `${month}-${day}`;
        // 該当日付の競馬場コードを取得
        const trackCodes = scheduleData
            .filter(entry => entry.event_year === year && entry.event_date === eventDate)
            .map(entry => entry.racecourse_code)
            .filter((code, index, self) => self.indexOf(code) === index) // 重複除去
            .sort(); // ソート
        return trackCodes;
    }
    catch (error) {
        console.error('スケジュールファイルの読み込みエラー:', error);
        return [];
    }
}
exports.getTrackCodesFromSchedule = getTrackCodesFromSchedule;

/**
 * スケジュール管理ユーティリティ
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

interface ScheduleEntry {
  record_type_id: string;
  data_division: string;
  data_created_date: string;
  event_year: string;
  event_date: string;  // MM-DD format
  racecourse_code: string;
  event_round: string;
  event_day: string;
  weekday_code: string;
}

/**
 * スケジュールファイルから日付に対応する競馬場コードを取得
 */
export function getTrackCodesFromSchedule(dateYYYYMMDD: string): string[] {
  const scheduleFilePath = join(process.cwd(), 'src', 'shared', '2025_kaihai_schedule_full.json');
  
  if (!existsSync(scheduleFilePath)) {
    // フォールバック: ルートディレクトリも確認
    const fallbackPath = join(process.cwd(), '2025_kaihai_schedule_full.json');
    if (!existsSync(fallbackPath)) {
      console.warn(`スケジュールファイルが見つかりません: ${scheduleFilePath}`);
      return [];
    }
    return getTrackCodesFromFile(fallbackPath, dateYYYYMMDD);
  }
  
  return getTrackCodesFromFile(scheduleFilePath, dateYYYYMMDD);
}

function getTrackCodesFromFile(filePath: string, dateYYYYMMDD: string): string[] {
  try {
    const scheduleData: ScheduleEntry[] = JSON.parse(readFileSync(filePath, 'utf-8'));
    
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
  } catch (error) {
    console.error('スケジュールファイルの読み込みエラー:', error);
    return [];
  }
}

/**
 * 日付文字列の形式を変換
 */
export function formatDateYYYYMMDD(dateYYYYMMDD: string): string {
  if (dateYYYYMMDD.length !== 8) return dateYYYYMMDD;
  return `${dateYYYYMMDD.slice(0, 4)}-${dateYYYYMMDD.slice(4, 6)}-${dateYYYYMMDD.slice(6, 8)}`;
}

/**
 * 日付文字列の形式を変換 (API用)
 */
export function formatDateForApi(dateYYYYMMDD: string): string {
  return formatDateYYYYMMDD(dateYYYYMMDD);
}

/**
 * 複数日付の文字列を配列に変換
 */
export function parseDates(dateString: string): string[] {
  return dateString.split(',').map(d => d.trim());
}

/**
 * 日付の妥当性チェック
 */
export function validateDate(dateYYYYMMDD: string): boolean {
  if (dateYYYYMMDD.length !== 8) return false;
  
  const year = parseInt(dateYYYYMMDD.slice(0, 4));
  const month = parseInt(dateYYYYMMDD.slice(4, 6));
  const day = parseInt(dateYYYYMMDD.slice(6, 8));
  
  if (year < 2000 || year > 2030) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  
  return true;
}
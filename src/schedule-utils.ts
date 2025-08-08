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
 * @param dateYYYYMMDD YYYYMMDD形式の日付
 * @returns 競馬場コードの配列
 */
export function getTrackCodesFromSchedule(dateYYYYMMDD: string): string[] {
  const scheduleFilePath = join(process.cwd(), '2025_kaihai_schedule_full.json');
  
  if (!existsSync(scheduleFilePath)) {
    console.warn(`スケジュールファイルが見つかりません: ${scheduleFilePath}`);
    return [];
  }

  try {
    const scheduleData: ScheduleEntry[] = JSON.parse(readFileSync(scheduleFilePath, 'utf-8'));
    
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
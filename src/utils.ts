import fs from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';
import { HorseEntry } from './types';

// RaceInfoのプロパティと日本語ヘッダーのマッピング
const raceInfoHeaders: Record<string, string> = {
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
const horseEntryHeaders: Record<string, string> = {
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

export function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function saveToJson(data: any, filename: string): void {
  const dirPath = path.join('data');
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
  
  const filePath = path.join(dirPath, filename);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  console.log(`JSONファイルを保存しました: ${filePath}`);
}

export function saveToExcel(data: any, filename: string): void {
  const dirPath = path.join('data');
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
  
  // Excelワークブックを作成
  const wb = XLSX.utils.book_new();
  
  if (Array.isArray(data)) {
    // ファイル名に "race_details" が含まれる場合、レースごとにシートを分割
    if (filename.includes('race_details')) {
      // レースごとにシートを作成
      data.forEach((race, index) => {
        // レース情報のコピーを作成
        const raceData: any = { ...race };
        const entries = raceData.entries || [];
        delete raceData.entries;
        
        // レース情報を日本語ヘッダーに変換
        const translatedRaceData: Record<string, any> = {};
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
          const translatedEntries = entries.map((entry: any) => {
            const translatedEntry: Record<string, any> = {};
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
    } else {
      // 通常のレース一覧の場合
      // レース情報をExcel用にフラット化し、日本語ヘッダーに変換
      const excelData = data.map(race => {
        const raceData: any = { ...race };
        delete raceData.entries;
        
        // 日本語ヘッダーに変換
        const translatedRaceData: Record<string, any> = {};
        Object.entries(raceData).forEach(([key, value]) => {
          const japaneseHeader = raceInfoHeaders[key] || key;
          translatedRaceData[japaneseHeader] = value;
        });
        
        return translatedRaceData;
      });
      
      // 馬情報を別シートに出力するためのデータを準備
      const entriesData: any[] = [];
      data.forEach(race => {
        if (race.entries && Array.isArray(race.entries)) {
          race.entries.forEach((entry: HorseEntry) => {
            const entryData: Record<string, any> = {
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
  } else {
    // 単一レースの詳細情報の場合
    const raceData: any = { ...data };
    const entries = raceData.entries || [];
    delete raceData.entries;
    
    // レース情報を日本語ヘッダーに変換
    const translatedRaceData: Record<string, any> = {};
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
      const translatedEntries = entries.map((entry: any) => {
        const translatedEntry: Record<string, any> = {};
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
  const filePath = path.join(dirPath, filename);
  XLSX.writeFile(wb, filePath);
  console.log(`Excelファイルを保存しました: ${filePath}`);
}

export function logError(error: Error, context?: string): void {
  const timestamp = new Date().toISOString();
  const message = `[${timestamp}] ${context ? `[${context}] ` : ''}${error.message}\n${error.stack}\n`;
  
  const logDir = path.join(process.cwd(), 'logs');
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
  
  const logPath = path.join(logDir, 'error.log');
  fs.appendFileSync(logPath, message, 'utf8');
  console.error(`エラーが発生しました: ${error.message}`);
}

export function randomDelay(min: number, max: number): Promise<void> {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise(resolve => setTimeout(resolve, delay));
} 
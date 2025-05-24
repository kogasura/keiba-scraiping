import fs from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';
import { UmaxRacePrediction } from './types';
import { getTrackName } from './consts';

/**
 * UMAX予想データをExcelファイルに保存する関数
 * @param predictions UMAX予想データの配列
 * @param filename 保存するファイル名
 */
export function saveUmaxPredictionsToExcel(predictions: UmaxRacePrediction[], filename: string): void {
  const dirPath = path.join('umax-data');
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }

  // ヘッダー行の定義
  const headers = [
    "日付",
    "会場",
    "レースNo",
    "UMAX予想1",
    "UMAX予想2",
    "UMAX予想3",
    "UMAX予想4",
    "UMAX予想5",
    "UMAXタイム偏差1",
    "UMAXタイム偏差2",
    "UMAXタイム偏差3",
    "UMAX上がり偏差1",
    "UMAX上がり偏差2",
    "UMAX上がり偏差3",
    "UMAX-SP値1",
    "UMAX-SP値2",
    "UMAX-SP値3",
    "UMAX-SP値4",
    "UMAX-SP値5",
    "UMAX-AG値1",
    "UMAX-AG値2",
    "UMAX-AG値3",
    "UMAX-AG値4",
    "UMAX-AG値5",
    "UMAX-SA値1",
    "UMAX-SA値2",
    "UMAX-SA値3",
    "UMAX-SA値4",
    "UMAX-SA値5",
    "UMAX-KI値1",
    "UMAX-KI値2",
    "UMAX-KI値3"
  ];

  // データ行の作成
  const rows = predictions.map(prediction => {
    const row: Record<string, any> = {
      "日付": `${prediction.date.substring(0, 4)}/${prediction.date.substring(4, 6)}/${prediction.date.substring(6, 8)}`,
      "会場": getTrackName(prediction.trackCode),
      "レースNo": prediction.raceNumber,
    };

    // UMAX予想
    for (let i = 0; i < prediction.focusedHorseNumbers.length; i++) {
      if (i < 5) {
        row[`UMAX予想${i+1}`] = prediction.focusedHorseNumbers[i];
      }
    }

    // タイム偏差
    for (let i = 0; i < prediction.timeDeviationTop3.length; i++) {
      if (i < 3) {
        row[`UMAXタイム偏差${i+1}`] = prediction.timeDeviationTop3[i];
      }
    }

    // 上がり偏差
    for (let i = 0; i < prediction.lastSpurtDeviationTop3.length; i++) {
      if (i < 3) {
        row[`UMAX上がり偏差${i+1}`] = prediction.lastSpurtDeviationTop3[i];
      }
    }

    // SP値
    for (let i = 0; i < prediction.spValueTop5.length; i++) {
      if (i < 5) {
        row[`UMAX-SP値${i+1}`] = prediction.spValueTop5[i];
      }
    }

    // AG値
    for (let i = 0; i < prediction.agValueTop5.length; i++) {
      if (i < 5) {
        row[`UMAX-AG値${i+1}`] = prediction.agValueTop5[i];
      }
    }

    // SA値
    for (let i = 0; i < prediction.saValueTop5.length; i++) {
      if (i < 5) {
        row[`UMAX-SA値${i+1}`] = prediction.saValueTop5[i];
      }
    }

    // KI値
    for (let i = 0; i < prediction.kiValueTop3.length; i++) {
      if (i < 3) {
        row[`UMAX-KI値${i+1}`] = prediction.kiValueTop3[i];
      }
    }

    return row;
  });

  // ワークブックとワークシートの作成
  const worksheet = XLSX.utils.json_to_sheet(rows, { header: headers });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'UMAX予想');

  // ファイルの保存
  const filePath = path.join(dirPath, filename);
  XLSX.writeFile(workbook, filePath);
  console.log(`UMAXデータを ${filePath} に保存しました`);
}
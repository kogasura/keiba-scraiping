/**
 * ファイル操作ユーティリティ (v2移植版)
 */

import fs from 'fs';
import path from 'path';
import { logger } from './logger';

/**
 * ディレクトリが存在しない場合は作成
 */
export function ensureDirectoryExists(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    logger.debug(`ディレクトリを作成しました: ${dirPath}`);
  }
}

/**
 * 現在の日付をYYYYMMDD形式で取得
 */
export function getCurrentDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

/**
 * 日付をフォーマット
 */
export function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

/**
 * JSONファイルに保存
 */
export function saveToJson(data: any, filename: string, subDir?: string): void {
  try {
    const dirPath = subDir ? path.join('data', subDir) : path.join('data');
    ensureDirectoryExists(dirPath);
    
    const filePath = path.join(dirPath, filename);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    logger.info(`JSONファイルを保存しました: ${filePath}`);
  } catch (error) {
    logger.error('JSONファイルの保存に失敗しました:', error);
    throw error;
  }
}

/**
 * JSONファイルを読み込み
 */
export function loadFromJson<T>(filename: string, subDir?: string): T | null {
  try {
    const dirPath = subDir ? path.join('data', subDir) : path.join('data');
    const filePath = path.join(dirPath, filename);
    
    if (!fs.existsSync(filePath)) {
      logger.warn(`JSONファイルが見つかりません: ${filePath}`);
      return null;
    }
    
    const content = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content);
    logger.debug(`JSONファイルを読み込みました: ${filePath}`);
    return data as T;
  } catch (error) {
    logger.error('JSONファイルの読み込みに失敗しました:', error);
    return null;
  }
}

/**
 * エラーログを記録
 */
export function logError(error: Error, context?: string): void {
  const timestamp = new Date().toISOString();
  const message = `[${timestamp}] ${context ? `[${context}] ` : ''}${error.message}\n${error.stack}\n`;
  
  const logDir = path.join('logs');
  ensureDirectoryExists(logDir);
  
  const logPath = path.join(logDir, 'error.log');
  fs.appendFileSync(logPath, message, 'utf8');
  
  logger.error(`エラーが発生しました: ${error.message}`, context);
}

/**
 * ファイルが存在するかチェック
 */
export function fileExists(filePath: string): boolean {
  return fs.existsSync(filePath);
}

/**
 * ファイルを削除
 */
export function deleteFile(filePath: string): void {
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    logger.debug(`ファイルを削除しました: ${filePath}`);
  }
}

/**
 * ディレクトリ内のファイル一覧を取得
 */
export function getFileList(dirPath: string, extension?: string): string[] {
  if (!fs.existsSync(dirPath)) {
    return [];
  }
  
  const files = fs.readdirSync(dirPath);
  
  if (extension) {
    return files.filter(file => file.toLowerCase().endsWith(extension.toLowerCase()));
  }
  
  return files;
}

/**
 * ファイルサイズを取得
 */
export function getFileSize(filePath: string): number {
  if (!fs.existsSync(filePath)) {
    return 0;
  }
  
  const stats = fs.statSync(filePath);
  return stats.size;
}

/**
 * ファイルの更新日時を取得
 */
export function getFileModifiedTime(filePath: string): Date | null {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  
  const stats = fs.statSync(filePath);
  return stats.mtime;
}
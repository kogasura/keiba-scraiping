/**
 * 中間ファイル管理ユーティリティ
 */

import { promises as fs } from 'fs';
import path from 'path';
import { logger } from '../utils/logger';
import { 
  IntermediateFile, 
  IntermediateFileMetadata, 
  IntermediateFileInfo, 
  ApiType, 
  IntermediateFileStatus,
  ValidationResult 
} from '../types/intermediate';

const INTERMEDIATE_DIR = 'intermediate';
const CURRENT_VERSION = '1.0.0';

export class IntermediateFileManager {
  
  /**
   * 中間ファイルパスを生成
   */
  static generateFilePath(api: ApiType, date: string, trackCode: string): string {
    const timestamp = Date.now();
    const fileName = `${trackCode}_${api}_${date.replace(/-/g, '')}_${timestamp}.json`;
    return path.join(INTERMEDIATE_DIR, api, date, fileName);
  }

  /**
   * 中間ファイルを保存
   */
  static async saveIntermediateFile<T>(
    api: ApiType,
    date: string,
    trackCode: string,
    data: T[]
  ): Promise<string> {
    const filePath = this.generateFilePath(api, date, trackCode);
    
    const metadata: IntermediateFileMetadata = {
      api,
      date,
      trackCode,
      createdAt: new Date().toISOString(),
      dataCount: data.length,
      status: 'pending',
      version: CURRENT_VERSION
    };

    const intermediateFile: IntermediateFile<T> = {
      metadata,
      data
    };

    // ディレクトリ作成
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    
    // ファイル保存
    await fs.writeFile(filePath, JSON.stringify(intermediateFile, null, 2), 'utf-8');
    
    logger.debug(`中間ファイル保存: ${filePath}`);
    logger.debug(`データ件数: ${data.length}`);
    
    return filePath;
  }

  /**
   * 中間ファイルを読み込み
   */
  static async loadIntermediateFile<T>(filePath: string): Promise<IntermediateFile<T>> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const intermediateFile = JSON.parse(content) as IntermediateFile<T>;
      
      // バージョンチェック
      if (intermediateFile.metadata.version !== CURRENT_VERSION) {
        logger.warn(`中間ファイルのバージョンが古い可能性があります: ${intermediateFile.metadata.version}`);
      }
      
      return intermediateFile;
    } catch (error) {
      logger.error(`中間ファイル読み込み失敗: ${filePath}`, error);
      throw error;
    }
  }

  /**
   * 中間ファイルのステータスを更新
   */
  static async updateStatus(
    filePath: string,
    status: IntermediateFileStatus,
    errors?: string[]
  ): Promise<void> {
    try {
      const intermediateFile = await this.loadIntermediateFile(filePath);
      
      intermediateFile.metadata.status = status;
      if (errors) {
        intermediateFile.metadata.errors = errors;
      }
      
      await fs.writeFile(filePath, JSON.stringify(intermediateFile, null, 2), 'utf-8');
      
      logger.debug(`中間ファイルステータス更新: ${status} - ${filePath}`);
    } catch (error) {
      logger.error(`ステータス更新失敗: ${filePath}`, error);
      throw error;
    }
  }

  /**
   * 指定条件の中間ファイル一覧を取得
   */
  static async findIntermediateFiles(
    api: ApiType,
    date: string,
    trackCode?: string,
    status?: IntermediateFileStatus
  ): Promise<IntermediateFileInfo[]> {
    const searchDir = path.join(INTERMEDIATE_DIR, api, date);
    
    try {
      const files = await fs.readdir(searchDir);
      const result: IntermediateFileInfo[] = [];
      
      for (const file of files) {
        const filePath = path.join(searchDir, file);
        
        try {
          const intermediateFile = await this.loadIntermediateFile(filePath);
          
          // フィルタリング
          if (trackCode && intermediateFile.metadata.trackCode !== trackCode) {
            continue;
          }
          
          if (status && intermediateFile.metadata.status !== status) {
            continue;
          }
          
          result.push({
            filePath,
            metadata: intermediateFile.metadata
          });
        } catch (error) {
          logger.warn(`中間ファイル読み込みスキップ: ${filePath}`, error);
        }
      }
      
      return result.sort((a, b) => a.metadata.createdAt.localeCompare(b.metadata.createdAt));
    } catch (error) {
      logger.debug(`中間ファイル検索: ディレクトリが存在しません - ${searchDir}`);
      return [];
    }
  }

  /**
   * 中間ファイルの基本検証
   */
  static async validateIntermediateFile<T>(filePath: string): Promise<ValidationResult> {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: []
    };

    try {
      const intermediateFile = await this.loadIntermediateFile<T>(filePath);
      const { metadata, data } = intermediateFile;

      // 必須フィールドチェック
      if (!metadata.api || !metadata.date || !metadata.trackCode) {
        result.errors.push('必須メタデータが不足しています');
        result.isValid = false;
      }

      // 日付フォーマットチェック
      if (!/^\d{4}-\d{2}-\d{2}$/.test(metadata.date)) {
        result.errors.push('日付フォーマットが正しくありません (YYYY-MM-DD)');
        result.isValid = false;
      }

      // 競馬場コードチェック
      if (!/^(0[1-9]|10)$/.test(metadata.trackCode)) {
        result.errors.push('競馬場コードが正しくありません (01-10)');
        result.isValid = false;
      }

      // データ件数チェック
      if (metadata.dataCount !== data.length) {
        result.errors.push(`データ件数が一致しません: metadata=${metadata.dataCount}, actual=${data.length}`);
        result.isValid = false;
      }

      // データ空チェック
      if (data.length === 0) {
        result.warnings.push('データが空です');
      }

      // バージョンチェック
      if (metadata.version !== CURRENT_VERSION) {
        result.warnings.push(`バージョンが古い可能性があります: ${metadata.version}`);
      }

    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result.errors.push(`ファイル読み込みエラー: ${message}`);
      result.isValid = false;
    }

    return result;
  }

  /**
   * 古い中間ファイルをクリーンアップ
   */
  static async cleanupOldFiles(daysToKeep: number = 7): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    try {
      const apis = await fs.readdir(INTERMEDIATE_DIR);
      
      for (const api of apis) {
        const apiDir = path.join(INTERMEDIATE_DIR, api);
        const dates = await fs.readdir(apiDir);
        
        for (const date of dates) {
          const dateDir = path.join(apiDir, date);
          const files = await fs.readdir(dateDir);
          
          for (const file of files) {
            const filePath = path.join(dateDir, file);
            const stats = await fs.stat(filePath);
            
            if (stats.mtime < cutoffDate) {
              await fs.unlink(filePath);
              logger.info(`古い中間ファイルを削除: ${filePath}`);
            }
          }
        }
      }
    } catch (error) {
      logger.error('中間ファイルクリーンアップエラー', error);
    }
  }
}
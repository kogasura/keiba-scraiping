/**
 * レース情報サービス（中間ファイル対応版）
 */

import { ExecutionOptions } from '../types/common';
import { RaceInfoScraper } from '../scrapers/race-info/scraper';
import { RaceInfoEndpoint } from '../api/endpoints/race-info';
import { createApiClient } from '../api/client';
import { mapRaceInfoToApi } from '../mappers/race-info';
import { logger } from '../utils/logger';
import { IntermediateFileManager } from '../utils/intermediate-file';
import { validateRaceInfoData } from '../validators/race-info';
import { IntermediateFile } from '../types/intermediate';
import { RaceInfoRequest } from '../types/api';

/**
 * レース情報API実行（中間ファイル対応版）
 */
export async function executeRaceInfoStaged(options: ExecutionOptions): Promise<boolean> {
  const stage = options.stage || 'all';
  const dateStr = Array.isArray(options.date) ? options.date[0] : options.date;
  
  logger.info(`レース情報API実行開始: ${dateStr} (stage: ${stage})`);
  logger.setQuietMode(true);

  // 段階別実行
  if (stage === 'scrape' || stage === 'all') {
    const success = await scrapeAndSaveRaceInfo(options);
    if (!success && stage !== 'all') {
      return false;
    }
  }

  if (stage === 'validate' || stage === 'all') {
    const success = await validateRaceInfoFiles(options);
    if (!success && stage !== 'all') {
      return false;
    }
  }

  if (stage === 'send' || stage === 'all') {
    const success = await sendRaceInfoFromFiles(options);
    if (!success && stage !== 'all') {
      return false;
    }
  }

  logger.setQuietMode(false);
  logger.success(`レース情報API実行完了: ${dateStr} (stage: ${stage})`);
  return true;
}

/**
 * スクレイピングと中間ファイル保存
 */
async function scrapeAndSaveRaceInfo(options: ExecutionOptions): Promise<boolean> {
  const dateStr = Array.isArray(options.date) ? options.date[0] : options.date;
  const isoDateStr = formatDateToISO(dateStr);
  
  const scraper = new RaceInfoScraper();
  
  try {
    // 競馬場コードが未指定の場合はエラー
    if (!options.trackCodes || options.trackCodes.length === 0) {
      logger.error('競馬場コードが指定されていません');
      return false;
    }

    let successCount = 0;
    let failedCount = 0;
    let totalDataCount = 0;

    // 競馬場毎にスクレイピング実行
    for (const trackCode of options.trackCodes) {
      const result = await scraper.scrapeRaceInfo(dateStr, trackCode);
      
      if (result.success && result.data) {
        // API形式に変換
        const apiRequests = mapRaceInfoToApi(result.data);
        
        if (apiRequests.length > 0) {
          // 中間ファイルに保存
          await IntermediateFileManager.saveIntermediateFile(
            'race-info',
            isoDateStr,
            trackCode,
            apiRequests
          );
          
          successCount++;
          totalDataCount += apiRequests.length;
        } else {
          logger.warn(`API送信対象データが見つかりませんでした: ${trackCode}`);
          failedCount++;
        }
      } else {
        logger.warn(`レース情報スクレイピング失敗: ${trackCode} - ${result.error}`);
        failedCount++;
      }
    }

    logger.result(`スクレイピング結果: 成功=${successCount}, 失敗=${failedCount}, データ件数=${totalDataCount}`);
    return true;

  } catch (error) {
    logger.error('スクレイピング処理中にエラーが発生しました', error);
    return false;
  }
}

/**
 * 中間ファイルの検証
 */
async function validateRaceInfoFiles(options: ExecutionOptions): Promise<boolean> {
  const dateStr = Array.isArray(options.date) ? options.date[0] : options.date;
  const isoDateStr = formatDateToISO(dateStr);
  
  try {
    // 中間ファイル検索
    const files = await IntermediateFileManager.findIntermediateFiles(
      'race-info',
      isoDateStr,
      undefined,
      'pending'
    );

    if (files.length === 0) {
      logger.warn('検証対象の中間ファイルが見つかりません');
      return false;
    }

    let validCount = 0;
    let invalidCount = 0;
    let warningCount = 0;

    for (const fileInfo of files) {
      // 基本検証
      const basicValidation = await IntermediateFileManager.validateIntermediateFile(
        fileInfo.filePath
      );
      
      if (!basicValidation.isValid) {
        logger.error(`基本検証失敗: ${fileInfo.metadata.trackCode}`, basicValidation.errors);
        await IntermediateFileManager.updateStatus(
          fileInfo.filePath,
          'failed',
          basicValidation.errors
        );
        invalidCount++;
        continue;
      }

      // レース情報特有の検証
      const intermediateFile = await IntermediateFileManager.loadIntermediateFile<RaceInfoRequest>(
        fileInfo.filePath
      );
      
      const raceInfoValidation = await validateRaceInfoData(intermediateFile.data);
      
      if (!raceInfoValidation.isValid) {
        logger.error(`レース情報検証失敗: ${fileInfo.metadata.trackCode}`, raceInfoValidation.errors);
        await IntermediateFileManager.updateStatus(
          fileInfo.filePath,
          'failed',
          raceInfoValidation.errors
        );
        invalidCount++;
        continue;
      }

      // 検証成功
      await IntermediateFileManager.updateStatus(fileInfo.filePath, 'validated');
      validCount++;

      // 警告がある場合はカウント
      if (raceInfoValidation.warnings.length > 0) {
        logger.warn(`検証警告: ${fileInfo.metadata.trackCode}`, raceInfoValidation.warnings);
        warningCount++;
      }
    }

    logger.result(`検証結果: 有効=${validCount}, 無効=${invalidCount}, 警告=${warningCount}`);
    return invalidCount === 0;

  } catch (error) {
    logger.error('中間ファイル検証中にエラーが発生しました', error);
    return false;
  }
}

/**
 * 中間ファイルからのAPI送信
 */
async function sendRaceInfoFromFiles(options: ExecutionOptions): Promise<boolean> {
  const dateStr = Array.isArray(options.date) ? options.date[0] : options.date;
  const isoDateStr = formatDateToISO(dateStr);
  
  // 直接ファイル指定の場合
  if (options.intermediateFile) {
    return await sendSingleRaceInfoFile(options.intermediateFile, options.dryRun);
  }

  try {
    // 検証済みの中間ファイルを検索
    const files = await IntermediateFileManager.findIntermediateFiles(
      'race-info',
      isoDateStr,
      undefined,
      'validated'
    );

    if (files.length === 0) {
      logger.warn('送信対象の中間ファイルが見つかりません');
      return false;
    }

    let successCount = 0;
    let failedCount = 0;
    let totalSentCount = 0;

    for (const fileInfo of files) {
      const result = await sendSingleRaceInfoFile(fileInfo.filePath, options.dryRun);
      
      if (result) {
        successCount++;
        // 中間ファイルからデータ件数を取得
        const intermediateFile = await IntermediateFileManager.loadIntermediateFile(fileInfo.filePath);
        totalSentCount += intermediateFile.data.length;
      } else {
        failedCount++;
      }
    }

    logger.result(`API送信結果: 成功=${successCount}, 失敗=${failedCount}, 送信件数=${totalSentCount}`);
    return failedCount === 0;

  } catch (error) {
    logger.error('API送信中にエラーが発生しました', error);
    return false;
  }
}

/**
 * 単一中間ファイルからのAPI送信
 */
async function sendSingleRaceInfoFile(filePath: string, dryRun?: boolean): Promise<boolean> {
  try {
    const intermediateFile = await IntermediateFileManager.loadIntermediateFile<RaceInfoRequest>(filePath);
    const trackCode = intermediateFile.metadata.trackCode;
    
    if (dryRun) {
      logger.info(`ドライランモード: データ送信をスキップ - ${trackCode}`);
      logger.debug('送信予定データ:', JSON.stringify(intermediateFile.data, null, 2));
      return true;
    }

    const apiClient = createApiClient();
    const endpoint = new RaceInfoEndpoint(apiClient);

    let successCount = 0;
    let failedCount = 0;

    for (const apiRequest of intermediateFile.data) {
      try {
        const response = await endpoint.send(apiRequest);
        
        if (response.success) {
          successCount++;
        } else {
          const errorResponse = response as any;
          logger.error(`API送信失敗: ${apiRequest.trackCode} - ${errorResponse.error?.message || 'Unknown error'}`);
          failedCount++;
        }
      } catch (error) {
        logger.error(`API送信エラー: ${apiRequest.trackCode}`, error);
        failedCount++;
      }
    }

    // ステータス更新
    if (failedCount === 0) {
      await IntermediateFileManager.updateStatus(filePath, 'sent');
    } else {
      await IntermediateFileManager.updateStatus(filePath, 'failed', ['API送信に失敗しました']);
    }

    return failedCount === 0;

  } catch (error) {
    logger.error(`中間ファイル送信エラー: ${filePath}`, error);
    return false;
  }
}

/**
 * 日付フォーマット変換 (YYYYMMDD -> YYYY-MM-DD)
 */
function formatDateToISO(dateStr: string): string {
  if (dateStr.includes('-')) {
    return dateStr; // 既にISO形式
  }
  
  // YYYYMMDD -> YYYY-MM-DD
  return `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`;
}
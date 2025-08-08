/**
 * 予想情報サービス（中間ファイル対応版）
 */

import { ExecutionOptions } from '../types/common';
import { PredictionScraper } from '../scrapers/predictions/scraper';
import { PredictionsEndpoint } from '../api/endpoints/predictions';
import { createApiClient } from '../api/client';
import { mapPredictionsToApi } from '../mappers/predictions';
import { logger } from '../utils/logger';
import { IntermediateFileManager } from '../utils/intermediate-file';
import { validatePredictionsData } from '../validators/predictions';
import { IntermediateFile } from '../types/intermediate';
import { PredictionsRequest } from '../types/api';

/**
 * 予想情報API実行（中間ファイル対応版）
 */
export async function executePredictionsStaged(options: ExecutionOptions): Promise<boolean> {
  const stage = options.stage || 'all';
  const dateStr = Array.isArray(options.date) ? options.date[0] : options.date;
  
  logger.info(`予想情報API実行開始: ${dateStr} (stage: ${stage})`);
  logger.setQuietMode(true);

  // 段階別実行
  if (stage === 'scrape' || stage === 'all') {
    const success = await scrapeAndSavePredictions(options);
    if (!success && stage !== 'all') {
      return false;
    }
  }

  if (stage === 'validate' || stage === 'all') {
    const success = await validatePredictionsFiles(options);
    if (!success && stage !== 'all') {
      return false;
    }
  }

  if (stage === 'send' || stage === 'all') {
    const success = await sendPredictionsFromFiles(options);
    if (!success && stage !== 'all') {
      return false;
    }
  }

  logger.setQuietMode(false);
  logger.success(`予想情報API実行完了: ${dateStr} (stage: ${stage})`);
  return true;
}

/**
 * スクレイピングと中間ファイル保存
 */
async function scrapeAndSavePredictions(options: ExecutionOptions): Promise<boolean> {
  const dateStr = Array.isArray(options.date) ? options.date[0] : options.date;
  const isoDateStr = formatDateToISO(dateStr);
  
  logger.info(`予想情報スクレイピング開始: ${dateStr}`);

  const scraper = new PredictionScraper();
  
  try {
    // 競馬場コードが未指定の場合はエラー
    if (!options.trackCodes || options.trackCodes.length === 0) {
      logger.error('競馬場コードが指定されていません');
      return false;
    }

    // 競馬場毎にスクレイピング実行
    for (const trackCode of options.trackCodes) {
      logger.info(`予想情報スクレイピング: ${trackCode}`);
      const result = await scraper.scrapePredictions(dateStr, trackCode);
      
      if (result.success && result.data && result.data.length > 0) {
        // API形式に変換
        const apiRequests = mapPredictionsToApi(result.data);
        
        if (apiRequests.length > 0) {
          // 中間ファイルに保存
          const filePath = await IntermediateFileManager.saveIntermediateFile(
            'predictions',
            isoDateStr,
            trackCode,
            apiRequests
          );
          
          logger.success(`中間ファイル保存成功: ${trackCode} (${apiRequests.length}件)`);
        } else {
          logger.warn(`API送信対象データが見つかりませんでした: ${trackCode}`);
        }
      } else {
        logger.warn(`予想情報スクレイピング失敗: ${trackCode} - ${result.error}`);
      }
    }

    return true;

  } catch (error) {
    logger.error('予想情報スクレイピング処理中にエラーが発生しました', error);
    return false;
  }
}

/**
 * 中間ファイルの検証
 */
async function validatePredictionsFiles(options: ExecutionOptions): Promise<boolean> {
  const dateStr = Array.isArray(options.date) ? options.date[0] : options.date;
  const isoDateStr = formatDateToISO(dateStr);
  
  logger.info(`予想情報中間ファイル検証開始: ${dateStr}`);

  try {
    // 中間ファイル検索
    const files = await IntermediateFileManager.findIntermediateFiles(
      'predictions',
      isoDateStr,
      undefined,
      'pending'
    );

    if (files.length === 0) {
      logger.warn('検証対象の中間ファイルが見つかりません');
      return false;
    }

    let allValid = true;

    for (const fileInfo of files) {
      logger.info(`中間ファイル検証: ${fileInfo.metadata.trackCode}`);
      
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
        allValid = false;
        continue;
      }

      // 予想情報特有の検証
      const intermediateFile = await IntermediateFileManager.loadIntermediateFile<PredictionsRequest>(
        fileInfo.filePath
      );
      
      const predictionsValidation = await validatePredictionsData(intermediateFile.data);
      
      if (!predictionsValidation.isValid) {
        logger.error(`予想情報検証失敗: ${fileInfo.metadata.trackCode}`, predictionsValidation.errors);
        await IntermediateFileManager.updateStatus(
          fileInfo.filePath,
          'failed',
          predictionsValidation.errors
        );
        allValid = false;
        continue;
      }

      // 検証成功
      await IntermediateFileManager.updateStatus(fileInfo.filePath, 'validated');
      logger.success(`中間ファイル検証成功: ${fileInfo.metadata.trackCode}`);

      // 警告がある場合は表示
      if (predictionsValidation.warnings.length > 0) {
        logger.warn(`検証警告: ${fileInfo.metadata.trackCode}`, predictionsValidation.warnings);
      }
    }

    return allValid;

  } catch (error) {
    logger.error('予想情報中間ファイル検証中にエラーが発生しました', error);
    return false;
  }
}

/**
 * 中間ファイルからのAPI送信
 */
async function sendPredictionsFromFiles(options: ExecutionOptions): Promise<boolean> {
  const dateStr = Array.isArray(options.date) ? options.date[0] : options.date;
  const isoDateStr = formatDateToISO(dateStr);
  
  logger.info(`予想情報API送信開始: ${dateStr}`);

  // 直接ファイル指定の場合
  if (options.intermediateFile) {
    return await sendSinglePredictionsFile(options.intermediateFile, options.dryRun);
  }

  try {
    // 検証済みの中間ファイルを検索
    const files = await IntermediateFileManager.findIntermediateFiles(
      'predictions',
      isoDateStr,
      undefined,
      'validated'
    );

    if (files.length === 0) {
      logger.warn('送信対象の中間ファイルが見つかりません');
      return false;
    }

    let allSuccess = true;

    for (const fileInfo of files) {
      logger.info(`API送信処理: ${fileInfo.metadata.trackCode}`);
      
      const success = await sendSinglePredictionsFile(fileInfo.filePath, options.dryRun);
      
      if (!success) {
        allSuccess = false;
      }
    }

    return allSuccess;

  } catch (error) {
    logger.error('予想情報API送信中にエラーが発生しました', error);
    return false;
  }
}

/**
 * 単一中間ファイルからのAPI送信
 */
async function sendSinglePredictionsFile(filePath: string, dryRun?: boolean): Promise<boolean> {
  try {
    const intermediateFile = await IntermediateFileManager.loadIntermediateFile<PredictionsRequest>(filePath);
    const trackCode = intermediateFile.metadata.trackCode;
    
    if (dryRun) {
      logger.info(`ドライランモード: データ送信をスキップ - ${trackCode}`);
      logger.debug('送信予定データ:', JSON.stringify(intermediateFile.data, null, 2));
      return true;
    }

    const apiClient = createApiClient();
    const endpoint = new PredictionsEndpoint(apiClient);

    let allSuccess = true;

    for (const apiRequest of intermediateFile.data) {
      try {
        logger.info(`API送信中: ${apiRequest.date} ${apiRequest.trackCode}`);
        const response = await endpoint.send(apiRequest);
        
        if (response.success) {
          logger.success(`API送信成功: ${apiRequest.trackCode}`);
        } else {
          const errorResponse = response as any;
          logger.error(`API送信失敗: ${apiRequest.trackCode} - ${errorResponse.error?.message || 'Unknown error'}`);
          allSuccess = false;
        }
      } catch (error) {
        logger.error(`API送信エラー: ${apiRequest.trackCode}`, error);
        allSuccess = false;
      }
    }

    // ステータス更新
    if (allSuccess) {
      await IntermediateFileManager.updateStatus(filePath, 'sent');
      logger.success(`中間ファイル送信完了: ${trackCode}`);
    } else {
      await IntermediateFileManager.updateStatus(filePath, 'failed', ['API送信に失敗しました']);
      logger.error(`中間ファイル送信失敗: ${trackCode}`);
    }

    return allSuccess;

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
/**
 * ブラウザユーティリティ (v2移植版)
 */

import { Browser, BrowserContext, Page, chromium } from 'playwright';
import { CONFIG, getRandomUserAgent } from './config';
import { logger } from './logger';
import { ensureDirectoryExists, getCurrentDate } from './file';
import path from 'path';
import fs from 'fs';

export interface BrowserInitResult {
  browser: Browser;
  context: BrowserContext;
  page: Page;
}

/**
 * Playwrightブラウザを初期化
 */
export async function initBrowser(): Promise<BrowserInitResult> {
  try {
    logger.debug('ブラウザを初期化中...');
    
    const launchOptions = {
      headless: CONFIG.BROWSER.HEADLESS,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu'
      ]
    };

    const browser = await chromium.launch(launchOptions);

    const context = await browser.newContext({
      userAgent: getRandomUserAgent(),
      viewport: CONFIG.BROWSER.VIEWPORT,
      extraHTTPHeaders: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'ja-JP,ja;q=0.9,en-US;q=0.8,en;q=0.7',
        'Sec-Ch-Ua': '"Chromium";v="134", "Google Chrome";v="134"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"Windows"',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1'
      },
      bypassCSP: true,
      javaScriptEnabled: true
    });

    // ステルスモード設定（自動化検出対策）
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
      Object.defineProperty(navigator, 'languages', { get: () => ['ja-JP', 'ja', 'en-US', 'en'] });
    });

    const page = await context.newPage();

    logger.debug('ブラウザを初期化しました');
    return { browser, context, page };
  } catch (error) {
    logger.error('ブラウザの初期化に失敗しました:', error);
    throw error;
  }
}

/**
 * スクリーンショットを保存
 */
export async function saveScreenshot(
  page: Page,
  filename: string,
  executionDate?: string
): Promise<string> {
  try {
    const date = executionDate || getCurrentDate();
    const screenshotDir = path.join('screenshots', date);
    ensureDirectoryExists(screenshotDir);
    
    const screenshotPath = path.join(screenshotDir, filename);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    
    logger.debug(`スクリーンショットを保存しました: ${screenshotPath}`);
    return screenshotPath;
  } catch (error) {
    logger.error('スクリーンショットの保存に失敗しました:', error);
    throw error;
  }
}

/**
 * ログイン状態を保存
 */
export async function saveLoginState(
  context: BrowserContext,
  serviceName: string
): Promise<string> {
  try {
    const stateDir = path.join('state');
    ensureDirectoryExists(stateDir);
    
    const storageState = await context.storageState();
    const statePath = path.join(stateDir, `${serviceName}-storage-state.json`);
    fs.writeFileSync(statePath, JSON.stringify(storageState, null, 2));
    
    logger.info(`ログイン状態を保存しました: ${statePath}`);
    return statePath;
  } catch (error) {
    logger.error('ログイン状態の保存に失敗しました:', error);
    throw error;
  }
}

/**
 * 保存されたログイン状態を読み込み
 */
export async function loadLoginState(
  serviceName: string,
  baseUrl: string,
  loginCheckSelector: string,
  executionDate?: string
): Promise<{ browser: Browser | null; context: BrowserContext | null; page: Page | null; isLoggedIn: boolean }> {
  const statePath = path.join('state', `${serviceName}-storage-state.json`);
  
  if (!fs.existsSync(statePath)) {
    logger.warn('保存されたログイン状態が見つかりません');
    return { browser: null, context: null, page: null, isLoggedIn: false };
  }
  
  try {
    const browser = await chromium.launch({
      headless: CONFIG.BROWSER.HEADLESS,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--no-sandbox',
        '--disable-setuid-sandbox'
      ]
    });
    
    const context = await browser.newContext({
      userAgent: getRandomUserAgent(),
      viewport: CONFIG.BROWSER.VIEWPORT,
      extraHTTPHeaders: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'ja-JP,ja;q=0.9,en-US;q=0.8,en;q=0.7',
        'Sec-Ch-Ua': '"Chromium";v="134", "Google Chrome";v="134"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"Windows"',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1'
      },
      bypassCSP: true,
      javaScriptEnabled: true,
      storageState: statePath
    });
    
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
    });
    
    const page = await context.newPage();
    
    // ログイン状態を確認
    await page.goto(`${baseUrl}/mypage`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    
    const isLoggedIn = await page.evaluate((selector) => {
      return !!document.querySelector(selector);
    }, loginCheckSelector);
    
    if (isLoggedIn) {
      logger.info('保存されたログイン状態を復元しました');
      
      // ログイン状態のスクリーンショット
      if (CONFIG.SCRAPING.SCREENSHOT_ON_ERROR) {
        await saveScreenshot(page, `${serviceName}-login-restored.png`, executionDate);
      }
    } else {
      logger.warn('保存されたログイン状態が無効です。再ログインが必要です。');
    }
    
    return { browser, context, page, isLoggedIn };
  } catch (error) {
    logger.error('ログイン状態の読み込みに失敗しました:', error);
    return { browser: null, context: null, page: null, isLoggedIn: false };
  }
}
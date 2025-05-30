// playwrightでのユーティリティ関数をまとめたファイル

import { Browser, BrowserContext, Page, chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import { USER_AGENTS } from './config';

/**
 * Playwrightブラウザの初期化に関するユーティリティ関数
 * 各種スクレイピングのコードのinitで呼び出す
 */
export async function initBrowser(): Promise<{ browser: Browser; context: BrowserContext; page: Page }> {
  const launchOptions: any = {
    headless: true,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox',
      '--disable-setuid-sandbox'
    ]
  };

  const browser = await chromium.launch(launchOptions);

  const context = await browser.newContext({
    userAgent: USER_AGENTS,
    viewport: { width: 1280, height: 800 },
    extraHTTPHeaders: {
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'ja-JP,ja;q=0.9,en-US;q=0.8,en;q=0.7',
      'Sec-Ch-Ua': '"Chromium";v="112", "Google Chrome";v="112"', 
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

  // ステルスモードの追加設定（自動化検出対策）
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
    Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
  });

  const page = await context.newPage();
  
  return { browser, context, page };
}

/**
 * スクリーンショットを保存するためのユーティリティ関数
 */
export async function saveScreenshot(
  page: Page, 
  filename: string, 
  executionDate: string
): Promise<string> {
  const screenshotDir = path.join('image', executionDate);
  ensureDirectoryExists(screenshotDir);
  
  const screenshotPath = path.join(screenshotDir, filename);
  await page.screenshot({ path: screenshotPath });
  
  return screenshotPath;
}

/**
 * ディレクトリが存在しない場合は作成する
 */
export function ensureDirectoryExists(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
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
 * ログイン状態を保存する
 */
export async function saveLoginState(
  context: BrowserContext,
  serviceName: string
): Promise<string> {
  try {
    // 保存先ディレクトリの確認
    const stateDir = path.join(__dirname, '../state');
    ensureDirectoryExists(stateDir);
    
    // ストレージ状態を保存
    const storageState = await context.storageState();
    const statePath = path.join(stateDir, `${serviceName}-storage-state.json`);
    fs.writeFileSync(statePath, JSON.stringify(storageState, null, 2));
    
    console.log(`ログイン状態を保存しました: ${statePath}`);
    return statePath;
  } catch (error) {
    console.error('ログイン状態の保存に失敗しました:', error);
    throw error;
  }
}

/**
 * 保存されたログイン状態を読み込む
 */
export async function loadLoginState(
  serviceName: string,
  baseUrl: string,
  loginCheckSelector: string,
  executionDate: string
): Promise<{ browser: Browser | null; context: BrowserContext | null; page: Page | null; isLoggedIn: boolean }> {
  const statePath = path.join(__dirname, '../state', `${serviceName}-storage-state.json`);
  
  if (!fs.existsSync(statePath)) {
    console.log('保存されたログイン状態が見つかりません');
    return { browser: null, context: null, page: null, isLoggedIn: false };
  }
  
  try {
    // ブラウザを初期化
    const launchOptions: any = {
      headless: true,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--no-sandbox',
        '--disable-setuid-sandbox'
      ]
    };

    const browser = await chromium.launch(launchOptions);
    
    // 保存されたストレージ状態を読み込む
    const context = await browser.newContext({
      userAgent: USER_AGENTS,
      viewport: { width: 1280, height: 800 },
      extraHTTPHeaders: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'ja-JP,ja;q=0.9,en-US;q=0.8,en;q=0.7',
        'Sec-Ch-Ua': '"Chromium";v="112", "Google Chrome";v="112"', 
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
    
    // ステルスモードの追加設定
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
    });
    
    const page = await context.newPage();
    
    // ログイン状態を確認
    await page.goto(`${baseUrl}/mypage`, { waitUntil: 'domcontentloaded' });
    await new Promise(resolve => setTimeout(resolve, Math.floor(Math.random() * 1000) + 1000));
    
    // 指定されたセレクタが存在するか確認
    const isLoggedIn = await page.evaluate((selector) => {
      return !!document.querySelector(selector);
    }, loginCheckSelector);
    
    if (isLoggedIn) {
      console.log('保存されたログイン状態を復元しました');
      
      // ログイン状態のスクリーンショット
      const screenshotDir = path.join('image', executionDate);
      ensureDirectoryExists(screenshotDir);
      const screenshotPath = path.join(screenshotDir, `${serviceName}-login-restored.png`);
      await page.screenshot({ path: screenshotPath });
    } else {
      console.log('保存されたログイン状態が無効です。再ログインが必要です。');
    }
    
    return { browser, context, page, isLoggedIn };
  } catch (error) {
    console.error('ログイン状態の読み込みに失敗しました:', error);
    return { browser: null, context: null, page: null, isLoggedIn: false };
  }
}



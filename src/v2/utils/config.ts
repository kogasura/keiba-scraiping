/**
 * 設定ファイル (v2移植版)
 */

import 'dotenv/config';

export const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36'
];

export const CONFIG = {
  NETKEIBA: {
    BASE_URL: 'https://race.netkeiba.com',
    USERNAME: process.env.NETKEIBA_USERNAME || '',
    PASSWORD: process.env.NETKEIBA_PASSWORD || ''
  },
  WINKEIBA: {
    BASE_URL: 'https://www.winkeiba.jp',
    USERNAME: process.env.WINKEIBA_USERNAME || '',
    PASSWORD: process.env.WINKEIBA_PASSWORD || ''
  },
  UMAX: {
    BASE_URL: 'https://umax.jp',
    USERNAME: process.env.UMAX_USERNAME || '',
    PASSWORD: process.env.UMAX_PASSWORD || ''
  },
  API: {
    BASE_URL: process.env.LARAVEL_API_BASE_URL || 'http://localhost:80',
    API_KEY: process.env.LARAVEL_API_KEY || '',
    TIMEOUT: 30000,
    RETRIES: 3
  },
  SCRAPING: {
    REQUEST_INTERVAL: 30000,
    TIMEOUT: 30000,
    DEFAULT_DELAY_MIN: 1000,
    DEFAULT_DELAY_MAX: 3000,
    RETRY_COUNT: 3,
    SCREENSHOT_ON_ERROR: true
  },
  BROWSER: {
    HEADLESS: true,
    VIEWPORT: { width: 1920, height: 1080 },
    TIMEOUT: 30000
  }
} as const;

/**
 * 競馬場コード定数
 */
export const TRACK_CODES = {
  SAPPORO: '01',
  HAKODATE: '02',
  FUKUSHIMA: '03',
  NIIGATA: '04',
  TOKYO: '05',
  NAKAYAMA: '06',
  CHUKYO: '07',
  KYOTO: '08',
  HANSHIN: '09',
  KOKURA: '10',
} as const;

/**
 * 競馬場名マッピング
 */
export const TRACK_NAMES: Record<string, string> = {
  '01': '札幌',
  '02': '函館',
  '03': '福島',
  '04': '新潟',
  '05': '東京',
  '06': '中山',
  '07': '中京',
  '08': '京都',
  '09': '阪神',
  '10': '小倉',
};

/**
 * 競馬場コードから名前を取得
 */
export function getTrackName(code: string): string {
  return TRACK_NAMES[code] ?? '不明';
}

/**
 * 競馬場名からコードを取得
 */
export function getTrackCode(name: string): string {
  const entry = Object.entries(TRACK_NAMES).find(([_, n]) => n === name);
  return entry ? entry[0] : '';
}

/**
 * ランダムなUser-Agentを取得
 */
export function getRandomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}
/**
 * ログ出力ユーティリティ
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

export class Logger {
  private static instance: Logger;
  private logLevel: LogLevel = LogLevel.INFO;
  private verbose: boolean = false;
  private quietMode: boolean = false;

  private constructor() {}

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  setLogLevel(level: LogLevel): void {
    this.logLevel = level;
  }

  setVerbose(verbose: boolean): void {
    this.verbose = verbose;
    if (verbose) {
      this.logLevel = LogLevel.DEBUG;
    }
  }

  setQuietMode(quiet: boolean): void {
    this.quietMode = quiet;
  }

  debug(message: string, ...args: any[]): void {
    if (this.logLevel <= LogLevel.DEBUG) {
      console.debug(`[DEBUG] ${this.formatMessage(message)}`, ...args);
    }
  }

  info(message: string, ...args: any[]): void {
    if (this.quietMode && !this.verbose) {
      return;
    }
    if (this.logLevel <= LogLevel.INFO) {
      console.info(`[INFO] ${this.formatMessage(message)}`, ...args);
    }
  }

  warn(message: string, ...args: any[]): void {
    if (this.logLevel <= LogLevel.WARN) {
      console.warn(`[WARN] ${this.formatMessage(message)}`, ...args);
    }
  }

  error(message: string, ...args: any[]): void {
    if (this.logLevel <= LogLevel.ERROR) {
      console.error(`[ERROR] ${this.formatMessage(message)}`, ...args);
    }
  }

  success(message: string, ...args: any[]): void {
    console.log(`[SUCCESS] ${this.formatMessage(message)}`, ...args);
  }

  result(message: string, ...args: any[]): void {
    console.log(`[RESULT] ${this.formatMessage(message)}`, ...args);
  }

  private formatMessage(message: string): string {
    const timestamp = new Date().toISOString();
    return `${timestamp} - ${message}`;
  }
}

// シングルトンインスタンスをエクスポート
export const logger = Logger.getInstance();
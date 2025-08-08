/**
 * 遅延処理ユーティリティ
 */

/**
 * 指定された範囲内でランダムに遅延
 */
export function randomDelay(minMs: number, maxMs: number): Promise<void> {
  const delay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  return new Promise(resolve => setTimeout(resolve, delay));
}

/**
 * 固定時間の遅延
 */
export function fixedDelay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 指数バックオフ遅延（リトライ用）
 */
export function exponentialBackoff(attempt: number, baseMs: number = 1000, maxMs: number = 10000): Promise<void> {
  const delay = Math.min(baseMs * Math.pow(2, attempt), maxMs);
  return new Promise(resolve => setTimeout(resolve, delay));
}

/**
 * 条件付き遅延
 */
export function conditionalDelay(condition: () => boolean, ms: number): Promise<void> {
  return condition() ? fixedDelay(ms) : Promise.resolve();
}
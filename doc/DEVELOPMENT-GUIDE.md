# 開発ガイド

## 開発環境のセットアップ

### 前提条件
- Node.js 18.x以上
- npm 9.x以上
- Git
- WSL2（Windows環境の場合）

### 初期セットアップ

1. **リポジトリのクローン**
```bash
git clone <repository-url>
cd playwright-test
```

2. **依存関係のインストール**
```bash
npm install
```

3. **Playwrightブラウザのインストール**
```bash
npx playwright install
```

4. **Sharp（画像処理ライブラリ）の設定**
```bash
# WSL環境の場合
npm install --include=optional sharp
# または
npm install --os=linux --cpu=x64 sharp
```

5. **環境変数の設定**
`.env`ファイルを作成し、以下の内容を設定：
```env
# OpenAI API
OPENAI_API_KEY=your_openai_api_key

# WIN競馬認証情報
WIN_KEIBA_USER=your_username
WIN_KEIBA_PASS=your_password

# netkeiba認証情報
NETKEIBA_USER=your_username
NETKEIBA_PASS=your_password

# オプション設定
BROWSER_HEADLESS=true
REQUEST_DELAY_MIN=1000
REQUEST_DELAY_MAX=3000
```

## 開発ワークフロー

### ブランチ戦略
- `main`: 本番環境用の安定版
- `develop`: 開発統合ブランチ
- `feature/*`: 機能開発用ブランチ
- `hotfix/*`: 緊急修正用ブランチ

### 開発手順

1. **機能ブランチの作成**
```bash
git checkout develop
git pull origin develop
git checkout -b feature/new-feature-name
```

2. **開発とテスト**
```bash
# TypeScriptのコンパイル
npm run build

# 開発モードでの実行
npm run dev

# テスト実行
npm run test
```

3. **コードの品質チェック**
```bash
# TypeScriptの型チェック
npx tsc --noEmit

# コードフォーマット（推奨）
npx prettier --write src/
```

4. **コミットとプッシュ**
```bash
git add .
git commit -m "feat: 新機能の追加"
git push origin feature/new-feature-name
```

## コーディング規約

### TypeScript規約

1. **型定義の明示**
```typescript
// Good
function processRaceData(data: RaceInfo[]): AnalysisItem[] {
    return data.map(race => ({
        date: race.date,
        trackCode: race.trackCode,
        raceNumber: race.raceNumber
    }));
}

// Bad
function processRaceData(data: any): any {
    return data.map(race => ({
        date: race.date,
        trackCode: race.trackCode,
        raceNumber: race.raceNumber
    }));
}
```

2. **インターフェースの使用**
```typescript
// Good
interface ScrapingOptions {
    headless: boolean;
    timeout: number;
    retryCount: number;
}

// Bad
type ScrapingOptions = {
    headless: boolean;
    timeout: number;
    retryCount: number;
}
```

3. **エラーハンドリング**
```typescript
// Good
try {
    const data = await scraper.getData();
    return processData(data);
} catch (error) {
    console.error('データ取得エラー:', error);
    throw new Error(`スクレイピング失敗: ${error.message}`);
}

// Bad
const data = await scraper.getData();
return processData(data);
```

### ファイル命名規約
- クラスファイル: `kebab-case.ts` (例: `netkeiba-scraper.ts`)
- ユーティリティ: `kebab-case-utils.ts` (例: `excel-utils.ts`)
- 型定義: `types.ts`
- 定数: `consts.ts`

### 関数命名規約
- 関数名: `camelCase`
- 非同期関数: 動詞で開始 (例: `fetchData`, `processImage`)
- ブール値を返す関数: `is` または `has` で開始

## テスト

### 単体テスト
```bash
# 個別テスト実行
npm run test

# 特定のファイルのテスト
npx ts-node src/test-specific.ts
```

### 統合テスト
```bash
# 全体の処理フローテスト
npm run test -- --integration
```

### テストデータの準備
```typescript
// テスト用のモックデータ
const mockRaceData: RaceInfo = {
    date: '20250614',
    trackCode: '05',
    raceNumber: 1,
    race_name: 'テストレース',
    // ... その他のプロパティ
};
```

## デバッグ

### ログレベルの設定
```typescript
// デバッグログの有効化
const DEBUG = process.env.NODE_ENV === 'development';

if (DEBUG) {
    console.log('デバッグ情報:', data);
}
```

### ブラウザのヘッドフルモード
```typescript
// デバッグ時はブラウザを表示
const browser = await playwright.chromium.launch({
    headless: process.env.NODE_ENV === 'production'
});
```

### スクリーンショットの保存
```typescript
// エラー時のスクリーンショット
try {
    await page.goto(url);
} catch (error) {
    await page.screenshot({ path: `debug/error-${Date.now()}.png` });
    throw error;
}
```

## パフォーマンス最適化

### 並列処理の活用
```typescript
// 複数のレースを並列で処理
const racePromises = races.map(race => 
    processRace(race).catch(error => {
        console.error(`レース ${race.raceNumber} 処理エラー:`, error);
        return null;
    })
);
const results = await Promise.all(racePromises);
```

### メモリ使用量の監視
```typescript
// メモリ使用量の確認
const memUsage = process.memoryUsage();
console.log(`メモリ使用量: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`);
```

### リクエスト制限の遵守
```typescript
// レート制限の実装
async function withRateLimit<T>(fn: () => Promise<T>): Promise<T> {
    await randomDelay(1000, 3000);
    return await fn();
}
```

## トラブルシューティング

### よくある問題と解決方法

#### 1. Sharp モジュールエラー
```bash
# 解決方法
npm uninstall sharp
npm install --include=optional sharp
```

#### 2. Playwright ブラウザエラー
```bash
# 解決方法
npx playwright install --with-deps
```

#### 3. OpenAI API エラー
- APIキーの確認
- 利用制限の確認
- JSON Schemaの構文チェック

#### 4. メモリ不足エラー
```bash
# Node.jsのメモリ制限を増加
node --max-old-space-size=4096 dist/cli-index.js
```

### ログファイルの確認
```bash
# 最新のログを確認
tail -f logs/$(date +%Y%m%d)_prediction.log

# エラーログのフィルタリング
grep -i error logs/*.log
```

## デプロイメント

### 本番環境への配置

1. **ビルド**
```bash
npm run build
```

2. **本番環境変数の設定**
```bash
# 本番用の.envファイル
cp .env.example .env.production
```

3. **依存関係の最適化**
```bash
npm ci --only=production
```

4. **起動スクリプト**
```bash
#!/bin/bash
cd /path/to/playwright-test
npm run build
node dist/cli-index.js
```

### 定期実行の設定（cron）
```bash
# 毎日午前6時に実行
0 6 * * * /path/to/run-scraper.sh >> /var/log/scraper.log 2>&1
```

## 監視とメンテナンス

### ログ監視
- エラー率の監視
- 処理時間の監視
- データ取得成功率の監視

### 定期メンテナンス
- ログファイルのローテーション
- 古い画像ファイルの削除
- 依存関係の更新

### バックアップ
```bash
# データのバックアップ
tar -czf backup-$(date +%Y%m%d).tar.gz data/ umax-data/ ai-note-images/
```

## コントリビューション

### プルリクエストの作成
1. 機能ブランチで開発
2. テストの実行と確認
3. コードレビューの依頼
4. マージ後のクリーンアップ

### コードレビューのポイント
- 型安全性の確認
- エラーハンドリングの妥当性
- パフォーマンスへの影響
- セキュリティ上の問題

### ドキュメントの更新
- 新機能追加時のREADME更新
- API変更時のリファレンス更新
- 設定変更時の開発ガイド更新 
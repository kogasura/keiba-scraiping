# v2プロジェクト切り出し手順ガイド

## 概要

このガイドでは、現在のmonorepo構成から`src/v2/`を独立したプロジェクトとして切り出し、Docker化する手順を説明します。

## 前提条件

- v2プロジェクトは4つの外部依存関係のみ使用（axios, dotenv, openai, playwright）
- レガシーv1コードへの依存は最小限
- 共通型定義ファイルの移植が必要

## 手順

### 1. 新しいプロジェクトディレクトリの作成

```bash
# 新しいプロジェクトディレクトリを作成
mkdir netkeiba-scraper-v2
cd netkeiba-scraper-v2
```

### 2. 必要なファイル・ディレクトリのコピー

```bash
# v2のコア部分をコピー
cp -r /path/to/original/src/v2/* ./src/

# 共通型定義をコピー
mkdir -p ./src/types/legacy
cp /path/to/original/src/type/scraping-api-types.d.ts ./src/types/legacy/

# 設定ファイルをコピー
cp /path/to/original/config/ ./config/
cp /path/to/original/.env.example ./.env.example
```

### 3. 必要なファイル一覧

#### 必須ファイル・ディレクトリ

```
netkeiba-scraper-v2/
├── src/
│   ├── api/                     # API通信層
│   ├── cli/                     # CLI実行層
│   ├── mappers/                 # データ変換層
│   ├── scrapers/                # スクレイピング層
│   ├── services/                # ビジネスロジック層
│   ├── types/                   # v2型定義
│   │   └── legacy/              # 共通型定義（移植版）
│   ├── utils/                   # ユーティリティ
│   └── validators/              # バリデーション
├── config/                      # 設定ファイル
├── package.json                 # v2専用依存関係
├── tsconfig.json               # TypeScript設定
├── Dockerfile                  # Docker設定
├── docker-compose.yml          # 開発環境用
├── .dockerignore              # Docker除外ファイル
├── .env.example               # 環境変数テンプレート
└── README.md                  # v2専用ドキュメント
```

#### 移植が必要なファイル

```bash
# 共通型定義ファイルの移植
src/type/scraping-api-types.d.ts → src/types/legacy/scraping-api-types.d.ts

# 設定ファイル（必要に応じて）
config/execution-schedule.json   # スケジュール設定
.env.example                     # 環境変数テンプレート
```

### 4. v2専用package.jsonの作成

```json
{
  "name": "netkeiba-scraper-v2",
  "version": "2.0.0",
  "description": "netkeiba競馬データスクレイピングシステム v2",
  "main": "dist/cli/main.js",
  "scripts": {
    "build": "tsc",
    "start": "node dist/cli/main.js",
    "dev": "ts-node src/cli/main.ts",
    "type-check": "tsc --noEmit --skipLibCheck",
    "test": "echo \"Tests not implemented yet\" && exit 0"
  },
  "keywords": [
    "netkeiba",
    "scraper",
    "playwright",
    "horse-racing",
    "data-extraction"
  ],
  "author": "",
  "license": "MIT",
  "dependencies": {
    "axios": "^1.8.4",
    "dotenv": "^16.5.0", 
    "openai": "^4.91.1",
    "playwright": "^1.40.0"
  },
  "devDependencies": {
    "@types/node": "^18.11.9",
    "ts-node": "^10.9.1",
    "typescript": "^4.9.3"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
```

### 5. TypeScript設定（tsconfig.json）

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "removeComments": false,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noImplicitThis": true,
    "alwaysStrict": true,
    "noUnusedLocals": false,
    "noUnusedParameters": false,
    "exactOptionalPropertyTypes": false,
    "noImplicitOverride": true,
    "noPropertyAccessFromIndexSignature": false,
    "noUncheckedIndexedAccess": false
  },
  "include": [
    "src/**/*"
  ],
  "exclude": [
    "node_modules",
    "dist",
    "test"
  ]
}
```

### 6. import文の修正

共通型定義ファイルへの参照を修正：

```typescript
// 修正前（元のv2コード）
import { ApiResponse } from '../../../type/scraping-api-types';

// 修正後（独立版）
import { ApiResponse } from '../types/legacy/scraping-api-types';
```

### 7. Docker化

#### Dockerfile

```dockerfile
# Multi-stage build for optimized image
FROM node:20-slim AS base

# Playwright dependencies
RUN apt-get update && apt-get install -y \
    wget ca-certificates fonts-liberation \
    libasound2 libatk-bridge2.0-0 libatk1.0-0 libc6 \
    libcairo2 libcups2 libdbus-1-3 libexpat1 libfontconfig1 \
    libgbm1 libgcc1 libglib2.0-0 libgtk-3-0 libnspr4 libnss3 \
    libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 libx11-6 \
    libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 libxdamage1 \
    libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 \
    libxtst6 lsb-release xdg-utils \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

# Install Playwright browsers
RUN npx playwright install chromium
RUN npx playwright install-deps chromium

# Production stage
FROM node:20-slim

# Runtime dependencies
RUN apt-get update && apt-get install -y \
    fonts-liberation libasound2 libatk-bridge2.0-0 libatk1.0-0 \
    libcairo2 libcups2 libdbus-1-3 libdrm2 libgbm1 libgtk-3-0 \
    libnspr4 libnss3 libx11-6 libxcomposite1 libxdamage1 libxext6 \
    libxfixes3 libxrandr2 libxss1 libxtst6 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy from base stage
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /root/.cache/ms-playwright /root/.cache/ms-playwright

# Copy application files
COPY . .

# Build TypeScript
RUN npm run build

# Environment setup
ENV NODE_ENV=production
ENV PLAYWRIGHT_BROWSERS_PATH=/root/.cache/ms-playwright

# Non-root user for security
RUN useradd -m -u 1001 appuser && chown -R appuser:appuser /app
USER appuser

# Default command
CMD ["npm", "start"]
```

#### docker-compose.yml

```yaml
version: '3.8'

services:
  netkeiba-scraper-v2:
    build:
      context: .
      dockerfile: Dockerfile
    environment:
      # Netkeiba認証
      - NETKEIBA_USERNAME=${NETKEIBA_USERNAME}
      - NETKEIBA_PASSWORD=${NETKEIBA_PASSWORD}
      
      # Winkeiba認証
      - WINKEIBA_EMAIL=${WINKEIBA_EMAIL}
      - WINKEIBA_PASSWORD=${WINKEIBA_PASSWORD}
      
      # API設定
      - API_BASE_URL=${API_BASE_URL:-http://localhost}
      - API_KEY=${API_KEY}
      
      # OCR設定
      - DEEPSEEK_API_KEY=${DEEPSEEK_API_KEY}
      
      # Playwright設定
      - PLAYWRIGHT_BROWSERS_PATH=/root/.cache/ms-playwright
    volumes:
      # 開発時のソースマウント
      - ./src:/app/src
      - ./config:/app/config
      - /app/node_modules
    command: npm run dev
    stdin_open: true
    tty: true
```

### 8. .dockerignore

```
node_modules
npm-debug.log
.env
.env.local
.env.*.local

# Git関連
.git
.gitignore

# IDE
.vscode
.idea
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# ビルド成果物
dist
*.log

# テスト・デバッグ
coverage
.nyc_output
debug/
*.tmp

# ドキュメント
*.md
docs/
```

### 9. セットアップと検証

```bash
# 依存関係のインストール
npm install

# Playwrightブラウザのインストール
npx playwright install chromium

# TypeScript型チェック
npm run type-check

# ビルドテスト
npm run build

# 動作テスト（環境変数設定後）
npm run dev 20250125 --apis race-info --tracks 10
```

### 10. Docker動作確認

```bash
# Dockerイメージのビルド
docker build -t netkeiba-scraper-v2 .

# Docker Composeでの開発環境起動
docker-compose up --build

# コンテナ内での実行テスト
docker run --env-file .env netkeiba-scraper-v2 20250125 --apis race-info
```

## 移行時の注意点

### 1. 型定義の移植

- `scraping-api-types.d.ts`のimport文を全て修正
- 型定義に依存するファイルの参照パスを更新

### 2. 設定ファイルの調整

- `config/execution-schedule.json`の形式確認
- 環境変数名の整合性確認

### 3. テスト実行

- 各API（race-info, predictions, race-results）の動作確認
- エラーハンドリングの動作確認
- ログ出力の正常性確認

### 4. パフォーマンス考慮

- Dockerイメージサイズの最適化
- メモリ使用量の監視（Playwright使用時）
- 実行時間の測定と最適化

## 利点

1. **軽量化**: 依存関係を40%削減
2. **メンテナンス性**: v2専用の単純な構成
3. **デプロイの簡素化**: 単一プロジェクトとしてのCI/CD
4. **独立開発**: レガシーコードの影響を受けない
5. **Docker最適化**: v2専用の最適化されたコンテナ

## 今後の拡張

- Kubernetes対応
- マルチステージ環境（dev/staging/prod）
- 監視・ログ集約システムの統合
- 自動テストの追加
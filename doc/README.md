# 競馬予想データ統合システム

## プロジェクト概要

このプロジェクトは、複数の競馬情報サイトから予想データを自動収集し、統合的な分析を行うスクレイピングシステムです。Playwright、OpenAI API、画像解析技術を活用して、競馬予想の精度向上を支援します。

## 主要機能

### 1. データ収集機能
- **netkeiba**: タイム指数、データ分析、CP予想の取得
- **WIN競馬**: 新聞印情報、分析データの取得
- **UMA-X**: 各種指数（SP値、AG値、SA値、KI値）の取得
- **note画像解析**: AI予想データの画像OCR

### 2. データ統合・分析機能
- 複数サイトのデータを統一フォーマットで管理
- 競馬場コード順での自動ソート
- Excel形式での結果出力

### 3. 画像解析機能
- OpenAI Vision APIを使用した画像OCR
- 予想マーク（◎○☆▲△）と馬番の自動抽出
- 信頼度と候補データの管理

## プロジェクト構造

```
playwright-test/
├── src/                    # ソースコード
│   ├── cli-index.ts       # メインエントリーポイント
│   ├── types.ts           # 型定義
│   ├── consts.ts          # 定数・設定
│   ├── netkeiba-scraper.ts    # netkeibaスクレイパー
│   ├── winkeiba-scraper.ts    # WIN競馬スクレイパー
│   ├── umax-scraper.ts        # UMA-Xスクレイパー
│   ├── h58_ai.ts              # AI画像解析
│   ├── excel-utils.ts         # Excel出力ユーティリティ
│   ├── umax-excel-utils.ts    # UMA-X専用Excel出力
│   ├── note-image-ocr.ts      # note画像OCR
│   ├── formatter-utils.ts     # データフォーマット
│   ├── playwright-utlis.ts    # Playwrightユーティリティ
│   └── utils.ts               # 汎用ユーティリティ
├── data/                   # 分析データ保存
├── ai-note-images/        # AI予想画像
├── note_images/           # note画像
├── umax-data/             # UMA-X予想データ
├── logs/                  # ログファイル
└── doc/                   # ドキュメント
```

## 技術スタック

### 言語・フレームワーク
- **TypeScript 4.9.3**: メイン開発言語
- **Node.js**: 実行環境

### 主要ライブラリ
- **Playwright 1.40.0**: ブラウザ自動化・スクレイピング
- **OpenAI 4.91.1**: 画像解析・OCR
- **Sharp 0.34.2**: 画像処理・切り取り・結合
- **XLSX**: Excel形式でのデータ出力
- **Axios**: HTTP通信
- **dotenv**: 環境変数管理

## データモデル

### AnalysisItem（統合分析データ）
```typescript
interface AnalysisItem {
    date: string;                    // 日付（YYYYMMDD）
    trackCode: string;               // 競馬場コード
    raceNumber: number;              // レース番号
    
    // netkeiba由来データ
    time_index_max_ranks?: [number, number, number, number, number];
    time_index_avg_ranks?: [number, number, number, number, number];
    cp_ranks?: [number, number, number, number];
    deviation_ranks?: number[];
    
    // WIN競馬由来データ
    win_prediction_ranks?: [number, number, number, number?, number?, number?, number?, number?];
    time_ranks?: [number?, number?, number?];
    last_3f_ranks?: [number?, number?, number?];
    
    // UMA-X由来データ
    umax_prediction?: UmaxRacePrediction;
    
    // AI予想データ
    ai_ranks?: [number?, number?, number?, number?, number?];
    index_ranks?: [number, number, number, number, number, number, number, number];
    
    // レース結果
    race_result?: RaceResult;
}
```

### UmaxRacePrediction（UMA-X予想データ）
```typescript
interface UmaxRacePrediction {
    date: string;
    trackCode: string;
    raceNumber: string;
    focusedHorseNumbers: number[];      // 注目馬5頭
    timeDeviationTop3: number[];        // タイム偏差上位3頭
    lastSpurtDeviationTop3: number[];   // 上がり偏差上位3頭
    spValueTop5: number[];              // SP値上位5頭
    agValueTop5: number[];              // AG値上位5頭
    saValueTop5: number[];              // SA値上位5頭
    kiValueTop3: number[];              // KI値上位3頭
}
```

## 競馬場コード

```typescript
const TRACK_CODES = {
    SAPPORO: '01',   // 札幌
    HAKODATE: '02',  // 函館
    FUKUSHIMA: '03', // 福島
    NIIGATA: '04',   // 新潟
    TOKYO: '05',     // 東京
    NAKAYAMA: '06',  // 中山
    CHUKYO: '07',    // 中京
    KYOTO: '08',     // 京都
    HANSHIN: '09',   // 阪神
    KOKURA: '10',    // 小倉
};
```

## 使用方法

### 1. 環境設定
```bash
# 依存関係のインストール
npm install

# 環境変数の設定（.envファイル作成）
OPENAI_API_KEY=your_openai_api_key
WIN_KEIBA_USER=your_winkeiba_username
WIN_KEIBA_PASS=your_winkeiba_password
NETKEIBA_USER=your_netkeiba_username
NETKEIBA_PASS=your_netkeiba_password
```

### 2. v2 CLI実行

#### 基本的な使い方
```bash
# v2 CLIの実行（推奨）
npx ts-node src/v2/cli/main.ts --api=[API種別] --date=[日付]

# 例：レース情報の取得
npx ts-node src/v2/cli/main.ts --api=race-info,predictions --date=20250719

# 例：予想情報の取得（特定競馬場指定）
npx ts-node src/v2/cli/main.ts --api=predictions --date=20250719 --tracks=05,09

# 例：全API実行
npx ts-node src/v2/cli/main.ts --api=all --date=20250719
```

#### 利用可能なAPI
- `race-info`: レース情報取得
- `predictions`: 予想情報取得
- `ai-index`: AI指数取得
- `index-images`: 指数画像取得
- `race-results`: レース結果取得
- `all`: 全API実行

#### オプション
- `--date, -d`: 日付（YYYYMMDD形式）**必須**
- `--tracks, -t`: 競馬場コード（カンマ区切り）
- `--batch, -b`: バッチ処理モード
- `--dry`: ドライランモード（データ送信なし）
- `--stage, -s`: 実行段階（scrape, validate, send, all）
- `--intermediate-file, -i`: 中間ファイルパス（直接指定）
- `--help, -h`: ヘルプ表示

#### 段階的実行（中間ファイルシステム）
```bash
# スクレイピングのみ実行（中間ファイル作成）
npx ts-node src/v2/cli/main.ts --api=race-info --date=20250719 --stage=scrape

# 中間ファイルの検証
npx ts-node src/v2/cli/main.ts --api=race-info --date=20250719 --stage=validate

# 中間ファイルからのAPI送信
npx ts-node src/v2/cli/main.ts --api=race-info --date=20250719 --stage=send --dry

# 特定の中間ファイルを直接送信
npx ts-node src/v2/cli/main.ts --api=race-info --date=20250719 --stage=send --intermediate-file=path/to/file.json
```

#### 簡易実行（npm script）
```bash
# 基本的なv2実行
npm run v2 -- --api=race-info --date=20250719
```

### 3. 旧システム実行
```bash
# TypeScriptのコンパイル
npm run build

# メイン処理の実行
npm run test

# 開発モード
npm run dev
```

### 4. 設定変更
#### v2システムの場合
- 日付・競馬場・オプションはCLI引数で指定
- スケジュールファイル（`2025_kaihai_schedule_full.json`）から自動取得

#### 旧システムの場合
`src/cli-index.ts`で以下を変更：
```typescript
// 処理対象日付
const dates = ['20250614', '20250608', ...];

// 処理対象競馬場
const track_codes = ['05', '09', '02']; // 東京、阪神、函館
```

## 処理フロー

### v2システム（推奨）
```
スクレイピング → 中間ファイル作成 → 検証 → API送信
     (scrape)         (validate)      (send)
```

1. **スクレイピング段階**
   - 各サイトからのデータ収集
   - 中間ファイル形式での保存
   - 競馬場毎の個別ファイル作成

2. **検証段階**
   - 基本的なデータ形式チェック
   - API特有の検証（馬番重複、異常値等）
   - エラー・警告の詳細レポート

3. **送信段階**
   - 検証済み中間ファイルからのAPI送信
   - 送信結果の記録
   - 失敗時の詳細ログ

### 旧システム（cli-index.ts）
1. **netkeiba データ収集**
   - レース一覧取得
   - タイム指数（最高値、平均値、距離別）
   - データ分析（偏差値、急上昇、自己ベスト）
   - CP予想データ

2. **UMA-X データ収集**
   - 注目馬リスト
   - 各種指数（SP、AG、SA、KI値）
   - Excel形式で個別保存

3. **WIN競馬 データ収集**
   - 新聞印情報（◎○▲△）
   - タイム・上がり3F分析
   - 馬場特性分析

4. **画像解析処理**
   - note画像からの指数ランク抽出
   - AI予想マークの自動認識

5. **データ統合・出力**
   - 全データの統合
   - 競馬場コード順ソート
   - Excel形式で最終出力

### 画像解析フロー（h58_ai.ts）
1. **画像取得**: noteページから画像をダウンロード
2. **画像処理**: Sharp使用で切り取り・結合
3. **OCR処理**: OpenAI Vision APIで文字認識
4. **データ抽出**: 予想マークと馬番の構造化

## 中間ファイルシステム（v2）

### 概要
v2システムでは、データ送信前に中間ファイルを作成し、段階的な実行を可能にしています。

### 中間ファイル構造
```
intermediate/
├── race-info/
│   ├── 2025-07-19/
│   │   ├── 01_race-info_20250719_1234567890.json
│   │   └── 02_race-info_20250719_1234567890.json
├── predictions/
├── ai-index/
├── index-images/
└── race-results/
```

### 中間ファイル形式
```json
{
  "metadata": {
    "api": "race-info",
    "date": "2025-07-19",
    "trackCode": "02",
    "createdAt": "2025-07-18T12:18:00.635Z",
    "dataCount": 1,
    "status": "validated",
    "version": "1.0.0"
  },
  "data": [
    {
      "date": "2025-07-19",
      "trackCode": "02",
      "races": [...]
    }
  ]
}
```

### 実行段階
1. **scrape**: スクレイピング実行、中間ファイル作成
2. **validate**: 中間ファイルの検証
3. **send**: 中間ファイルからのAPI送信
4. **all**: 全段階を順次実行（デフォルト）

### メリット
- **データ検証**: 送信前のデータ品質チェック
- **再実行効率**: 失敗時に前段階をスキップ可能
- **デバッグ支援**: 中間データの確認が可能
- **段階的実行**: 必要な段階のみ実行

## 出力データ

### Excel出力ファイル
- `予想データ_YYYYMMDD.xlsx`: 統合分析データ
- `umax_predictions_YYYYMMDD.xlsx`: UMA-X専用データ

### JSON出力ファイル
- `data/analysis/`: 各レースの詳細分析データ
- `races_YYYYMMDD.json`: レース一覧データ

### 中間ファイル
- `intermediate/{api}/{date}/`: 段階的実行用の中間データ

## エラーハンドリング

### 画像解析エラー対応
- マーク未検出: `horse_number = null`
- 数字判別不能: `horse_number = 99` + 信頼度情報
- 信頼度 < 0.8 の場合は要確認フラグ

### スクレイピングエラー対応
- ランダム待機時間でレート制限回避
- ログイン失敗時の自動リトライ
- ページ読み込み失敗時のスキップ処理

## 開発・保守

### ログ出力
- 処理進捗の詳細ログ
- エラー発生時のスタックトレース
- 各データソースの取得件数

### 設定管理
- 環境変数での認証情報管理
- 競馬場・日付の柔軟な設定
- 出力フォーマットのカスタマイズ

## 注意事項

1. **利用規約遵守**: 各サイトの利用規約を必ず確認
2. **レート制限**: 適切な間隔でのアクセス
3. **認証情報**: .envファイルのGit管理除外
4. **Sharp依存**: WSL環境での追加インストールが必要な場合あり

## トラブルシューティング

### Sharp モジュールエラー
```bash
npm install --include=optional sharp
# または
npm install --os=linux --cpu=x64 sharp
```

### ブラウザ起動エラー
```bash
npx playwright install
```

### OpenAI API エラー
- API キーの確認
- 利用制限の確認
- JSON Schema形式の検証 
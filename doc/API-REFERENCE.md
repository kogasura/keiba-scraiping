# API リファレンス

## 主要クラス・サービス

### NetkeibaScraper

netkeibaサイトからレース情報とタイム指数を取得するスクレイパークラス。

#### メソッド

##### `init(): Promise<void>`
ブラウザとページの初期化を行います。

##### `login(): Promise<void>`
netkeibaサイトにログインします。環境変数から認証情報を取得。

##### `getRaceList(date: string): Promise<RaceInfo[]>`
指定日のレース一覧を取得します。

**パラメータ:**
- `date`: YYYYMMDD形式の日付文字列

**戻り値:**
- `RaceInfo[]`: レース情報の配列

##### `getTimeIndexMax(raceId: number): Promise<TimeIndex>`
タイム指数（最高値）を取得します。

**パラメータ:**
- `raceId`: netkeibaのレースID

**戻り値:**
- `TimeIndex`: 上位5頭の馬番を含むタイム指数データ

##### `getTimeIndexAverage(raceId: number): Promise<TimeIndex>`
タイム指数（近走平均）を取得します。

##### `getTimeIndexDistance(raceId: number): Promise<TimeIndex>`
タイム指数（当該距離）を取得します。

##### `getDataAnalysis(raceId: number): Promise<NetkeibaDataAnalysis>`
データ分析（偏差値、急上昇、自己ベスト）を取得します。

##### `getDataAnalysisRanking(raceId: number): Promise<NetkeibaDataAnalysisSimple>`
データ分析ランキングを取得します。

##### `getCPPrediction(raceId: number): Promise<NetkeibaCPPrediction>`
CP予想データを取得します。

##### `close(): Promise<void>`
ブラウザを閉じてリソースを解放します。

---

### WinkeibaScraperService

WIN競馬サイトから新聞印情報と分析データを取得するスクレイパークラス。

#### メソッド

##### `init(): Promise<void>`
ブラウザとページの初期化を行います。

##### `login(): Promise<boolean>`
WIN競馬サイトにログインします。

**戻り値:**
- `boolean`: ログイン成功時は`true`

##### `getRaceList(date: string, trackCodes: string[]): Promise<WinkeibaRaceInfo[]>`
指定日・競馬場のレース一覧を取得します。

**パラメータ:**
- `date`: YYYYMMDD形式の日付文字列
- `trackCodes`: 競馬場コードの配列

##### `getRaceMarks(date: string, trackCode: string, raceNum: string): Promise<HorseMarkArray>`
新聞印情報を取得します。

**パラメータ:**
- `date`: 日付
- `trackCode`: 競馬場コード
- `raceNum`: レース番号

**戻り値:**
- `HorseMarkArray`: 各馬の印情報（◎○▲△）

##### `getAnalysisData(date: string, trackCode: string, raceNum: string): Promise<AnalysisData>`
分析データ（タイム、上がり3F、馬場特性）を取得します。

##### `getRaceResults(date: string, trackCode: string): Promise<RaceResult[]>`
レース結果を取得します。

##### `close(): Promise<void>`
ブラウザを閉じてリソースを解放します。

---

### UmaxScraperService

UMA-Xサイトから各種指数データを取得するスクレイパークラス。

#### メソッド

##### `init(): Promise<void>`
ブラウザとページの初期化を行います。

##### `getRacePredictionByDate(date: string): Promise<UmaxRacePrediction[]>`
指定日のUMA-X予想データを取得します。

**パラメータ:**
- `date`: YYYYMMDD形式の日付文字列

**戻り値:**
- `UmaxRacePrediction[]`: UMA-X予想データの配列

##### `close(): Promise<void>`
ブラウザを閉じてリソースを解放します。

---

### ScrapingApiClient

Laravel API へスクレイピング結果を送信するクライアント。`src/scraping-api-client.ts` に実装されています。送信ペイロード型は `src/type/scraping-api-types.d.ts` を参照してください。

#### 主な役割
- レース編成情報・予想結果・AI指数・指数画像・レース結果を Laravel 側にまとめて POST する
- 共通ヘッダとして `Content-Type: application/json` と `X-API-KEY`（認証キー）を付与
- POST 成功時は `ApiSuccessResponse`（`{ success: true, saved_count: number }`）を返却

#### 環境変数依存
- `LARAVEL_API_BASE_URL`: ベース URL (例: `http://localhost:8000`) 未設定時は `http://localhost:80`
- `LARAVEL_API_KEY`: 認証キー（Laravel 側で検証）

#### メソッド

##### `sendRaceInfo(payload: RaceInfoRequest): Promise<ApiSuccessResponse>`
当日のレース編成情報を送信します。

##### `sendPredictions(payload: PredictionsRequest): Promise<ApiSuccessResponse>`
各種指数・予想ランキングを送信します。

##### `sendAiIndex(payload: AiIndexRequest): Promise<ApiSuccessResponse>`
AI 予想指数を送信します。

##### `sendIndexImages(payload: IndexImagesRequest): Promise<ApiSuccessResponse>`
指数画像 URL と解析結果を送信します。

##### `sendRaceResults(payload: RaceResultsRequest): Promise<ApiSuccessResponse>`
確定したレース結果と払戻情報を送信します。

---

## 画像解析関数

### h58_ai.ts

#### `fetchImagesFromNote(url: string, date: string, trackCode: string): Promise<string[]>`
noteページから画像を取得して保存します。

**パラメータ:**
- `url`: noteページのURL
- `date`: 日付（YYYYMMDD）
- `trackCode`: 競馬場コード

**戻り値:**
- `string[]`: 保存した画像ファイルパスの配列

#### `processImage(originalImagePath: string): Promise<string>`
元画像を切り取り・結合して新たな画像を作成します。

**パラメータ:**
- `originalImagePath`: 元画像のパス

**戻り値:**
- `string`: 処理後の画像パス

#### `extractTextFromImages(imagePaths: string[]): Promise<NoteAI[]>`
画像からOCRを使ってテキストを取得します。

**パラメータ:**
- `imagePaths`: 元画像のパス配列

**戻り値:**
- `NoteAI[]`: AI予想データの配列

---

### note-image-ocr.ts

#### `extractIndexRanksFromImage(imagePath: string, date: string, trackCode: string, raceNumber: string): Promise<NoteImageOCRResponse>`
note画像から指数ランクを抽出します。

**パラメータ:**
- `imagePath`: 画像ファイルパス
- `date`: 日付
- `trackCode`: 競馬場コード
- `raceNumber`: レース番号

**戻り値:**
- `NoteImageOCRResponse`: 指数期待度と馬の順位情報

---

## ユーティリティ関数

### excel-utils.ts

#### `saveAnalysisToExcel(analysis: AnalysisItem[], filename: string): void`
統合分析データをExcelファイルに保存します。

**パラメータ:**
- `analysis`: 分析データの配列
- `filename`: 保存ファイル名

### umax-excel-utils.ts

#### `saveUmaxPredictionsToExcel(predictions: UmaxRacePrediction[], filename: string): void`
UMA-X予想データをExcelファイルに保存します。競馬場コード順でソートされます。

**パラメータ:**
- `predictions`: UMA-X予想データの配列
- `filename`: 保存ファイル名

### formatter-utils.ts

#### `generateWinPredictionRanking(marks: HorseMarks[]): object`
新聞印情報から予想ランキングを生成します。

#### `generateTimeRanking(analysisData: AnalysisData): object`
分析データからタイムランキングを生成します。

#### `generateLast3FRanking(analysisData: AnalysisData): object`
分析データから上がり3Fランキングを生成します。

#### `generateHorseTraitRanking(analysisData: AnalysisData): object`
分析データから馬場特性ランキングを生成します。

### utils.ts

#### `formatDate(date: Date): string`
日付をYYYYMMDD形式の文字列に変換します。

#### `randomDelay(min: number, max: number): Promise<void>`
指定範囲内のランダムな時間待機します。

#### `saveToJson(data: any, filename: string): void`
データをJSONファイルに保存します。

#### `saveToExcel(data: any[], filename: string): void`
データをExcelファイルに保存します。

### playwright-utils.ts

#### `initBrowser(): Promise<{browser: Browser, context: BrowserContext, page: Page}>`
Playwrightブラウザを初期化します。

#### `ensureDirectoryExists(dirPath: string): void`
ディレクトリが存在しない場合は作成します。

---

## 定数・設定

### consts.ts

#### `TRACK_CODES`
競馬場コードの定数オブジェクト。

#### `TRACK_SORT_ORDER`
競馬場のソート順序を定義する配列。

#### `compareTrackCode(a: string, b: string): number`
競馬場コードの比較関数。

#### `getTrackName(code: string): string`
競馬場コードから競馬場名を取得します。

#### `getTrackCode(name: string): string`
競馬場名から競馬場コードを取得します。

---

## エラーハンドリング

### 共通エラー処理
- ネットワークエラー: 自動リトライ機能
- ログインエラー: 詳細ログ出力
- データ解析エラー: スキップして次の処理継続

### OCRエラー処理
- 画像読み込み失敗: 元画像を使用
- 文字認識失敗: 信頼度99で記録
- JSON解析失敗: エラーログ出力

---

## 環境変数

### 必須環境変数
```
OPENAI_API_KEY        # OpenAI APIキー
WIN_KEIBA_USER        # WIN競馬ユーザー名
WIN_KEIBA_PASS        # WIN競馬パスワード
NETKEIBA_USER         # netkeibaユーザー名
NETKEIBA_PASS         # netkeibaパスワード
LARAVEL_API_BASE_URL  # Laravel API ベース URL（例: http://localhost:8000）
LARAVEL_API_KEY       # Laravel API 認証キー
```

### オプション環境変数
```
BROWSER_HEADLESS      # ブラウザのヘッドレスモード（デフォルト: true）
REQUEST_DELAY_MIN     # リクエスト間隔最小値（ミリ秒）
REQUEST_DELAY_MAX     # リクエスト間隔最大値（ミリ秒）
``` 
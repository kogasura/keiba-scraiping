# Netkeiba Scraper v2 システム

## 概要

このプロジェクトは、競馬情報サイト（Netkeiba、Winkeiba、UMAX）から競馬データを自動収集し、Laravel APIに送信するスクレイピングシステムです。

## アーキテクチャ

### v1 (レガシー)
- `src/` - 元の実装
- モノリシックな構造
- 大きなAnalysisItem型を使用

### v2 (新実装)
- `src/v2/` - 新しいアーキテクチャ
- 関心の分離を実現
- API別に特化した型定義
- テスト可能な設計

## v2 システム構成

```
src/v2/
├── api/           # API通信層
│   ├── client.ts  # APIクライアント
│   └── endpoints/ # API別エンドポイント
├── cli/           # CLI実行層
├── mappers/       # データ変換層
├── scrapers/      # スクレイピング層
│   ├── base/      # 基盤スクレイパー
│   └── */         # 機能別スクレイパー
├── services/      # ビジネスロジック層
├── types/         # 型定義
└── utils/         # ユーティリティ
```

## 対応API一覧

### 1. Race Info API (`/api/v1/race-info`)
- **目的**: レース基本情報と出馬表の送信
- **データ源**: Netkeiba
- **実装状況**: ✅ 完全実装・テスト済み

### 2. Predictions API (`/api/v1/predictions`)
- **目的**: 予想データの送信
- **データ源**: Netkeiba (CP予想、データ分析、タイム指数)
- **実装状況**: ✅ 実装済み・データ形式修正済み

### 3. AI Index API (`/api/v1/ai-index`)
- **目的**: AI指数データの送信
- **データ源**: Note (OCR処理)
- **実装状況**: ✅ 実装済み

### 4. Index Images API (`/api/v1/index-images`)
- **目的**: 指数画像データの送信
- **データ源**: Note (OCR処理)
- **実装状況**: ✅ 実装済み

### 5. Race Results API (`/api/v1/race-results`)
- **目的**: レース結果データの送信
- **データ源**: Winkeiba
- **実装状況**: ✅ 完全実装・テスト済み

## 使用方法

### 基本コマンド

```bash
# v2システムの実行
ts-node src/v2/cli/main.ts <日付> [オプション]

# 例: レース情報＋予想情報取得（デフォルト）
ts-node src/v2/cli/main.ts 20250125

# 例: レース情報のみ取得
ts-node src/v2/cli/main.ts 20250125 --apis race-info

# 例: 予想情報のみ取得
ts-node src/v2/cli/main.ts 20250125 --apis predictions

# 例: レース結果取得
ts-node src/v2/cli/main.ts 20250125 --apis race-results

# 例: 特定競馬場のみ
ts-node src/v2/cli/main.ts 20250125 --tracks 06,10
```

### API種別

- `race-info`: レース基本情報
- `predictions`: 予想情報
- `ai-index`: AI指数
- `index-images`: 指数画像
- `race-results`: レース結果

### 競馬場コード

- `01`: 札幌
- `02`: 函館
- `03`: 福島
- `04`: 新潟
- `05`: 東京
- `06`: 中山
- `07`: 中京
- `08`: 京都
- `09`: 阪神
- `10`: 小倉

### 日付形式

- `YYYYMMDD` (例: `20250125`)

## 環境変数

```env
# Netkeiba認証情報
NETKEIBA_USERNAME=your_username
NETKEIBA_PASSWORD=your_password

# Winkeiba認証情報（レース結果取得時に必要）
WINKEIBA_USERNAME=your_username  # または WINKEIBA_EMAIL
WINKEIBA_PASSWORD=your_password

# API接続設定
API_BASE_URL=http://localhost
API_KEY=your_api_key

# OCR設定（AI指数・指数画像用）
DEEPSEEK_API_KEY=your_deepseek_api_key
```

## 実行例

### 1. レース情報の取得と送信

```bash
# 2025年1月25日の小倉競馬場のレース情報を取得・送信
ts-node src/v2/cli/main.ts 20250125 --apis race-info --tracks 10

# 実行結果例:
# [INFO] レース情報API実行開始: 20250125
# [INFO] レース情報スクレイピング: 10
# [INFO] レース一覧を取得しました: 12件
# [INFO] スクレイピング完了: 12件
# [INFO] API送信データ: 1件
# [SUCCESS] API送信成功: 10
```

### 2. 複数競馬場の一括処理

```bash
# 複数競馬場を指定（カンマ区切り）
ts-node src/v2/cli/main.ts 20250125 --apis race-info --tracks 06,07,10
```

### 3. 予想情報の取得

```bash
# 予想情報を取得（時間がかかる場合があります）
ts-node src/v2/cli/main.ts 20250125 --apis predictions --tracks 10
```

## トラブルシューティング

### よくある問題

1. **ログイン失敗**
   - 環境変数が正しく設定されているか確認
   - Netkeiba/Winkeibaのアカウント情報を確認

2. **スクレイピング失敗**
   - 対象日付にレースが開催されているか確認
   - サイトの構造変更の可能性

3. **API送信エラー**
   - API_BASE_URLとAPI_KEYが正しく設定されているか確認
   - Laravel API側の動作状況を確認

### デバッグ方法

```bash
# ログレベルを詳細に設定
DEBUG=* ts-node src/v2/cli/main.ts 20250125 --apis race-info --tracks 10
```

## 開発情報

### 型定義の参照

- メインAPI型: `src/v2/types/api.ts`
- スクレイピング型: `src/v2/types/scraping.ts`
- Laravel API型: `src/type/scraping-api-types.d.ts`

### テストコマンド

```bash
# TypeScript型チェック
npx tsc --noEmit --skipLibCheck

# 特定ファイルのコンパイルチェック
npx tsc --noEmit --skipLibCheck src/v2/services/race-info.ts
```

### 新しいAPIの追加手順

1. `src/v2/scrapers/[api-name]/scraper.ts` - スクレイパー作成
2. `src/v2/mappers/[api-name].ts` - マッパー作成
3. `src/v2/services/[api-name].ts` - サービス作成
4. `src/v2/cli/main.ts` - CLI処理追加
5. 型定義の更新

## パフォーマンス

- **race-info**: 約30-60秒（12レース）
- **predictions**: 約3-5分（多数のデータ取得が必要）
- **ai-index**: 約1-2分（OCR処理含む）
- **index-images**: 約1-2分（OCR処理含む）
- **race-results**: 約30-60秒（12レース）

## 注意事項

1. **レート制限**: 各サイトへの過度なアクセスを避けるため、適切な間隔を設けています
2. **データ整合性**: race-resultsはrace-infoが事前に送信されている必要があります
3. **環境依存**: Playwright要件のため、適切なブラウザ環境が必要です

## 既知の問題

### Predictions API バリデーションエラー（2025-08-03）

**問題**: predictions APIでバリデーションエラーが発生
- `validation.min.numeric`: 数値フィールドに0またはnull値が含まれている
- `validation.size.array`: 配列サイズが期待値と異なる

**影響フィールド**:
- `cp_ranks`: 4要素固定、各要素は1以上の数値
- `time_index_max_ranks`: 5要素固定、各要素は1以上の数値  
- `time_index_avg_ranks`: 5要素固定、各要素は1以上の数値
- `time_index_distance_ranks`: 5要素固定、各要素は1以上の数値
- `personal_best_ranks`: 配列サイズの制約あり

**対応方針**: 
- フロントエンド側で0値による埋め込み対応を実装（データなしを表す）
- バックエンド側で0値を許可するようバリデーション要件を調整する予定

**データ埋め込みルール**:
- 固定長配列で不足分が発生した場合は`PADDING_VALUES.NO_DATA_HORSE_NUMBER`（0）で埋める
- この値は「データなし/該当なし」を表す専用の定数として管理
- 0は競馬において「該当なし」を意味する自然な値
- 定数は `src/v2/mappers/predictions.ts` で一元管理

**デバッグ支援**: API送信時のHTTPリクエスト内容を`debug/`フォルダに自動保存する機能を追加

## 自動実行システム

### Windowsタスクスケジューラー

システムは以下のシンプルな構成で自動実行されます：

```
scripts/
└── scheduler-runner-simple.ps1    # メイン実行スクリプト

config/
└── execution-schedule.json        # 実行スケジュール設定
```

### セットアップ

```powershell
# 週末の対象時間帯のみ2時間おきに実行するタスクを作成
$action = New-ScheduledTaskAction -Execute "PowerShell.exe" -Argument "-ExecutionPolicy Bypass -File `"C:\Users\大久保勇輝\Kaihatu\netkeiba\playwright-test\scripts\scheduler-runner-simple.ps1`""

# 複数のトリガーを作成（金曜・土曜・日曜の16時から20時まで2時間おき）
$triggers = @()
$triggers += New-ScheduledTaskTrigger -Weekly -DaysOfWeek Friday -At 16:00
$triggers += New-ScheduledTaskTrigger -Weekly -DaysOfWeek Friday -At 18:00
$triggers += New-ScheduledTaskTrigger -Weekly -DaysOfWeek Friday -At 20:00
$triggers += New-ScheduledTaskTrigger -Weekly -DaysOfWeek Saturday -At 16:00
$triggers += New-ScheduledTaskTrigger -Weekly -DaysOfWeek Saturday -At 18:00
$triggers += New-ScheduledTaskTrigger -Weekly -DaysOfWeek Saturday -At 20:00
$triggers += New-ScheduledTaskTrigger -Weekly -DaysOfWeek Sunday -At 16:00
$triggers += New-ScheduledTaskTrigger -Weekly -DaysOfWeek Sunday -At 18:00
$triggers += New-ScheduledTaskTrigger -Weekly -DaysOfWeek Sunday -At 20:00

$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive
Register-ScheduledTask -TaskName "NetkeibaScraper_Runner" -Action $action -Trigger $triggers -Settings $settings -Principal $principal
```

### 実行スケジュール

**自動実行**: 週末の16時、18時、20時に実行（2時間おき）
- **金曜18時**: 土曜分の race-info + predictions
- **土曜18時**: 日曜分の race-info + predictions、土曜分の race-results
- **日曜18時**: 日曜分の race-results
- **手動実行**: 必要に応じて

### 手動実行

```powershell
# 個別API実行
.\scripts\scheduler-runner-simple.ps1 -Schedule "manual_race_info" -VerboseOutput
.\scripts\scheduler-runner-simple.ps1 -Schedule "manual_predictions" -VerboseOutput
.\scripts\scheduler-runner-simple.ps1 -Schedule "manual_race_results" -VerboseOutput

# 特定の日付で実行
.\scripts\scheduler-runner-simple.ps1 -Schedule "manual_race_info" -Date "20250125" -VerboseOutput
```

## 開発方針

**シンプルさと保守性を最優先**
- 未使用・複雑な機能は削除
- 要件を満たす最小限の実装
- 設定ファイルベースの管理
- 明確なログ出力

**コード品質**
- 型安全性の確保
- エラーハンドリングの徹底
- テスト可能な設計
- 関心の分離

## 今後の拡張予定

- [ ] より多くの競馬場対応
- [ ] リアルタイム実行機能
- [ ] エラー自動復旧機能
- [ ] 統計レポート機能
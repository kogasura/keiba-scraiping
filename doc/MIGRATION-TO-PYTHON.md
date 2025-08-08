# Python 版への完全移行ガイド

> **目的**  
> 本書は既存 TypeScript/Node.js プロジェクトを *Python 3.11+* に移植するための決定版ドキュメントです。AI あるいは開発者が本書だけを読めば、機能同等かつ保守性の高い Python 実装を構築できるレベルの情報を提供します。

---

## 0. 概要

| 項目 | 現行 (TypeScript) | 移行後 (Python) |
|------|-----------------------|---------------------------|
| 言語 / ランタイム | TypeScript 4.9 / Node.js 18 | Python 3.11 (async/await) |
| スクレイピング | Playwright 1.40 | playwright-python (同バージョン) |
| 画像処理 | Sharp | Pillow (PIL) + numpy, もしくは *pyvips* |
| OCR / Vision API | OpenAI 4.x JS SDK | openai>=1.30.0 (Python SDK) |
| Excel出力 | SheetJS (xlsx) | *openpyxl* / *xlsxwriter* / *pandas* |
| 環境変数 | dotenv | python-dotenv |
| ロギング | console.xxx | logging, loguru |
| パッケージ管理 | npm / package.json | poetry / pyproject.toml |
| テスト | なし（ts-node 実行） | pytest + pytest-asyncio |

---

## 1. ディレクトリ構成 (推奨)

```
project_root/
├─ app/                       # Python アプリケーション本体
│  ├─ __init__.py
│  ├─ cli.py                  # エントリポイント (旧 cli-index.ts)
│  ├─ core/                   # ドメイン層
│  │  ├─ models.py            # pydantic BaseModel で型定義 (旧 types.ts)
│  │  ├─ constants.py         # TRACK_CODES 等 (旧 consts.ts)
│  │  ├─ formatter.py         # 旧 formatter-utils.ts
│  │  └─ utils.py             # 共通ユーティリティ
│  ├─ scrapers/               # スクレイパ群
│  │  ├─ netkeiba.py          # NetkeibaScraper
│  │  ├─ winkeiba.py          # WinkeibaScraperService
│  │  ├─ umax.py              # UmaxScraperService
│  │  └─ note_ai.py           # H58_AI OCR
│  ├─ services/               # アプリケーションサービス層
│  │  └─ integration.py       # データ統合エンジン
│  ├─ adapters/               # 外部サービス適合層 (OpenAI, S3 等)
│  ├─ jobs/                   # cron 等で呼び出すバッチ
│  └─ settings.py             # pydantic Settings 管理
├─ data/                      # JSON / Excel / 画像
├─ tests/                     # pytest テスト
├─ docs/                      # ドキュメント (本ファイル含む)
├─ pyproject.toml             # poetry 定義
└─ README.md                  # プロジェクトトップ
```

### DDD ライトウェイト構成
- **core** に純粋なドメインロジック／型宣言を集約
- **scrapers** は I/O 境界。Playwright と外部 API 呼び出しのみを担当
- **services** は core と scrapers をオーケストレーションしビジネス価値を提供
- **adapters** は外部システムとの接続（S3、メールなど）を抽象化

---

## 2. パッケージ選定理由と実装ポイント

### 2.1 Playwright for Python
```bash
pip install playwright==1.40.0
playwright install chromium --with-deps
```
- **非同期 API** が提供されるため `asyncio` ベースで実装する
- TypeScript 版の `page.goto(url, { waitUntil: 'domcontentloaded' })` は Python では
  ```python
  await page.goto(url, wait_until="domcontentloaded")
  ```

### 2.2 Pillow / numpy への置き換え
- `sharp.extract({ left, top, width, height })` →
  ```python
  from PIL import Image
  with Image.open(path) as im:
      crop = im.crop((left, top, left+width, top+height))
  ```
- 結合は `Image.new('RGB', size)` + `paste()`
- 高速化したい場合は *pyvips* を検討（libvips の Python バインディング）

### 2.3 OpenAI Vision API 呼び出し
```python
import openai, base64
client = openai.OpenAI()
resp = client.chat.completions.create(
    model="gpt-4o-mini",  # 例
    messages=[
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": [
            {"type": "text", "text": USER_TEXT},
            {"type": "image_url", "image_url": f"data:image/jpeg;base64,{b64}"}
        ]}
    ],
    response_format={"type": "json_schema", "schema": HORSE_MARK_SCHEMA}
)
```
- *json_schema* フォーマットを維持することで TypeScript 版と同等のバリデーションを実現

### 2.4 Excel 生成
- `pandas` + `openpyxl` (可読性重視) もしくは `xlsxwriter` (性能重視)
- 例：
  ```python
  import pandas as pd
  df = pd.DataFrame(rows)
  df.to_excel(path, sheet_name="UMAX予想", index=False)
  ```

### 2.5 型定義
- **pydantic v2** の `BaseModel` を使用して JSON シリアライズ／バリデーションを統一
- 既存の `interface AnalysisItem` は下記のように移植
  ```python
  class AnalysisItem(BaseModel):
      date: str
      track_code: str
      race_number: int
      # ... 以下同様 (Optional[int] や list[int] へ変換)
  ```

### 2.6 ロギング
```python
import logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[
        logging.FileHandler("logs/app.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)
```
- `logger.info`, `logger.error` を全層で使用

### 2.7 非同期設計
- **async/await** を全面採用し、I/O 待ちを効率化
- `asyncio.Semaphore` で同時ブラウザインスタンス数を制限

---

## 3. 既存コードとの対応表

| TypeScript ファイル | 主なクラス/関数 | Python 置き換えモジュール | 補足 |
|--------------------|-----------------|---------------------------|------|
| `cli-index.ts` | `main` | `app/cli.py` | Typer で CLI 実装推奨 |
| `netkeiba-scraper.ts` | `NetkeibaScraper` | `scrapers/netkeiba.py` | playwright 同等 API |
| `winkeiba-scraper.ts` | `WinkeibaScraperService` | `scrapers/winkeiba.py` | セッション管理を `async with` で |
| `umax-scraper.ts` | `UmaxScraperService` | `scrapers/umax.py` | 〃 |
| `h58_ai.ts` | OCR 関数群 | `scrapers/note_ai.py` | Pillow + openai |
| `umax-excel-utils.ts` | Excel出力 | `core/exporters.py` | pandas/openpyxl |
| `excel-utils.ts` | Excel出力 | `core/exporters.py` | 共通化 |
| `formatter-utils.ts` | ランキング生成 | `core/formatter.py` | pandas で容易化 |
| `playwright-utlis.ts` | ブラウザ init | `scrapers/_browser.py` | async contextmanager |
| `utils.ts` | 汎用関数 | `core/utils.py` | datetime, random, json |

---

## 4. ステップバイステップ移行手順

### Step 1: Python プロジェクト初期化
```bash
poetry new my-horseracing-ai
cd my-horseracing-ai
poetry add playwright openai pillow python-dotenv pandas openpyxl typer loguru pydantic pytest pytest-asyncio
playwright install chromium --with-deps
```

### Step 2: 型モデルの移植
1. `src/types.ts` を参照し `app/core/models.py` を作成
2. `interface` → `class xxx(BaseModel)` に機械変換 (AI ツール可)
3. フィールド名を `snake_case` に統一 (`raceNumber` → `race_number`)

### Step 3: 定数・ユーティリティ移植
- `consts.ts` → `constants.py`
- `TRACK_CODES`, `compare_track_code`, `get_track_name` を関数化

### Step 4: スクレイパー移植
- 1 ファイルずつ Playwright Python API に書き換え
- 共通ブラウザインスタンス (`async with init_browser() as page:`) をユーティリティ化

### Step 5: 画像処理 + OCR
- `sharp` 特有の API を Pillow で再現
- Base64 変換は `base64.b64encode(bytes)`

### Step 6: データ統合サービス
- `integration.py` にオーケストレーション層を実装
- インターフェースは既存 `cli-index.ts` の流れと 1:1 対応

### Step 7: CLI 実装
- `Typer` ライブラリで `python -m app.cli --date 20250614` の形式を実現

### Step 8: テストと検証
- `pytest -q` で単体テスト実行
- `pytest --asyncio-mode=auto` で非同期テスト

### Step 9: ドキュメント更新
- 本ファイルを `docs` ルートに配置
- `README.md` の使用方法を Python 版に差し替え

---

## 5. サンプルコードスニペット

### 5.1 ブラウザインスタンス (Python)
```python
from contextlib import asynccontextmanager
from playwright.async_api import async_playwright, Browser, Page

@asynccontextmanager
async def init_browser(headless: bool = True):
    async with async_playwright() as p:
        browser: Browser = await p.chromium.launch(headless=headless)
        context = await browser.new_context()
        page: Page = await context.new_page()
        try:
            yield page
        finally:
            await context.close()
            await browser.close()
```

### 5.2 OCR 呼び出し
```python
import base64, asyncio, openai
from pathlib import Path

async def ocr_horse_marks(image_path: Path):
    b64 = base64.b64encode(image_path.read_bytes()).decode()
    client = openai.AsyncOpenAI()
    resp = await client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": USER_CONTENT(b64)}
        ],
        response_format={"type": "json_schema", "schema": HORSE_MARK_SCHEMA}
    )
    return resp.choices[0].message.content
```

### 5.3 Excel 出力 (pandas)
```python
import pandas as pd
from pathlib import Path

def save_umax_predictions(preds: list[UmaxRacePrediction], file_path: Path):
    # TRACK_SORT_ORDER でソート
    preds_sorted = sorted(preds, key=lambda p: TRACK_SORT_ORDER.index(p.track_code))
    rows = [p.model_dump() for p in preds_sorted]
    df = pd.DataFrame(rows)
    df.to_excel(file_path, sheet_name="UMAX予想", index=False)
```

---

## 6. 品質保証チェックリスト

- [ ] 型厳密性: *pydantic* による全 I/O バリデーション
- [ ] 非同期安全性: すべての I/O を `async` 化し `await` 忘れなし
- [ ] 競馬場コード順: `compare_track_code` に統一
- [ ] ログ出力: 重要イベント・エラー時に context 付きログ
- [ ] 例外設計: `CustomError` ツリーで捕捉・再スロー
- [ ] 冪等性: 失敗時に再実行しても重複データなし
- [ ] 依存性: `poetry.lock` でピン留め
- [ ] CI: `pytest` + `ruff` + `mypy`

---

## 7. 参考リンク
- Playwright Python Docs: https://playwright.dev/python
- Pillow Handbook: https://pillow.readthedocs.io
- OpenAI Python SDK: https://github.com/openai/openai-python
- pandas Excel I/O: https://pandas.pydata.org/docs/user_guide/io.html#excel-files
- pydantic v2 Docs: https://docs.pydantic.dev

---

### ❤️ これで移行準備は万全です。
AI もしくは開発者は本ドキュメントと既存ドメイン知識だけで TypeScript 版から Python 版への移植を完了できます。 
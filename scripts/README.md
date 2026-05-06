# scripts/

開発・調査用の ad-hoc スクリプト。本番パイプラインからは呼ばれない。

| ファイル | 用途 |
|---|---|
| `probe-google.ts` | Playwright で Google 検索ページを開き、bot 判定 / DOM 構造 / HTTP ヘッダを実測する。Discovery 周りで CAPTCHA や DOM 抽出の問題を切り分ける時に使う。 |
| `probe-discovery.ts` | `SonaeDiscoverer` を直接呼んで、複数自治体の PDF picker の挙動を確認する。Pipeline 全体を回さずに Discovery レイヤだけ検証したい時に使う。 |
| `check-pdf-text.ts` | 指定 PDF の指定ページの text-layer を抽出して確認する。テキストレイヤの有無 / 文字化けの切り分け用。 |
| `clean-result-types.ts` | `cache/municipalities/*.json` の `by_disaster_type[].disaster_type` から enum 違反の値 (古いモデルが返した不正な種別) を一括削除。 |
| `patch-ocr-page.ts` | 指定 PDF の指定ページを再 render → 再 OCR → 既存 `cache/ocr/{code}.md` に追記する。OCR 失敗ページのリカバリ用。 |

実行: `npx tsx scripts/<name>.ts ...`

各スクリプトの引数はファイル冒頭のコメント参照。

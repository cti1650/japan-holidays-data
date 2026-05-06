# Japan Holidays Data

日本の祝日データをUTF-8形式のCSVとJSONで提供するリポジトリです。

## データ配信

GitHub Pagesでホスティングされています。

### ダウンロードページ

https://cti1650.github.io/japan-holidays-data/

### 直リンク

| 形式 | URL |
|------|-----|
| CSV (UTF-8 BOM) | `https://cti1650.github.io/japan-holidays-data/holidays.csv` |
| JSON | `https://cti1650.github.io/japan-holidays-data/holidays.json` |
| CSV (ISO 8601日付) | `https://cti1650.github.io/japan-holidays-data/holidays-iso.csv` |
| JSON (ISO 8601日付) | `https://cti1650.github.io/japan-holidays-data/holidays-iso.json` |
| iCal (全データ) | `https://cti1650.github.io/japan-holidays-data/holidays.ics` |
| iCal (直近±2年) | `https://cti1650.github.io/japan-holidays-data/holidays-recent.ics` |
| Atom (更新履歴) | `https://cti1650.github.io/japan-holidays-data/feed.xml` |

iCalのURLはGoogleカレンダー / Appleカレンダー等の「URLでカレンダーを購読」機能にそのまま貼り付けて利用できます。

## データ形式

### CSV

```csv
国民の祝日・休日月日,国民の祝日・休日名称
1955/1/1,元日
1955/1/15,成人の日
```

### JSON

```json
[
  { "date": "1955/1/1", "name": "元日" },
  { "date": "1955/1/15", "name": "成人の日" }
]
```

### ISO 8601 日付版

`holidays-iso.csv` / `holidays-iso.json` は、日付を ISO 8601 形式 (`YYYY-MM-DD`) にした派生ファイルです。プログラムでのパース・ソートが容易で、国際標準にも準拠します。

```csv
国民の祝日・休日月日,国民の祝日・休日名称
1955-01-01,元日
1955-01-15,成人の日
```

```json
[
  { "date": "1955-01-01", "name": "元日" },
  { "date": "1955-01-15", "name": "成人の日" }
]
```

### iCal

RFC 5545 準拠の `VCALENDAR`。各祝日は `VALUE=DATE` の終日イベントとして出力されます。

- `holidays.ics` — 全データ
- `holidays-recent.ics` — 実行時の現在年±2年（計5年分）

### Atom フィード

`feed.xml` は更新履歴を Atom 1.0 形式で配信します。各 `entry` には差分検出時のタイムスタンプ・追加/削除/変更された祝日が含まれます。元データは `changes.json` に保持されます。

## 自動更新

GitHub Actionsにより毎週月曜日に内閣府のデータをチェックし、差分があれば自動でPRを作成・マージします。

### フォーマットチェック

更新時に以下のバリデーションを実行し、フォーマットが変更されていた場合はエラーで中止します。

- ヘッダー行が `国民の祝日・休日月日,国民の祝日・休日名称` であること
- 日付が `YYYY/M/D` 形式であること

## データソース

[内閣府「国民の祝日」について](https://www8.cao.go.jp/chosei/shukujitsu/gaiyou.html)

## ローカル開発

```bash
# 依存関係のインストール
npm install

# データの取得・変換
npm run fetch
```

## セットアップ手順

1. このリポジトリをフォークまたはクローン
2. GitHub Pagesを有効化（Settings > Pages > Source: GitHub Actions）
3. リポジトリ設定でAuto-mergeを有効化（Settings > General > Allow auto-merge）

## ライセンス

MIT

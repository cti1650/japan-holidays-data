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

GitHub Actionsにより毎週月曜日に内閣府のデータをチェックし、差分があれば自動でPRを作成・マージし、GitHub Pagesへデプロイします。

### 依存関係の自動更新

Dependabotが毎週 npm パッケージと GitHub Actions の更新PRを作成します。minor / patch 更新は CI（型チェック・テスト・取得スクリプトの動作確認）に通れば自動でマージされます（major 更新は手動でレビュー）。

公開リポジトリでは60日間アクティビティがないと schedule 実行が自動で無効化されるため、この定期マージで祝日データ更新の停止を防いでいます。

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

# テスト
npm test
```

## セットアップ手順

1. このリポジトリをフォークまたはクローン
2. GitHub Pagesを有効化（Settings > Pages > Source: GitHub Actions）
3. Actions からのPR作成を許可（Settings > Actions > General > Workflow permissions > Allow GitHub Actions to create and approve pull requests）

## ライセンス

MIT

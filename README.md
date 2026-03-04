# Japan Holidays Data

日本の祝日データをUTF-8形式のCSVとJSONで提供するリポジトリです。

## データ配信

GitHub Pagesでホスティングされています。

### ダウンロードページ

https://YOUR_USERNAME.github.io/japan-holidays-data/

### 直リンク

| 形式 | URL |
|------|-----|
| CSV (UTF-8 BOM) | `https://YOUR_USERNAME.github.io/japan-holidays-data/holidays.csv` |
| JSON | `https://YOUR_USERNAME.github.io/japan-holidays-data/holidays.json` |

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

## 自動更新

GitHub Actionsにより毎週月曜日に内閣府のデータをチェックし、差分があれば自動でPRを作成・マージします。

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

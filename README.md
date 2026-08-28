# ぷよ連鎖シミュレーター

スマホのタップ操作で盤面を作り、ぷよぷよの連鎖を確認できる依存なしの静的Webアプリです。

## ローカル確認

ブラウザで `index.html` を開くか、任意の静的ファイルサーバーから配信してください。

ロジックテスト:

```sh
npm test
```

## GitHub Pages

`main` ブランチへ push すると `.github/workflows/deploy.yml` が自動デプロイします。初回のみ GitHub リポジトリの Settings → Pages で Source を **GitHub Actions** にしてください。

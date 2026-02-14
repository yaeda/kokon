# KOKON

KOKON is a simple SPA to support a word-guessing game. It loads word data from a Google Sheets CSV, lets players answer by typing or optional speech input, and reveals items on correct answers.

KOKON は古今東西ゲームを補助するためのシンプルな SPA です。
Google スプレッドシートの CSV を読み込み、タイピング中心 + 任意の音声入力で回答します。
正解すると単語と画像が表示され、正解行へスクロール・ハイライトされます。

## Features

- Load words from Google Sheets (CSV export)
- Typing-first UX with optional speech recognition (space to hold)
- Correct/incorrect sounds and highlight + scroll on success
- Options drawer for settings

## Requirements

- Node.js 22
- npm

## Setup

```bash
npm install
```

## Development

```bash
npm run dev
```

## Build

```bash
npm run build
```

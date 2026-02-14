import { atom } from "jotai";
import { getSpeechRecognitionStatic } from "../lib/speech";
import {
  buildSpreadsheetCsvUrl,
  parseSpreadsheetCsv
} from "../lib/spreadsheet";
import {
  highlightedIdsAtom,
  isLoadingAtom,
  isTypingOpenAtom,
  lastTranscriptAtom,
  loadErrorAtom,
  onDeviceStatusAtom,
  resultStatusAtom,
  revealedIdsAtom,
  typingValueAtom,
  wordsAtom
} from "./app";

export const loadSpreadsheetAtom = atom(
  null,
  async (_get, set, inputUrl: string) => {
    set(isLoadingAtom, true);
    set(loadErrorAtom, null);

    try {
      const csvUrl = buildSpreadsheetCsvUrl(inputUrl);
      if (!csvUrl) {
        throw new Error("URLを入力してください。");
      }

      const response = await fetch(csvUrl);
      if (!response.ok) {
        throw new Error("スプレッドシートの取得に失敗しました。");
      }

      const text = await response.text();
      const entries = parseSpreadsheetCsv(text);
      if (entries.length === 0) {
        throw new Error("読み込める単語がありません。");
      }

      set(wordsAtom, entries);
      set(revealedIdsAtom, new Set());
      set(highlightedIdsAtom, new Set());
      set(resultStatusAtom, "idle");
    } catch (error) {
      const message = error instanceof Error ? error.message : "読み込みエラー";
      set(loadErrorAtom, message);
    } finally {
      set(isLoadingAtom, false);
    }
  }
);

export const resetAnswersAtom = atom(null, (_get, set) => {
  set(revealedIdsAtom, new Set());
  set(highlightedIdsAtom, new Set());
  set(lastTranscriptAtom, "");
  set(resultStatusAtom, "idle");
});

export const closeTypingOverlayAtom = atom(null, (_get, set) => {
  set(isTypingOpenAtom, false);
  set(typingValueAtom, "");
});

export const prepareOnDeviceAtom = atom(null, async (_get, set) => {
  const speechStatic = getSpeechRecognitionStatic();
  if (!speechStatic?.install) {
    set(onDeviceStatusAtom, "unavailable");
    return;
  }

  set(onDeviceStatusAtom, "installing");
  try {
    const installed = await speechStatic.install({
      langs: ["ja-JP"],
      processLocally: true
    });
    set(onDeviceStatusAtom, installed ? "available" : "unavailable");
  } catch {
    set(onDeviceStatusAtom, "unavailable");
  }
});

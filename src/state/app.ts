import { atom } from "jotai";
import { getSpeechRecognitionConstructor } from "../lib/speech";
import type { WordEntry } from "../lib/spreadsheet";
import { speechEnabledAtom } from "./options";

export type ResultStatus = "idle" | "correct" | "incorrect";
export type OnDeviceStatus =
  | "unknown"
  | "available"
  | "unavailable"
  | "downloading"
  | "installing";

export const wordsAtom = atom<WordEntry[]>([]);
export const revealedIdsAtom = atom<Set<string>>(new Set<string>());
export const highlightedIdsAtom = atom<Set<string>>(new Set<string>());
export const showImagesAtom = atom(true);
export const isOptionsOpenAtom = atom(false);
export const isLoadingAtom = atom(false);
export const loadErrorAtom = atom<string | null>(null);
export const typingValueAtom = atom("");
export const isTypingOpenAtom = atom(false);
export const lastTranscriptAtom = atom("");
export const resultStatusAtom = atom<ResultStatus>("idle");
export const isListeningAtom = atom(false);
export const isPressingAtom = atom(false);
export const onDeviceStatusAtom = atom<OnDeviceStatus>("unknown");
export const speechSupportedAtom = atom(
  Boolean(getSpeechRecognitionConstructor())
);

export const categoriesAtom = atom((get) => {
  const words = get(wordsAtom);
  const grouped = new Map<string, WordEntry[]>();
  for (const word of words) {
    const items = grouped.get(word.category) ?? [];
    items.push(word);
    grouped.set(word.category, items);
  }
  return Array.from(grouped.entries());
});

export const hasAnyImageAtom = atom((get) =>
  get(wordsAtom).some((entry) => Boolean(entry.imageUrl))
);

export const listeningOverlayVisibleAtom = atom((get) => {
  return (
    get(isPressingAtom) &&
    get(speechEnabledAtom) &&
    get(speechSupportedAtom) &&
    get(isTypingOpenAtom) === false
  );
});

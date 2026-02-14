export interface SpeechRecognitionResultLike {
  transcript: string;
  confidence: number;
}

export interface SpeechRecognitionResultListLike {
  [index: number]: SpeechRecognitionResultLike;
  isFinal: boolean;
  length: number;
}

export interface SpeechRecognitionEventLike {
  results: SpeechRecognitionResultListLike[];
  resultIndex: number;
}

export interface SpeechRecognitionErrorEventLike {
  error: string;
  message?: string;
}

export interface SpeechRecognitionLike extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives?: number;
  phrases?: Array<string | SpeechRecognitionPhraseLike>;
  processLocally?: boolean;
  onaudiostart?: (() => void) | null;
  onaudioend?: (() => void) | null;
  onsoundstart?: (() => void) | null;
  onsoundend?: (() => void) | null;
  onspeechstart?: (() => void) | null;
  onspeechend?: (() => void) | null;
  onstart?: (() => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

export type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

export type SpeechRecognitionAvailability =
  | "available"
  | "unavailable"
  | "downloading";

export interface SpeechRecognitionStaticLike {
  available?: (options: {
    langs: string[];
    processLocally?: boolean;
  }) => Promise<SpeechRecognitionAvailability>;
  install?: (options: {
    langs: string[];
    processLocally?: boolean;
  }) => Promise<boolean>;
}

export interface SpeechRecognitionPhraseLike {
  phrase: string;
  boost?: number;
}

export type SpeechRecognitionPhraseConstructor = new (
  phrase: string,
  boost?: number
) => SpeechRecognitionPhraseLike;

interface SpeechRecognitionWindow extends Window {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
  SpeechRecognitionPhrase?: SpeechRecognitionPhraseConstructor;
  webkitSpeechRecognitionPhrase?: SpeechRecognitionPhraseConstructor;
}

export const getSpeechRecognitionConstructor =
  (): SpeechRecognitionConstructor | null => {
    if (typeof window === "undefined") {
      return null;
    }

    const speechWindow = window as SpeechRecognitionWindow;
    return (
      speechWindow.SpeechRecognition ??
      speechWindow.webkitSpeechRecognition ??
      null
    );
  };

export const getSpeechRecognitionStatic =
  (): SpeechRecognitionStaticLike | null => {
    if (typeof window === "undefined") {
      return null;
    }

    const speechWindow = window as SpeechRecognitionWindow &
      SpeechRecognitionStaticLike;
    return speechWindow.SpeechRecognition
      ? (speechWindow.SpeechRecognition as SpeechRecognitionStaticLike)
      : null;
  };

export const applyRecognitionPhrases = (
  recognition: SpeechRecognitionLike,
  phrases: string[]
): void => {
  const uniquePhrases = Array.from(
    new Set(phrases.map((phrase) => phrase.trim()).filter(Boolean))
  );
  if (uniquePhrases.length === 0) {
    return;
  }

  if ("phrases" in recognition) {
    const speechWindow = window as SpeechRecognitionWindow;
    const phraseConstructor =
      speechWindow.SpeechRecognitionPhrase ??
      speechWindow.webkitSpeechRecognitionPhrase ??
      null;

    if (!phraseConstructor) {
      return;
    }

    try {
      recognition.phrases = uniquePhrases.map(
        (phrase) => new phraseConstructor(phrase, 10.0)
      );
    } catch (error) {
      return;
    }
    return;
  }
};

export const extractTranscript = (
  event: SpeechRecognitionEventLike
): string => {
  if (!event.results.length) {
    return "";
  }

  let bestTranscript = "";
  let bestConfidence = -1;
  let hasFinal = false;

  for (const result of event.results) {
    const isFinal = result.isFinal;
    for (let i = 0; i < result.length; i += 1) {
      const candidate = result[i];
      if (!candidate?.transcript) {
        continue;
      }
      const confidence = Number.isFinite(candidate.confidence)
        ? candidate.confidence
        : 0;
      if (isFinal && !hasFinal) {
        bestTranscript = candidate.transcript;
        bestConfidence = confidence;
        hasFinal = true;
        continue;
      }
      if (isFinal === hasFinal && confidence >= bestConfidence) {
        bestTranscript = candidate.transcript;
        bestConfidence = confidence;
      }
    }
  }

  return bestTranscript;
};

import { useAtom, useAtomValue, useSetAtom } from "jotai";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import * as React from "react";
import { useCallback, useEffect, useRef } from "react";
import { flushSync } from "react-dom";
import AppHeader from "./components/AppHeader";
import ListeningOverlay from "./components/ListeningOverlay";
import OptionsDrawer from "./components/OptionsDrawer";
import TypingOverlay from "./components/TypingOverlay";
import WordListSection from "./components/WordListSection";
import type { SpeechRecognitionLike } from "./lib/speech";
import {
  extractTranscript,
  getSpeechRecognitionConstructor,
  getSpeechRecognitionStatic
} from "./lib/speech";
import type { WordEntry } from "./lib/spreadsheet";
import { normalizeReading } from "./lib/spreadsheet";
import { closeTypingOverlayAtom, loadSpreadsheetAtom } from "./state/actions";
import {
  highlightedIdsAtom,
  isListeningAtom,
  isPressingAtom,
  isTypingOpenAtom,
  lastTranscriptAtom,
  loadErrorAtom,
  onDeviceStatusAtom,
  resultStatusAtom,
  revealedIdsAtom,
  typingValueAtom,
  wordsAtom
} from "./state/app";
import { speechEnabledAtom } from "./state/options";
import { spreadsheetUrlAtom } from "./state/spreadsheet";

type ResultTone = "correct" | "correct_again" | "incorrect";
const App = () => {
  const spreadsheetUrl = useAtomValue(spreadsheetUrlAtom);
  const words = useAtomValue(wordsAtom);
  const [revealedIds, setRevealedIds] = useAtom(revealedIdsAtom);
  const [, setHighlightedIds] = useAtom(highlightedIdsAtom);
  const [, setLoadError] = useAtom(loadErrorAtom);
  const isSpeechEnabled = useAtomValue(speechEnabledAtom);
  const [typingValue, setTypingValue] = useAtom(typingValueAtom);
  const [isTypingOpen, setIsTypingOpen] = useAtom(isTypingOpenAtom);
  const [, setLastTranscript] = useAtom(lastTranscriptAtom);
  const setResultStatus = useSetAtom(resultStatusAtom);
  const [isListening, setIsListening] = useAtom(isListeningAtom);
  const [isPressing, setIsPressing] = useAtom(isPressingAtom);
  const [, setOnDeviceStatus] = useAtom(onDeviceStatusAtom);
  const closeTypingOverlay = useSetAtom(closeTypingOverlayAtom);
  const loadSpreadsheet = useSetAtom(loadSpreadsheetAtom);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const lastTranscriptRef = useRef("");
  const lastFinalTranscriptRef = useRef("");
  const correctAudioRef = useRef<HTMLAudioElement | null>(null);
  const correctAgainAudioRef = useRef<HTMLAudioElement | null>(null);
  const incorrectAudioRef = useRef<HTMLAudioElement | null>(null);
  const highlightTimersRef = useRef<Map<string, number>>(new Map());
  const isPressingRef = useRef(false);
  const restartTimerRef = useRef<number | null>(null);
  const typingInputRef = useRef<HTMLInputElement | null>(null);
  const hasAutoLoadedRef = useRef(false);
  const spaceHoldTimerRef = useRef<number | null>(null);
  const spacePressedRef = useRef(false);

  const speechConstructor = getSpeechRecognitionConstructor();
  const isSpeechSupported = Boolean(speechConstructor);

  useEffect(() => {
    const timers = highlightTimersRef.current;
    return () => {
      timers.forEach((timerId) => {
        window.clearTimeout(timerId);
      });
      timers.clear();
    };
  }, []);

  useEffect(() => {
    if (!isTypingOpen) {
      return;
    }

    const focusTimer = window.setTimeout(() => {
      typingInputRef.current?.focus();
    }, 0);

    return () => window.clearTimeout(focusTimer);
  }, [isTypingOpen]);

  useEffect(() => {
    if (!isSpeechEnabled) {
      return;
    }

    const speechStatic = getSpeechRecognitionStatic();
    if (!speechStatic?.available) {
      return;
    }

    speechStatic
      .available({ langs: ["ja-JP"], processLocally: true })
      .then((status) => {
        setOnDeviceStatus(status);
      })
      .catch(() => {
        setOnDeviceStatus("unavailable");
      });
  }, [isSpeechEnabled, setOnDeviceStatus]);

  const playTone = useCallback((tone: ResultTone) => {
    const audioRef =
      tone === "correct"
        ? correctAudioRef
        : tone === "correct_again"
          ? correctAgainAudioRef
          : incorrectAudioRef;
    const src =
      tone === "correct"
        ? "/sounds/correct.mp3"
        : tone === "correct_again"
          ? "/sounds/correct_again.mp3"
          : "/sounds/incorrect.mp3";

    if (!audioRef.current) {
      audioRef.current = new Audio(src);
    }

    audioRef.current.pause();
    audioRef.current.currentTime = 0;
    void audioRef.current.play();
  }, []);

  const revealWords = useCallback(
    (matchedWords: WordEntry[]) => {
      const newlyRevealed = matchedWords.filter(
        (entry) => !revealedIds.has(entry.id)
      );

      setRevealedIds((prev: Set<string>) => {
        const next = new Set(prev);
        matchedWords.forEach((entry) => next.add(entry.id));
        return next;
      });

      const highlightTargets =
        newlyRevealed.length > 0 ? newlyRevealed : matchedWords;

      if (highlightTargets.length > 0) {
        setHighlightedIds((prev: Set<string>) => {
          const next = new Set(prev);
          highlightTargets.forEach((entry) => {
            next.add(entry.id);
            const existingTimer = highlightTimersRef.current.get(entry.id);
            if (existingTimer !== undefined) {
              window.clearTimeout(existingTimer);
            }
            const timerId = window.setTimeout(() => {
              highlightTimersRef.current.delete(entry.id);
              setHighlightedIds((current: Set<string>) => {
                const updated = new Set(current);
                updated.delete(entry.id);
                return updated;
              });
            }, 3000);
            highlightTimersRef.current.set(entry.id, timerId);
          });
          return next;
        });
      }

      const targetId = newlyRevealed[0]?.id ?? matchedWords[0]?.id;
      if (targetId) {
        window.setTimeout(() => {
          const target = document.getElementById(`word-row-${targetId}`);
          target?.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 0);
      }
    },
    [revealedIds, setHighlightedIds, setRevealedIds]
  );

  useEffect(() => {
    if (isTypingOpen) {
      return;
    }
    spacePressedRef.current = false;
    if (spaceHoldTimerRef.current !== null) {
      window.clearTimeout(spaceHoldTimerRef.current);
      spaceHoldTimerRef.current = null;
    }
  }, [isTypingOpen]);

  const handleCheckAnswer = useCallback(
    (transcript: string) => {
      const normalizedSpoken = normalizeReading(transcript);
      const matchedWords = words.filter(
        (entry) =>
          normalizedSpoken.length > 0 &&
          (normalizeReading(entry.reading) === normalizedSpoken ||
            normalizeReading(entry.word) === normalizedSpoken)
      );

      if (matchedWords.length > 0) {
        const hasNewReveal = matchedWords.some(
          (entry) => !revealedIds.has(entry.id)
        );
        setResultStatus("correct");
        playTone(hasNewReveal ? "correct" : "correct_again");
        revealWords(matchedWords);
        if (isTypingOpen) {
          closeTypingOverlay();
        }
        if (isListening || isPressing) {
          isPressingRef.current = false;
          setIsPressing(false);
          setIsListening(false);
          recognitionRef.current?.stop();
        }
      } else {
        setResultStatus("incorrect");
        playTone("incorrect");
      }
    },
    [
      closeTypingOverlay,
      isListening,
      isPressing,
      isTypingOpen,
      playTone,
      revealedIds,
      revealWords,
      setIsListening,
      setIsPressing,
      setResultStatus,
      words
    ]
  );

  const stopRecognition = useCallback(() => {
    isPressingRef.current = false;
    setIsPressing(false);
    if (restartTimerRef.current !== null) {
      window.clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
    if (!recognitionRef.current) {
      return;
    }
    recognitionRef.current.stop();
  }, [setIsPressing]);

  useEffect(() => {
    if (!isSpeechEnabled && isListening) {
      stopRecognition();
    }
  }, [isSpeechEnabled, isListening, stopRecognition]);

  const startRecognition = useCallback(
    (forceRestart = false) => {
      if (!speechConstructor || !isSpeechEnabled) {
        return;
      }

      if (words.length === 0) {
        setLoadError("先にスプレッドシートを読み込んでください。");
        return;
      }

      if (isListening && !forceRestart) {
        return;
      }

      setResultStatus("idle");
      setIsListening(true);
      isPressingRef.current = true;
      setIsPressing(true);
      lastTranscriptRef.current = "";
      lastFinalTranscriptRef.current = "";
      setLastTranscript("");

      const recognition = new speechConstructor();
      recognition.lang = "ja-JP";
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 5;
      recognition.processLocally = false;
      recognition.onresult = (event) => {
        const transcript = extractTranscript(event).trim();
        let finalTranscript: string | undefined;
        for (let index = 0; index < event.results.length; index += 1) {
          const result = event.results[index];
          if (!result?.isFinal) {
            continue;
          }
          const candidate = result[0]?.transcript ?? "";
          if (candidate.trim().length > 0) {
            finalTranscript = candidate.trim();
            break;
          }
        }
        if (transcript) {
          lastTranscriptRef.current = transcript;
          setLastTranscript(transcript);
          setTypingValue(transcript);
          if (finalTranscript) {
            lastFinalTranscriptRef.current = finalTranscript;
          }
        } else {
          setTypingValue("");
        }
      };

      recognition.onerror = () => {
        setIsListening(false);
        setResultStatus("incorrect");
        playTone("incorrect");
      };

      recognition.onend = () => {
        const shouldContinue = isPressingRef.current;
        if (shouldContinue) {
          setIsListening(true);
          restartTimerRef.current = window.setTimeout(() => {
            restartTimerRef.current = null;
            startRecognition(true);
          }, 200);
          return;
        }

        setIsListening(false);

        const spokenRaw =
          lastFinalTranscriptRef.current || lastTranscriptRef.current;
        handleCheckAnswer(spokenRaw || "");
      };

      recognitionRef.current = recognition;
      recognition.start();
    },
    [
      handleCheckAnswer,
      isListening,
      isSpeechEnabled,
      playTone,
      setIsListening,
      setIsPressing,
      setLastTranscript,
      setLoadError,
      setResultStatus,
      setTypingValue,
      speechConstructor,
      words
    ]
  );

  const handleTypedSubmit = useCallback(() => {
    const rawInput = typingValue.trim();
    if (!rawInput) {
      closeTypingOverlay();
      return;
    }

    if (words.length === 0) {
      setLoadError("先にスプレッドシートを読み込んでください。");
      closeTypingOverlay();
      return;
    }

    setResultStatus("idle");
    closeTypingOverlay();

    handleCheckAnswer(rawInput);
  }, [
    closeTypingOverlay,
    handleCheckAnswer,
    setLoadError,
    setResultStatus,
    typingValue,
    words.length
  ]);

  const handleTypingKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Enter") {
        event.preventDefault();
        handleTypedSubmit();
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        closeTypingOverlay();
      }
    },
    [closeTypingOverlay, handleTypedSubmit]
  );

  useEffect(() => {
    if (hasAutoLoadedRef.current) {
      return;
    }
    if (!spreadsheetUrl.trim()) {
      return;
    }

    hasAutoLoadedRef.current = true;
    void loadSpreadsheet(spreadsheetUrl);
  }, [loadSpreadsheet, spreadsheetUrl]);

  useEffect(() => {
    const isEditableTarget = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) {
        return false;
      }
      if (isTypingOpen && target === typingInputRef.current) {
        return false;
      }
      const tagName = target.tagName.toLowerCase();
      return (
        tagName === "input" ||
        tagName === "textarea" ||
        target.isContentEditable
      );
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) {
        return;
      }

      if (isTypingOpen) {
        if (event.code === "Space") {
          event.preventDefault();
          spacePressedRef.current = true;
          if (
            isSpeechEnabled &&
            isSpeechSupported &&
            spaceHoldTimerRef.current === null
          ) {
            spaceHoldTimerRef.current = window.setTimeout(() => {
              spaceHoldTimerRef.current = null;
              if (spacePressedRef.current && isTypingOpen) {
                startRecognition();
              }
            }, 350);
          }
          return;
        }
        if (event.key === "Enter") {
          event.preventDefault();
          handleTypedSubmit();
          return;
        }
        if (event.key === "Escape") {
          event.preventDefault();
          closeTypingOverlay();
        }
        return;
      }

      if (event.ctrlKey || event.metaKey || event.altKey) {
        return;
      }

      if (event.code === "Space") {
        event.preventDefault();
        flushSync(() => {
          setIsTypingOpen(true);
          setTypingValue("");
        });
        typingInputRef.current?.focus();
        spacePressedRef.current = true;
        if (
          isSpeechEnabled &&
          isSpeechSupported &&
          spaceHoldTimerRef.current === null
        ) {
          spaceHoldTimerRef.current = window.setTimeout(() => {
            spaceHoldTimerRef.current = null;
            if (spacePressedRef.current && isTypingOpen) {
              startRecognition();
            }
          }, 350);
        }
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.code !== "Space") {
        return;
      }

      spacePressedRef.current = false;
      if (spaceHoldTimerRef.current !== null) {
        window.clearTimeout(spaceHoldTimerRef.current);
        spaceHoldTimerRef.current = null;
      }
      if (isSpeechEnabled && isSpeechSupported) {
        stopRecognition();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [
    closeTypingOverlay,
    handleTypedSubmit,
    isSpeechEnabled,
    isSpeechSupported,
    isTypingOpen,
    setIsTypingOpen,
    setTypingValue,
    startRecognition,
    stopRecognition
  ]);

  return (
    <React.Fragment>
      <div className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-100">
        <div className="pointer-events-none absolute top-0 left-1/2 h-105 w-170 -translate-x-1/2 rounded-full bg-[radial-gradient(circle_at_top,rgba(190,24,93,0.25),transparent_70%)] blur-3xl" />
        <div className="pointer-events-none absolute -bottom-30 -left-35 h-90 w-90 rounded-full bg-[radial-gradient(circle,rgba(14,116,144,0.25),transparent_70%)] blur-3xl" />
        <main className="relative mx-auto flex w-full max-w-none flex-col gap-8 px-6 pt-10 pb-16">
          <AppHeader />
          <WordListSection />
        </main>
      </div>
      <TypingOverlay
        onKeyDown={handleTypingKeyDown}
        onClose={closeTypingOverlay}
        inputRef={typingInputRef}
      />
      <ListeningOverlay />
      <OptionsDrawer />
    </React.Fragment>
  );
};

export default App;

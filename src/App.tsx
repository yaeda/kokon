import { useAtom } from "jotai";
import type { FormEvent, KeyboardEvent as ReactKeyboardEvent } from "react";
import * as React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import {
  buildSpreadsheetCsvUrl,
  normalizeReading,
  parseSpreadsheetCsv
} from "./lib/spreadsheet";
import { speechEnabledAtom } from "./state/options";
import { spreadsheetUrlAtom } from "./state/spreadsheet";

type ResultTone = "correct" | "incorrect";
type ResultStatus = "idle" | "correct" | "incorrect";

const App = () => {
  const [spreadsheetUrl, setSpreadsheetUrl] = useAtom(spreadsheetUrlAtom);
  const [words, setWords] = useState<WordEntry[]>([]);
  const [revealedIds, setRevealedIds] = useState<Set<string>>(new Set());
  const [showImages, setShowImages] = useState(true);
  const [isOptionsOpen, setIsOptionsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSpeechEnabled, setIsSpeechEnabled] = useAtom(speechEnabledAtom);
  const [typingValue, setTypingValue] = useState("");
  const [isTypingOpen, setIsTypingOpen] = useState(false);
  const [lastTranscript, setLastTranscript] = useState("");
  const [resultStatus, setResultStatus] = useState<ResultStatus>("idle");
  const [isListening, setIsListening] = useState(false);
  const [isPressing, setIsPressing] = useState(false);
  const [onDeviceStatus, setOnDeviceStatus] = useState<
    "unknown" | "available" | "unavailable" | "downloading" | "installing"
  >("unknown");
  const [highlightedIds, setHighlightedIds] = useState<Set<string>>(new Set());

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const lastTranscriptRef = useRef("");
  const lastFinalTranscriptRef = useRef("");
  const correctAudioRef = useRef<HTMLAudioElement | null>(null);
  const incorrectAudioRef = useRef<HTMLAudioElement | null>(null);
  const rowRefs = useRef<Map<string, HTMLTableRowElement>>(new Map());
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
    return () => {
      highlightTimersRef.current.forEach((timerId) => {
        window.clearTimeout(timerId);
      });
      highlightTimersRef.current.clear();
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
  }, [isSpeechEnabled]);

  const handlePrepareOnDevice = () => {
    const speechStatic = getSpeechRecognitionStatic();
    if (!speechStatic?.install) {
      setOnDeviceStatus("unavailable");
      return;
    }

    setOnDeviceStatus("installing");
    speechStatic
      .install({ langs: ["ja-JP"], processLocally: true })
      .then((installed) => {
        setOnDeviceStatus(installed ? "available" : "unavailable");
      })
      .catch(() => {
        setOnDeviceStatus("unavailable");
      });
  };

  const categories = useMemo(() => {
    const grouped = new Map<string, WordEntry[]>();
    for (const word of words) {
      const items = grouped.get(word.category) ?? [];
      items.push(word);
      grouped.set(word.category, items);
    }
    return Array.from(grouped.entries());
  }, [words]);

  const hasAnyImage = useMemo(
    () => words.some((entry) => Boolean(entry.imageUrl)),
    [words]
  );

  const playTone = useCallback((tone: ResultTone) => {
    const audioRef = tone === "correct" ? correctAudioRef : incorrectAudioRef;
    const src =
      tone === "correct" ? "/sounds/correct.mp3" : "/sounds/incorrect.mp3";

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

      setRevealedIds((prev) => {
        const next = new Set(prev);
        matchedWords.forEach((entry) => next.add(entry.id));
        return next;
      });

      if (newlyRevealed.length === 0) {
        return;
      }

      setHighlightedIds((prev) => {
        const next = new Set(prev);
        newlyRevealed.forEach((entry) => {
          next.add(entry.id);
          const existingTimer = highlightTimersRef.current.get(entry.id);
          if (existingTimer !== undefined) {
            window.clearTimeout(existingTimer);
          }
          const timerId = window.setTimeout(() => {
            highlightTimersRef.current.delete(entry.id);
            setHighlightedIds((current) => {
              const updated = new Set(current);
              updated.delete(entry.id);
              return updated;
            });
          }, 3000);
          highlightTimersRef.current.set(entry.id, timerId);
        });
        return next;
      });

      const target = rowRefs.current.get(newlyRevealed[0]?.id ?? "");
      if (target) {
        window.setTimeout(() => {
          target.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 0);
      }
    },
    [revealedIds]
  );

  const registerRowRef = useCallback(
    (id: string) => (node: HTMLTableRowElement | null) => {
      if (!node) {
        rowRefs.current.delete(id);
        return;
      }
      rowRefs.current.set(id, node);
    },
    []
  );

  const closeTypingOverlay = useCallback(() => {
    setIsTypingOpen(false);
    setTypingValue("");
    spacePressedRef.current = false;
    if (spaceHoldTimerRef.current !== null) {
      window.clearTimeout(spaceHoldTimerRef.current);
      spaceHoldTimerRef.current = null;
    }
  }, []);

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
        setResultStatus("correct");
        playTone("correct");
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
      revealWords,
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
  }, []);

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
      speechConstructor,
      words
    ]
  );

  const handleReset = () => {
    setRevealedIds(new Set());
    setLastTranscript("");
    setResultStatus("idle");
  };

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
  }, [closeTypingOverlay, handleCheckAnswer, typingValue, words.length]);

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

  const loadSpreadsheet = useCallback(async (inputUrl: string) => {
    setIsLoading(true);
    setLoadError(null);

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

      setWords(entries);
      setRevealedIds(new Set());
      setResultStatus("idle");
    } catch (error) {
      const message = error instanceof Error ? error.message : "読み込みエラー";
      setLoadError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleLoad = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void loadSpreadsheet(spreadsheetUrl);
  };

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
    isSpeechEnabled,
    isSpeechSupported,
    isTypingOpen,
    startRecognition,
    stopRecognition,
    closeTypingOverlay,
    handleTypedSubmit
  ]);

  return (
    <React.Fragment>
      <div className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-100">
        <div className="pointer-events-none absolute top-0 left-1/2 h-[420px] w-[680px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle_at_top,_rgba(190,24,93,0.25),_transparent_70%)] blur-3xl" />
        <div className="pointer-events-none absolute bottom-[-120px] left-[-140px] h-[360px] w-[360px] rounded-full bg-[radial-gradient(circle,_rgba(14,116,144,0.25),_transparent_70%)] blur-3xl" />
        <main className="relative mx-auto flex w-full max-w-none flex-col gap-8 px-6 pt-10 pb-16">
          <AppHeader onOpenOptions={() => setIsOptionsOpen(true)} />
          <WordListSection
            categories={categories}
            resultStatus={resultStatus}
            hasAnyImage={hasAnyImage}
            showImages={showImages}
            revealedIds={revealedIds}
            highlightedIds={highlightedIds}
            registerRowRef={registerRowRef}
          />
        </main>
      </div>
      <TypingOverlay
        isOpen={isTypingOpen}
        isSpeechEnabled={isSpeechEnabled}
        isSpeechSupported={isSpeechSupported}
        isPressing={isPressing}
        typingValue={typingValue}
        onChange={(event) => setTypingValue(event.target.value)}
        onKeyDown={handleTypingKeyDown}
        onClose={closeTypingOverlay}
        inputRef={typingInputRef}
      />
      <ListeningOverlay
        isVisible={
          isPressing && isSpeechEnabled && isSpeechSupported && !isTypingOpen
        }
        lastTranscript={lastTranscript}
      />
      <OptionsDrawer
        isOpen={isOptionsOpen}
        onClose={() => setIsOptionsOpen(false)}
        onLoad={handleLoad}
        spreadsheetUrl={spreadsheetUrl}
        onSpreadsheetUrlChange={(event) =>
          setSpreadsheetUrl(event.target.value)
        }
        isLoading={isLoading}
        loadError={loadError}
        showImages={showImages}
        onToggleShowImages={() => setShowImages((prev) => !prev)}
        onReset={handleReset}
        isSpeechEnabled={isSpeechEnabled}
        onToggleSpeech={() => setIsSpeechEnabled((prev) => !prev)}
        onPrepareOnDevice={handlePrepareOnDevice}
        onDeviceStatus={onDeviceStatus}
      />
    </React.Fragment>
  );
};

export default App;

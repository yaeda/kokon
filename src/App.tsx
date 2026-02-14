import { useAtom } from "jotai";
import type { FormEvent, KeyboardEvent as ReactKeyboardEvent } from "react";
import * as React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
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
        <div className="pointer-events-none absolute left-1/2 top-0 h-[420px] w-[680px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle_at_top,_rgba(190,24,93,0.25),_transparent_70%)] blur-3xl" />
        <div className="pointer-events-none absolute bottom-[-120px] left-[-140px] h-[360px] w-[360px] rounded-full bg-[radial-gradient(circle,_rgba(14,116,144,0.25),_transparent_70%)] blur-3xl" />
        <main className="relative mx-auto flex w-full max-w-none flex-col gap-8 px-6 pb-16 pt-10">
          <header className="flex flex-wrap items-center justify-between gap-6">
            <div className="flex flex-col gap-2">
              <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                KOKON
              </h1>
              <p className="max-w-2xl text-sm text-slate-300">
                スペースを押して回答
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsOptionsOpen(true)}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-700 bg-slate-900/70 text-slate-200 transition hover:border-slate-500"
              aria-label="オプションを開く"
            >
              <span className="flex flex-col gap-1">
                <span className="h-0.5 w-5 rounded-full bg-current" />
                <span className="h-0.5 w-5 rounded-full bg-current" />
                <span className="h-0.5 w-5 rounded-full bg-current" />
              </span>
            </button>
          </header>

          <section className="grid gap-6">
            <div className="flex flex-col gap-6">
              <div className="rounded-3xl border border-slate-800 bg-slate-900/50 p-6 shadow-[0_0_50px_rgba(15,23,42,0.4)]">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex flex-col gap-2">
                    <h2 className="text-lg font-semibold text-white">
                      単語リスト
                    </h2>
                    <p className="text-sm text-slate-400">
                      正解すると単語と画像が表示されます。
                    </p>
                  </div>
                  <div
                    className={`rounded-full border px-4 py-2 text-xs uppercase tracking-[0.3em] ${
                      resultStatus === "correct"
                        ? "border-emerald-400/60 text-emerald-300"
                        : resultStatus === "incorrect"
                          ? "border-rose-400/60 text-rose-300"
                          : "border-slate-700 text-slate-400"
                    }`}
                  >
                    {resultStatus === "correct"
                      ? "Correct"
                      : resultStatus === "incorrect"
                        ? "Incorrect"
                        : "Standby"}
                  </div>
                </div>

                <div className="mt-6 grid items-start gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                  {categories.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-700 p-6 text-sm text-slate-400">
                      単語データがありません。URLを入力して読み込んでください。
                    </div>
                  ) : (
                    categories.map(([category, entries]) => (
                      <div
                        key={category}
                        className="flex flex-col items-start gap-3"
                      >
                        <div className="flex h-8 w-full items-center justify-between">
                          <div className="flex min-w-0 items-center gap-3">
                            <span className="h-2 w-2 shrink-0 rounded-full bg-rose-400" />
                            <h3 className="min-w-0 truncate whitespace-nowrap text-base font-semibold leading-none text-white">
                              {category}
                            </h3>
                          </div>
                          <span className="shrink-0 text-xs leading-none text-slate-500">
                            {entries.length}語
                          </span>
                        </div>
                        <div className="w-full overflow-hidden rounded-2xl">
                          <table className="w-full border-separate border-spacing-0 rounded-2xl border border-slate-800 text-left text-sm">
                            <thead className="bg-slate-900/70 text-xs uppercase tracking-[0.2em] text-slate-500">
                              <tr>
                                <th className="px-4 py-3">単語</th>
                                <th className="px-4 py-3 text-right" />
                                {hasAnyImage && (
                                  <th className="px-4 py-3">画像</th>
                                )}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800">
                              {entries.map((entry) => {
                                const isRevealed = revealedIds.has(entry.id);
                                return (
                                  <tr
                                    key={entry.id}
                                    ref={registerRowRef(entry.id)}
                                    className={
                                      highlightedIds.has(entry.id)
                                        ? "bg-emerald-500/10"
                                        : undefined
                                    }
                                  >
                                    <td className="px-4 py-4 font-medium">
                                      {isRevealed ? (
                                        <span className="text-white">
                                          {entry.word}
                                        </span>
                                      ) : (
                                        <span className="text-slate-600">
                                          •••••
                                        </span>
                                      )}
                                    </td>
                                    <td className="px-4 py-4 text-right text-slate-500">
                                      {isRevealed ? entry.reading : ""}
                                    </td>
                                    {hasAnyImage && (
                                      <td className="px-4 py-4">
                                        {!showImages ? (
                                          <span className="text-xs text-slate-600">
                                            非表示
                                          </span>
                                        ) : !isRevealed ? (
                                          <span className="text-xs text-slate-600">
                                            ???
                                          </span>
                                        ) : entry.imageUrl ? (
                                          <img
                                            src={entry.imageUrl}
                                            alt={entry.word}
                                            className="h-14 w-20 rounded-lg object-cover"
                                          />
                                        ) : (
                                          <span className="text-xs text-slate-500">
                                            画像なし
                                          </span>
                                        )}
                                      </td>
                                    )}
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </section>
        </main>
      </div>
      {isTypingOpen && (
        <div className="z-60 fixed inset-0 flex items-center justify-center bg-slate-950/75 px-6 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-3xl border border-slate-700 bg-slate-900/90 p-6 shadow-[0_30px_80px_rgba(15,23,42,0.6)]">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
                Answer Input
              </p>
              <button
                type="button"
                onClick={closeTypingOverlay}
                className="text-xs text-slate-400 transition hover:text-white"
              >
                閉じる
              </button>
            </div>
            <div className="mt-3 rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-xs text-slate-400">
              {isSpeechEnabled ? (
                isSpeechSupported ? (
                  <span>
                    {isPressing ? "Listening..." : "Ready"} /
                    スペース長押しで音声入力
                  </span>
                ) : (
                  "このブラウザでは音声認識が利用できません。"
                )
              ) : (
                "音声認識はオプションで有効化できます。"
              )}
            </div>
            <input
              ref={typingInputRef}
              value={typingValue}
              onChange={(event) => setTypingValue(event.target.value)}
              onKeyDown={handleTypingKeyDown}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              placeholder="ここに入力してEnterで確定"
              className="mt-4 w-full rounded-2xl border border-slate-700 bg-slate-950/80 px-4 py-4 text-lg text-white placeholder:text-slate-600 focus:border-rose-400 focus:outline-none"
            />
            <p className="mt-3 text-xs text-slate-500">
              おすすめ：IMEの設定で予測変換を無効にする
            </p>
          </div>
        </div>
      )}
      {isPressing && isSpeechEnabled && isSpeechSupported && !isTypingOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-6 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-3xl border border-slate-700 bg-slate-900/90 p-6 shadow-[0_30px_80px_rgba(15,23,42,0.6)]">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
              Listening...
            </p>
            <p className="mt-4 text-lg font-semibold text-white">
              {lastTranscript || "..."}
            </p>
            <p className="mt-2 text-xs text-slate-500">
              スペースキーを離すと確定します。
            </p>
          </div>
        </div>
      )}
      <button
        type="button"
        aria-label="オプションを閉じる"
        className={`fixed inset-0 z-40 bg-slate-950/70 transition-opacity ${
          isOptionsOpen
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0"
        }`}
        onClick={() => setIsOptionsOpen(false)}
      />
      <aside
        className={`fixed right-0 top-0 z-50 h-full w-[320px] border-l border-slate-800 bg-slate-950/95 p-6 shadow-2xl transition-transform duration-300 ${
          isOptionsOpen ? "translate-x-0" : "translate-x-full"
        }`}
        aria-hidden={!isOptionsOpen}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">設定・オプション</h2>
          <button
            type="button"
            onClick={() => setIsOptionsOpen(false)}
            className="text-xs text-slate-400 transition hover:text-white"
          >
            閉じる
          </button>
        </div>
        <form className="mt-4 flex flex-col gap-3" onSubmit={handleLoad}>
          <label
            htmlFor="spreadsheet-url"
            className="text-xs uppercase tracking-[0.2em] text-slate-500"
          >
            Spreadsheet URL
          </label>
          <input
            id="spreadsheet-url"
            type="url"
            value={spreadsheetUrl}
            onChange={(event) => setSpreadsheetUrl(event.target.value)}
            placeholder="https://docs.google.com/spreadsheets/d/..."
            className="rounded-2xl border border-slate-800 bg-slate-900/80 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:border-rose-400 focus:outline-none"
          />
          <button
            type="submit"
            className="rounded-2xl bg-rose-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-rose-400 disabled:cursor-not-allowed disabled:bg-slate-700"
            disabled={isLoading}
          >
            {isLoading ? "読み込み中..." : "データを読み込む"}
          </button>
          <a
            href={spreadsheetUrl || "#"}
            target="_blank"
            rel="noreferrer"
            className={`rounded-2xl border border-slate-700 px-4 py-3 text-center text-sm font-semibold transition ${
              spreadsheetUrl.trim()
                ? "text-slate-200 hover:border-slate-500"
                : "pointer-events-none text-slate-500"
            }`}
          >
            データを開く
          </a>
          {loadError && (
            <p className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
              {loadError}
            </p>
          )}
        </form>

        <div className="mt-6 grid gap-4">
          <div className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-3">
            <div>
              <p className="text-sm text-white">画像の表示</p>
              <p className="text-xs text-slate-500">
                伏せ表示のときは ??? になります。
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowImages((prev) => !prev)}
              className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
                showImages
                  ? "bg-emerald-400/20 text-emerald-200"
                  : "bg-slate-800 text-slate-400"
              }`}
            >
              {showImages ? "ON" : "OFF"}
            </button>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-3">
            <p className="text-sm text-white">回答状況をリセット</p>
            <p className="text-xs text-slate-500">
              単語の表示と判定状態を初期化します。
            </p>
            <button
              type="button"
              onClick={handleReset}
              className="mt-3 w-full rounded-xl border border-slate-700 px-3 py-2 text-xs text-slate-300 transition hover:border-slate-500"
            >
              リセットする
            </button>
          </div>

          <div className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-3">
            <div>
              <p className="text-sm text-white">音声認識</p>
              <p className="text-xs text-slate-500">
                スペースキーを押している間に認識します。
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsSpeechEnabled((prev) => !prev)}
              className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
                isSpeechEnabled
                  ? "bg-emerald-400/20 text-emerald-200"
                  : "bg-slate-800 text-slate-400"
              }`}
            >
              {isSpeechEnabled ? "ON" : "OFF"}
            </button>
          </div>

          {isSpeechEnabled && (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-3">
              <p className="text-sm text-white">オンデバイス音声</p>
              <p className="text-xs text-slate-500">状態: {onDeviceStatus}</p>
              <button
                type="button"
                onClick={handlePrepareOnDevice}
                className="mt-3 w-full rounded-xl border border-slate-700 px-3 py-2 text-xs text-slate-300 transition hover:border-slate-500 disabled:cursor-not-allowed"
                disabled={onDeviceStatus === "installing"}
              >
                {onDeviceStatus === "installing"
                  ? "準備中..."
                  : "オンデバイス音声を準備"}
              </button>
            </div>
          )}
        </div>
      </aside>
    </React.Fragment>
  );
};

export default App;

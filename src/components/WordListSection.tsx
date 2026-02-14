import { useAtomValue } from "jotai";
import * as React from "react";
import {
  categoriesAtom,
  hasAnyImageAtom,
  highlightedIdsAtom,
  resultStatusAtom,
  revealedIdsAtom,
  showImagesAtom
} from "../state/app";

const WordListSection = () => {
  const categories = useAtomValue(categoriesAtom);
  const resultStatus = useAtomValue(resultStatusAtom);
  const hasAnyImage = useAtomValue(hasAnyImageAtom);
  const showImages = useAtomValue(showImagesAtom);
  const revealedIds = useAtomValue(revealedIdsAtom);
  const highlightedIds = useAtomValue(highlightedIdsAtom);
  const rowRefs = React.useRef<Map<string, HTMLTableRowElement>>(new Map());
  const previousHighlightedRef = React.useRef<Set<string>>(new Set());

  const registerRowRef = React.useCallback(
    (id: string) => (node: HTMLTableRowElement | null) => {
      if (!node) {
        rowRefs.current.delete(id);
        return;
      }
      rowRefs.current.set(id, node);
    },
    []
  );

  React.useEffect(() => {
    const previous = previousHighlightedRef.current;
    let targetId: string | undefined;
    for (const id of highlightedIds) {
      if (!previous.has(id)) {
        targetId = id;
        break;
      }
    }
    if (targetId) {
      const target = rowRefs.current.get(targetId);
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
    previousHighlightedRef.current = new Set(highlightedIds);
  }, [highlightedIds]);

  return (
    <section className="grid gap-6">
      <div className="flex flex-col gap-6">
        <div className="rounded-3xl border border-slate-800 bg-slate-900/50 p-6 shadow-[0_0_50px_rgba(15,23,42,0.4)]">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-col gap-2">
              <h2 className="text-lg font-semibold text-white">単語リスト</h2>
              <p className="text-sm text-slate-400">
                正解すると単語と画像が表示されます。
              </p>
            </div>
            <div
              className={`rounded-full border px-4 py-2 text-xs tracking-[0.3em] uppercase ${
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
                <div key={category} className="flex flex-col items-start gap-3">
                  <div className="flex h-8 w-full items-center justify-between">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="h-2 w-2 shrink-0 rounded-full bg-rose-400" />
                      <h3 className="min-w-0 truncate text-base leading-none font-semibold whitespace-nowrap text-white">
                        {category}
                      </h3>
                    </div>
                    <span className="shrink-0 text-xs leading-none text-slate-500">
                      {entries.length}語
                    </span>
                  </div>
                  <div className="w-full overflow-hidden rounded-2xl">
                    <table className="w-full border-separate border-spacing-0 rounded-2xl border border-slate-800 text-left text-sm">
                      <thead className="bg-slate-900/70 text-xs tracking-[0.2em] text-slate-500 uppercase">
                        <tr>
                          <th className="px-4 py-3">単語</th>
                          <th className="px-4 py-3 text-right" />
                          {hasAnyImage && <th className="px-4 py-3">画像</th>}
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
                                  <span className="text-slate-600">•••••</span>
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
  );
};

export default React.memo(WordListSection);

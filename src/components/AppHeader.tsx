import { useSetAtom } from "jotai";
import * as React from "react";
import { isOptionsOpenAtom } from "../state/app";

const AppHeader = () => {
  const setIsOptionsOpen = useSetAtom(isOptionsOpenAtom);

  return (
    <header className="flex flex-wrap items-center justify-between gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight text-white group-data-[theme=light]:text-slate-900 sm:text-4xl">
          KOKON
        </h1>
        <p className="max-w-2xl text-sm text-slate-300 group-data-[theme=light]:text-slate-600">
          スペースキー or 入力ボタンから回答
        </p>
      </div>
      <button
        type="button"
        onClick={() => setIsOptionsOpen(true)}
        className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-700 bg-slate-900/70 text-slate-200 transition hover:border-slate-500 group-data-[theme=light]:border-slate-200 group-data-[theme=light]:bg-white group-data-[theme=light]:text-slate-700 group-data-[theme=light]:hover:border-slate-300"
        aria-label="オプションを開く"
      >
        <span className="flex flex-col gap-1">
          <span className="h-0.5 w-5 rounded-full bg-current" />
          <span className="h-0.5 w-5 rounded-full bg-current" />
          <span className="h-0.5 w-5 rounded-full bg-current" />
        </span>
      </button>
    </header>
  );
};

export default React.memo(AppHeader);

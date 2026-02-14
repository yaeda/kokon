import { useAtom, useAtomValue, useSetAtom } from "jotai";
import * as React from "react";
import {
  loadSpreadsheetAtom,
  prepareOnDeviceAtom,
  resetAnswersAtom
} from "../state/actions";
import {
  isLoadingAtom,
  isOptionsOpenAtom,
  loadErrorAtom,
  onDeviceStatusAtom,
  showImagesAtom
} from "../state/app";
import { speechEnabledAtom } from "../state/options";
import { spreadsheetUrlAtom } from "../state/spreadsheet";

const OptionsDrawer = () => {
  const [isOpen, setIsOpen] = useAtom(isOptionsOpenAtom);
  const [spreadsheetUrl, setSpreadsheetUrl] = useAtom(spreadsheetUrlAtom);
  const isLoading = useAtomValue(isLoadingAtom);
  const loadError = useAtomValue(loadErrorAtom);
  const [showImages, setShowImages] = useAtom(showImagesAtom);
  const [isSpeechEnabled, setIsSpeechEnabled] = useAtom(speechEnabledAtom);
  const onDeviceStatus = useAtomValue(onDeviceStatusAtom);
  const loadSpreadsheet = useSetAtom(loadSpreadsheetAtom);
  const resetAnswers = useSetAtom(resetAnswersAtom);
  const prepareOnDevice = useSetAtom(prepareOnDeviceAtom);

  const handleLoad: React.FormEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault();
    loadSpreadsheet(spreadsheetUrl);
  };

  return (
    <React.Fragment>
      <button
        type="button"
        aria-label="オプションを閉じる"
        className={`fixed inset-0 z-40 bg-slate-950/70 transition-opacity ${
          isOpen
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0"
        }`}
        onClick={() => setIsOpen(false)}
      />
      <aside
        className={`fixed top-0 right-0 z-50 h-full w-[320px] border-l border-slate-800 bg-slate-950/95 p-6 shadow-2xl transition-transform duration-300 ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
        aria-hidden={!isOpen}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">設定・オプション</h2>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="text-xs text-slate-400 transition hover:text-white"
          >
            閉じる
          </button>
        </div>
        <form className="mt-4 flex flex-col gap-3" onSubmit={handleLoad}>
          <label
            htmlFor="spreadsheet-url"
            className="text-xs tracking-[0.2em] text-slate-500 uppercase"
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
              onClick={() => resetAnswers()}
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
                onClick={() => prepareOnDevice()}
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

export default React.memo(OptionsDrawer);

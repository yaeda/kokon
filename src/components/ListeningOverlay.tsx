import { useAtomValue } from "jotai";
import * as React from "react";
import { lastTranscriptAtom, listeningOverlayVisibleAtom } from "../state/app";

const ListeningOverlay = () => {
  const isVisible = useAtomValue(listeningOverlayVisibleAtom);
  const lastTranscript = useAtomValue(lastTranscriptAtom);

  if (!isVisible) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-6 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-3xl border border-slate-700 bg-slate-900/90 p-6 shadow-[0_30px_80px_rgba(15,23,42,0.6)]">
        <p className="text-xs tracking-[0.3em] text-slate-400 uppercase">
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
  );
};

export default React.memo(ListeningOverlay);

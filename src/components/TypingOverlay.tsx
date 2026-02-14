import * as React from "react";

type TypingOverlayProps = {
  isOpen: boolean;
  isSpeechEnabled: boolean;
  isSpeechSupported: boolean;
  isPressing: boolean;
  typingValue: string;
  onChange: React.ChangeEventHandler<HTMLInputElement>;
  onKeyDown: React.KeyboardEventHandler<HTMLInputElement>;
  onClose: () => void;
  inputRef: React.RefObject<HTMLInputElement>;
};

const TypingOverlay = ({
  isOpen,
  isSpeechEnabled,
  isSpeechSupported,
  isPressing,
  typingValue,
  onChange,
  onKeyDown,
  onClose,
  inputRef
}: TypingOverlayProps) => {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-950/75 px-6 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-3xl border border-slate-700 bg-slate-900/90 p-6 shadow-[0_30px_80px_rgba(15,23,42,0.6)]">
        <div className="flex items-center justify-between">
          <p className="text-xs tracking-[0.3em] text-slate-400 uppercase">
            Answer Input
          </p>
          <button
            type="button"
            onClick={onClose}
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
          ref={inputRef}
          value={typingValue}
          onChange={onChange}
          onKeyDown={onKeyDown}
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
  );
};

export default TypingOverlay;

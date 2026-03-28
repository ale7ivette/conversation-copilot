"use client";

type TokenState = "idle" | "loading" | "ready" | "error";

type ListeningToolbarProps = {
  isListening: boolean;
  tokenState: TokenState;
  /** True when WebSocket + mic pipeline is active */
  micStreaming?: boolean;
  onStart: () => void;
  onStop: () => void;
};

export function ListeningToolbar({
  isListening,
  tokenState,
  micStreaming,
  onStart,
  onStop,
}: ListeningToolbarProps) {
  const live = tokenState === "ready" && isListening && micStreaming;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={onStart}
        disabled={isListening || tokenState === "loading"}
        className="rounded-full bg-white px-5 py-2 text-sm font-medium text-neutral-950 shadow-sm transition-opacity hover:opacity-95 disabled:opacity-45"
      >
        {tokenState === "loading" ? "Connecting…" : "Start listening"}
      </button>
      <button
        type="button"
        onClick={onStop}
        disabled={!isListening}
        className="rounded-full border border-white/15 bg-white/[0.04] px-5 py-2 text-sm font-medium text-white/90 transition-colors hover:bg-white/[0.07] disabled:opacity-40"
      >
        Stop
      </button>
      {tokenState === "ready" && isListening && (
        <span className="inline-flex items-center gap-2 text-xs text-white/50">
          <span
            className={`h-2 w-2 rounded-full ${
              live ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]" : "bg-white/25"
            }`}
            aria-hidden
          />
          {micStreaming ? "Live" : "Connected"}
        </span>
      )}
      {tokenState === "error" && (
        <span className="text-xs text-amber-200/75">Couldn&apos;t connect</span>
      )}
    </div>
  );
}

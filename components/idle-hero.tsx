"use client";

type IdleHeroProps = {
  onStart: () => void;
  connecting: boolean;
  errorMessage: string | null;
};

export function IdleHero({
  onStart,
  connecting,
  errorMessage,
}: IdleHeroProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 pb-16 pt-8">
      <div className="w-full max-w-md text-center">
        <p className="text-[15px] leading-relaxed text-[var(--copilot-muted)]">
          Real-time suggestions while you stay in the conversation — calm,
          readable, and human.
        </p>

        <button
          type="button"
          onClick={onStart}
          disabled={connecting}
          className="mt-10 w-full rounded-2xl bg-[var(--copilot-accent)] px-6 py-4 text-base font-semibold text-[#1a1508] shadow-md transition-opacity hover:opacity-95 disabled:opacity-50"
        >
          {connecting ? "Connecting…" : "Start listening"}
        </button>

        {errorMessage ? (
          <p
            className="mt-4 text-center text-sm leading-relaxed text-amber-200/85"
            role="alert"
          >
            {errorMessage}
          </p>
        ) : null}
      </div>
    </div>
  );
}

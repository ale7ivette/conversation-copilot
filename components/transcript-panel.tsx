"use client";

import { useEffect, useMemo, useRef } from "react";
import type { SpeakerMap, TranscriptLine } from "@/lib/transcript-buffer";

type TranscriptPanelProps = {
  lines: TranscriptLine[];
  /** In-progress ASR while speaking (live mic only; not sent to copilot). */
  liveLine?: string;
  className?: string;
  speakerMap: SpeakerMap;
  onSpeakerMapChange: (map: SpeakerMap) => void;
};

function badgeForLine(line: TranscriptLine) {
  if (line.speaker === "me") return { text: "Me", className: "bg-sky-500/20 text-sky-200/95" };
  if (line.speaker === "other")
    return { text: "Other", className: "bg-violet-500/20 text-violet-200/90" };
  if (line.diarizationLabel)
    return {
      text: line.diarizationLabel,
      className: "bg-white/10 text-white/55",
    };
  return { text: "?", className: "bg-white/10 text-white/45" };
}

export function TranscriptPanel({
  lines,
  liveLine = "",
  className = "",
  speakerMap,
  onSpeakerMapChange,
}: TranscriptPanelProps) {
  const showLive = liveLine.trim().length > 0;
  const scrollRef = useRef<HTMLDivElement>(null);

  const diarizationLabels = useMemo(() => {
    const s = new Set<string>();
    for (const l of lines) {
      if (l.diarizationLabel?.trim()) s.add(l.diarizationLabel.trim());
    }
    return [...s].sort();
  }, [lines]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [lines, liveLine]);

  return (
    <section
      className={`flex min-h-0 flex-1 flex-col rounded-3xl border border-white/[0.07] bg-white/[0.035] p-5 backdrop-blur-sm ${className}`}
    >
      <div className="mb-3 shrink-0">
        <h2 className="text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-white/40">
          Transcript
        </h2>
        <p className="mt-1 text-xs text-white/45">
          With <code className="text-white/55">gpt-4o-transcribe-diarize</code>{" "}
          (see .env.example), speaker ids appear—map them to Me / Other below.
          Partial text shows while you speak.
        </p>
      </div>

      {diarizationLabels.length > 0 && (
        <div className="mb-3 shrink-0 rounded-2xl border border-white/[0.06] bg-black/25 px-3 py-2.5">
          <p className="text-[0.65rem] font-medium uppercase tracking-[0.1em] text-white/38">
            Who is speaking?
          </p>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            {diarizationLabels.map((label) => (
              <label
                key={label}
                className="flex flex-wrap items-center gap-2 text-xs text-white/60"
              >
                <span className="font-mono text-white/50">{label}</span>
                <select
                  value={speakerMap[label] ?? ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    const next = { ...speakerMap };
                    if (v === "me" || v === "other") next[label] = v;
                    else delete next[label];
                    onSpeakerMapChange(next);
                  }}
                  className="rounded-lg border border-white/10 bg-black/40 px-2 py-1 text-sm text-white/90"
                >
                  <option value="">Unmapped</option>
                  <option value="me">Me</option>
                  <option value="other">Other</option>
                </select>
              </label>
            ))}
          </div>
        </div>
      )}

      <div
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-2xl border border-white/[0.05] bg-black/20"
      >
        {lines.length === 0 && !showLive ? (
          <p className="px-4 py-12 text-center text-[15px] leading-relaxed text-white/35">
            No conversation yet. Start listening or open Developer testing below.
          </p>
        ) : (
          <ul className="divide-y divide-white/[0.06]">
            {lines.map((line, i) => {
              const b = badgeForLine(line);
              return (
                <li
                  key={`${line.timestamp}-${i}-${line.text.slice(0, 8)}`}
                  className={`flex gap-3 px-4 py-3.5 ${
                    i % 2 === 1 ? "bg-white/[0.02]" : ""
                  }`}
                >
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[0.65rem] font-medium uppercase tracking-wide ${b.className}`}
                  >
                    {b.text}
                  </span>
                  <p className="min-w-0 flex-1 text-[15px] leading-relaxed text-white/[0.92]">
                    {line.text}
                  </p>
                </li>
              );
            })}
            {showLive && (
              <li className="border-t border-dashed border-white/15 bg-white/[0.03] px-4 py-3.5">
                <div className="text-[0.65rem] font-medium uppercase tracking-[0.14em] text-white/38">
                  Listening…
                </div>
                <p className="mt-1.5 whitespace-pre-wrap text-[15px] leading-relaxed text-white/55">
                  {liveLine}
                </p>
              </li>
            )}
          </ul>
        )}
      </div>
    </section>
  );
}

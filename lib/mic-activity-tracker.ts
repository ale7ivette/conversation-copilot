/**
 * Correlates diarization labels with mic RMS at transcript commit time.
 * Best effort: local mic path only; mixed tab audio limits separation.
 */
export type MicPrimaryGuess = {
  diarizationLabel?: string;
  confidence: number;
  rationale: string;
};

type LabelAgg = { sum: number; count: number };

export class MicActivityTracker {
  private byLabel = new Map<string, LabelAgg>();
  private lastCueMeta: {
    diarizationLabel?: string;
    committedAtMs: number;
    micRms01?: number;
  } | null = null;

  reset() {
    this.byLabel.clear();
    this.lastCueMeta = null;
  }

  recordCue(args: {
    diarizationLabel?: string;
    micRms01?: number;
    committedAtMs: number;
  }) {
    this.lastCueMeta = {
      diarizationLabel: args.diarizationLabel?.trim() || undefined,
      committedAtMs: args.committedAtMs,
      micRms01: args.micRms01,
    };
    const label = args.diarizationLabel?.trim();
    if (!label || args.micRms01 == null) return;
    const prev = this.byLabel.get(label) ?? { sum: 0, count: 0 };
    prev.sum += args.micRms01;
    prev.count += 1;
    this.byLabel.set(label, prev);
  }

  getLastCueMeta() {
    return this.lastCueMeta;
  }

  getMicPrimaryGuess(): MicPrimaryGuess | undefined {
    if (this.byLabel.size === 0) {
      return {
        confidence: 0.25,
        rationale:
          "No diarization segments with mic level samples yet; prefer transcript and speaker map.",
      };
    }
    let bestLabel: string | undefined;
    let bestAvg = -1;
    for (const [label, agg] of this.byLabel) {
      if (agg.count === 0) continue;
      const avg = agg.sum / agg.count;
      if (avg > bestAvg) {
        bestAvg = avg;
        bestLabel = label;
      }
    }
    if (!bestLabel) return undefined;
    const secondAvg = [...this.byLabel.entries()]
      .filter(([l]) => l !== bestLabel)
      .map(([, a]) => a.sum / Math.max(1, a.count))
      .sort((a, b) => b - a)[0];
    const spread =
      secondAvg != null ? Math.max(0, bestAvg - secondAvg) : bestAvg;
    const confidence = Math.min(
      0.9,
      0.35 + spread * 1.2 + Math.min(0.25, this.byLabel.get(bestLabel)!.count * 0.03)
    );
    return {
      diarizationLabel: bestLabel,
      confidence,
      rationale:
        "Higher average mic level when segments with this diarization label were committed (proxy for you speaking into the local mic).",
    };
  }
}

"use client";

import { useEffect, useState } from "react";

import type { RealtimeMicOptions } from "@/lib/realtime-mic-session";

export const AUDIO_DEVICE_STORAGE_KEY = "copilot-mic-device-id";
export const AUDIO_MIX_STORAGE_KEY = "copilot-mix-display-audio";
const MIC_GAIN_KEY = "copilot-mic-gain";
const DISPLAY_GAIN_KEY = "copilot-display-gain";
const NOISE_REDUCTION_KEY = "copilot-noise-reduction";

const DEVICE_KEY = AUDIO_DEVICE_STORAGE_KEY;
const MIX_KEY = AUDIO_MIX_STORAGE_KEY;

const DEFAULT_MIC_GAIN = 1;
const DEFAULT_DISPLAY_GAIN = 0.85;
const MIC_GAIN_MIN = 0.25;
const MIC_GAIN_MAX = 2.5;
const DISPLAY_GAIN_MIN = 0;
const DISPLAY_GAIN_MAX = 1.5;

export type NoiseReductionMode = "near_field" | "far_field";

export type PersistedAudioCaptureSettings = {
  audioDeviceId?: string;
  mixDisplayAudio: boolean;
  micGain: number;
  displayGain: number;
  noiseReduction: NoiseReductionMode;
};

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n));
}

function parseGain(key: string, fallback: number, lo: number, hi: number) {
  if (typeof window === "undefined") return fallback;
  const raw = localStorage.getItem(key);
  if (raw == null) return fallback;
  const n = Number.parseFloat(raw);
  if (Number.isNaN(n)) return fallback;
  return clamp(n, lo, hi);
}

function loadNoiseReduction(): NoiseReductionMode {
  if (typeof window === "undefined") return "near_field";
  const v = localStorage.getItem(NOISE_REDUCTION_KEY);
  return v === "far_field" ? "far_field" : "near_field";
}

/** Read saved audio options (call when starting a session). */
export function readPersistedAudioCaptureSettings(): PersistedAudioCaptureSettings {
  if (typeof window === "undefined") {
    return {
      mixDisplayAudio: false,
      micGain: DEFAULT_MIC_GAIN,
      displayGain: DEFAULT_DISPLAY_GAIN,
      noiseReduction: "near_field",
    };
  }
  const id = localStorage.getItem(DEVICE_KEY)?.trim();
  return {
    audioDeviceId: id || undefined,
    mixDisplayAudio: localStorage.getItem(MIX_KEY) === "1",
    micGain: parseGain(
      MIC_GAIN_KEY,
      DEFAULT_MIC_GAIN,
      MIC_GAIN_MIN,
      MIC_GAIN_MAX
    ),
    displayGain: parseGain(
      DISPLAY_GAIN_KEY,
      DEFAULT_DISPLAY_GAIN,
      DISPLAY_GAIN_MIN,
      DISPLAY_GAIN_MAX
    ),
    noiseReduction: loadNoiseReduction(),
  };
}

/** Subset passed into `startRealtimeMicSession` (third argument). */
export function toRealtimeMicSessionOptions(
  s: PersistedAudioCaptureSettings
): RealtimeMicOptions {
  return {
    audioDeviceId: s.audioDeviceId,
    mixDisplayAudio: s.mixDisplayAudio,
    micGain: s.micGain,
    displayGain: s.displayGain,
  };
}

function loadDeviceId(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(DEVICE_KEY) ?? "";
}

function saveDeviceId(id: string) {
  if (typeof window === "undefined") return;
  if (id) localStorage.setItem(DEVICE_KEY, id);
  else localStorage.removeItem(DEVICE_KEY);
}

function loadMix(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(MIX_KEY) === "1";
}

function saveMix(on: boolean) {
  if (typeof window === "undefined") return;
  localStorage.setItem(MIX_KEY, on ? "1" : "0");
}

function saveMicGain(v: number) {
  if (typeof window === "undefined") return;
  localStorage.setItem(MIC_GAIN_KEY, String(v));
}

function saveDisplayGain(v: number) {
  if (typeof window === "undefined") return;
  localStorage.setItem(DISPLAY_GAIN_KEY, String(v));
}

function saveNoiseReduction(v: NoiseReductionMode) {
  if (typeof window === "undefined") return;
  localStorage.setItem(NOISE_REDUCTION_KEY, v);
}

type AudioCaptureSettingsProps = {
  disabled?: boolean;
};

export function AudioCaptureSettingsPanel({
  disabled,
}: AudioCaptureSettingsProps) {
  const [inputs, setInputs] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState("");
  const [mixDisplay, setMixDisplay] = useState(false);
  const [micGain, setMicGain] = useState(DEFAULT_MIC_GAIN);
  const [displayGain, setDisplayGain] = useState(DEFAULT_DISPLAY_GAIN);
  const [noiseReduction, setNoiseReduction] =
    useState<NoiseReductionMode>("near_field");

  useEffect(() => {
    setDeviceId(loadDeviceId());
    setMixDisplay(loadMix());
    setMicGain(
      parseGain(
        MIC_GAIN_KEY,
        DEFAULT_MIC_GAIN,
        MIC_GAIN_MIN,
        MIC_GAIN_MAX
      )
    );
    setDisplayGain(
      parseGain(
        DISPLAY_GAIN_KEY,
        DEFAULT_DISPLAY_GAIN,
        DISPLAY_GAIN_MIN,
        DISPLAY_GAIN_MAX
      )
    );
    setNoiseReduction(loadNoiseReduction());
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function list() {
      try {
        const list = await navigator.mediaDevices.enumerateDevices();
        if (!cancelled) {
          setInputs(list.filter((d) => d.kind === "audioinput"));
        }
      } catch {
        if (!cancelled) setInputs([]);
      }
    }
    void list();
    navigator.mediaDevices.addEventListener("devicechange", list);
    return () => {
      cancelled = true;
      navigator.mediaDevices.removeEventListener("devicechange", list);
    };
  }, []);

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] px-4 py-3 text-xs text-white/55">
      <p className="mb-2 font-medium text-white/45">Audio capture</p>
      <p className="mb-3 text-[0.65rem] leading-relaxed text-white/38">
        The browser only hears your chosen <strong className="text-white/55">mic input</strong>{" "}
        and optional <strong className="text-white/55">shared tab/window</strong> audio. Quiet or
        distant sources (e.g. a phone on a desk) may not transcribe well—route calls to this PC,
        use loopback devices, or an external mic. Higher gain increases noise.
      </p>

      <label className="block">
        <span className="mb-1 block text-[0.65rem] uppercase tracking-[0.1em] text-white/35">
          Microphone / input
        </span>
        <select
          disabled={disabled}
          value={deviceId}
          onChange={(e) => {
            const v = e.target.value;
            setDeviceId(v);
            saveDeviceId(v);
          }}
          className="w-full max-w-md rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white/90 disabled:opacity-50"
        >
          <option value="">System default</option>
          {inputs.map((d) => (
            <option key={d.deviceId} value={d.deviceId}>
              {d.label || `Input ${d.deviceId.slice(0, 8)}…`}
            </option>
          ))}
        </select>
      </label>
      <p className="mt-2 text-[0.65rem] leading-relaxed text-white/35">
        Choose Stereo Mix, VB-Cable, or BlackHole here to capture desktop audio
        as an input device.
      </p>

      <label className="mt-3 block">
        <span className="mb-1 block text-[0.65rem] uppercase tracking-[0.1em] text-white/35">
          Mic sensitivity (digital gain)
        </span>
        <div className="flex items-center gap-3">
          <input
            type="range"
            disabled={disabled}
            min={MIC_GAIN_MIN}
            max={MIC_GAIN_MAX}
            step={0.05}
            value={micGain}
            onChange={(e) => {
              const v = Number(e.target.value);
              setMicGain(v);
              saveMicGain(v);
            }}
            className="h-2 flex-1 max-w-xs accent-white/80 disabled:opacity-50"
          />
          <span className="w-10 tabular-nums text-white/60">{micGain.toFixed(2)}×</span>
        </div>
      </label>

      <label className="mt-3 block">
        <span className="mb-1 block text-[0.65rem] uppercase tracking-[0.1em] text-white/35">
          Shared tab/window level
        </span>
        <div className="flex items-center gap-3">
          <input
            type="range"
            disabled={disabled}
            min={DISPLAY_GAIN_MIN}
            max={DISPLAY_GAIN_MAX}
            step={0.05}
            value={displayGain}
            onChange={(e) => {
              const v = Number(e.target.value);
              setDisplayGain(v);
              saveDisplayGain(v);
            }}
            className="h-2 flex-1 max-w-xs accent-white/80 disabled:opacity-50"
          />
          <span className="w-10 tabular-nums text-white/60">{displayGain.toFixed(2)}×</span>
        </div>
        <span className="mt-0.5 block text-[0.65rem] text-white/35">
          Used only when “Mix in tab or window audio” is on.
        </span>
      </label>

      <label className="mt-3 block">
        <span className="mb-1 block text-[0.65rem] uppercase tracking-[0.1em] text-white/35">
          Noise reduction (Realtime session)
        </span>
        <select
          disabled={disabled}
          value={noiseReduction}
          onChange={(e) => {
            const v =
              e.target.value === "far_field" ? "far_field" : "near_field";
            setNoiseReduction(v);
            saveNoiseReduction(v);
          }}
          className="w-full max-w-md rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white/90 disabled:opacity-50"
        >
          <option value="near_field">Headset / close mic (near-field)</option>
          <option value="far_field">Room / laptop mic (far-field)</option>
        </select>
        <span className="mt-1 block text-[0.65rem] leading-relaxed text-white/35">
          Applies on next <strong className="text-white/50">Start listening</strong> (new
          session). Independent of conversation type.
        </span>
      </label>

      <label className="mt-3 flex cursor-pointer items-start gap-2">
        <input
          type="checkbox"
          disabled={disabled}
          checked={mixDisplay}
          onChange={(e) => {
            const on = e.target.checked;
            setMixDisplay(on);
            saveMix(on);
          }}
          className="mt-0.5"
        />
        <span>
          <span className="text-white/75">Mix in tab or window audio</span>
          <span className="mt-0.5 block text-[0.65rem] leading-relaxed text-white/40">
            You will be asked to share a screen or tab (audio only is fine).
            Use headphones to reduce echo. Sends one mixed stream to the
            copilot.
          </span>
        </span>
      </label>
    </div>
  );
}

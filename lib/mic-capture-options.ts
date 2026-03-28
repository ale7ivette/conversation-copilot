/** Options for browser mic capture shared by OpenAI Realtime and AssemblyAI paths. */
export type MicCaptureOptions = {
  /** Pin input device (e.g. loopback / Stereo Mix). */
  audioDeviceId?: string;
  /** Also capture tab/system audio via getDisplayMedia (user must share). */
  mixDisplayAudio?: boolean;
  micGain?: number;
  displayGain?: number;
};

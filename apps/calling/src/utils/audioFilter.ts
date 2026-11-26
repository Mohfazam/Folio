/**
 * High-performance telephony audio pre-processor for 8kHz G.711 mu-law streams.
 *
 * Provides:
 * 1. Noise Gating: Attenuates low-level background noise (fan hum, line hiss, distant chatter)
 *    so it doesn't trigger false STT transcriptions or premature barge-in.
 * 2. Adaptive Gain Boost (+6dB): Boosts caller vocal amplitude with soft limiting
 *    so callers can speak at normal, comfortable volume without having to speak loudly.
 */

const ULAW_BIAS = 0x84;
const ULAW_CLIP = 32635;

// Pre-computed 256-entry lookup table for ultra-fast mu-law to linear PCM (16-bit)
const MULAW_TO_LINEAR = new Int16Array(256);
for (let i = 0; i < 256; i++) {
  const u = ~i & 0xff;
  let t = ((u & 0x0f) << 3) + ULAW_BIAS;
  t <<= (u & 0x70) >> 4;
  MULAW_TO_LINEAR[i] = (u & 0x80) ? (ULAW_BIAS - t) : (t - ULAW_BIAS);
}

/**
 * Fast linear 16-bit PCM sample to G.711 mu-law byte.
 */
function linearToMulawSample(sample: number): number {
  let sign = 0;
  if (sample < 0) {
    sign = 0x80;
    sample = -sample;
  }
  if (sample > ULAW_CLIP) sample = ULAW_CLIP;
  sample += ULAW_BIAS;

  let exponent = 7;
  for (let expMask = 0x4000; (sample & expMask) === 0 && exponent > 0; expMask >>= 1) {
    exponent--;
  }
  const mantissa = (sample >> (exponent + 3)) & 0x0f;
  return ~(sign | (exponent << 4) | mantissa) & 0xff;
}

export interface AudioFilterOptions {
  /**
   * Linear gain multiplier for caller speech.
   * Default: 1.85 (~+5.3dB boost), allows normal-volume speech to reach STT clearly.
   */
  gainMultiplier?: number;
  /**
   * Noise gate RMS threshold in 16-bit linear PCM scale (0..32767).
   * Audio frames with energy below this threshold are treated as ambient noise floor.
   * Default: 140 (approx -47dBFS).
   */
  noiseGateRmsThreshold?: number;
}

/**
 * Filters and enhances an 8kHz mu-law audio chunk.
 * Returns an enhanced mu-law Buffer of identical length.
 */
export function filterAndBoostAudio(chunk: Buffer, options?: AudioFilterOptions): Buffer {
  if (!chunk || chunk.length === 0) return chunk;

  const gain = options?.gainMultiplier ?? 1.85;
  const gateThreshold = options?.noiseGateRmsThreshold ?? 140;

  const len = chunk.length;
  const pcm = new Int16Array(len);
  let sumSquares = 0;

  // 1. Decode to linear PCM and calculate RMS energy
  for (let i = 0; i < len; i++) {
    const byte = chunk[i] ?? 0;
    const val = MULAW_TO_LINEAR[byte] ?? 0;
    pcm[i] = val;
    sumSquares += val * val;
  }

  const rms = Math.sqrt(sumSquares / len);

  // 2. Noise Gate: If frame energy is below noise floor, suppress background noise
  if (rms < gateThreshold) {
    const quietOutput = Buffer.allocUnsafe(len);
    // Attenuate to silent mu-law (0xff represents zero amplitude in mu-law)
    for (let i = 0; i < len; i++) {
      // Lightly attenuate by 75% towards silence to preserve natural line acoustics
      const val = pcm[i] ?? 0;
      const attenuated = Math.round(val * 0.25);
      quietOutput[i] = linearToMulawSample(attenuated);
    }
    return quietOutput;
  }

  // 3. Speech Gain Boost: Apply clean gain with soft saturation limiting
  const output = Buffer.allocUnsafe(len);
  for (let i = 0; i < len; i++) {
    const val = pcm[i] ?? 0;
    let s = val * gain;
    // Soft limiting saturation to avoid harsh square-wave digital distortion
    if (s > 30000) {
      s = 30000 + (s - 30000) * 0.2;
    } else if (s < -30000) {
      s = -30000 + (s + 30000) * 0.2;
    }
    const clamped = Math.max(-32767, Math.min(32767, Math.round(s)));
    output[i] = linearToMulawSample(clamped);
  }

  return output;
}

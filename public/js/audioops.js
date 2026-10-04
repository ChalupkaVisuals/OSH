// Sound editing: volume and timing. Processed sounds are written as 16-bit wav.

let ctx;
const audioContext = () => (ctx ||= new AudioContext());

/** @returns {Promise<{channels: Float32Array[], sampleRate: number}>} */
export async function decodeAudio(bytes) {
  const buf = await audioContext().decodeAudioData(bytes.slice().buffer);
  const channels = [];
  for (let c = 0; c < buf.numberOfChannels; c++) channels.push(buf.getChannelData(c));
  return { channels, sampleRate: buf.sampleRate };
}

/**
 * gain: 1 = unchanged. delayMs > 0 adds silence before the sound (it plays later),
 * delayMs < 0 cuts that much off the start (it plays earlier).
 */
export function processAudio({ channels, sampleRate }, { gain = 1, delayMs = 0 }) {
  const shift = Math.round(sampleRate * delayMs / 1000);
  const out = channels.map(src => {
    const from = Math.min(src.length, Math.max(0, -shift)), pad = Math.max(0, shift);
    const dst = new Float32Array(pad + src.length - from);
    for (let i = from; i < src.length; i++) dst[pad + i - from] = Math.max(-1, Math.min(1, src[i] * gain));
    return dst;
  });
  return { channels: out, sampleRate };
}

export function encodeWav({ channels, sampleRate }) {
  const n = channels.length, frames = channels[0] ? channels[0].length : 0, bytes = frames * n * 2;
  const dv = new DataView(new ArrayBuffer(44 + bytes));
  const str = (o, s) => [...s].forEach((ch, i) => dv.setUint8(o + i, ch.charCodeAt(0)));
  str(0, 'RIFF'); dv.setUint32(4, 36 + bytes, true); str(8, 'WAVEfmt ');
  dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, n, true);
  dv.setUint32(24, sampleRate, true); dv.setUint32(28, sampleRate * n * 2, true);
  dv.setUint16(32, n * 2, true); dv.setUint16(34, 16, true);
  str(36, 'data'); dv.setUint32(40, bytes, true);
  let o = 44;
  for (let i = 0; i < frames; i++) {
    for (let c = 0; c < n; c++, o += 2) {
      const v = Math.max(-1, Math.min(1, channels[c][i]));
      dv.setInt16(o, Math.round(v < 0 ? v * 32768 : v * 32767), true);
    }
  }
  return new Uint8Array(dv.buffer);
}

let playing;
export function playAudio({ channels, sampleRate }) {
  const ac = audioContext();
  if (playing) { try { playing.stop(); } catch { /* already ended */ } }
  if (!channels.length || !channels[0].length) return;
  const buf = ac.createBuffer(channels.length, channels[0].length, sampleRate);
  channels.forEach((ch, c) => buf.copyToChannel(ch, c));
  playing = ac.createBufferSource();
  playing.buffer = buf;
  playing.connect(ac.destination);
  playing.start();
}

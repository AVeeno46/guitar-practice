// 지판의 음을 눌렀을 때, TAB을 재생할 때 내는 짧은 기타 비슷한 소리.

import { frequencyOf } from './theory';

let ctx: AudioContext | null = null;

/** 지금 바로 한 음을 낸다 (지판·편집기에서 음을 눌렀을 때) */
export async function pluck(midi: number) {
  try {
    if (!ctx) {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctx = new Ctx({ latencyHint: 'interactive' });
    }
    if (ctx.state !== 'running') await ctx.resume();
  } catch {
    return; // 소리를 낼 수 없는 환경이면 조용히 무시
  }
  pluckAt(ctx, ctx.destination, midi, ctx.currentTime);
}

/**
 * 주어진 오디오 시계 시각(time)에 한 음을 예약한다.
 * 메트로놈과 같은 AudioContext에 예약하면 클릭과 정확히 맞물린다.
 * level: 여러 줄을 동시에 칠 때 소리가 너무 커지지 않게 줄이는 값
 */
export function pluckAt(ctx: AudioContext, dest: AudioNode, midi: number, time: number, level = 1) {
  const now = time;
  const freq = frequencyOf(midi);
  const out = ctx.createGain();
  out.gain.setValueAtTime(0.0001, now);
  out.gain.exponentialRampToValueAtTime(0.35 * level, now + 0.005);
  out.gain.exponentialRampToValueAtTime(0.0001, now + 1.4);

  // 밝은 어택이 금방 둥글어지도록 저역 통과 필터를 닫아 간다
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(Math.min(8000, freq * 8), now);
  filter.frequency.exponentialRampToValueAtTime(Math.max(400, freq * 1.5), now + 0.6);
  filter.connect(out).connect(dest);

  for (const [type, mult, level] of [
    ['sawtooth', 1, 0.5],
    ['triangle', 2, 0.25],
  ] as const) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq * mult;
    g.gain.value = level;
    osc.connect(g).connect(filter);
    osc.start(now);
    osc.stop(now + 1.5);
  }
}

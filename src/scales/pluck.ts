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

export interface PluckOptions {
  /** 소리 크기 배율 (여러 줄을 동시에 칠 때 줄인다) */
  level?: number;
  /** 피킹 없이 이어 친 음(해머링·풀링): 어택을 부드럽고 작게 */
  soft?: boolean;
  /** 뮤트음(X): 음정 없이 짧게 '틱' */
  dead?: boolean;
  /** 팜뮤트: 짧고 먹먹하게 */
  palmMute?: boolean;
  /** 벤딩: 몇 반음 올릴지 (온음 = 2) */
  bendSemis?: number;
  /** 슬라이드: start~end 사이에 toMidi 음정으로 미끄러진다 */
  glide?: { toMidi: number; start: number; end: number };
  /** 소리를 이 시각까지 울린다 (기본 1.4초) */
  until?: number;
}

/**
 * 주어진 오디오 시계 시각(time)에 한 음을 예약한다.
 * 메트로놈과 같은 AudioContext에 예약하면 클릭과 정확히 맞물린다.
 */
export function pluckAt(ctx: AudioContext, dest: AudioNode, midi: number, time: number, opts: PluckOptions = {}) {
  const now = time;
  const level = (opts.level ?? 1) * (opts.soft ? 0.55 : 1) * (opts.dead ? 0.6 : 1);
  const decay = opts.dead ? 0.05 : opts.palmMute ? 0.22 : 1.4;
  const end = Math.max(now + decay, opts.until ?? 0);
  const freq = frequencyOf(midi);
  const out = ctx.createGain();
  out.gain.setValueAtTime(0.0001, now);
  out.gain.exponentialRampToValueAtTime(0.35 * level, now + (opts.soft ? 0.02 : 0.005));
  out.gain.exponentialRampToValueAtTime(0.0001, end);

  // 밝은 어택이 금방 둥글어지도록 저역 통과 필터를 닫아 간다. 팜뮤트·뮤트음은 처음부터 먹먹하게
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  const bright = opts.dead ? 2500 : opts.palmMute ? freq * 3 : Math.min(8000, freq * 8);
  filter.frequency.setValueAtTime(bright, now);
  filter.frequency.exponentialRampToValueAtTime(Math.max(300, freq * (opts.palmMute ? 1 : 1.5)), now + 0.6);
  filter.connect(out).connect(dest);

  for (const [type, mult, gain] of [
    [opts.dead ? 'square' : 'sawtooth', 1, 0.5],
    ['triangle', 2, 0.25],
  ] as const) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq * mult, now);
    if (opts.bendSemis) {
      // 벤딩: 0.15초 동안 목표 음정까지 끌어올리고 유지
      osc.frequency.setValueAtTime(freq * mult, now + 0.04);
      osc.frequency.exponentialRampToValueAtTime(frequencyOf(midi + opts.bendSemis) * mult, now + 0.19);
    }
    if (opts.glide) {
      const startAt = Math.max(now + 0.01, opts.glide.start);
      osc.frequency.setValueAtTime(freq * mult, startAt);
      osc.frequency.exponentialRampToValueAtTime(frequencyOf(opts.glide.toMidi) * mult, Math.max(startAt + 0.02, opts.glide.end));
    }
    g.gain.value = gain;
    osc.connect(g).connect(filter);
    osc.start(now);
    osc.stop(end + 0.1);
  }
}

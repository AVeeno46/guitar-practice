// Web Audio 기반 메트로놈 엔진.
// setInterval 대신 오디오 시계로 미리 예약(lookahead)해서 박자가 흔들리지 않게 한다.

export type Subdivision = 1 | 2 | 3 | 4;

export interface MetronomeSettings {
  bpm: number;
  beatsPerBar: number;
  subdivision: Subdivision;
  accentFirst: boolean;
  volume: number; // 0..1
}

export interface Tick {
  beat: number; // 0-based 마디 안의 박
  sub: number; // 0-based 박 안의 세분 음
  time: number; // AudioContext 시간
}

export const BPM_MIN = 30;
export const BPM_MAX = 300;

export const clampBpm = (bpm: number) =>
  Math.min(BPM_MAX, Math.max(BPM_MIN, Math.round(bpm)));

const LOOKAHEAD_MS = 25;
const SCHEDULE_AHEAD_S = 0.12;

export class MetronomeEngine {
  private ctx: AudioContext | null = null;
  private gain: GainNode | null = null;
  private timer: number | null = null;
  private nextTime = 0;
  private beat = 0;
  private sub = 0;
  private queue: Tick[] = [];
  private settings: MetronomeSettings;
  running = false;

  constructor(settings: MetronomeSettings) {
    this.settings = { ...settings, bpm: clampBpm(settings.bpm || BPM_MIN) };
  }

  update(settings: Partial<MetronomeSettings>) {
    const prev = this.settings;
    this.settings = { ...prev, ...settings };
    // 입력 중인 값(0, 빈칸 등)이 들어와도 박 간격이 0이 되지 않게 막는다
    this.settings.bpm = clampBpm(this.settings.bpm || BPM_MIN);
    if (this.gain && settings.volume !== undefined) {
      this.gain.gain.value = this.settings.volume;
    }
    if (settings.beatsPerBar !== undefined && this.beat >= this.settings.beatsPerBar) {
      this.beat = 0;
    }
    if (settings.subdivision !== undefined && this.sub >= this.settings.subdivision) {
      this.sub = 0;
    }
  }

  async start() {
    if (this.running) return;
    if (!this.ctx) {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctx({ latencyHint: 'interactive' });
      this.gain = this.ctx.createGain();
      this.gain.gain.value = this.settings.volume;
      this.gain.connect(this.ctx.destination);
    }
    if (this.ctx.state !== 'running') await this.ctx.resume();
    this.running = true;
    this.beat = 0;
    this.sub = 0;
    this.queue = [];
    this.nextTime = this.ctx.currentTime + 0.06;
    this.scheduler();
    this.timer = window.setInterval(() => this.scheduler(), LOOKAHEAD_MS);
  }

  stop() {
    this.running = false;
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
    this.queue = [];
  }

  /** 지금까지 소리가 난 틱 중 가장 최근 것을 돌려준다(화면 표시용). */
  currentTick(): Tick | null {
    if (!this.ctx) return null;
    const now = this.ctx.currentTime;
    let last: Tick | null = null;
    while (this.queue.length && this.queue[0].time <= now) {
      last = this.queue.shift()!;
    }
    return last;
  }

  private scheduler() {
    if (!this.ctx) return;
    while (this.nextTime < this.ctx.currentTime + SCHEDULE_AHEAD_S) {
      this.scheduleClick(this.beat, this.sub, this.nextTime);
      this.queue.push({ beat: this.beat, sub: this.sub, time: this.nextTime });
      this.advance();
    }
  }

  private advance() {
    const { bpm, subdivision, beatsPerBar } = this.settings;
    this.nextTime += 60 / bpm / subdivision;
    this.sub += 1;
    if (this.sub >= subdivision) {
      this.sub = 0;
      this.beat = (this.beat + 1) % beatsPerBar;
    }
  }

  private scheduleClick(beat: number, sub: number, time: number) {
    const ctx = this.ctx!;
    const accent = this.settings.accentFirst && beat === 0 && sub === 0;
    const isSub = sub !== 0;

    const freq = accent ? 1760 : isSub ? 660 : 1100;
    const peak = accent ? 1 : isSub ? 0.35 : 0.7;
    const length = isSub ? 0.03 : 0.05;

    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = 'square';
    osc.frequency.value = freq;
    env.gain.setValueAtTime(0.0001, time);
    env.gain.exponentialRampToValueAtTime(peak * 0.5, time + 0.002);
    env.gain.exponentialRampToValueAtTime(0.0001, time + length);
    osc.connect(env).connect(this.gain!);
    osc.start(time);
    osc.stop(time + length + 0.01);
  }
}

/** 탭 템포: 최근 탭 간격의 평균으로 BPM을 계산한다. */
export class TapTempo {
  private taps: number[] = [];

  tap(now = performance.now()): number | null {
    const last = this.taps[this.taps.length - 1];
    if (last !== undefined && now - last > 2000) this.taps = [];
    this.taps.push(now);
    if (this.taps.length > 6) this.taps.shift();
    if (this.taps.length < 2) return null;
    const intervals = this.taps.slice(1).map((t, i) => t - this.taps[i]);
    const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    return clampBpm(60000 / avg);
  }
}

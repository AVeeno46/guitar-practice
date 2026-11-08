import { useCallback, useEffect, useRef, useState } from 'react';
import type { MetronomeSettings, ScheduleListener } from '../../metronome/engine';
import { pluckAt } from '../../scales/pluck';
import { midiOf, perBar, type TabScore } from './score';

export interface LoopRange {
  from: number; // 마디 번호 (0부터)
  to: number;
}

export interface PlayOptions {
  sound: boolean; // TAB 음을 기타 소리로
  click: boolean; // 메트로놈 클릭
  speedUp: boolean; // 한 번 돌 때마다 BPM 올리기
}

export const SPEED_STEP = 2;

/**
 * 메트로놈 소리 번호 → TAB 칸 위치.
 * 1마디 카운트인 뒤부터 시작하고, 반복 구간(없으면 전체)을 계속 돈다.
 */
function locate(index: number, score: TabScore, loop: LoopRange | null) {
  const n = perBar(score);
  const played = index - n; // 카운트인 1마디
  if (index < 0) return { col: -1, countIn: 0, pass: 0 };
  if (played < 0) return { col: -1, countIn: Math.ceil(-played / score.notesPerBeat), pass: 0 };
  const start = loop ? loop.from * n : 0;
  const len = loop ? (loop.to - loop.from + 1) * n : score.cols.length;
  return { col: start + (played % len), countIn: 0, pass: Math.floor(played / len) };
}

/**
 * TAB 악보를 메트로놈에 맞춰 재생한다.
 * - onTick: 화면의 커서 위치
 * - onSchedule: 메트로놈과 같은 오디오 시계에 TAB 음을 예약 (박자에 정확히 맞는다)
 * - 한 바퀴 돌 때마다 onPass(바퀴 수)를 부른다 (점점 빠르게)
 */
export function useTabPlayer(
  score: TabScore | null,
  loop: LoopRange | null,
  options: PlayOptions,
  onPass: (pass: number) => void,
) {
  const [index, setIndex] = useState(-1);

  // 메트로놈 스케줄러는 React 밖에서 불리므로 최신 값을 ref로 넘긴다
  const live = useRef({ score, loop, options, onPass, lastPass: 0 });
  useEffect(() => {
    live.current.score = score;
    live.current.loop = loop;
    live.current.options = options;
    live.current.onPass = onPass;
  }, [score, loop, options, onPass]);

  const onTick = useCallback((i: number, _m: MetronomeSettings) => {
    setIndex(i);
    const { score: s, loop: l } = live.current;
    if (!s || i < 0) {
      live.current.lastPass = 0;
      return;
    }
    const { pass } = locate(i, s, l);
    if (pass > live.current.lastPass) {
      live.current.lastPass = pass;
      live.current.onPass(pass);
    }
  }, []);

  const onSchedule: ScheduleListener = useCallback((tick, ctx) => {
    const { score: s, loop: l, options: o } = live.current;
    if (!s || !o.sound) return;
    const { col } = locate(tick.index, s, l);
    if (col < 0) return;
    const frets = s.cols[col].map((f, string) => (f === null ? null : midiOf(string, f))).filter((m) => m !== null);
    const level = 1 / Math.sqrt(Math.max(1, frets.length)); // 코드를 칠 때 너무 커지지 않게
    for (const midi of frets) pluckAt(ctx, ctx.destination, midi as number, tick.time, level);
  }, []);

  const where = score ? locate(index, score, loop) : { col: -1, countIn: 0, pass: 0 };
  return { running: index >= 0, cursor: where.col, countIn: where.countIn, pass: where.pass, onTick, onSchedule };
}

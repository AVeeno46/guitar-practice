import { useCallback, useEffect, useRef, useState } from 'react';
import type { MetronomeSettings, ScheduleListener, TempoScale } from '../../metronome/engine';
import { pluckAt } from '../../scales/pluck';
import { midiOf, nextNote, perBar, prevNote, tempoAt, type TabScore } from './score';

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
  const start = loop ? loop.from * n : 0;
  if (index < 0) return { col: -1, countIn: 0, pass: 0, start };
  if (played < 0) return { col: -1, countIn: Math.ceil(-played / score.notesPerBeat), pass: 0, start };
  const len = loop ? (loop.to - loop.from + 1) * n : score.cols.length;
  return { col: start + (played % len), countIn: 0, pass: Math.floor(played / len), start };
}

/** 이 칸의 템포 ÷ 원곡 템포. 템포 정보가 없으면 1 */
function scaleAt(score: TabScore, col: number) {
  const base = score.tempo;
  const t = tempoAt(score, col);
  return base && t ? t / base : 1;
}

/**
 * TAB 악보를 메트로놈에 맞춰 재생한다.
 * - onTick: 화면의 커서 위치
 * - onSchedule: 메트로놈과 같은 오디오 시계에 TAB 음을 예약 (박자에 정확히 맞는다)
 * - tempoScale: 악보 중간 템포 변경을 메트로놈 간격에 반영
 * - 한 바퀴 돌 때마다 onPass(바퀴 수)를 부른다 (점점 빠르게)
 */
export function useTabPlayer(
  score: TabScore | null,
  loop: LoopRange | null,
  options: PlayOptions,
  bpm: number,
  onPass: (pass: number) => void,
) {
  const [index, setIndex] = useState(-1);

  // 메트로놈 스케줄러는 React 밖에서 불리므로 최신 값을 ref로 넘긴다
  const live = useRef({ score, loop, options, onPass, bpm, lastPass: 0 });
  useEffect(() => {
    Object.assign(live.current, { score, loop, options, onPass, bpm });
  }, [score, loop, options, onPass, bpm]);

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

  const tempoScale: TempoScale = useCallback((i) => {
    const { score: s, loop: l } = live.current;
    if (!s) return 1;
    const { col, start } = locate(i, s, l);
    return scaleAt(s, col >= 0 ? col : start); // 카운트인은 시작 칸의 템포로
  }, []);

  const onSchedule: ScheduleListener = useCallback((tick, ctx) => {
    const { score: s, loop: l, options: o, bpm: b } = live.current;
    if (!s || !o.sound) return;
    const { col } = locate(tick.index, s, l);
    if (col < 0) return;
    const column = s.cols[col];
    const attacks = column.notes.filter((n) => n && !n.tie).length;
    const level = 1 / Math.sqrt(Math.max(1, attacks)); // 코드를 칠 때 너무 커지지 않게
    const secPerCol = 60 / (b * scaleAt(s, col)) / s.notesPerBeat;

    column.notes.forEach((note, string) => {
      if (!note || note.tie) return; // 이음은 다시 치지 않는다 (앞 음이 계속 울림)
      const prev = prevNote(s, col, string);
      if (prev && prev.note.slide && !note.dead) return; // 앞 음에서 미끄러져 온 음: 이미 소리가 나고 있다
      const midi = midiOf(string, note.fret);
      const next = nextNote(s, col, string);
      // 이음으로 이어지는 만큼 길게 울린다
      let holdTo = col;
      let bendCol = note.bend ? col : -1; // 이어 울리는 도중 벤딩이 있으면 그 칸에서
      for (let k = col + 1; k < s.cols.length && s.cols[k].notes[string]?.tie; k++) {
        holdTo = k;
        if (bendCol < 0 && s.cols[k].notes[string]?.bend) bendCol = k;
      }
      const until = tick.time + (holdTo - col + 1) * secPerCol;
      // 쉼표가 나오거나 같은 줄을 다시 치면 소리를 끊는다
      let cutCol = -1;
      for (let k = holdTo + 1; k < s.cols.length && k - col <= s.notesPerBeat * s.beatsPerBar * 2; k++) {
        const nk = s.cols[k].notes[string];
        if (s.cols[k].rest || (nk && !nk.tie && !(note.slide || note.legato))) {
          cutCol = k;
          break;
        }
      }
      const cutAt = cutCol >= 0 ? tick.time + (cutCol - col) * secPerCol : undefined;
      pluckAt(ctx, ctx.destination, midi, tick.time, {
        level,
        dead: note.dead,
        palmMute: column.pm,
        soft: !!prev?.note.legato, // 해머링·풀링으로 이어진 음은 피킹 없이 작게
        bendSemis: bendCol >= 0 ? 2 : undefined,
        bendAt: bendCol >= 0 ? tick.time + (bendCol - col) * secPerCol : undefined,
        until: note.dead ? undefined : until,
        cutAt,
        glide:
          note.slide && next && !next.note.dead
            ? {
                toMidi: midiOf(string, next.note.fret),
                start: tick.time + (next.col - col) * secPerCol * 0.5,
                end: tick.time + (next.col - col) * secPerCol,
              }
            : undefined,
      });
    });
  }, []);

  const where = score ? locate(index, score, loop) : { col: -1, countIn: 0, pass: 0, start: 0 };
  const scale = score && where.col >= 0 ? scaleAt(score, where.col) : 1;
  return {
    running: index >= 0,
    cursor: where.col,
    countIn: where.countIn,
    pass: where.pass,
    /** 지금 구간 템포 배율 (악보 중간 템포 변경 시 1이 아님) */
    scale,
    onTick,
    onSchedule,
    tempoScale,
  };
}

// 스파이더(손가락 독립) 연습 순서 만들기.
// 이웃한 두 줄을 오가며 친다: 패턴의 1·3번째 손가락은 아래 줄(굵은 줄), 2·4번째는 위 줄.
// 예) 1234, 6·5번 줄, 5프렛: 6번줄 5(검지) → 5번줄 6(중지) → 6번줄 7(약지) → 5번줄 8(새끼)
// 한 손가락이 한 프렛을 맡는 것은 크로매틱과 같다.

import { ALL_PATTERNS, NOTE_VALUE_LABEL, patternLabel, type ChromaticSettings, type DrillNote, type DrillRound } from './chromatic';

export type SpiderStep = 1 | 2;

export interface SpiderSettings extends ChromaticSettings {
  /** 다음 줄 쌍으로 넘어갈 때 1줄씩(6·5 → 5·4) 또는 2줄씩(6·5 → 4·3) */
  step: SpiderStep;
}

export const SPIDER_DEFAULTS: SpiderSettings = {
  pattern: '1234',
  startFret: 5,
  direction: 'updown',
  notesPerBeat: 4,
  shift: false,
  step: 1,
};

/** 자주 쓰는 패턴. 나머지는 '전체'에서 고른다 */
export const SPIDER_COMMON = ['1234', '1324', '1423', '2143', '3412', '4321'];
export const SPIDER_ALL = ALL_PATTERNS;

const SHIFT_ROUNDS = 5;

/** 아래 줄 번호들 (0 = 6번줄). 1줄씩이면 0..4, 2줄씩이면 0,2,4 */
const pairStarts = (step: SpiderStep) => (step === 1 ? [0, 1, 2, 3, 4] : [0, 2, 4]);

function round(s: SpiderSettings, startFret: number): DrillNote[] {
  const fingers = s.pattern.split('').map(Number);
  const note = (string: number, finger: number): DrillNote => ({ string, fret: startFret + finger - 1, finger });
  // 아래 줄 → 위 줄 → 아래 줄 → 위 줄
  const pairUp = (low: number) => fingers.map((f, i) => note(i % 2 === 0 ? low : low + 1, f));
  // 내려갈 때는 위 줄부터: 위 → 아래 → 위 → 아래
  const pairDown = (low: number) => fingers.map((f, i) => note(i % 2 === 0 ? low + 1 : low, f));

  const starts = pairStarts(s.step);
  const up = starts.flatMap(pairUp);
  if (s.direction === 'up') return up;
  if (s.direction === 'down') return [...starts].reverse().flatMap(pairDown);
  // 왕복: 올라간 길을 그대로 거꾸로 (손가락 순서도 뒤집힌다)
  return [...up, ...[...up].reverse()];
}

export function spiderRounds(s: SpiderSettings): DrillRound[] {
  const count = s.shift ? SHIFT_ROUNDS : 1;
  return Array.from({ length: count }, (_, i) => ({
    startFret: s.startFret + i,
    notes: round(s, s.startFret + i),
  }));
}

/** BPM·기록은 패턴, 줄 이동, 박당 음 수별로 따로 */
export const spiderKey = (s: SpiderSettings) => `spider:${s.pattern}:${s.step}:${s.notesPerBeat}`;

export const spiderLabel = (s: SpiderSettings) =>
  `스파이더 ${patternLabel(s.pattern)}${s.step === 2 ? ' 두 줄씩' : ''} (${NOTE_VALUE_LABEL[s.notesPerBeat]})`;

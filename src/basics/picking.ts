// 피킹(오른손) 연습 순서 만들기. 왼손은 한 프렛(0이면 개방현)에 고정하고 줄과 피킹 방향에 집중한다.
// 피킹은 얼터네이트: 짝수 번째 음 다운(⊓), 홀수 번째 업(V). 한 바퀴의 음 수는 항상 짝수라 반복해도 방향이 이어진다.

import { NOTE_VALUE_LABEL, type DrillNote, type DrillRound, type NotesPerBeat } from './chromatic';

export type PickingKind = 'single' | 'crossing' | 'inout' | 'skip';
/** 아우터: 굵은 줄 다운 → 가는 줄 업 (피크가 두 줄 바깥). 이너: 굵은 줄 업 → 가는 줄 다운 (두 줄 사이) */
export type PickingMode = 'outside' | 'inside';

export interface PickingSettings {
  kind: PickingKind;
  /** 칠 줄 (0 = 6번줄). 두 줄 연습에서는 아래(굵은) 줄 */
  string: number;
  fret: number;
  mode: PickingMode;
  notesPerBeat: NotesPerBeat;
}

export const PICKING_DEFAULTS: PickingSettings = {
  kind: 'single',
  string: 0,
  fret: 0,
  mode: 'outside',
  notesPerBeat: 4,
};

export const PICKING_FRET_MAX = 12;

export const KIND_LABEL: Record<PickingKind, string> = {
  single: '한 줄',
  crossing: '줄 이동',
  inout: '이너·아우터',
  skip: '줄 건너뛰기',
};

/** 종류별로 고를 수 있는 (아래) 줄. 두 줄 연습은 위 줄이 있어야 한다 */
export function stringChoices(kind: PickingKind): number[] {
  if (kind === 'single') return [0, 1, 2, 3, 4, 5];
  if (kind === 'inout') return [0, 1, 2, 3, 4];
  if (kind === 'skip') return [0, 1, 2, 3];
  return [];
}

/** 다른 줄과 짝을 이룰 위 줄 */
export const upperString = (kind: PickingKind, low: number) => (kind === 'skip' ? low + 2 : low + 1);

/** 종류를 바꿔 지금 줄을 고를 수 없게 되면 고를 수 있는 가장 가까운 줄 */
export function validString(kind: PickingKind, string: number): number {
  const choices = stringChoices(kind);
  return choices.length ? Math.min(Math.max(string, choices[0]), choices[choices.length - 1]) : string;
}

const stringNo = (s: number) => 6 - s; // 0 → 6번줄

export function stringChoiceLabel(kind: PickingKind, low: number): string {
  if (kind === 'single') return `${stringNo(low)}번줄`;
  return `${stringNo(low)}·${stringNo(upperString(kind, low))}번줄`;
}

function round(s: PickingSettings): DrillNote[] {
  const n = s.notesPerBeat;
  const note = (string: number): DrillNote => ({ string, fret: s.fret, finger: s.fret > 0 ? 1 : 0 });
  const low = validString(s.kind, s.string);
  const high = upperString(s.kind, low);

  switch (s.kind) {
    case 'single':
      // 같은 음을 두 마디(4/4 기준) 동안
      return Array.from({ length: n * 8 }, () => note(low));
    case 'crossing': {
      // 한 박마다 다음 줄로: 6 → 1번줄 → 다시 6번줄 쪽으로 (양 끝은 한 번씩)
      const order = [0, 1, 2, 3, 4, 5, 4, 3, 2, 1];
      return order.flatMap((str) => Array.from({ length: n }, () => note(str)));
    }
    case 'inout': {
      // 한 음씩 번갈아. 첫 음(다운)이 굵은 줄이면 아우터, 가는 줄이면 이너
      const [first, second] = s.mode === 'outside' ? [low, high] : [high, low];
      return Array.from({ length: n * 8 }, (_, i) => note(i % 2 === 0 ? first : second));
    }
    case 'skip':
      // 한 박마다 사이 줄을 건너 번갈아
      return Array.from({ length: 8 }, (_, b) => b).flatMap((b) =>
        Array.from({ length: n }, () => note(b % 2 === 0 ? low : high)),
      );
  }
}

export function pickingRounds(s: PickingSettings): DrillRound[] {
  return [{ startFret: s.fret, notes: round(s) }];
}

/** BPM·기록은 종류(이너/아우터 구분)와 박당 음 수별로 따로. 줄·프렛은 같이 쓴다 */
export const pickingKey = (s: PickingSettings) =>
  `picking:${s.kind === 'inout' ? s.mode : s.kind}:${s.notesPerBeat}`;

export const pickingLabel = (s: PickingSettings) => {
  const name = s.kind === 'inout' ? (s.mode === 'outside' ? '아우터' : '이너') : KIND_LABEL[s.kind];
  return `피킹 ${name} (${NOTE_VALUE_LABEL[s.notesPerBeat]})`;
};

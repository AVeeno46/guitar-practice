// 곡에 저장하는 TAB 악보.
// 박을 일정한 칸(리듬 단위)으로 나눈 격자다. 칸 하나 = 메트로놈 세분 소리 하나라서
// 재생할 때 소리 번호로 바로 칸을 찾을 수 있다.
//
// cols[i] 는 6줄짜리 배열: 0 = 6번줄(저음 E) … 5 = 1번줄. null은 그 줄을 안 침.

import { TUNING } from '../../scales/theory';

export type NotesPerBeat = 1 | 2 | 3 | 4;
export type Fret = number | null;
export type Column = Fret[];

export interface TabScore {
  beatsPerBar: number;
  notesPerBeat: NotesPerBeat;
  /** 마디 구분 없이 이어진 칸들. 길이는 항상 한 마디 칸 수의 배수 */
  cols: Column[];
}

export const MAX_FRET = 24;
export const STRING_COUNT = 6;
export const STRING_NAMES = ['E', 'A', 'D', 'G', 'B', 'e'];
export const RHYTHM_LABEL: Record<NotesPerBeat, string> = {
  1: '4분음표',
  2: '8분음표',
  3: '셋잇단',
  4: '16분음표',
};

export const emptyColumn = (): Column => Array(STRING_COUNT).fill(null);
export const perBar = (s: TabScore) => s.beatsPerBar * s.notesPerBeat;
export const barCount = (s: TabScore) => s.cols.length / perBar(s);
export const isEmptyColumn = (c: Column) => c.every((f) => f === null);

export function createScore(beatsPerBar = 4, notesPerBeat: NotesPerBeat = 2, bars = 4): TabScore {
  return {
    beatsPerBar,
    notesPerBeat,
    cols: Array.from({ length: beatsPerBar * notesPerBeat * bars }, emptyColumn),
  };
}

export const midiOf = (string: number, fret: number) => TUNING[string] + fret;

// ---------- 편집 (모두 새 객체를 돌려준다) ----------

export function setFret(s: TabScore, col: number, string: number, fret: Fret): TabScore {
  const cols = s.cols.slice();
  cols[col] = cols[col].slice();
  cols[col][string] = fret;
  return { ...s, cols };
}

/** bar 뒤에 빈 마디를 넣는다 (bar = -1이면 맨 앞) */
export function insertBar(s: TabScore, afterBar: number): TabScore {
  const n = perBar(s);
  const at = (afterBar + 1) * n;
  const cols = [...s.cols.slice(0, at), ...Array.from({ length: n }, emptyColumn), ...s.cols.slice(at)];
  return { ...s, cols };
}

/** bar를 복제해서 바로 뒤에 붙인다 */
export function duplicateBar(s: TabScore, bar: number): TabScore {
  const n = perBar(s);
  const copy = s.cols.slice(bar * n, (bar + 1) * n).map((c) => c.slice());
  const at = (bar + 1) * n;
  return { ...s, cols: [...s.cols.slice(0, at), ...copy, ...s.cols.slice(at)] };
}

/** 마디를 지운다. 마지막 한 마디는 지우지 않고 비운다 */
export function deleteBar(s: TabScore, bar: number): TabScore {
  const n = perBar(s);
  if (barCount(s) <= 1) return { ...s, cols: Array.from({ length: n }, emptyColumn) };
  return { ...s, cols: [...s.cols.slice(0, bar * n), ...s.cols.slice((bar + 1) * n)] };
}

/**
 * 박자(한 마디 박 수)나 리듬 단위(박당 칸 수)를 바꾼다.
 * 이미 적은 음이 새 격자에 정확히 놓이지 않으면(예: 16분음표 자리에 있는 음을 8분음표로) null.
 */
export function reshape(s: TabScore, beatsPerBar: number, notesPerBeat: NotesPerBeat): TabScore | null {
  // 1) 리듬 단위: 각 칸의 시작 위치(박 단위)를 새 격자로 옮긴다
  let cols = s.cols;
  if (notesPerBeat !== s.notesPerBeat) {
    const beats = s.cols.length / s.notesPerBeat;
    const next: Column[] = Array.from({ length: beats * notesPerBeat }, emptyColumn);
    for (let i = 0; i < s.cols.length; i++) {
      if (isEmptyColumn(s.cols[i])) continue;
      const pos = (i * notesPerBeat) / s.notesPerBeat;
      if (Math.abs(pos - Math.round(pos)) > 1e-9) return null;
      next[Math.round(pos)] = s.cols[i].slice();
    }
    cols = next;
  }
  // 2) 박자: 이어진 칸을 새 마디 길이로 다시 나누고, 모자란 끝은 빈 칸으로 채운다
  const n = beatsPerBar * notesPerBeat;
  const padded = cols.slice();
  while (padded.length % n !== 0 || padded.length === 0) padded.push(emptyColumn());
  // 끝에 생긴 완전히 빈 마디는 하나만 남긴다
  while (padded.length > n && padded.slice(-n).every(isEmptyColumn) && padded.slice(-2 * n, -n).every(isEmptyColumn)) {
    padded.splice(-n, n);
  }
  return { beatsPerBar, notesPerBeat, cols: padded };
}

/** 저장된 값이 깨져 있어도 화면이 망가지지 않게 정리한다 */
export function normalizeScore(raw: unknown): TabScore | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Partial<TabScore>;
  const beatsPerBar = Number(r.beatsPerBar) || 4;
  const npb = ([1, 2, 3, 4] as const).find((v) => v === r.notesPerBeat) ?? 2;
  const n = beatsPerBar * npb;
  const cols = Array.isArray(r.cols)
    ? r.cols.map((c) =>
        Array.from({ length: STRING_COUNT }, (_, i) => {
          const f = Array.isArray(c) ? c[i] : null;
          return typeof f === 'number' && f >= 0 && f <= MAX_FRET ? f : null;
        }),
      )
    : [];
  while (cols.length % n !== 0 || cols.length === 0) cols.push(emptyColumn());
  return { beatsPerBar, notesPerBeat: npb, cols };
}

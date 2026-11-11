// 코드 사전: 코드 종류별 구성음과 운지(보이싱).
// 운지는 두 가지로 만든다.
//  1) 자주 쓰는 오픈 코드 (C, D, G 등) — 손으로 적은 것
//  2) 옮겨 쓰는 모양 — 6번줄 근음(E 모양)·5번줄 근음(A 모양)을 근음 프렛만큼 옮긴 것.
//     근음 프렛이 0이면 그대로 오픈 코드가 된다 (E, Em, A, Am …)

import { TUNING } from '../scales/theory';

export type ChordType =
  | 'maj'
  | 'm'
  | '7'
  | 'm7'
  | 'maj7'
  | 'sus2'
  | 'sus4'
  | '5'
  | '6'
  | 'm6'
  | 'add9'
  | '9'
  | 'dim7'
  | 'm7b5'
  | 'aug';

interface ChordDef {
  /** 코드 이름에 붙는 기호 (C + 'm7' → Cm7) */
  symbol: string;
  /** 고르는 칩에 쓰는 이름 */
  label: string;
  intervals: number[];
  degrees: string[];
  /** 없어도 되는 음 (주로 5도) */
  optional?: number[];
}

export const CHORDS: Record<ChordType, ChordDef> = {
  maj: { symbol: '', label: '메이저', intervals: [0, 4, 7], degrees: ['R', '3', '5'] },
  m: { symbol: 'm', label: '마이너', intervals: [0, 3, 7], degrees: ['R', '♭3', '5'] },
  '7': { symbol: '7', label: '7', intervals: [0, 4, 7, 10], degrees: ['R', '3', '5', '♭7'], optional: [7] },
  m7: { symbol: 'm7', label: 'm7', intervals: [0, 3, 7, 10], degrees: ['R', '♭3', '5', '♭7'], optional: [7] },
  maj7: { symbol: 'maj7', label: 'maj7', intervals: [0, 4, 7, 11], degrees: ['R', '3', '5', '7'], optional: [7] },
  sus2: { symbol: 'sus2', label: 'sus2', intervals: [0, 2, 7], degrees: ['R', '2', '5'] },
  sus4: { symbol: 'sus4', label: 'sus4', intervals: [0, 5, 7], degrees: ['R', '4', '5'] },
  '5': { symbol: '5', label: '파워코드 5', intervals: [0, 7], degrees: ['R', '5'] },
  '6': { symbol: '6', label: '6', intervals: [0, 4, 7, 9], degrees: ['R', '3', '5', '6'], optional: [7] },
  m6: { symbol: 'm6', label: 'm6', intervals: [0, 3, 7, 9], degrees: ['R', '♭3', '5', '6'], optional: [7] },
  add9: { symbol: 'add9', label: 'add9', intervals: [0, 2, 4, 7], degrees: ['R', '9', '3', '5'], optional: [7] },
  '9': { symbol: '9', label: '9', intervals: [0, 2, 4, 7, 10], degrees: ['R', '9', '3', '5', '♭7'], optional: [7] },
  dim7: { symbol: 'dim7', label: 'dim7', intervals: [0, 3, 6, 9], degrees: ['R', '♭3', '♭5', '𝄫7'] },
  m7b5: { symbol: 'm7♭5', label: 'm7♭5', intervals: [0, 3, 6, 10], degrees: ['R', '♭3', '♭5', '♭7'] },
  aug: { symbol: 'aug', label: 'aug', intervals: [0, 4, 8], degrees: ['R', '3', '♯5'] },
};

/** 고르는 순서 (Object.keys는 '5','7' 같은 숫자 키를 앞으로 보내서 직접 적는다) */
export const CHORD_TYPES: ChordType[] = ['maj', 'm', '7', 'm7', 'maj7', 'sus2', 'sus4', '5', '6', 'm6', 'add9', '9', 'dim7', 'm7b5', 'aug'];

/** 기타에서 흔히 쓰는 근음 이름 */
export const ROOT_NAMES = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];

export const chordName = (root: number, type: ChordType) => ROOT_NAMES[root] + CHORDS[type].symbol;

/** 운지. frets/fingers는 6번줄부터 1번줄 순서, null은 치지 않는 줄, 손가락 0은 개방현 */
export interface Voicing {
  frets: (number | null)[];
  fingers: number[];
  /** 'open' 오픈 코드, 'E' 6번줄 근음 모양, 'A' 5번줄 근음 모양 */
  shape: 'open' | 'E' | 'A';
}

type Offsets = (number | null)[];
interface Template {
  /** 근음 줄: 6번줄(0) 또는 5번줄(1) */
  rootString: 0 | 1;
  offsets: Offsets;
  fingers: number[];
}

const x = null;

// 옮겨 쓰는 모양. offsets는 근음 프렛에서 몇 프렛 떨어졌는지
const TEMPLATES: Partial<Record<ChordType, Template[]>> = {
  maj: [
    { rootString: 0, offsets: [0, 2, 2, 1, 0, 0], fingers: [1, 3, 4, 2, 1, 1] },
    { rootString: 1, offsets: [x, 0, 2, 2, 2, 0], fingers: [0, 1, 3, 3, 3, 1] },
  ],
  m: [
    { rootString: 0, offsets: [0, 2, 2, 0, 0, 0], fingers: [1, 3, 4, 1, 1, 1] },
    { rootString: 1, offsets: [x, 0, 2, 2, 1, 0], fingers: [0, 1, 3, 4, 2, 1] },
  ],
  '7': [
    { rootString: 0, offsets: [0, 2, 0, 1, 0, 0], fingers: [1, 3, 1, 2, 1, 1] },
    { rootString: 1, offsets: [x, 0, 2, 0, 2, 0], fingers: [0, 1, 3, 1, 4, 1] },
  ],
  m7: [
    { rootString: 0, offsets: [0, 2, 0, 0, 0, 0], fingers: [1, 3, 1, 1, 1, 1] },
    { rootString: 1, offsets: [x, 0, 2, 0, 1, 0], fingers: [0, 1, 3, 1, 2, 1] },
  ],
  maj7: [
    { rootString: 0, offsets: [0, x, 1, 1, 0, x], fingers: [1, 0, 3, 4, 2, 0] },
    { rootString: 1, offsets: [x, 0, 2, 1, 2, 0], fingers: [0, 1, 3, 2, 4, 1] },
  ],
  sus2: [{ rootString: 1, offsets: [x, 0, 2, 2, 0, 0], fingers: [0, 1, 3, 4, 1, 1] }],
  sus4: [
    { rootString: 0, offsets: [0, 2, 2, 2, 0, 0], fingers: [1, 2, 3, 4, 1, 1] },
    { rootString: 1, offsets: [x, 0, 2, 2, 3, 0], fingers: [0, 1, 2, 3, 4, 1] },
  ],
  '5': [
    { rootString: 0, offsets: [0, 2, 2, x, x, x], fingers: [1, 3, 4, 0, 0, 0] },
    { rootString: 1, offsets: [x, 0, 2, 2, x, x], fingers: [0, 1, 3, 4, 0, 0] },
  ],
  '6': [{ rootString: 1, offsets: [x, 0, 2, 2, 2, 2], fingers: [0, 1, 3, 3, 3, 3] }],
  m6: [{ rootString: 1, offsets: [x, 0, 2, 2, 1, 2], fingers: [0, 1, 3, 3, 2, 4] }],
  add9: [{ rootString: 1, offsets: [x, 0, 2, 4, 2, x], fingers: [0, 1, 2, 4, 3, 0] }],
  '9': [{ rootString: 1, offsets: [x, 0, -1, 0, 0, 0], fingers: [0, 2, 1, 3, 3, 3] }],
  dim7: [{ rootString: 1, offsets: [x, 0, 1, -1, 1, x], fingers: [0, 2, 3, 1, 4, 0] }],
  m7b5: [
    { rootString: 1, offsets: [x, 0, 1, 0, 1, x], fingers: [0, 1, 3, 2, 4, 0] },
    { rootString: 0, offsets: [0, x, 0, 0, -1, x], fingers: [2, 0, 3, 4, 1, 0] },
  ],
  aug: [
    { rootString: 1, offsets: [x, 0, -1, -2, -2, x], fingers: [0, 4, 3, 1, 1, 0] },
    { rootString: 0, offsets: [0, x, 2, 1, 1, x], fingers: [1, 0, 4, 2, 3, 0] },
  ],
};

// 손으로 적은 오픈 코드: '근음 번호:종류' → 운지
const OPEN: Record<string, { frets: Offsets; fingers: number[] }[]> = {
  '0:maj': [{ frets: [x, 3, 2, 0, 1, 0], fingers: [0, 3, 2, 0, 1, 0] }],
  '0:7': [{ frets: [x, 3, 2, 3, 1, 0], fingers: [0, 3, 2, 4, 1, 0] }],
  '0:maj7': [{ frets: [x, 3, 2, 0, 0, 0], fingers: [0, 3, 2, 0, 0, 0] }],
  '0:add9': [{ frets: [x, 3, 2, 0, 3, 0], fingers: [0, 2, 1, 0, 3, 0] }],
  '0:sus2': [{ frets: [x, 3, 0, 0, 1, 3], fingers: [0, 3, 0, 0, 1, 4] }],
  '0:sus4': [{ frets: [x, 3, 3, 0, 1, 1], fingers: [0, 3, 4, 0, 1, 1] }],
  '2:maj': [{ frets: [x, x, 0, 2, 3, 2], fingers: [0, 0, 0, 1, 3, 2] }],
  '2:m': [{ frets: [x, x, 0, 2, 3, 1], fingers: [0, 0, 0, 2, 3, 1] }],
  '2:7': [{ frets: [x, x, 0, 2, 1, 2], fingers: [0, 0, 0, 2, 1, 3] }],
  '2:m7': [{ frets: [x, x, 0, 2, 1, 1], fingers: [0, 0, 0, 2, 1, 1] }],
  '2:maj7': [{ frets: [x, x, 0, 2, 2, 2], fingers: [0, 0, 0, 1, 1, 1] }],
  '2:sus2': [{ frets: [x, x, 0, 2, 3, 0], fingers: [0, 0, 0, 1, 3, 0] }],
  '2:sus4': [{ frets: [x, x, 0, 2, 3, 3], fingers: [0, 0, 0, 1, 3, 4] }],
  '2:5': [{ frets: [x, x, 0, 2, 3, x], fingers: [0, 0, 0, 1, 2, 0] }],
  '4:sus2': [{ frets: [0, 2, 4, 4, 0, 0], fingers: [0, 1, 3, 4, 0, 0] }],
  '5:maj7': [{ frets: [x, x, 3, 2, 1, 0], fingers: [0, 0, 3, 2, 1, 0] }],
  '7:maj': [
    { frets: [3, 2, 0, 0, 0, 3], fingers: [2, 1, 0, 0, 0, 3] },
    { frets: [3, 2, 0, 0, 3, 3], fingers: [2, 1, 0, 0, 3, 4] },
  ],
  '7:7': [{ frets: [3, 2, 0, 0, 0, 1], fingers: [3, 2, 0, 0, 0, 1] }],
  '7:maj7': [{ frets: [3, 2, 0, 0, 0, 2], fingers: [3, 2, 0, 0, 0, 1] }],
  '7:5': [{ frets: [3, 5, 5, x, x, x], fingers: [1, 3, 4, 0, 0, 0] }],
  '11:7': [{ frets: [x, 2, 1, 2, 0, 2], fingers: [0, 2, 1, 3, 0, 4] }],
};

const mod12 = (n: number) => ((n % 12) + 12) % 12;
const MAX_ROOT_FRET = 12;

function fromTemplate(t: Template, rootFret: number): Voicing | null {
  const frets = t.offsets.map((o) => (o === null ? null : rootFret + o));
  if (frets.some((f) => f !== null && f < 0)) return null;
  // 근음 프렛이 0이면 근음 프렛의 손가락(검지 바레)은 개방현이 되고 나머지 손가락은 하나씩 당겨진다
  const fingers =
    rootFret === 0
      ? t.offsets.map((o, i) => (o === null || o === 0 ? 0 : Math.max(1, t.fingers[i] - 1)))
      : t.fingers.map((f, i) => (t.offsets[i] === null ? 0 : f));
  return { frets, fingers, shape: rootFret === 0 ? 'open' : t.rootString === 0 ? 'E' : 'A' };
}

/** 이 코드의 운지 목록. 낮은 프렛(오픈 코드)부터 */
export function voicingsFor(root: number, type: ChordType): Voicing[] {
  const out: Voicing[] = (OPEN[`${root}:${type}`] ?? []).map((v) => ({ ...v, shape: 'open' as const }));
  for (const t of TEMPLATES[type] ?? []) {
    const base = mod12(root - TUNING[t.rootString]);
    for (const rootFret of [base, base + 12]) {
      if (rootFret > MAX_ROOT_FRET) continue;
      const v = fromTemplate(t, rootFret);
      if (v) out.push(v);
    }
  }
  // 같은 운지 지우기
  const seen = new Set<string>();
  const unique = out.filter((v) => {
    const k = v.frets.join(',');
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  const low = (v: Voicing) => Math.min(...v.frets.filter((f): f is number => f !== null && f > 0), 99);
  return unique.sort((a, b) => (a.shape === 'open' ? 0 : 1) - (b.shape === 'open' ? 0 : 1) || low(a) - low(b));
}

/** 운지에서 나는 음 (MIDI). 6번줄부터, 치지 않는 줄은 빠진다 */
export const voicingMidi = (v: Voicing) =>
  v.frets.flatMap((f, s) => (f === null ? [] : [TUNING[s] + f]));

/** 운지가 정말 그 코드인지: 구성음 밖의 음이 없고, 꼭 필요한 음이 다 있고, 가장 낮은 음이 근음 */
export function checkVoicing(root: number, type: ChordType, v: Voicing): string | null {
  const def = CHORDS[type];
  const notes = voicingMidi(v);
  const ivs = new Set(notes.map((n) => mod12(n - root)));
  for (const iv of ivs) if (!def.intervals.includes(iv)) return `구성음 아님: ${iv}`;
  for (const iv of def.intervals) {
    if (!ivs.has(iv) && !def.optional?.includes(iv)) return `빠진 음: ${iv}`;
  }
  if (mod12(Math.min(...notes) - root) !== 0) return '가장 낮은 음이 근음이 아님';
  return null;
}

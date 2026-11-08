// 크로매틱(손가락 독립) 연습 순서 만들기.
// 한 손가락이 한 프렛을 맡는다: 시작 프렛이 5면 검지 5, 중지 6, 약지 7, 새끼 8.

export type Direction = 'up' | 'down' | 'updown';
export type NotesPerBeat = 1 | 2 | 3 | 4;

export interface ChromaticSettings {
  pattern: string; // 손가락 순서, 예: '1234'
  startFret: number;
  direction: Direction;
  notesPerBeat: NotesPerBeat;
  /** 한 바퀴 돌 때마다 시작 프렛을 1씩 올린다 (5바퀴 후 처음으로) */
  shift: boolean;
}

export const CHROMATIC_DEFAULTS: ChromaticSettings = {
  pattern: '1234',
  startFret: 5,
  direction: 'updown',
  notesPerBeat: 4,
  shift: false,
};

/** 자주 쓰는 패턴. 나머지는 '전체 패턴'에서 고른다 */
export const COMMON_PATTERNS = ['1234', '4321', '1324', '1243', '1423', '1342', '2413', '3142'];

/** 1,2,3,4로 만들 수 있는 24가지 순서 전부 */
export const ALL_PATTERNS: string[] = (() => {
  const out: string[] = [];
  const permute = (rest: string, acc: string) => {
    if (!rest) out.push(acc);
    for (let i = 0; i < rest.length; i++) permute(rest.slice(0, i) + rest.slice(i + 1), acc + rest[i]);
  };
  permute('1234', '');
  return out;
})();

export const patternLabel = (p: string) => p.split('').join('-');

export const START_FRET_MIN = 1;
export const START_FRET_MAX = 12;
const SHIFT_ROUNDS = 5;

export interface DrillNote {
  string: number; // 0 = 6번줄(저음 E) … 5 = 1번줄
  fret: number;
  finger: number; // 1~4
}

/** 한 바퀴(시작 프렛 하나)의 음 순서 */
function round(s: ChromaticSettings, startFret: number): DrillNote[] {
  const fingers = s.pattern.split('').map(Number);
  const reversed = [...fingers].reverse();
  const note = (string: number, finger: number) => ({ string, fret: startFret + finger - 1, finger });
  const up = [0, 1, 2, 3, 4, 5].flatMap((str) => fingers.map((f) => note(str, f)));
  // 내려올 때는 손가락 순서를 뒤집는다 (1-2-3-4로 올라갔으면 4-3-2-1로 내려옴)
  const downMirrored = [5, 4, 3, 2, 1, 0].flatMap((str) => reversed.map((f) => note(str, f)));
  const downPlain = [5, 4, 3, 2, 1, 0].flatMap((str) => fingers.map((f) => note(str, f)));
  if (s.direction === 'up') return up;
  if (s.direction === 'down') return downPlain;
  return [...up, ...downMirrored];
}

export interface DrillRound {
  startFret: number;
  notes: DrillNote[];
}

/** 연습 전체: 프렛 이동을 켜면 시작 프렛이 하나씩 올라가는 여러 바퀴 */
export function chromaticRounds(s: ChromaticSettings): DrillRound[] {
  const count = s.shift ? SHIFT_ROUNDS : 1;
  return Array.from({ length: count }, (_, i) => ({
    startFret: s.startFret + i,
    notes: round(s, s.startFret + i),
  }));
}

/** 기록·BPM을 패턴과 박당 음 수별로 따로 모은다 (같은 BPM이라도 박당 음 수가 다르면 다른 빠르기) */
export const chromaticKey = (s: ChromaticSettings) => `chromatic:${s.pattern}:${s.notesPerBeat}`;

export const NOTE_VALUE_LABEL: Record<NotesPerBeat, string> = {
  1: '4분음표',
  2: '8분음표',
  3: '셋잇단',
  4: '16분음표',
};

export const chromaticLabel = (s: ChromaticSettings) =>
  `크로매틱 ${patternLabel(s.pattern)} (${NOTE_VALUE_LABEL[s.notesPerBeat]})`;

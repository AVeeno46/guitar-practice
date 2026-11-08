// 펜타토닉 스케일 계산: 음 이름, 도수, 지판 위치, 5개 포지션(박스).

export type ScaleType = 'minor' | 'major';

/** 표준 튜닝. 0번이 6번줄(저음 E2), 5번이 1번줄(고음 E4). 값은 MIDI 음 높이. */
export const TUNING = [40, 45, 50, 55, 59, 64];
export const STRING_LABELS = ['6', '5', '4', '3', '2', '1'];
export const MAX_FRET = 15;

const SHARPS = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
const FLATS = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'];

interface ScaleDef {
  name: string;
  intervals: number[];
  degrees: string[];
  /** 블루스 스케일로 만들 때 더하는 음 */
  blue: { interval: number; degree: string };
}

export const SCALES: Record<ScaleType, ScaleDef> = {
  minor: {
    name: '마이너 펜타토닉',
    intervals: [0, 3, 5, 7, 10],
    degrees: ['R', '♭3', '4', '5', '♭7'],
    blue: { interval: 6, degree: '♭5' },
  },
  major: {
    name: '메이저 펜타토닉',
    intervals: [0, 2, 4, 7, 9],
    degrees: ['R', '2', '3', '5', '6'],
    blue: { interval: 3, degree: '♭3' },
  },
};

const mod12 = (n: number) => ((n % 12) + 12) % 12;

/** 관계조: A 마이너 ↔ C 메이저처럼 같은 음을 쓰는 다른 종류의 키 */
export const relativeRoot = (root: number, type: ScaleType) =>
  type === 'minor' ? mod12(root + 3) : mod12(root - 3);

/** 조표가 ♭인 키(F, B♭, E♭, A♭, D♭, G♭ 메이저와 그 관계 단조)는 ♭로 쓴다. */
function usesFlats(root: number, type: ScaleType) {
  const major = type === 'major' ? root : relativeRoot(root, type);
  return [5, 10, 3, 8, 1, 6].includes(major);
}

export const noteName = (pc: number, root: number, type: ScaleType) =>
  (usesFlats(root, type) ? FLATS : SHARPS)[mod12(pc)];

export const rootLabel = (root: number, type: ScaleType) => noteName(root, root, type);

export interface ScaleNote {
  pc: number; // 0..11 (C=0)
  name: string;
  degree: string;
  isRoot: boolean;
  isBlue: boolean;
}

/** 이 스케일에 들어가는 음들. 키가 pc인 Map으로 돌려준다. */
export function scaleNotes(root: number, type: ScaleType, withBlue: boolean): Map<number, ScaleNote> {
  const def = SCALES[type];
  const notes = new Map<number, ScaleNote>();
  def.intervals.forEach((iv, i) => {
    const pc = mod12(root + iv);
    notes.set(pc, { pc, name: noteName(pc, root, type), degree: def.degrees[i], isRoot: iv === 0, isBlue: false });
  });
  if (withBlue) {
    const pc = mod12(root + def.blue.interval);
    // 블루 노트는 반음 내린 음(♭5, ♭3)이라 키와 상관없이 ♭로 적는다
    notes.set(pc, { pc, name: FLATS[pc], degree: def.blue.degree, isRoot: false, isBlue: true });
  }
  return notes;
}

export const pitchClassAt = (string: number, fret: number) => mod12(TUNING[string] + fret);

export const cellKey = (string: number, fret: number) => `${string}:${fret}`;

export interface Box {
  position: number; // 1..5
  cells: Set<string>; // cellKey 모음
  /** 줄마다 이 박스가 차지하는 프렛 범위 (블루 노트를 박스 안으로 볼지 판단할 때 쓴다) */
  spans: [number, number][];
}

/**
 * 5개 포지션을 계산한다.
 * 포지션 n은 6번줄에서 n번째 스케일 음(1번은 근음)부터 시작해,
 * 한 줄에 두 음씩 올라가며 1번줄까지 채운 모양이다.
 * 지판 안에 들어가면 12프렛 위의 같은 모양도 함께 돌려준다.
 */
export function pentatonicBoxes(root: number, type: ScaleType): Box[] {
  const intervals = SCALES[type].intervals;
  const inScale = new Set(intervals.map((iv) => mod12(root + iv)));
  const boxes: Box[] = [];

  intervals.forEach((iv, i) => {
    const startFret = mod12(root + iv - TUNING[0]);
    for (const base of [startFret, startFret + 12]) {
      const pitches: number[] = [];
      for (let p = TUNING[0] + base; pitches.length < 12; p++) {
        if (inScale.has(mod12(p))) pitches.push(p);
      }
      const cells = new Set<string>();
      const spans: [number, number][] = [];
      let fits = true;
      TUNING.forEach((open, s) => {
        const a = pitches[s * 2] - open;
        const b = pitches[s * 2 + 1] - open;
        if (a < 0 || b > MAX_FRET) fits = false;
        cells.add(cellKey(s, a));
        cells.add(cellKey(s, b));
        spans.push([a, b]);
      });
      if (fits) boxes.push({ position: i + 1, cells, spans });
    }
  });
  return boxes;
}

/** A4=440Hz 기준 주파수 */
export const frequencyOf = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

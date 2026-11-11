// 스케일 계산: 음 이름, 도수, 지판 위치, 포지션(박스).
// 펜타토닉(5음)은 한 줄에 2음씩 5개 포지션, 7음 스케일(메이저·내추럴 마이너·모드)은 한 줄에 3음씩(3NPS) 7개 포지션.

export type PentatonicType = 'minor' | 'major';
export type SevenType = 'ionian' | 'dorian' | 'phrygian' | 'lydian' | 'mixolydian' | 'aeolian' | 'locrian';
export type ScaleType = PentatonicType | SevenType;

/** 표준 튜닝. 0번이 6번줄(저음 E2), 5번이 1번줄(고음 E4). 값은 MIDI 음 높이. */
export const TUNING = [40, 45, 50, 55, 59, 64];
export const STRING_LABELS = ['6', '5', '4', '3', '2', '1'];
export const MAX_FRET = 15;

const SHARPS = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
const FLATS = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'];

interface ScaleDef {
  name: string;
  /** 칩에 쓰는 짧은 이름 */
  short: string;
  intervals: number[];
  degrees: string[];
  /** 이 근음이 메이저 키의 몇 반음 위인지 (A 에올리안 → C 메이저에서 9). 조표(♯/♭)와 같은 음 스케일 안내에 쓴다 */
  parentOffset: number;
  /** 블루스 스케일로 만들 때 더하는 음 (펜타토닉만) */
  blue?: { interval: number; degree: string };
  /** 소리 색을 만드는 음 (모드) */
  feature?: { interval: number; text: string };
}

export const SCALES: Record<ScaleType, ScaleDef> = {
  minor: {
    name: '마이너 펜타토닉',
    short: '마이너',
    intervals: [0, 3, 5, 7, 10],
    degrees: ['R', '♭3', '4', '5', '♭7'],
    parentOffset: 9,
    blue: { interval: 6, degree: '♭5' },
  },
  major: {
    name: '메이저 펜타토닉',
    short: '메이저',
    intervals: [0, 2, 4, 7, 9],
    degrees: ['R', '2', '3', '5', '6'],
    parentOffset: 0,
    blue: { interval: 3, degree: '♭3' },
  },
  ionian: {
    name: '메이저 스케일',
    short: '메이저',
    intervals: [0, 2, 4, 5, 7, 9, 11],
    degrees: ['R', '2', '3', '4', '5', '6', '7'],
    parentOffset: 0,
  },
  aeolian: {
    name: '내추럴 마이너',
    short: '내추럴 마이너',
    intervals: [0, 2, 3, 5, 7, 8, 10],
    degrees: ['R', '2', '♭3', '4', '5', '♭6', '♭7'],
    parentOffset: 9,
  },
  dorian: {
    name: '도리안',
    short: '도리안',
    intervals: [0, 2, 3, 5, 7, 9, 10],
    degrees: ['R', '2', '♭3', '4', '5', '6', '♭7'],
    parentOffset: 2,
    feature: { interval: 9, text: '내추럴 마이너에서 6을 반음 올린 소리. 밝은 마이너, 펑크·퓨전에 많이 써요' },
  },
  phrygian: {
    name: '프리지안',
    short: '프리지안',
    intervals: [0, 1, 3, 5, 7, 8, 10],
    degrees: ['R', '♭2', '♭3', '4', '5', '♭6', '♭7'],
    parentOffset: 4,
    feature: { interval: 1, text: '내추럴 마이너에서 2를 반음 내린 소리. 어둡고 스페인풍, 메탈에 많이 써요' },
  },
  lydian: {
    name: '리디안',
    short: '리디안',
    intervals: [0, 2, 4, 6, 7, 9, 11],
    degrees: ['R', '2', '3', '♯4', '5', '6', '7'],
    parentOffset: 5,
    feature: { interval: 6, text: '메이저에서 4를 반음 올린 소리. 떠 있는 듯한 몽환적인 메이저' },
  },
  mixolydian: {
    name: '믹솔리디안',
    short: '믹솔리디안',
    intervals: [0, 2, 4, 5, 7, 9, 10],
    degrees: ['R', '2', '3', '4', '5', '6', '♭7'],
    parentOffset: 7,
    feature: { interval: 10, text: '메이저에서 7을 반음 내린 소리. 블루스·록의 도미넌트 7 코드 위에서 써요' },
  },
  locrian: {
    name: '로크리안',
    short: '로크리안',
    intervals: [0, 1, 3, 5, 6, 8, 10],
    degrees: ['R', '♭2', '♭3', '4', '♭5', '♭6', '♭7'],
    parentOffset: 11,
    feature: { interval: 6, text: '5가 반음 내려간 불안정한 소리. 마이너 7♭5(하프 디미니시) 코드 위에서 써요' },
  },
};

export const PENTATONIC_TYPES: PentatonicType[] = ['minor', 'major'];
export const SEVEN_TYPES: SevenType[] = ['ionian', 'aeolian', 'dorian', 'mixolydian', 'lydian', 'phrygian', 'locrian'];
export const isPentatonic = (t: ScaleType): t is PentatonicType => t === 'minor' || t === 'major';
/** 예전에 저장된 값이 이상하면 마이너 펜타토닉으로 */
export const validType = (t: unknown): ScaleType => (typeof t === 'string' && t in SCALES ? (t as ScaleType) : 'minor');

const mod12 = (n: number) => ((n % 12) + 12) % 12;

/** 같은 음을 쓰는 메이저 키의 근음 (A 마이너 → C, D 도리안 → C) */
export const parentMajor = (root: number, type: ScaleType) => mod12(root - SCALES[type].parentOffset);

/** 관계조: A 마이너 ↔ C 메이저처럼 같은 음을 쓰는 다른 종류의 키 */
export const relativeRoot = (root: number, type: ScaleType) =>
  SCALES[type].parentOffset === 0 ? mod12(root + 9) : parentMajor(root, type);

/** 조표가 ♭인 키(F, B♭, E♭, A♭, D♭, G♭ 메이저와 같은 음 스케일)는 ♭로 쓴다. */
function usesFlats(root: number, type: ScaleType) {
  return [5, 10, 3, 8, 1, 6].includes(parentMajor(root, type));
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
  /** 모드의 특징음 */
  isFeature?: boolean;
}

/** 이 스케일에 들어가는 음들. 키가 pc인 Map으로 돌려준다. */
export function scaleNotes(root: number, type: ScaleType, withBlue: boolean): Map<number, ScaleNote> {
  const def = SCALES[type];
  const notes = new Map<number, ScaleNote>();
  def.intervals.forEach((iv, i) => {
    const pc = mod12(root + iv);
    notes.set(pc, {
      pc,
      name: noteName(pc, root, type),
      degree: def.degrees[i],
      isRoot: iv === 0,
      isBlue: false,
      isFeature: def.feature?.interval === iv,
    });
  });
  if (withBlue && def.blue) {
    const pc = mod12(root + def.blue.interval);
    // 블루 노트는 반음 내린 음(♭5, ♭3)이라 키와 상관없이 ♭로 적는다
    notes.set(pc, { pc, name: FLATS[pc], degree: def.blue.degree, isRoot: false, isBlue: true });
  }
  return notes;
}

export const pitchClassAt = (string: number, fret: number) => mod12(TUNING[string] + fret);

export const cellKey = (string: number, fret: number) => `${string}:${fret}`;

export interface Box {
  position: number; // 1..5 (펜타토닉) / 1..7 (7음)
  cells: Set<string>; // cellKey 모음
  /** 줄마다 이 박스가 차지하는 프렛 범위 (블루 노트를 박스 안으로 볼지 판단할 때 쓴다) */
  spans: [number, number][];
}

/**
 * 포지션들을 계산한다.
 * 포지션 n은 6번줄에서 n번째 스케일 음(1번은 근음)부터 시작해,
 * 한 줄에 펜타토닉은 2음, 7음 스케일은 3음(3NPS)씩 올라가며 1번줄까지 채운 모양이다.
 * 지판 안에 들어가면 12프렛 위의 같은 모양도 함께 돌려준다.
 */
export function scaleBoxes(root: number, type: ScaleType): Box[] {
  const intervals = SCALES[type].intervals;
  const perString = intervals.length === 5 ? 2 : 3;
  const inScale = new Set(intervals.map((iv) => mod12(root + iv)));
  const boxes: Box[] = [];

  intervals.forEach((iv, i) => {
    const startFret = mod12(root + iv - TUNING[0]);
    for (const base of [startFret, startFret + 12]) {
      const pitches: number[] = [];
      for (let p = TUNING[0] + base; pitches.length < perString * 6; p++) {
        if (inScale.has(mod12(p))) pitches.push(p);
      }
      const cells = new Set<string>();
      const spans: [number, number][] = [];
      let fits = true;
      TUNING.forEach((open, s) => {
        const frets = pitches.slice(s * perString, (s + 1) * perString).map((p) => p - open);
        if (frets[0] < 0 || frets[frets.length - 1] > MAX_FRET) fits = false;
        frets.forEach((f) => cells.add(cellKey(s, f)));
        spans.push([frets[0], frets[frets.length - 1]]);
      });
      if (fits) boxes.push({ position: i + 1, cells, spans });
    }
  });
  return boxes;
}

/** 포지션 박스 테두리 색 (근음 주황, 블루 노트 파랑과 겹치지 않게 고름) */
export const BOX_COLORS = ['#e07a5f', '#7cc48b', '#4fc1c9', '#c59be0', '#e6cf6a', '#f2a7c3', '#a3b8f0'];

/** A4=440Hz 기준 주파수 */
export const frequencyOf = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

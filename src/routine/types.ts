// 루틴: 오늘 할 연습을 순서대로 묶은 것. 항목마다 시간(분)과 그 화면의 설정을 루틴에 고정해 둔다.
// BPM은 루틴에 따로 두지 않고 각 연습이 기억하는 BPM(패턴별·곡별)을 그대로 쓴다.

import { CHROMATIC_DEFAULTS, chromaticLabel, type ChromaticSettings } from '../basics/chromatic';
import { PICKING_DEFAULTS, pickingLabel, type PickingSettings } from '../basics/picking';
import { SPIDER_DEFAULTS, spiderLabel, type SpiderSettings } from '../basics/spider';
import { SCALES_STORAGE_KEY, SCALE_DEFAULTS, scaleLabel, type ScaleSettings } from '../scales/settings';
import { loadLocal, saveLocal } from '../storage';
import { newId } from '../songs/types';

export type RoutineItem =
  | { id: string; minutes: number; kind: 'chromatic'; settings: ChromaticSettings }
  | { id: string; minutes: number; kind: 'spider'; settings: SpiderSettings }
  | { id: string; minutes: number; kind: 'picking'; settings: PickingSettings }
  | { id: string; minutes: number; kind: 'scale'; settings: ScaleSettings }
  | { id: string; minutes: number; kind: 'song'; songId: string }
  | { id: string; minutes: number; kind: 'metronome' }
  | { id: string; minutes: number; kind: 'free' };

export type ItemKind = RoutineItem['kind'];

export interface Routine {
  id: string;
  name: string;
  items: RoutineItem[];
  updatedAt: number;
}

export const KIND_NAME: Record<ItemKind, string> = {
  chromatic: '크로매틱',
  spider: '스파이더',
  picking: '피킹',
  scale: '스케일',
  song: '곡',
  metronome: '메트로놈',
  free: '자유 연습',
};

export const ITEM_KINDS: ItemKind[] = ['chromatic', 'spider', 'picking', 'scale', 'song', 'metronome', 'free'];

export const MINUTES_MIN = 1;
export const MINUTES_MAX = 60;

/** 항목을 한 줄로: '크로매틱 1-2-3-4 (16분음표)', '곡: 제목' */
export function itemLabel(item: RoutineItem, songTitle?: (id: string) => string | undefined): string {
  switch (item.kind) {
    case 'chromatic':
      return chromaticLabel(item.settings);
    case 'spider':
      return spiderLabel(item.settings);
    case 'picking':
      return pickingLabel(item.settings);
    case 'scale':
      return `스케일 ${scaleLabel(item.settings)}`;
    case 'song':
      return `곡: ${songTitle?.(item.songId) ?? '(지워진 곡)'}`;
    default:
      return KIND_NAME[item.kind];
  }
}

export const totalMinutes = (r: Routine) => r.items.reduce((t, i) => t + i.minutes, 0);

/** 새 항목. 연습 화면에서 마지막으로 쓰던 설정으로 시작한다 */
export function newItem(kind: Exclude<ItemKind, 'song'>, minutes?: number): RoutineItem;
export function newItem(kind: 'song', minutes: number, songId: string): RoutineItem;
export function newItem(kind: ItemKind, minutes = 5, songId = ''): RoutineItem {
  const id = newId();
  switch (kind) {
    case 'chromatic':
      return { id, minutes, kind, settings: loadLocal('gp.chromatic', CHROMATIC_DEFAULTS) };
    case 'spider':
      return { id, minutes, kind, settings: loadLocal('gp.spider', SPIDER_DEFAULTS) };
    case 'picking':
      return { id, minutes, kind, settings: loadLocal('gp.picking', PICKING_DEFAULTS) };
    case 'scale':
      return { id, minutes, kind, settings: loadLocal(SCALES_STORAGE_KEY, SCALE_DEFAULTS) };
    case 'song':
      return { id, minutes, kind, songId };
    default:
      return { id, minutes, kind };
  }
}

/** 처음 열었을 때 넣어 두는 기본 루틴 */
function starterRoutines(): Routine[] {
  return [
    {
      id: newId(),
      name: '기본기 20분',
      updatedAt: Date.now(),
      items: [
        { id: newId(), minutes: 5, kind: 'chromatic', settings: { ...CHROMATIC_DEFAULTS } },
        { id: newId(), minutes: 5, kind: 'spider', settings: { ...SPIDER_DEFAULTS } },
        { id: newId(), minutes: 5, kind: 'picking', settings: { ...PICKING_DEFAULTS, kind: 'inout' } },
        { id: newId(), minutes: 5, kind: 'scale', settings: { ...SCALE_DEFAULTS } },
      ],
    },
  ];
}

// ---------- 저장 ----------

const ROUTINES_KEY = 'gp.routines';

interface Stored {
  routines: Routine[];
  /** 기본 루틴을 한 번 넣었는지 (다 지운 사람에게 다시 넣지 않게) */
  seeded: boolean;
}

export function loadRoutines(): Routine[] {
  const stored = loadLocal<Stored>(ROUTINES_KEY, { routines: [], seeded: false });
  if (!stored.seeded) {
    const routines = starterRoutines();
    saveRoutines(routines);
    return routines;
  }
  return Array.isArray(stored.routines) ? stored.routines : [];
}

export function saveRoutines(routines: Routine[]) {
  saveLocal<Stored>(ROUTINES_KEY, { routines, seeded: true });
}

// ---------- 진행 상태 (새로고침해도 이어지게) ----------

export const RUN_KEY = 'gp.routineRun';

export interface RunState {
  routineId: string;
  index: number;
  /** ready: 시작 전 / playing: 연습 중 / between: 항목 끝, 다음 기다림 / done: 루틴 끝 */
  phase: 'ready' | 'playing' | 'between' | 'done';
  /** 이 항목에서 지난 시간 (멈춘 동안 제외) */
  elapsedMs: number;
  /** 지금 시간이 흐르는 중이면 그 시작 시각 */
  runningSince: number | null;
  /** 이 항목에 더한 시간 (1분 더) */
  extraMs: number;
  /** 끝낸 항목들의 실제 연습 시간 합 */
  doneMs: number;
}

export function loadRun(): RunState | null {
  try {
    const raw = localStorage.getItem(RUN_KEY);
    const v = raw ? (JSON.parse(raw) as RunState) : null;
    return v?.routineId ? v : null;
  } catch {
    return null;
  }
}

export function saveRun(run: RunState | null) {
  try {
    if (run) localStorage.setItem(RUN_KEY, JSON.stringify(run));
    else localStorage.removeItem(RUN_KEY);
  } catch {
    // 저장 못 해도 진행은 된다
  }
}

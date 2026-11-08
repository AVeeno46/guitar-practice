// 기본기 연습별 BPM과 날짜별 BPM 기록. 곡의 bpmLog와 같은 모양이라 기록 탭 그래프를 같이 쓴다.

import { loadLocal, saveLocal } from '../storage';
import { todayKey, type BpmEntry } from '../songs/types';

const KEY = 'gp.drills';

export interface DrillRecord {
  label: string;
  bpm: number;
  log: BpmEntry[];
  updatedAt: number;
}

type Store = Record<string, DrillRecord>;

export const loadDrills = (): Store => loadLocal<Store>(KEY, {});

export function drillBpm(key: string, fallback: number): number {
  return loadDrills()[key]?.bpm ?? fallback;
}

/** 연습 BPM을 저장하고 오늘 날짜로 기록을 남긴다 (같은 날은 마지막 값만) */
export function setDrillBpm(key: string, label: string, bpm: number) {
  const store = loadDrills();
  const prev = store[key];
  const date = todayKey();
  const log = (prev?.log ?? []).filter((e) => e.date !== date);
  log.push({ date, bpm });
  store[key] = { label, bpm, log, updatedAt: Date.now() };
  saveLocal(KEY, store);
}

import type { TabScore } from './tab/score';

export type SheetKind = 'image' | 'pdf';

/** 악보 파일 정보. 파일 내용(Blob)은 IndexedDB의 sheets 저장소에 따로 둔다. */
export interface SheetMeta {
  id: string;
  name: string;
  kind: SheetKind;
}

/** 날짜별 연습 BPM. 같은 날 여러 번 바꾸면 마지막 값만 남는다. */
export interface BpmEntry {
  date: string; // YYYY-MM-DD (기기 현지 날짜)
  bpm: number;
}

export interface Song {
  id: string;
  title: string;
  artist: string;
  practiceBpm: number;
  targetBpm: number | null;
  memo: string;
  sheets: SheetMeta[];
  /** 앱에서 직접 만든 TAB 악보 (없으면 null/undefined) */
  tab?: TabScore | null;
  bpmLog: BpmEntry[];
  createdAt: number;
  updatedAt: number;
}

export const newId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export const todayKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** 연습 BPM을 바꾸고 오늘 날짜로 진행 기록을 남긴 새 곡 객체를 돌려준다. */
export function withPracticeBpm(song: Song, bpm: number): Song {
  const date = todayKey();
  const log = song.bpmLog.filter((e) => e.date !== date);
  log.push({ date, bpm });
  return { ...song, practiceBpm: bpm, bpmLog: log, updatedAt: Date.now() };
}

/** 목표 대비 진행률 0..1. 목표가 없으면 null. */
export function progressOf(song: Song): number | null {
  if (!song.targetBpm) return null;
  return Math.max(0, Math.min(1, song.practiceBpm / song.targetBpm));
}

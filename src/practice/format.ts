import { loadLocal, saveLocal } from '../storage';

/** 23분, 1시간 5분, 40초 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.floor(seconds)}초`;
  // 오늘 진행률과 숫자가 어긋나지 않도록 분은 항상 버림
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m}분`;
  const h = Math.floor(m / 60);
  return m % 60 ? `${h}시간 ${m % 60}분` : `${h}시간`;
}

/** 12:34, 1:02:03 */
export function formatClock(seconds: number): string {
  const s = Math.floor(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

export const formatTime = (ms: number) => {
  const d = new Date(ms);
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
};

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

/** 2026-11-09 → 11월 9일 (월) */
export function formatDate(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  return `${m}월 ${d}일 (${WEEKDAYS[new Date(y, m - 1, d).getDay()]})`;
}

// ---------- 하루 목표 ----------

export interface Goals {
  /** 이만큼 하면 연속 연습 일수가 이어진다 */
  minMinutes: 10 | 15;
  /** 이만큼 하면 그날 목표 달성 */
  targetMinutes: 20 | 30;
}

const GOALS_KEY = 'gp.goals';
const DEFAULT_GOALS: Goals = { minMinutes: 15, targetMinutes: 30 };

export const loadGoals = () => loadLocal(GOALS_KEY, DEFAULT_GOALS);
export const saveGoals = (g: Goals) => saveLocal(GOALS_KEY, g);

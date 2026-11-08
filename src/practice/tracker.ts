// 연습 시간 추적기. 앱 전체에서 하나만 돈다.
//
// - "연습 시작"을 누르거나, 아무 화면에서든 메트로놈을 켜면 연습이 시작된다.
// - 연습 중에는 1초마다 지금 화면(Activity)에 시간을 쌓는다.
// - 메트로놈 소리도, 화면 조작도 없는 시간은 일단 '보류'에 쌓아 두었다가
//   다시 무언가 하면 연습 시간에 넣는다. 그대로 오래 지나면(자동 시작 10분,
//   직접 시작 60분) 보류한 시간은 버리고 마지막 활동 시점에 연습을 끝낸다.
// - 앱을 닫았다 열어도 이어지고, 10분 넘게 닫혀 있었다면 닫힌 시점에 끝낸다.

import { saveSession } from './db';
import { FREE_ACTIVITY, type Activity, type PracticeSession, type SessionItem } from './types';
import { newId, todayKey } from '../songs/types';

const ACTIVE_KEY = 'gp.activeSession';
const AUTO_IDLE_MS = 10 * 60 * 1000;
const MANUAL_IDLE_MS = 60 * 60 * 1000;
/** 앱이 이보다 오래 멈춰 있었으면(닫힘·잠김) 그 사이는 연습으로 치지 않는다 */
const SUSPEND_MS = 10 * 60 * 1000;
const MIN_SESSION_SEC = 60;
const MIN_ITEM_SEC = 10;
const TICK_MS = 1000;

type Items = Record<string, SessionItem>;

interface ActiveSession {
  id: string;
  start: number;
  auto: boolean;
  lastTick: number;
  lastActive: number;
  items: Items;
  pending: Items;
}

export interface TrackerSnapshot {
  running: boolean;
  auto: boolean;
  start: number | null;
  seconds: number;
  /** 연습이 저장될 때마다 1씩 오른다. 기록 화면이 다시 불러올 때 쓴다 */
  savedCount: number;
}

let active: ActiveSession | null = null;
let activity: Activity = FREE_ACTIVITY;
let metronomes = 0;
let savedCount = 0;
let timer: number | null = null;
const listeners = new Set<() => void>();
let snapshot: TrackerSnapshot = makeSnapshot();

const sumSeconds = (items: Items) => Object.values(items).reduce((s, i) => s + i.seconds, 0);

function makeSnapshot(): TrackerSnapshot {
  return {
    running: !!active,
    auto: active?.auto ?? false,
    start: active?.start ?? null,
    seconds: active ? Math.floor(sumSeconds(active.items) + sumSeconds(active.pending)) : 0,
    savedCount,
  };
}

function emit() {
  snapshot = makeSnapshot();
  listeners.forEach((l) => l());
}

function persist() {
  try {
    if (active) localStorage.setItem(ACTIVE_KEY, JSON.stringify(active));
    else localStorage.removeItem(ACTIVE_KEY);
  } catch {
    // 저장 공간이 막혀 있으면 새로고침 복구만 안 될 뿐 추적은 계속된다
  }
}

function addTime(target: Items, act: Activity, seconds: number) {
  const item = (target[act.key] ??= { key: act.key, kind: act.kind, label: act.label, refId: act.refId, seconds: 0 });
  item.seconds += seconds;
  item.label = act.label;
  if (act.bpm !== undefined) {
    item.bpmStart ??= act.bpm;
    item.bpmEnd = act.bpm;
  }
}

/** 보류한 시간을 연습 시간으로 옮긴다 */
function flushPending(a: ActiveSession) {
  for (const p of Object.values(a.pending)) {
    const item = a.items[p.key];
    if (!item) {
      a.items[p.key] = { ...p };
      continue;
    }
    item.seconds += p.seconds;
    item.label = p.label;
    if (p.bpmEnd !== undefined) {
      item.bpmStart ??= p.bpmStart;
      item.bpmEnd = p.bpmEnd;
    }
  }
  a.pending = {};
}

function idleLimit(a: ActiveSession) {
  return a.auto ? AUTO_IDLE_MS : MANUAL_IDLE_MS;
}

/** 지난 tick 이후 흐른 시간을 지금 화면에 쌓는다. 연습이 끝났으면 false */
function tick(now = Date.now()): boolean {
  const a = active;
  if (!a) return false;
  const gap = now - a.lastTick;
  if (gap > SUSPEND_MS) {
    // 앱이 오래 멈춰 있었다: 멈춘 시점에 끝낸다
    void finish(a.lastTick, false);
    return false;
  }
  if (gap > 0) addTime(a.pending, activity, gap / 1000);
  a.lastTick = now;
  if (metronomes > 0) {
    flushPending(a);
    a.lastActive = now;
  } else if (now - a.lastActive > idleLimit(a)) {
    void finish(a.lastActive, false);
    return false;
  }
  persist();
  emit();
  return true;
}

function startTimer() {
  if (timer === null) timer = window.setInterval(() => tick(), TICK_MS);
}

function stopTimer() {
  if (timer !== null) window.clearInterval(timer);
  timer = null;
}

/** 무언가 하고 있다는 신호: 보류한 시간을 연습으로 인정한다 */
function markActive() {
  if (!tick() || !active) return;
  flushPending(active);
  active.lastActive = Date.now();
  persist();
}

let lastSaveError: unknown = null;

/**
 * 연습을 끝내고 저장한다.
 * keepPending: 직접 '종료'를 누른 경우처럼 보류 시간도 연습으로 칠지.
 * 1분이 안 되면 저장하지 않고 null을 돌려준다.
 */
async function finish(end: number, keepPending: boolean): Promise<PracticeSession | null> {
  const a = active;
  if (!a) return null;
  active = null;
  stopTimer();
  persist();
  if (keepPending) flushPending(a);

  // 10초도 안 머문 화면은 '자유 연습'으로 합친다
  const items: Items = {};
  for (const item of Object.values(a.items)) {
    if (item.seconds < MIN_ITEM_SEC && item.key !== FREE_ACTIVITY.key) addTime(items, FREE_ACTIVITY, item.seconds);
    else items[item.key] = { ...item, seconds: item.seconds + (items[item.key]?.seconds ?? 0) };
  }
  const list = Object.values(items)
    .map((i) => ({ ...i, seconds: Math.round(i.seconds) }))
    .filter((i) => i.seconds > 0)
    .sort((x, y) => y.seconds - x.seconds);
  const seconds = list.reduce((s, i) => s + i.seconds, 0);

  if (seconds < MIN_SESSION_SEC) {
    emit();
    return null;
  }
  const session: PracticeSession = {
    id: a.id,
    date: todayKey(new Date(a.start)),
    start: a.start,
    end: Math.max(end, a.start + seconds * 1000),
    seconds,
    items: list,
    memo: '',
    auto: a.auto,
  };
  try {
    await saveSession(session);
    lastSaveError = null;
  } catch (e) {
    lastSaveError = e;
  }
  savedCount++;
  emit();
  return session;
}

// ---------- 화면에서 쓰는 API ----------

export function startPractice(auto = false) {
  if (active) return;
  const now = Date.now();
  active = { id: newId(), start: now, auto, lastTick: now, lastActive: now, items: {}, pending: {} };
  startTimer();
  persist();
  emit();
}

/** '종료' 버튼. 저장된 연습(1분 미만이면 null)을 돌려준다. */
export function stopPractice(): Promise<PracticeSession | null> {
  if (!active) return Promise.resolve(null);
  tick();
  return finish(Date.now(), true);
}

export function practiceSaveFailed() {
  return lastSaveError !== null;
}

/** 지금 보고 있는 화면을 알린다. 그 전 화면까지의 시간은 이전 화면에 쌓인다. */
export function setPracticeActivity(next: Activity) {
  if (
    next.key === activity.key &&
    next.label === activity.label &&
    next.bpm === activity.bpm &&
    next.refId === activity.refId
  ) {
    return;
  }
  if (active) {
    tick();
    if (active) {
      flushPending(active); // 화면을 옮긴 것 자체가 활동이다
      active.lastActive = Date.now();
    }
  }
  activity = next;
}

export function metronomeStarted() {
  metronomes++;
  if (!active) startPractice(true);
  else markActive();
}

export function metronomeStopped() {
  metronomes = Math.max(0, metronomes - 1);
  markActive();
}

let lastInteraction = 0;
/** 화면을 만졌다는 신호 (자주 불러도 5초에 한 번만 처리) */
export function notePracticeInteraction() {
  if (!active) return;
  const now = Date.now();
  if (now - lastInteraction < 5000) return;
  lastInteraction = now;
  markActive();
}

export function subscribePractice(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const getPracticeSnapshot = () => snapshot;

// ---------- 새로고침·재실행 복구 ----------

function restore() {
  let saved: ActiveSession | null = null;
  try {
    const raw = localStorage.getItem(ACTIVE_KEY);
    saved = raw ? (JSON.parse(raw) as ActiveSession) : null;
  } catch {
    saved = null;
  }
  if (!saved?.id) return;
  active = { ...saved, pending: saved.pending ?? {}, items: saved.items ?? {} };
  if (Date.now() - active.lastTick > SUSPEND_MS) {
    void finish(active.lastTick, false);
  } else {
    startTimer();
    emit();
  }
}

restore();

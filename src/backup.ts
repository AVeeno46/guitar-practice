// 앱 데이터 전체 백업·복원. 곡(악보 사진·PDF 포함), 연습 기록, 기본기 BPM, 설정을 JSON 파일 하나에 담는다.
// 복원은 지금 기기의 데이터를 지우지 않고 합친다:
//   곡: 같은 곡이면 더 최근에 고친 쪽 / 연습 기록: 없는 것만 추가 / 기본기 BPM: 날짜별로 합침 / 설정: 백업 값

import { done, openDb, request, STORES } from './db';
import { shareOrDownload } from './fileShare';
import type { DrillRecord } from './basics/drillStore';
import type { PracticeSession } from './practice/types';
import type { Song } from './songs/types';
import { normalizeScore } from './songs/tab/score';
import { todayKey } from './songs/types';

const FORMAT = 'guitar-practice/backup';
const VERSION = 1;

const DRILLS_KEY = 'gp.drills';
const LAST_BACKUP_KEY = 'gp.lastBackup';
/** 기기마다 따로인 값: 진행 중인 연습, 마지막 백업 시각 */
const SKIP_KEYS = new Set(['gp.activeSession', LAST_BACKUP_KEY]);

interface EncodedBlob {
  type: string;
  base64: string;
}

interface BackupFile {
  format: typeof FORMAT;
  version: number;
  exportedAt: string;
  songs: Song[];
  sheets: Record<string, EncodedBlob>;
  sessions: PracticeSession[];
  local: Record<string, string>;
}

export interface BackupSummary {
  songs: number;
  sheets: number;
  sessions: number;
}

// ---------- Blob <-> base64 ----------

async function encodeBlob(blob: Blob): Promise<EncodedBlob> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let bin = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return { type: blob.type, base64: btoa(bin) };
}

function decodeBlob(e: EncodedBlob): Blob {
  const bin = atob(e.base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: e.type });
}

// ---------- 내보내기 ----------

function appLocalKeys(): string[] {
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k?.startsWith('gp.') && !SKIP_KEYS.has(k)) keys.push(k);
  }
  return keys;
}

export async function buildBackup(): Promise<{ blob: Blob; summary: BackupSummary }> {
  const db = await openDb();
  const tx = db.transaction([STORES.songs, STORES.sheets, STORES.sessions]);
  const sheetStore = tx.objectStore(STORES.sheets);
  const [songs, sheetKeys, sheetBlobs, sessions] = await Promise.all([
    request(tx.objectStore(STORES.songs).getAll() as IDBRequest<Song[]>),
    request(sheetStore.getAllKeys()),
    request(sheetStore.getAll() as IDBRequest<Blob[]>),
    request(tx.objectStore(STORES.sessions).getAll() as IDBRequest<PracticeSession[]>),
  ]);

  // 곡에 연결된 악보 파일만 담는다
  const used = new Set(songs.flatMap((s) => s.sheets.map((m) => m.id)));
  const sheets: Record<string, EncodedBlob> = {};
  for (let i = 0; i < sheetKeys.length; i++) {
    const id = String(sheetKeys[i]);
    if (used.has(id) && sheetBlobs[i] instanceof Blob) sheets[id] = await encodeBlob(sheetBlobs[i]);
  }

  const local: Record<string, string> = {};
  for (const k of appLocalKeys()) {
    const v = localStorage.getItem(k);
    if (v !== null) local[k] = v;
  }

  const data: BackupFile = {
    format: FORMAT,
    version: VERSION,
    exportedAt: new Date().toISOString(),
    songs,
    sheets,
    sessions,
    local,
  };
  return {
    blob: new Blob([JSON.stringify(data)], { type: 'application/json' }),
    summary: { songs: songs.length, sheets: Object.keys(sheets).length, sessions: sessions.length },
  };
}

export async function exportBackup(): Promise<BackupSummary> {
  const { blob, summary } = await buildBackup();
  await shareOrDownload(blob, `guitar-practice-backup-${todayKey()}.json`, '기타 연습 백업');
  try {
    localStorage.setItem(LAST_BACKUP_KEY, String(Date.now()));
  } catch {
    // 저장 공간이 막혀 있으면 기록만 못 남긴다
  }
  return summary;
}

export function lastBackupAt(): number | null {
  try {
    const n = Number(localStorage.getItem(LAST_BACKUP_KEY));
    return n > 0 ? n : null;
  } catch {
    return null;
  }
}

// ---------- 복원 ----------

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

function parseBackup(text: string): BackupFile {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('백업 파일이 아니에요 (JSON 형식이 아님)');
  }
  if (isObj(data) && data.format === 'guitar-practice/song') {
    throw new Error('곡 하나만 담긴 파일이에요. 곡 탭의 "곡 파일 불러오기"로 열어 주세요');
  }
  if (!isObj(data) || data.format !== FORMAT) {
    throw new Error('기타 연습 앱에서 만든 백업 파일이 아니에요');
  }
  if (Number(data.version) > VERSION) {
    throw new Error('더 새 버전의 앱에서 만든 백업이에요. 앱을 새로고침해 최신 버전으로 바꾼 뒤 다시 해 주세요');
  }
  const songs = (Array.isArray(data.songs) ? data.songs : [])
    .filter((s): s is Song => isObj(s) && typeof s.id === 'string' && typeof s.title === 'string')
    .map((s) => ({
      ...s,
      sheets: Array.isArray(s.sheets) ? s.sheets : [],
      bpmLog: Array.isArray(s.bpmLog) ? s.bpmLog : [],
      tab: s.tab ? normalizeScore(s.tab) : null,
      updatedAt: Number(s.updatedAt) || 0,
    }));
  const sessions = (Array.isArray(data.sessions) ? data.sessions : []).filter(
    (s): s is PracticeSession =>
      isObj(s) && typeof s.id === 'string' && typeof s.date === 'string' && Array.isArray(s.items),
  );
  const sheets: Record<string, EncodedBlob> = {};
  if (isObj(data.sheets)) {
    for (const [id, v] of Object.entries(data.sheets)) {
      if (isObj(v) && typeof v.base64 === 'string') sheets[id] = { type: String(v.type ?? ''), base64: v.base64 };
    }
  }
  const local: Record<string, string> = {};
  if (isObj(data.local)) {
    for (const [k, v] of Object.entries(data.local)) {
      if (k.startsWith('gp.') && !SKIP_KEYS.has(k) && typeof v === 'string') local[k] = v;
    }
  }
  return { format: FORMAT, version: VERSION, exportedAt: String(data.exportedAt ?? ''), songs, sheets, sessions, local };
}

type DrillStore = Record<string, DrillRecord>;

function parseDrills(raw: string | null | undefined): DrillStore {
  try {
    const v = raw ? JSON.parse(raw) : {};
    return isObj(v) ? (v as DrillStore) : {};
  } catch {
    return {};
  }
}

/** 기본기 BPM: 날짜별 기록은 합치고, 같은 날은 더 최근에 고친 쪽 값, 현재 BPM도 더 최근 쪽 */
export function mergeDrills(current: DrillStore, incoming: DrillStore): DrillStore {
  const out: DrillStore = { ...current };
  for (const [key, inc] of Object.entries(incoming)) {
    if (!isObj(inc) || typeof inc.bpm !== 'number') continue;
    const cur = out[key];
    if (!cur) {
      out[key] = { ...inc, log: Array.isArray(inc.log) ? inc.log : [] };
      continue;
    }
    const [older, newer] = (inc.updatedAt ?? 0) > (cur.updatedAt ?? 0) ? [cur, inc] : [inc, cur];
    const byDate = new Map<string, number>();
    for (const e of [...(older.log ?? []), ...(newer.log ?? [])]) byDate.set(e.date, e.bpm);
    const log = [...byDate.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([date, bpm]) => ({ date, bpm }));
    out[key] = { ...newer, log };
  }
  return out;
}

export interface RestoreResult {
  songsAdded: number;
  songsUpdated: number;
  sessionsAdded: number;
  exportedAt: string;
}

export async function restoreBackup(file: File): Promise<RestoreResult> {
  const data = parseBackup(await file.text());

  // 트랜잭션 안에서 await 하면 트랜잭션이 닫히므로 Blob은 미리 만든다
  const sheetBlobs = new Map<string, Blob>();
  for (const [id, e] of Object.entries(data.sheets)) {
    try {
      sheetBlobs.set(id, decodeBlob(e));
    } catch {
      // 깨진 악보 파일 하나는 건너뛴다
    }
  }

  const db = await openDb();
  // 지금 있는 곡·기록 id를 먼저 읽는다
  const readTx = db.transaction([STORES.songs, STORES.sessions]);
  const [curSongs, curSessionIds] = await Promise.all([
    request(readTx.objectStore(STORES.songs).getAll() as IDBRequest<Song[]>),
    request(readTx.objectStore(STORES.sessions).getAllKeys()),
  ]);
  const songById = new Map(curSongs.map((s) => [s.id, s]));
  const sessionIds = new Set(curSessionIds.map(String));

  const tx = db.transaction([STORES.songs, STORES.sheets, STORES.sessions], 'readwrite');
  const songStore = tx.objectStore(STORES.songs);
  const sheetStore = tx.objectStore(STORES.sheets);
  const sessionStore = tx.objectStore(STORES.sessions);

  let songsAdded = 0;
  let songsUpdated = 0;
  for (const song of data.songs) {
    const cur = songById.get(song.id);
    if (cur && cur.updatedAt > song.updatedAt) continue; // 이 기기 쪽이 더 최근
    // 백업에 파일이 없는 악보는 목록에서 뺀다 (깨진 항목이 남지 않도록)
    const sheets = song.sheets.filter((m) => sheetBlobs.has(m.id));
    for (const m of sheets) sheetStore.put(sheetBlobs.get(m.id)!, m.id);
    if (cur) {
      const keep = new Set(sheets.map((m) => m.id));
      for (const m of cur.sheets) if (!keep.has(m.id)) sheetStore.delete(m.id);
      songsUpdated++;
    } else {
      songsAdded++;
    }
    songStore.put({ ...song, sheets });
  }

  let sessionsAdded = 0;
  for (const s of data.sessions) {
    if (sessionIds.has(s.id)) continue;
    sessionStore.put(s);
    sessionsAdded++;
  }
  await done(tx);

  // localStorage: 기본기 BPM은 합치고, 나머지 설정은 백업 값으로
  try {
    for (const [k, v] of Object.entries(data.local)) {
      if (k === DRILLS_KEY) {
        const merged = mergeDrills(parseDrills(localStorage.getItem(k)), parseDrills(v));
        localStorage.setItem(k, JSON.stringify(merged));
      } else {
        localStorage.setItem(k, v);
      }
    }
  } catch {
    // 설정 저장이 막혀 있어도 곡·기록은 복원됐다
  }

  return { songsAdded, songsUpdated, sessionsAdded, exportedAt: data.exportedAt };
}

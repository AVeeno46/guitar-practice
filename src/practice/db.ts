import { done, openDb, request, STORES } from '../db';
import type { PracticeSession } from './types';

const SESSIONS = STORES.sessions;

export async function listSessions(): Promise<PracticeSession[]> {
  const db = await openDb();
  const all = await request(
    db.transaction(SESSIONS).objectStore(SESSIONS).getAll() as IDBRequest<PracticeSession[]>,
  );
  return all.sort((a, b) => b.start - a.start);
}

export async function saveSession(session: PracticeSession): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(SESSIONS, 'readwrite');
  tx.objectStore(SESSIONS).put(session);
  await done(tx);
}

export async function deleteSession(id: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(SESSIONS, 'readwrite');
  tx.objectStore(SESSIONS).delete(id);
  await done(tx);
}

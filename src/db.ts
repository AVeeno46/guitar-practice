// 기기 안의 IndexedDB. 곡·악보·연습 기록을 저장한다.
// 저장소를 추가할 때는 DB_VERSION을 올리고 onupgradeneeded에 만들기만 추가한다(기존 데이터는 그대로).

const DB_NAME = 'guitar-practice';
const DB_VERSION = 2;

export const STORES = {
  songs: 'songs', // v1
  sheets: 'sheets', // v1
  sessions: 'sessions', // v2: 연습 기록
} as const;

let dbPromise: Promise<IDBDatabase> | null = null;

export function openDb(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORES.songs)) db.createObjectStore(STORES.songs, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(STORES.sheets)) db.createObjectStore(STORES.sheets);
      if (!db.objectStoreNames.contains(STORES.sessions)) {
        const sessions = db.createObjectStore(STORES.sessions, { keyPath: 'id' });
        sessions.createIndex('date', 'date');
      }
    };
    // 다른 탭이 새 버전을 열려고 하면 연결을 닫아 업그레이드를 막지 않는다
    req.onsuccess = () => {
      const db = req.result;
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
      };
      resolve(db);
    };
    req.onerror = () => {
      dbPromise = null;
      reject(req.error);
    };
  });
  return dbPromise;
}

export function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('저장이 취소되었어요'));
  });
}

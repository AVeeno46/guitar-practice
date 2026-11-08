// 기기 안에 저장하는 간단한 설정 저장소.
// 연습 기록처럼 기기끼리 이어져야 하는 데이터는 나중에 Supabase로 옮긴다.

export function loadLocal<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}

export function saveLocal<T>(key: string, value: T) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // 저장 공간이 없거나 막힌 경우 무시
  }
}

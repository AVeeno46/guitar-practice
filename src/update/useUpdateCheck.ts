import { useEffect, useState } from 'react';

// 폰에서 홈 화면 앱은 닫지 않고 다시 열면 예전 버전이 그대로 남아 있다.
// 화면이 다시 보일 때와 일정 간격으로 version.json을 확인해 새 배포가 있으면 알려 준다.

const CHECK_EVERY_MS = 30 * 60 * 1000;
const MIN_GAP_MS = 60 * 1000;

async function latestBuild(): Promise<string | null> {
  try {
    const res = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return null;
    const data = (await res.json()) as { build?: unknown };
    return typeof data.build === 'string' ? data.build : null;
  } catch {
    return null; // 오프라인 등
  }
}

/** 새 버전이 배포됐으면 true */
export function useUpdateCheck(): boolean {
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    if (__APP_BUILD__ === 'dev') return;
    let lastCheck = 0;
    let stopped = false;

    const check = async () => {
      if (stopped || document.visibilityState !== 'visible') return;
      if (Date.now() - lastCheck < MIN_GAP_MS) return;
      lastCheck = Date.now();
      const build = await latestBuild();
      if (!stopped && build && build !== __APP_BUILD__) {
        setAvailable(true);
        stopped = true; // 한 번 알았으면 더 확인하지 않는다
      }
    };

    void check();
    const timer = setInterval(() => void check(), CHECK_EVERY_MS);
    const onVisible = () => void check();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    window.addEventListener('online', onVisible);
    return () => {
      stopped = true;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
      window.removeEventListener('online', onVisible);
    };
  }, []);

  return available;
}

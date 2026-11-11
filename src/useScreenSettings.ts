import { useEffect, useRef, useState } from 'react';
import { loadLocal, saveLocal, type ScreenSettingsProps } from './storage';

/** ScreenSettingsProps를 받는 화면에서 쓰는 설정 상태 */
export function useScreenSettings<T extends object>(
  key: string,
  defaults: T,
  { initial, onSettingsChange }: ScreenSettingsProps<T>,
) {
  const [s, setS] = useState<T>(() => (initial ? { ...defaults, ...initial } : loadLocal(key, defaults)));
  const onChange = useRef(onSettingsChange);
  useEffect(() => {
    onChange.current = onSettingsChange;
  });
  const routine = useRef(!!initial);
  useEffect(() => {
    if (routine.current) onChange.current?.(s);
    else saveLocal(key, s);
  }, [key, s]);
  const set = (patch: Partial<T>) => setS((prev) => ({ ...prev, ...patch }));
  return [s, set] as const;
}

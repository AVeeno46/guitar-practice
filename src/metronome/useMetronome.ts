import { useCallback, useEffect, useRef, useState } from 'react';
import { MetronomeEngine, type MetronomeSettings, type ScheduleListener } from './engine';
import { loadLocal } from '../storage';
import { metronomeStarted, metronomeStopped } from '../practice/tracker';

export const METRONOME_STORAGE_KEY = 'gp.metronome';

export const METRONOME_DEFAULTS: MetronomeSettings = {
  bpm: 80,
  beatsPerBar: 4,
  subdivision: 1,
  accentFirst: true,
  volume: 0.8,
};

/** 메트로놈 탭에서 저장한 박자·세분·볼륨 설정을 불러온다. */
export const loadMetronomeSettings = () =>
  loadLocal(METRONOME_STORAGE_KEY, METRONOME_DEFAULTS);

/**
 * 메트로놈 엔진을 화면에 연결한다.
 * 설정이 바뀌면 재생 중에도 바로 반영되고, 화면을 떠나면 소리가 멈춘다.
 */
export function useMetronome(settings: MetronomeSettings, onSchedule?: ScheduleListener) {
  const [engine] = useState(() => new MetronomeEngine(settings));

  useEffect(() => {
    engine.setScheduleListener(onSchedule ?? null);
    return () => engine.setScheduleListener(null);
  }, [engine, onSchedule]);
  const [running, setRunning] = useState(false);
  const [activeBeat, setActiveBeat] = useState(-1);
  // 시작한 뒤 몇 번째 소리인지(세분 음 포함). 정지 상태면 -1. 연습 화면의 '지금 칠 음' 표시에 쓴다
  const [tickIndex, setTickIndex] = useState(-1);
  const rafRef = useRef<number | null>(null);
  const startingRef = useRef(false);

  useEffect(() => {
    engine.update(settings);
  }, [engine, settings]);

  const stopLoop = () => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  };

  useEffect(
    () => () => {
      if (engine.running) metronomeStopped();
      engine.stop();
      stopLoop();
    },
    [engine],
  );

  // 화면 잠금 방지 (지원하는 브라우저에서만)
  useEffect(() => {
    if (!running || !('wakeLock' in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let released = false;
    navigator.wakeLock
      .request('screen')
      .then((l) => {
        if (released) l.release().catch(() => {});
        else lock = l;
      })
      .catch(() => {});
    return () => {
      released = true;
      lock?.release().catch(() => {});
    };
  }, [running]);

  const toggle = useCallback(async () => {
    if (engine.running) {
      engine.stop();
      metronomeStopped();
      stopLoop();
      setRunning(false);
      setActiveBeat(-1);
      setTickIndex(-1);
      return;
    }
    if (startingRef.current) return; // 빠르게 두 번 눌러도 한 번만 시작
    startingRef.current = true;
    try {
      await engine.start();
    } finally {
      startingRef.current = false;
    }
    metronomeStarted(); // 메트로놈을 켜면 연습 기록이 자동으로 시작된다
    setRunning(true);
    const loop = () => {
      const tick = engine.currentTick();
      if (tick) {
        setTickIndex(tick.index);
        if (tick.sub === 0) setActiveBeat(tick.beat);
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
  }, [engine]);

  return { running, activeBeat, tickIndex, toggle };
}

import { useEffect, useSyncExternalStore } from 'react';
import { getPracticeSnapshot, notePracticeInteraction, setPracticeActivity, subscribePractice } from './tracker';
import { FREE_ACTIVITY, type Activity } from './types';

/** 지금 연습 상태(진행 중인지, 몇 초째인지). 1초마다 갱신된다. */
export const usePractice = () => useSyncExternalStore(subscribePractice, getPracticeSnapshot);

/**
 * 이 화면이 보이는 동안의 연습 시간을 activity로 기록한다.
 * 화면을 떠나면 '자유 연습'으로 돌아간다.
 */
export function usePracticeActivity({ key, kind, label, bpm, refId }: Activity) {
  useEffect(() => {
    setPracticeActivity({ key, kind, label, bpm, refId });
  }, [key, kind, label, bpm, refId]);

  useEffect(() => () => setPracticeActivity(FREE_ACTIVITY), []);
}

/** 화면을 만지거나 스크롤하면 '아직 연습 중'으로 친다. App에서 한 번만 쓴다. */
export function usePracticeInteractionListener() {
  useEffect(() => {
    const on = () => notePracticeInteraction();
    const opts = { passive: true, capture: true } as const;
    for (const type of ['pointerdown', 'wheel', 'keydown', 'scroll'] as const) window.addEventListener(type, on, opts);
    return () => {
      for (const type of ['pointerdown', 'wheel', 'keydown', 'scroll'] as const) window.removeEventListener(type, on, opts);
    };
  }, []);
}

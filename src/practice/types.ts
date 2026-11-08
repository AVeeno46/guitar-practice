export type ActivityKind = 'free' | 'metronome' | 'song' | 'scale' | 'drill' | 'routine';

/** 지금 보고 있는 화면이 무슨 연습인지. 연습 시간은 이 단위로 나눠 쌓인다. */
export interface Activity {
  key: string; // 같은 key끼리 시간이 합쳐진다 (예: song:<id>, scale:9:minor:2)
  kind: ActivityKind;
  label: string;
  bpm?: number;
  refId?: string; // 곡 id 등
}

export interface SessionItem {
  key: string;
  kind: ActivityKind;
  label: string;
  refId?: string;
  seconds: number;
  bpmStart?: number;
  bpmEnd?: number;
}

export interface PracticeSession {
  id: string;
  date: string; // 시작한 날 (YYYY-MM-DD, 기기 현지 날짜)
  start: number;
  end: number;
  seconds: number;
  items: SessionItem[];
  memo: string;
  /** 메트로놈을 켜서 자동으로 시작된 연습 */
  auto: boolean;
}

export const FREE_ACTIVITY: Activity = { key: 'free', kind: 'free', label: '자유 연습' };

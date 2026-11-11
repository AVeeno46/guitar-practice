import { SCALES, rootLabel, type ScaleType } from './theory';
import type { LabelMode } from './Fretboard';

export const SCALES_STORAGE_KEY = 'gp.scales';

export interface ScaleSettings {
  root: number; // 0..11 (C=0)
  type: ScaleType;
  position: number; // 0 = 전체, 1..5
  labelMode: LabelMode;
  blue: boolean;
  outlines: boolean;
  /** 스케일 연습용 BPM (곡 BPM, 메트로놈 탭 BPM과 따로 기억) */
  bpm: number;
}

export const SCALE_DEFAULTS: ScaleSettings = { root: 9, type: 'minor', position: 0, labelMode: 'name', blue: false, outlines: true, bpm: 80 };

export function scaleName({ root, type, blue }: ScaleSettings): string {
  const def = SCALES[type];
  return `${rootLabel(root, type)} ${blue && def.blue ? def.name.replace('펜타토닉', '블루스') : def.name}`;
}

export function scaleLabel(s: ScaleSettings): string {
  return s.position ? `${scaleName(s)} · ${s.position}번 포지션` : scaleName(s);
}

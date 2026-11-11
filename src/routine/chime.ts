// 루틴 항목이 끝났을 때 울리는 짧은 알림음. 메트로놈과 다른 음색(부드러운 두 음)으로.

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (ctx) return ctx;
  const Ctor =
    window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  ctx = new Ctor();
  return ctx;
}

/** 버튼을 누를 때 불러서 소리를 낼 수 있게 깨워 둔다 (iOS는 사용자 동작 안에서만 소리를 허락) */
export function unlockChime() {
  const c = audio();
  if (c?.state === 'suspended') void c.resume();
}

export function playChime() {
  const c = audio();
  if (!c) return;
  if (c.state === 'suspended') void c.resume();
  const now = c.currentTime + 0.02;
  [880, 1318.5, 880, 1318.5].forEach((freq, i) => {
    const t = now + i * 0.18 + (i >= 2 ? 0.25 : 0);
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.35, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
    osc.connect(gain).connect(c.destination);
    osc.start(t);
    osc.stop(t + 0.4);
  });
  navigator.vibrate?.([120, 80, 120]);
}

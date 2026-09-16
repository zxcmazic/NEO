// Раздел 6 ТЗ: "звук... high-fidelity" — здесь это значит не набор скачанных
// mp3 (лицензионные риски + лишний вес бандла), а короткие синтезированные
// звуки через Web Audio API. Этого достаточно для отклика на действия
// (клик/выигрыш/проигрыш/монеты/карта) без внешних ассетов.

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  // Браузеры блокируют автозапуск AudioContext до первого жеста пользователя —
  // resume() безопасно вызывать даже если уже running.
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}

let muted = false;
export function setSoundMuted(value: boolean) {
  muted = value;
}
export function isSoundMuted() {
  return muted;
}

interface ToneOptions {
  freq: number;
  durationMs: number;
  type?: OscillatorType;
  gain?: number;
  delayMs?: number;
  slideToFreq?: number; // для эффекта "взлёта"/"падения" тона
}

function tone({ freq, durationMs, type = "sine", gain = 0.15, delayMs = 0, slideToFreq }: ToneOptions) {
  const audio = getCtx();
  if (!audio || muted) return;

  const startTime = audio.currentTime + delayMs / 1000;
  const osc = audio.createOscillator();
  const gainNode = audio.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, startTime);
  if (slideToFreq) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideToFreq), startTime + durationMs / 1000);
  }

  // Быстрый attack + экспоненциальный decay — звучит как "чирп"/"звяк", а не гудок.
  gainNode.gain.setValueAtTime(0, startTime);
  gainNode.gain.linearRampToValueAtTime(gain, startTime + 0.01);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + durationMs / 1000);

  osc.connect(gainNode);
  gainNode.connect(audio.destination);
  osc.start(startTime);
  osc.stop(startTime + durationMs / 1000 + 0.02);
}

export const sfx = {
  click: () => tone({ freq: 600, durationMs: 60, type: "square", gain: 0.06 }),
  bet: () => tone({ freq: 320, durationMs: 90, type: "triangle", gain: 0.1 }),
  win: () => {
    // Маленький мажорный арпеджио — узнаваемая "победная" последовательность.
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) =>
      tone({ freq, durationMs: 140, type: "triangle", gain: 0.12, delayMs: i * 70 })
    );
  },
  bigWin: () => {
    [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((freq, i) =>
      tone({ freq, durationMs: 200, type: "triangle", gain: 0.14, delayMs: i * 80 })
    );
  },
  lose: () => tone({ freq: 220, durationMs: 260, type: "sawtooth", gain: 0.08, slideToFreq: 110 }),
  coin: () => {
    tone({ freq: 1200, durationMs: 90, type: "square", gain: 0.08 });
    tone({ freq: 1600, durationMs: 120, type: "square", gain: 0.06, delayMs: 60 });
  },
  cardFlip: () => tone({ freq: 900, durationMs: 40, type: "square", gain: 0.04 }),
  diceRoll: () => tone({ freq: 180, durationMs: 180, type: "square", gain: 0.05, slideToFreq: 400 }),
  crashTick: () => tone({ freq: 440, durationMs: 30, type: "sine", gain: 0.02 }),
  crashOut: () => tone({ freq: 200, durationMs: 300, type: "sawtooth", gain: 0.1, slideToFreq: 60 }),
};

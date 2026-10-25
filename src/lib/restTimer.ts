/**
 * The rest timer lives outside React and stores its end time (not a running
 * count) in localStorage, so it survives reloads, navigation and the phone
 * locking (when JS timers pause).
 */
const KEY = "workout-tracker:rest-timer";

export type RestTimer = {
  /** Epoch ms. */
  endsAt: number;
  totalSec: number;
  label: string;
  /** Set once the end has been signalled, so it fires only once. */
  notified: boolean;
};

const listeners = new Set<() => void>();
let audio: AudioContext | null = null;

function read(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

function write(timer: RestTimer | null) {
  try {
    if (timer) localStorage.setItem(KEY, JSON.stringify(timer));
    else localStorage.removeItem(KEY);
  } catch {
    // Storage unavailable: the timer just won't survive a reload.
  }
  for (const listener of listeners) listener();
}

export const restTimer = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  /** Raw snapshot string, stable between changes (for useSyncExternalStore). */
  snapshot: read,
  parse(raw: string | null): RestTimer | null {
    if (!raw) return null;
    try {
      return JSON.parse(raw) as RestTimer;
    } catch {
      return null;
    }
  },
  start(seconds: number, label: string) {
    primeAudio();
    write({
      endsAt: Date.now() + seconds * 1000,
      totalSec: seconds,
      label,
      notified: false,
    });
  },
  add(seconds: number) {
    const timer = restTimer.parse(read());
    if (!timer) return;
    const base = Math.max(timer.endsAt, Date.now());
    write({
      ...timer,
      endsAt: base + seconds * 1000,
      totalSec: timer.totalSec + seconds,
      notified: false,
    });
  },
  stop() {
    write(null);
  },
  /** Vibrates and beeps once when the rest is over. */
  notify() {
    const timer = restTimer.parse(read());
    if (!timer || timer.notified) return;
    write({ ...timer, notified: true });
    navigator.vibrate?.([300, 150, 300]);
    beep();
  },
};

/** Browsers only allow audio after a user gesture, so unlock it when the timer starts (a tap on ✓). */
function primeAudio() {
  try {
    audio ??= new AudioContext();
    void audio.resume();
  } catch {
    audio = null;
  }
}

function beep() {
  if (!audio) return;
  for (const [offset, freq] of [
    [0, 880],
    [0.25, 880],
    [0.5, 1320],
  ] as const) {
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.25, audio.currentTime + offset);
    gain.gain.exponentialRampToValueAtTime(
      0.001,
      audio.currentTime + offset + 0.2,
    );
    osc.connect(gain).connect(audio.destination);
    osc.start(audio.currentTime + offset);
    osc.stop(audio.currentTime + offset + 0.2);
  }
}

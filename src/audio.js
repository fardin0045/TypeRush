let context;
let buffers = [];
let loading;
let lastSample = -1;

// Real keystroke recordings; licensing is in public/audio/mechanical/CREDITS.md.
export function prepareKeyboard() {
  try {
    context ??= new AudioContext();
    if (context.state === 'suspended') void context.resume().catch(() => {});
    if (!loading) {
      loading = Promise.all(Array.from({ length: 8 }, async (_, i) => {
        const response = await fetch(`${import.meta.env.BASE_URL}audio/mechanical/key-${i + 1}.wav`);
        if (!response.ok) throw new Error('Keyboard recording unavailable');
        return context.decodeAudioData(await response.arrayBuffer());
      })).then(decoded => { buffers = decoded; }).catch(() => { loading = undefined; });
    }
    return loading;
  } catch { return Promise.resolve(); }
}

export function keyboardClick(enabled, key = '') {
  if (!enabled) return;
  void prepareKeyboard();
  // Preload during countdown/toggle; never play a stale click after loading.
  if (!buffers.length) return;
  try {
    let index = Math.floor(Math.random() * buffers.length);
    if (index === lastSample) index = (index + 1) % buffers.length;
    lastSample = index;
    const source = context.createBufferSource();
    const gain = context.createGain();
    source.buffer = buffers[index];
    source.playbackRate.value = (key === ' ' ? 0.88 : key === 'Backspace' ? 0.94 : 1) * (0.985 + Math.random() * 0.03);
    gain.gain.value = key === ' ' ? 0.72 : 0.60;
    source.connect(gain); gain.connect(context.destination); source.start();
    source.onended = () => { source.disconnect(); gain.disconnect(); };
  } catch {}
}

export function sound(enabled, frequency = 440, duration = 0.08) {
  if (!enabled) return;
  void prepareKeyboard();
  try {
    const oscillator = context.createOscillator(), gain = context.createGain();
    oscillator.type = 'sine'; oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.035, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + duration);
    oscillator.connect(gain); gain.connect(context.destination);
    oscillator.start(); oscillator.stop(context.currentTime + duration);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  } catch {}
}

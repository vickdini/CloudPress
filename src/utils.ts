import { invoke } from '@tauri-apps/api/core';

export const openExternalUrl = async (url: string) => {
  if (!url) return;
  try {
    await invoke('open_external_url', { url });
  } catch (err) {
    console.warn('Failed to open URL with Tauri command, falling back to window.open:', err);
    window.open(url, '_blank', 'noopener,noreferrer');
  }
};

/**
 * Synthesizes a crisp, celebratory multi-tone success chime using the Web Audio API.
 * Ascending chord with harmonious overtones and smooth exponential decay.
 */
export const playSuccessChime = () => {
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    // Celebratory ascending major arpeggio: C5 -> E5 -> G5 -> C6
    const notes = [
      { freq: 523.25, time: 0.0, duration: 0.22, gain: 0.26 }, // C5
      { freq: 659.25, time: 0.11, duration: 0.22, gain: 0.26 }, // E5
      { freq: 783.99, time: 0.22, duration: 0.32, gain: 0.30 }, // G5
      { freq: 1046.5, time: 0.33, duration: 0.75, gain: 0.35 }, // C6
    ];

    const now = ctx.currentTime;

    notes.forEach(({ freq, time, duration, gain: targetGain }) => {
      // Primary bell tone
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + time);

      // Fast, smooth attack
      gainNode.gain.setValueAtTime(0.0001, now + time);
      gainNode.gain.linearRampToValueAtTime(targetGain, now + time + 0.015);
      // Gentle exponential decay
      gainNode.gain.exponentialRampToValueAtTime(0.0001, now + time + duration);

      osc.connect(gainNode);
      gainNode.connect(ctx.destination);

      osc.start(now + time);
      osc.stop(now + time + duration);

      // Subtle harmonic overtone (1 octave higher) for crystalline chime resonance
      const overtone = ctx.createOscillator();
      const overtoneGain = ctx.createGain();

      overtone.type = 'sine';
      overtone.frequency.setValueAtTime(freq * 2, now + time);

      overtoneGain.gain.setValueAtTime(0.0001, now + time);
      overtoneGain.gain.linearRampToValueAtTime(targetGain * 0.18, now + time + 0.015);
      overtoneGain.gain.exponentialRampToValueAtTime(0.0001, now + time + duration * 0.7);

      overtone.connect(overtoneGain);
      overtoneGain.connect(ctx.destination);

      overtone.start(now + time);
      overtone.stop(now + time + duration);
    });

    // Cleanup audio context after note finishes
    setTimeout(() => {
      try {
        ctx.close();
      } catch {}
    }, 1500);
  } catch (err) {
    console.warn('Unable to play audio chime:', err);
  }
};

/**
 * Requests desktop OS notification permission if not yet decided.
 */
export const requestNotificationPermission = async () => {
  if (typeof window !== 'undefined' && 'Notification' in window) {
    if (Notification.permission === 'default') {
      try {
        await Notification.requestPermission();
      } catch (err) {
        console.warn('Notification permission request error:', err);
      }
    }
  }
};

/**
 * Triggers a desktop OS notification if granted.
 */
export const sendSystemNotification = (title: string, options?: NotificationOptions) => {
  if (
    typeof window !== 'undefined' &&
    'Notification' in window &&
    Notification.permission === 'granted'
  ) {
    try {
      new Notification(title, options);
    } catch (err) {
      console.warn('Failed to display system notification:', err);
    }
  }
};

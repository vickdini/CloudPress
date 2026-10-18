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

import type { DiagradeApi } from '../preload';

declare global {
  interface Window {
    diagrade: DiagradeApi;
  }
}

export {};

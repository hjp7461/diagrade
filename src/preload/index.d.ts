import type { DiagradeApi } from './index';

declare global {
  interface Window {
    diagrade: DiagradeApi;
  }
}

export {};

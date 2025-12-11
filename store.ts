import { create } from 'zustand';

interface AppState {
  chaosLevel: number; // 0 = Tree, 1 = Chaos
  targetChaosLevel: number;
  cameraOffset: { x: number; y: number };
  setChaosLevel: (level: number) => void;
  setTargetChaosLevel: (level: number) => void;
  setCameraOffset: (x: number, y: number) => void;
  isWebcamActive: boolean;
  setWebcamActive: (active: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  chaosLevel: 0,
  targetChaosLevel: 0,
  cameraOffset: { x: 0, y: 0 },
  setChaosLevel: (level) => set({ chaosLevel: level }),
  setTargetChaosLevel: (level) => set({ targetChaosLevel: level }),
  setCameraOffset: (x, y) => set({ cameraOffset: { x, y } }),
  isWebcamActive: false,
  setWebcamActive: (active) => set({ isWebcamActive: active }),
}));
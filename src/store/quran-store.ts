import { create } from 'zustand';

type ViewMode = 'page' | 'verse';

interface QuranState {
  fontSize: number;
  increaseFontSize: () => void;
  decreaseFontSize: () => void;
  viewMode: ViewMode;
  toggleViewMode: () => void;
  selectedSurah: string | undefined;
  setSelectedSurah: (surahId: string | undefined) => void;
}

const MIN_FONT_SIZE = 12;
const MAX_FONT_SIZE = 48;
const FONT_STEP = 2;

export const useQuranStore = create<QuranState>((set) => ({
  fontSize: 18, // Initial font size
  increaseFontSize: () =>
    set((state) => ({
      fontSize: Math.min(state.fontSize + FONT_STEP, MAX_FONT_SIZE),
    })),
  decreaseFontSize: () =>
    set((state) => ({
      fontSize: Math.max(state.fontSize - FONT_STEP, MIN_FONT_SIZE),
    })),
  viewMode: 'verse', // Initial view mode set to 'verse'
  toggleViewMode: () =>
    set((state) => ({
      viewMode: state.viewMode === 'page' ? 'verse' : 'page',
    })),
  selectedSurah: undefined, // Initially no surah selected
  setSelectedSurah: (surahId) => set({ selectedSurah: surahId }),
}));

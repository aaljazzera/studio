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
  selectedRiwaya: string; // State for Riwaya selection (text display)
  setSelectedRiwaya: (riwayaId: string) => void; // Setter for Riwaya selection (text display)
}

const MIN_FONT_SIZE = 12;
const MAX_FONT_SIZE = 48;
const FONT_STEP = 2;

export const useQuranStore = create<QuranState>((set) => ({
  fontSize: 40, // Initial font size set to 40
  increaseFontSize: () =>
    set((state) => ({
      fontSize: Math.min(state.fontSize + FONT_STEP, MAX_FONT_SIZE),
    })),
  decreaseFontSize: () =>
    set((state) => ({
      fontSize: Math.max(state.fontSize - FONT_STEP, MIN_FONT_SIZE),
    })),
  viewMode: 'page', // Default view mode set to 'page'
  toggleViewMode: () =>
    set((state) => ({
      viewMode: state.viewMode === 'page' ? 'verse' : 'page',
    })),
  selectedSurah: '1', // Default to Surah Al-Fatiha (ID 1)
  setSelectedSurah: (surahId) => set({ selectedSurah: surahId }),
  selectedRiwaya: 'hafs', // Default Riwaya to Hafs for text display
  setSelectedRiwaya: (riwayaId) => set({ selectedRiwaya: riwayaId }),
}));

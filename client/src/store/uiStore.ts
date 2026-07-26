import { create } from 'zustand';

type SidebarState = 'open' | 'collapsed';

interface UIState {
  sidebar: SidebarState;
  setSidebar: (state: SidebarState) => void;
  toggleSidebar: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebar: 'open',
  setSidebar: (sidebar) => set({ sidebar }),
  toggleSidebar: () =>
    set((s) => ({ sidebar: s.sidebar === 'open' ? 'collapsed' : 'open' })),
}));

// src/stores/app-store.ts
// 应用级视图设置：默认值对齐详细设计 §9.4。
// 这些开关均为视图操作，不进入撤销历史（持久化到 SQLite 由后续任务接线）。
import { defineStore } from 'pinia'

export type ThemeMode = 'system' | 'light' | 'dark'

interface AppViewSettings {
  showRulers: boolean
  showGrid: boolean
  showGuides: boolean
  showPageBreaks: boolean
  snapToGrid: boolean
  theme: ThemeMode
}

export const useAppStore = defineStore('app', {
  state: (): AppViewSettings => ({
    showRulers: true,
    showGrid: false,
    showGuides: true,
    showPageBreaks: false,
    snapToGrid: true,
    theme: 'system',
  }),
  actions: {
    toggleRulers() {
      this.showRulers = !this.showRulers
    },
    toggleGrid() {
      this.showGrid = !this.showGrid
    },
    toggleGuides() {
      this.showGuides = !this.showGuides
    },
    togglePageBreaks() {
      this.showPageBreaks = !this.showPageBreaks
    },
    toggleSnap() {
      this.snapToGrid = !this.snapToGrid
    },
  },
})

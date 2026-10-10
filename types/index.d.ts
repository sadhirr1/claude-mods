export type Mode = 'full' | 'prefs' | 'none'

declare module 'claude-code' {
  interface PluginState {
    'memory-mode': { mode: Mode | null }
  }
}

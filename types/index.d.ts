export type Hit = { count: number; lastTurn: number }

declare module 'claude-code' {
  interface PluginState {
    'skill-dashboard': {
      pinned: string[]
      armed: string[]
      forcedThisTurn: string[]
      hits: Record<string, Hit>
      hitsThisTurn: string[]
      installed: Record<string, string>
      turn: number
    }
  }
}

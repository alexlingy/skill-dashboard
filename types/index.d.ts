/** One skill the panel can list: a slash command a plugin or the person's own skills folder provides. */
export type Skill = { name: string; description: string; group: string; isListed: boolean }

/** The `/config` toggle the panel shows at its foot (Remote Control), as last read. */
export type Toggle = { key: string; label: string; value: boolean; isChoice: boolean; isLocked: boolean }

declare module 'claude-code' {
  interface PluginState {
    'skill-dashboard': {
      catalog: Skill[]
      pinned: string[]
      favorites: string[]
      loaded: Record<string, number>
      turn: number
      openGroups: string[]
      expanded: string[]
      query: string
      isCollapsed: boolean
      remote: Toggle | null
    }
  }
}

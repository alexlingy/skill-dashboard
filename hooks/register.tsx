import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Skill, Toggle } from '../types'

const PANE = 'skill-dashboard'
const COMMAND = 'skill-dashboard'
const TITLE = 'Skills 儀表板'

/** The five skills the dashboard started with: their own labels and Chinese notes, and the default favorites. */
const KNOWN: Record<string, { label: string; about: string }> = {
  'academic-humanizer': { label: 'Academic Humanizer', about: '學術文字潤飾，保留作者語氣' },
  'deep-research': { label: 'Deep Research', about: '研究問題、文獻回顧、事實查核' },
  'academic-paper': { label: 'Academic Paper', about: '論文規劃、撰寫、修訂' },
  'academic-paper-reviewer': { label: 'Paper Reviewer', about: '多角度論文審查' },
  'academic-pipeline': { label: 'Academic Pipeline', about: '研究到投稿的完整流程' },
}

/** Plugins whose skills the KNOWN notes describe; another plugin's skill of the same name (`anthropic-skills:deep-research`) is not one of them. */
const OWNERS = ['academic-research-skills', 'academic-humanizer']

/** Short words the typed command still takes for the five. */
const ALIASES: Record<string, string> = {
  humanizer: 'academic-humanizer',
  research: 'deep-research',
  paper: 'academic-paper',
  reviewer: 'academic-paper-reviewer',
  pipeline: 'academic-pipeline',
}

const MINE = '我的 skills'
const FAVORITES = 'favorites'

const catalog = atom({ plugin: 'skill-dashboard', key: 'catalog' } as const, [])
const pinned = atom({ plugin: 'skill-dashboard', key: 'pinned' } as const, [])
const favorites = atom({ plugin: 'skill-dashboard', key: 'favorites' } as const, [])
const loaded = atom({ plugin: 'skill-dashboard', key: 'loaded' } as const, {})
const turn = atom({ plugin: 'skill-dashboard', key: 'turn' } as const, 0)
const openGroups = atom({ plugin: 'skill-dashboard', key: 'openGroups' } as const, ['favorites'])
const expanded = atom({ plugin: 'skill-dashboard', key: 'expanded' } as const, [])
const query = atom({ plugin: 'skill-dashboard', key: 'query' } as const, '')
const isCollapsed = atom({ plugin: 'skill-dashboard', key: 'isCollapsed' } as const, false)
const remote = atom({ plugin: 'skill-dashboard', key: 'remote' } as const, null)

/** Claude's own theme keys, so the panel follows the person's theme: one accent for "on", greys for the rest. */
const ACCENT = 'claude'
const MUTED = 'subtle'
const TRACK_OFF = 'inactive'

const bareOf = (name: string) => name.split(':').pop() ?? name
const ownerOf = (name: string) => (name.includes(':') ? name.slice(0, name.lastIndexOf(':')) : undefined)

/** The KNOWN entry a name stands for: bare, or `owner:name` from one of OWNERS. */
function knownOf(name: string) {
  const owner = ownerOf(name)
  return owner === undefined || OWNERS.includes(owner) ? KNOWN[bareOf(name)] : undefined
}

const labelOf = (name: string) => knownOf(name)?.label ?? bareOf(name)

function aboutOf(skill: Skill | undefined, name: string) {
  return knownOf(name)?.about ?? skill?.description ?? ''
}

function toggled(list: readonly string[], one: string): string[] {
  return list.includes(one) ? list.filter(item => item !== one) : [...list, one]
}

/**
 * The catalog name a stored or typed name stands for: itself when listed, else the listed
 * skill of that bare name (one of OWNERS' first, for names the dashboard stored before 0.3).
 */
function resolve(list: readonly Skill[], name: string): string | undefined {
  if (list.some(one => one.name === name)) {
    return name
  }
  const bare = ALIASES[name.toLowerCase()] ?? bareOf(name)
  const same = list.filter(one => bareOf(one.name) === bare)
  const owned = same.find(one => knownOf(one.name) !== undefined)

  return (owned ?? (same.length === 1 ? same[0] : undefined))?.name
}

/** Stored names brought up to date with the catalog; a name no longer listed is kept, so the panel can say it was removed. */
const resolveAll = (list: readonly Skill[], names: readonly string[]) => [
  ...new Set(names.map(name => resolve(list, name) ?? name)),
]

async function readCatalog($: EngineInterface): Promise<Skill[]> {
  const found: Skill[] = []
  for (const command of await $.command.list()) {
    if (command.name === COMMAND || found.some(one => one.name === command.name)) {
      continue
    }
    const isListed = command.source === 'plugin' || command.source === 'user'
    const group = command.plugin ?? ownerOf(command.name) ?? (command.source === 'user' ? MINE : command.source)
    found.push({ name: command.name, description: command.description, group, isListed })
  }

  return found
}

/** Reads the skills installed now and the Remote Control toggle; cheap, so it runs on every message and every open. */
async function refresh($: EngineInterface) {
  const list = await readCatalog($).catch(() => null)
  if (list) {
    await update($, catalog, () => list)
    const storedPins = await $.store.get('pinned')
    const pins = resolveAll(list, Array.isArray(storedPins) ? storedPins.filter((one): one is string => typeof one === 'string') : [])
    await update($, pinned, () => pins)
    const storedFavorites = await $.store.get('favorites')
    const favs = Array.isArray(storedFavorites)
      ? resolveAll(list, storedFavorites.filter((one): one is string => typeof one === 'string'))
      : Object.keys(KNOWN).map(id => resolve(list, id) ?? id)
    await update($, favorites, () => favs)
  }

  // `/config` keeps Remote Control as a choice of `true`, `false` or `default` (off unless set).
  const rows = await $.config.list().catch(() => [])
  const row = rows.find(one => /remote.?control/i.test(`${one.key} ${one.label}`) && (one.kind === 'boolean' || one.options?.includes('true')))
  const toggle: Toggle | null = row
    ? { key: row.key, label: row.label, value: row.value === true || row.value === 'true', isChoice: row.kind === 'choice', isLocked: row.isLocked }
    : null
  await update($, remote, () => toggle)
}

async function setPinned($: EngineInterface, name: string, isOn: boolean) {
  const list = await read($, pinned)
  const next = isOn ? [...new Set([...list, name])] : list.filter(one => one !== name)
  await update($, pinned, () => next)
  await $.store.set('pinned', next)
}

async function setFavorite($: EngineInterface, name: string, isOn: boolean) {
  const list = await read($, favorites)
  const next = isOn ? [...new Set([...list, name])] : list.filter(one => one !== name)
  await update($, favorites, () => next)
  await $.store.set('favorites', next)
}

async function toggleGroup($: EngineInterface, group: string) {
  const next = toggled(await read($, openGroups), group)
  await update($, openGroups, () => next)
  await $.store.set('openGroups', next)
  await refresh($)
}

async function toggleCollapsed($: EngineInterface) {
  const next = !(await read($, isCollapsed))
  await update($, isCollapsed, () => next)
  await $.store.set('isCollapsed', next)
}

async function flipRemote($: EngineInterface) {
  const now = await read($, remote)
  if (!now) {
    return
  }
  if (now.isLocked) {
    await $.ui.toast(`${now.label}：由管理設定鎖定，無法在這裡變更`)
    return
  }
  const value = now.isChoice ? String(!now.value) : !now.value
  const result = await $.config.set({ key: now.key, value }).catch((error: unknown) => ({ deny: String(error) }))
  if (result.deny !== undefined) {
    await $.ui.toast(`${now.label}：${result.deny}`)
  }
  await refresh($)
}

/** The system prompt's part: switched-on skills not yet loaded in this conversation are to be loaded before answering. */
async function sectionText($: EngineInterface): Promise<string | null> {
  const list = await read($, catalog)
  const done = await read($, loaded)
  const due = (await read($, pinned)).filter(name => done[name] === undefined && list.some(one => one.name === name))
  if (due.length === 0) {
    return null
  }

  return [
    '# Skill dashboard',
    'The person switched these skills ON in the skill dashboard, and they have not been loaded in this conversation yet. Before answering, invoke the Skill tool with each of them; then keep applying them wherever they fit for the rest of the conversation:',
    ...due.map(name => `- ${name}: ${aboutOf(list.find(one => one.name === name), name)}`),
  ].join('\n')
}

async function statusText($: EngineInterface): Promise<string> {
  const list = await read($, catalog)
  const pins = await read($, pinned)
  const favs = await read($, favorites)
  const done = await read($, loaded)
  const now = await read($, turn)
  const lineOf = (name: string) => {
    const isGone = !list.some(one => one.name === name)
    const state = isGone ? '已移除' : done[name] === now ? '本回合已載入' : done[name] !== undefined ? '已載入' : '未載入'
    return `${pins.includes(name) ? '■' : '□'} ${labelOf(name)}（${name}）：${pins.includes(name) ? '強制' : '不強制'} · ${state}`
  }
  const shown = [...new Set([...favs, ...pins, ...Object.keys(done)])]

  return [
    `共 ${list.filter(one => one.isListed).length} 個 skill。常用、強制或已載入的：`,
    ...(shown.length > 0 ? shown.map(lineOf) : ['（沒有）']),
  ].join('\n')
}

const USAGE = [
  '用法：/skill-dashboard [on|off|add|remove] <skill 名稱>',
  'on/off：強制載入開關 · add/remove：加入或移出常用（內建的 skill 也可以加）',
].join('\n')

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const wasCollapsed = (await $.store.get('isCollapsed')) === true
    await update($, isCollapsed, () => wasCollapsed)
    const stored = await $.store.get('openGroups')
    const groups = Array.isArray(stored) ? stored.filter((one): one is string => typeof one === 'string') : [FAVORITES]
    await update($, openGroups, () => groups)
    void $.ui.open({ id: PANE, title: TITLE })
    await refresh($)
    // `/skills` is a built-in command, so the dashboard's own is named after the plugin.
    await $.command
      .register({ name: COMMAND, description: 'Open the skill dashboard panel' })
      .catch(() => $.ui.toast(`skill-dashboard: could not register /${COMMAND}`))

    return next(e)
  })

  // A /clear starts the conversation over: nothing is loaded in it any more.
  on('session.end', async ($, e, next) => {
    if (e.reason === 'clear') {
      await update($, loaded, () => ({}))
    }

    return next(e)
  })

  on('command.run', { command: COMMAND }, async ($, e) => {
    await refresh($)
    const [verb = '', ...rest] = e.args.trim().split(/\s+/)
    const word = rest.join(' ')
    if (verb !== '') {
      const action = verb.toLowerCase()
      const list = await read($, catalog)
      const name = resolve(list, word) ?? (action === 'off' || action === 'remove' ? word : undefined)
      if (!['on', 'off', 'add', 'remove'].includes(action) || !word) {
        return { text: USAGE }
      }
      if (!name) {
        const near = list.filter(one => one.name.toLowerCase().includes(word.toLowerCase())).map(one => one.name)
        return { text: near.length > 0 ? `「${word}」不只一個，請用完整名稱：${near.join('、')}` : `找不到「${word}」這個 skill。\n${USAGE}` }
      }
      if (action === 'on' || action === 'off') {
        await setPinned($, name, action === 'on')
      } else {
        await setFavorite($, name, action === 'add')
      }

      return { text: await statusText($) }
    }

    const opened = await $.ui.open({ id: PANE, title: TITLE })
    const note = opened.isPlaced
      ? '側邊面板已打開。'
      : `這個 app 目前沒有顯示側邊面板（${opened.reason}），請用下面的文字指令控制。`

    return { text: [note, await statusText($), USAGE].join('\n\n') }
  })

  on('prompt.submit', async ($, e, next) => {
    await update($, turn, n => n + 1)
    await refresh($)

    return next(e)
  })

  on('skill.prompt', async ($, e, next) => {
    const name = e.pluginName && !e.skill.includes(':') ? `${e.pluginName}:${e.skill}` : e.skill
    const at = await read($, turn)
    await update($, loaded, all => ({ ...all, [name]: at }))

    return next(e)
  })

  on('prompt.compose', async ($, e, next) => {
    const composed = await next(e)
    const text = await sectionText($)
    if (text === null) {
      return composed
    }

    return { sections: [...composed.sections, { id: 'skill-dashboard:active', text, scope: 'session' }] }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const elements = $.ui.resolve(e)
    const { Box, Button, Text } = elements
    // Mobile has no text field, so the search shows where the surface has one.
    const Input = 'Input' in elements ? elements.Input : undefined
    const list = await read($, catalog)
    const pins = await read($, pinned)
    const favs = await read($, favorites)
    const done = await read($, loaded)
    const now = await read($, turn)
    const open = await read($, openGroups)
    const details = await read($, expanded)
    const rawQuery = await read($, query)
    const typed = rawQuery.trim().toLowerCase()
    const collapsed = await read($, isCollapsed)
    const toggle = await read($, remote)

    const skillOf = (name: string) => list.find(one => one.name === name)
    const matches = (name: string) =>
      typed === '' || `${name} ${labelOf(name)} ${aboutOf(skillOf(name), name)}`.toLowerCase().includes(typed)

    const lamp = (name: string) =>
      done[name] === now ? (
        <Text color={ACCENT} bold>●</Text>
      ) : done[name] !== undefined ? (
        <Text color={ACCENT} dimColor>●</Text>
      ) : (
        <Text color={MUTED}>○</Text>
      )

    // The track is drawn with inverse, so it shows on every terminal; the knob sits right when on.
    const slider = (isOn: boolean) =>
      isOn ? <Text color={ACCENT} inverse>{'   ●'}</Text> : <Text color={TRACK_OFF} inverse>{'●   '}</Text>

    const loadedCount = Object.keys(done).length
    const summary = [pins.length > 0 ? `${pins.length} 強制` : null, loadedCount > 0 ? `${loadedCount} 已載入` : null]
      .filter(Boolean)
      .join(' · ')

    const header = (
      <Button key="panel" plain onPress={() => toggleCollapsed($)}>
        <Text color={ACCENT} bold>{collapsed ? '▸' : '▾'} Skills</Text>
        <Text color={MUTED}>{collapsed && summary ? `  ${summary}` : ''}</Text>
      </Button>
    )
    if (collapsed) {
      return <Box flexDirection="column">{header}</Box>
    }

    const row = (name: string) => {
      const skill = skillOf(name)
      const isGone = skill === undefined
      const isOn = pins.includes(name)

      return (
        <Box key={`row:${name}`} flexDirection="column">
          <Box justifyContent="space-between">
            <Box flexShrink={1}>
              {lamp(name)}
              <Text> </Text>
              <Button key={`expand:${name}`} plain onPress={() => update($, expanded, all => toggled(all, name))}>
                <Text color={isGone ? MUTED : undefined} strikethrough={isGone} wrap="truncate-end">{labelOf(name)}</Text>
              </Button>
            </Box>
            <Button key={`pin:${name}`} plain onPress={() => setPinned($, name, !isOn)}>
              {slider(isOn)}
            </Button>
          </Box>
          {details.includes(name) && (
            <Box flexDirection="column" paddingLeft={2}>
              <Text color={MUTED} wrap="wrap">{isGone ? '已移除：這台機器上找不到這個 skill' : aboutOf(skill, name)}</Text>
              <Button key={`fav:${name}`} plain onPress={() => setFavorite($, name, !favs.includes(name))}>
                <Text color={MUTED}>{favs.includes(name) ? '★ 移出常用' : '☆ 加入常用'}</Text>
              </Button>
            </Box>
          )}
        </Box>
      )
    }

    const group = (id: string, title: string, names: readonly string[]) => {
      const shown = names.filter(matches)
      if (shown.length === 0) {
        return null
      }
      const isOpen = typed !== '' || open.includes(id)
      const onCount = shown.filter(name => pins.includes(name)).length

      return (
        <Box key={`group:${id}`} flexDirection="column" marginTop={1}>
          <Button key={`group:${id}`} plain onPress={() => toggleGroup($, id)}>
            <Text color={MUTED}>{isOpen ? '▾ ' : '▸ '}</Text>
            <Text bold>{title}</Text>
            <Text color={MUTED}>{isOpen ? '' : `  ${shown.length}${onCount > 0 ? ` · ${onCount} 強制` : ''}`}</Text>
          </Button>
          {isOpen && <Box flexDirection="column" paddingLeft={2}>{shown.map(row)}</Box>}
        </Box>
      )
    }

    const listed = list.filter(one => one.isListed && !favs.includes(one.name))
    const groupNames = [...new Set(listed.map(one => one.group))].sort((a, b) =>
      a === MINE ? -1 : b === MINE ? 1 : a.localeCompare(b),
    )
    const active = [...new Set([...pins, ...Object.keys(done)])]

    return (
      <Box flexDirection="column">
        {header}
        <Box flexDirection="column" borderStyle="round" borderColor={MUTED} paddingX={1}>
          <Text color={ACCENT} bold>作用中</Text>
          {active.length === 0 && <Text color={MUTED}>目前沒有</Text>}
          {active.map(name => (
            <Box key={`active:${name}`}>
              {lamp(name)}
              <Text color={skillOf(name) ? undefined : MUTED} wrap="truncate-end">
                {` ${labelOf(name)}`}
                {pins.includes(name) ? <Text color={ACCENT}> 強制</Text> : ''}
                {skillOf(name) ? '' : <Text color={MUTED}> 已移除</Text>}
              </Text>
            </Box>
          ))}
        </Box>
        {Input && (
          <Box marginTop={1}>
            <Input
              key="search"
              placeholder="搜尋 skill…"
              value={rawQuery}
              onInput={text => void update($, query, () => text)}
              onSubmit={text => void update($, query, () => text)}
            />
          </Box>
        )}
        {group(FAVORITES, '★ 常用', favs)}
        {groupNames.map(name => group(name, name, listed.filter(one => one.group === name).map(one => one.name)))}
        {toggle && (
          <Box marginTop={1} justifyContent="space-between">
            <Text bold>{toggle.label}</Text>
            <Button key="remote" plain onPress={() => flipRemote($)}>
              {slider(toggle.value)}
            </Button>
          </Box>
        )}
      </Box>
    )
  })
}

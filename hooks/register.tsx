import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Hit } from '../types'

const PANE = 'skill-dashboard'
const COMMAND = 'skill-dashboard'

const SKILLS = [
  { id: 'academic-humanizer', label: 'Academic Humanizer', about: '學術文字潤飾，保留作者語氣', scope: 'editing AI-assisted academic prose or grant proposals for clarity and voice' },
  { id: 'deep-research', label: 'Deep Research', about: '研究問題、文獻回顧、事實查核', scope: 'investigating a research question, literature review, fact-checking' },
  { id: 'academic-paper', label: 'Academic Paper', about: '論文規劃、撰寫、修訂', scope: 'planning, drafting or revising an academic paper' },
  { id: 'academic-paper-reviewer', label: 'Paper Reviewer', about: '多角度論文審查', scope: 'peer-reviewing an academic paper' },
  { id: 'academic-pipeline', label: 'Academic Pipeline', about: '研究到投稿的完整流程', scope: 'running the full research-to-publication pipeline' },
] as const

const pinned = atom({ plugin: 'skill-dashboard', key: 'pinned' } as const, [])
const armed = atom({ plugin: 'skill-dashboard', key: 'armed' } as const, [])
const forcedThisTurn = atom({ plugin: 'skill-dashboard', key: 'forcedThisTurn' } as const, [])
const hits = atom({ plugin: 'skill-dashboard', key: 'hits' } as const, {})
const hitsThisTurn = atom({ plugin: 'skill-dashboard', key: 'hitsThisTurn' } as const, [])
const installed = atom({ plugin: 'skill-dashboard', key: 'installed' } as const, {})
const turn = atom({ plugin: 'skill-dashboard', key: 'turn' } as const, 0)
const expanded = atom({ plugin: 'skill-dashboard', key: 'expanded' } as const, [])
const isCollapsed = atom({ plugin: 'skill-dashboard', key: 'isCollapsed' } as const, false)

/** Claude's own theme keys, so the panel follows the person's light or dark theme. */
const ACCENT = 'claude'
const MUTED = 'subtle'
const KNOB = '#FFFFFF'

/** The slide switch's track: the knob sits right when on, left when off. */
const TRACK_ON = '    ● '
const TRACK_OFF = ' ●    '

const ALIASES: Record<string, string> = {
  humanizer: 'academic-humanizer',
  research: 'deep-research',
  paper: 'academic-paper',
  reviewer: 'academic-paper-reviewer',
  pipeline: 'academic-pipeline',
}

/** Plugins whose skills these are; another plugin's skill of the same name (`anthropic-skills:deep-research`) is not. */
const OWNERS = ['academic-research-skills', 'academic-humanizer']

/** The dashboard id a skill or command name stands for: bare `name`, or `owner:name` from one of OWNERS. */
function idOf(name: string): string | undefined {
  const parts = name.split(':')
  const bare = parts.pop() ?? name
  if (parts.length > 0 && !OWNERS.includes(parts.join(':'))) {
    return undefined
  }
  return SKILLS.find(one => one.id === bare)?.id
}

function idOfTyped(word: string): string | undefined {
  const lower = word.toLowerCase()
  return ALIASES[lower] ?? idOf(lower)
}

function toggled(list: readonly string[], id: string): string[] {
  return list.includes(id) ? list.filter(one => one !== id) : [...list, id]
}

async function togglePinned($: EngineInterface, id: string) {
  const next = toggled(await read($, pinned), id)
  await update($, pinned, () => next)
  await $.store.set('pinned', next)
}

async function toggleArmed($: EngineInterface, id: string) {
  await update($, armed, list => toggled(list, id))
}

async function toggleCollapsed($: EngineInterface) {
  const next = !(await read($, isCollapsed))
  await update($, isCollapsed, () => next)
  await $.store.set('isCollapsed', next)
}

async function toggleExpanded($: EngineInterface, id: string) {
  await update($, expanded, list => toggled(list, id))
}

async function refreshInstalled($: EngineInterface) {
  const found: Record<string, string> = {}
  for (const command of await $.command.list()) {
    const id = idOf(command.name)
    if (id && !found[id]) {
      found[id] = command.name
    }
  }
  await update($, installed, () => found)
}

async function sectionText($: EngineInterface): Promise<string | null> {
  const names = await read($, installed)
  const nameOf = (id: string) => names[id] ?? `${id} (not installed in this session: say so to the person)`
  const always = await read($, pinned)
  const now = await read($, forcedThisTurn)
  const lines: string[] = []

  if (always.length > 0) {
    lines.push(
      'The person has switched these skills ON in the skill dashboard. When a request falls within one of their scopes, load that skill with the Skill tool before answering; once per conversation is enough while its instructions are still in context:',
      ...always.map(id => `- ${nameOf(id)}: ${SKILLS.find(one => one.id === id)?.scope ?? ''}`),
    )
  }
  if (now.length > 0) {
    lines.push(
      'The person pressed the one-shot button for THIS request: invoke the Skill tool with each of these skills before answering, and apply it to this request:',
      ...now.map(id => `- ${nameOf(id)}`),
    )
  }

  return lines.length > 0 ? ['# Skill dashboard', ...lines].join('\n') : null
}

async function statusText($: EngineInterface): Promise<string> {
  const always = await read($, pinned)
  const once = await read($, armed)
  const counts = await read($, hits)
  const names = await read($, installed)
  const rows = SKILLS.map(skill => {
    const hit = counts[skill.id]
    const parts = [
      always.includes(skill.id) ? '常駐 ON' : '常駐 OFF',
      once.includes(skill.id) ? '⚡ 下一則待命' : null,
      hit ? `已觸發 ${hit.count} 次（第 ${hit.lastTurn} 則）` : '未觸發',
      names[skill.id] ? null : '未安裝',
    ].filter(Boolean)
    return `${skill.label}：${parts.join(' · ')}`
  })
  const thisTurn = await read($, hitsThisTurn)

  return [...rows, `本回合觸發：${thisTurn.length > 0 ? thisTurn.join('、') : '無'}`].join('\n')
}

const USAGE = '用法：/skill-dashboard [on|off|once] [humanizer|research|paper|reviewer|pipeline]'

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const stored = await $.store.get('pinned')
    const ids = Array.isArray(stored) ? stored.filter((one): one is string => typeof one === 'string' && idOf(one) === one) : []
    await update($, pinned, () => ids)
    const wasCollapsed = (await $.store.get('isCollapsed')) === true
    await update($, isCollapsed, () => wasCollapsed)
    void $.ui.open({ id: PANE, title: 'Skills 儀表板' })
    await refreshInstalled($)
    // `/skills` is a built-in command, so the dashboard's own is named after the plugin.
    await $.command
      .register({ name: COMMAND, description: 'Open the skill dashboard panel' })
      .catch(() => $.ui.toast(`skill-dashboard: could not register /${COMMAND}`))

    return next(e)
  })

  on('command.run', { command: COMMAND }, async ($, e) => {
    const [verb = '', word = ''] = e.args.trim().split(/\s+/)
    if (verb !== '') {
      const id = idOfTyped(word)
      if (!id || !['on', 'off', 'once'].includes(verb.toLowerCase())) {
        return { text: USAGE }
      }
      const always = await read($, pinned)
      const verbLower = verb.toLowerCase()
      if (verbLower === 'once') {
        await update($, armed, list => (list.includes(id) ? list : [...list, id]))
      } else if ((verbLower === 'on') !== always.includes(id)) {
        await togglePinned($, id)
      }

      return { text: await statusText($) }
    }

    await refreshInstalled($)
    const opened = await $.ui.open({ id: PANE, title: 'Skills 儀表板' })
    const note = opened.isPlaced
      ? '側邊面板已打開。'
      : `這個 app 目前沒有顯示側邊面板（${opened.reason}），請用下面的文字指令控制。`

    return { text: [note, await statusText($), USAGE].join('\n\n') }
  })

  on('prompt.submit', async ($, e, next) => {
    const once = await read($, armed)
    await update($, forcedThisTurn, () => once)
    await update($, armed, () => [])
    await update($, hitsThisTurn, () => [])
    await update($, turn, n => n + 1)

    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    await update($, forcedThisTurn, () => [])

    return next(e)
  })

  on('skill.prompt', async ($, e, next) => {
    const id = idOf(e.skill)
    if (id) {
      const at = await read($, turn)
      await update($, hits, all => {
        const was: Hit = all[id] ?? { count: 0, lastTurn: 0 }
        return { ...all, [id]: { count: was.count + 1, lastTurn: at } }
      })
      await update($, hitsThisTurn, list => (list.includes(id) ? list : [...list, id]))
    }

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
    const { Box, Button, Text } = $.ui.resolve(e)
    const always = await read($, pinned)
    const once = await read($, armed)
    const counts = await read($, hits)
    const thisTurn = await read($, hitsThisTurn)
    const names = await read($, installed)
    const open = await read($, expanded)
    const collapsed = await read($, isCollapsed)

    const summary = [
      always.length > 0 ? `${always.length} 常駐` : null,
      once.length > 0 ? `⚡ ${once.length}` : null,
      thisTurn.length > 0 ? `✓ ${thisTurn.length}` : null,
    ].filter(Boolean).join(' · ')

    const header = (
      <Button key="panel" onPress={() => toggleCollapsed($)}>
        <Text color={ACCENT} bold>{collapsed ? '▸' : '▾'} Skills</Text>
        <Text color={MUTED}>{summary ? `  ${summary}` : ''}</Text>
      </Button>
    )

    if (collapsed) {
      return <Box flexDirection="column">{header}</Box>
    }

    return (
      <Box flexDirection="column">
        {header}
        {SKILLS.map(skill => {
          const isOn = always.includes(skill.id)
          const isArmed = once.includes(skill.id)
          const isOpen = open.includes(skill.id)
          const isMissing = !names[skill.id]
          const hit = counts[skill.id]

          return (
            <Box key={skill.id} flexDirection="column" marginTop={1}>
              <Box justifyContent="space-between">
                <Button key={`expand:${skill.id}`} plain onPress={() => toggleExpanded($, skill.id)}>
                  <Text color={MUTED}>{isOpen ? '▾ ' : '▸ '}</Text>
                  <Text bold={isOn} color={isMissing ? MUTED : undefined}>{skill.label}</Text>
                  <Text color={ACCENT}>{thisTurn.includes(skill.id) ? '  ✓' : ''}</Text>
                </Button>
                <Box>
                  <Button key={`once:${skill.id}`} plain onPress={() => toggleArmed($, skill.id)}>
                    {isArmed ? <Text color={ACCENT} bold>⚡</Text> : <Text color={MUTED}>⚡</Text>}
                  </Button>
                  <Text> </Text>
                  <Button key={`pin:${skill.id}`} plain onPress={() => togglePinned($, skill.id)}>
                    {isOn ? (
                      <Text backgroundColor={ACCENT} color={KNOB} bold>{TRACK_ON}</Text>
                    ) : (
                      <Text backgroundColor={MUTED} color={KNOB}>{TRACK_OFF}</Text>
                    )}
                  </Button>
                </Box>
              </Box>
              {isOpen && (
                <Box flexDirection="column" paddingLeft={2}>
                  <Text color={MUTED}>{skill.about}</Text>
                  <Text color={MUTED}>{isOn ? '常駐：開' : '常駐：關'} · {isArmed ? '⚡ 下一則：待命' : '⚡ 下一則：未啟用'}</Text>
                  <Text color={MUTED}>
                    {hit ? `已觸發 ${hit.count} 次 · 最近：第 ${hit.lastTurn} 則訊息` : '本次對話尚未觸發'}
                  </Text>
                  {isMissing && <Text color={MUTED}>未安裝在這台機器上</Text>}
                </Box>
              )}
            </Box>
          )
        })}
        <Box marginTop={1}>
          <Text color={MUTED}>本回合觸發：</Text>
          <Text color={thisTurn.length > 0 ? ACCENT : MUTED}>{thisTurn.length > 0 ? thisTurn.join('、') : '無'}</Text>
        </Box>
      </Box>
    )
  })
}

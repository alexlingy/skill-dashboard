import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Hit } from '../types'

const PANE = 'skill-dashboard'
const COMMAND = 'skill-dashboard'

const SKILLS = [
  { id: 'academic-humanizer', label: 'Academic Humanizer', scope: 'editing AI-assisted academic prose or grant proposals for clarity and voice' },
  { id: 'deep-research', label: 'Deep Research', scope: 'investigating a research question, literature review, fact-checking' },
  { id: 'academic-paper', label: 'Academic Paper', scope: 'planning, drafting or revising an academic paper' },
  { id: 'academic-paper-reviewer', label: 'Paper Reviewer', scope: 'peer-reviewing an academic paper' },
  { id: 'academic-pipeline', label: 'Academic Pipeline', scope: 'running the full research-to-publication pipeline' },
] as const

const pinned = atom({ plugin: 'skill-dashboard', key: 'pinned' } as const, [])
const armed = atom({ plugin: 'skill-dashboard', key: 'armed' } as const, [])
const forcedThisTurn = atom({ plugin: 'skill-dashboard', key: 'forcedThisTurn' } as const, [])
const hits = atom({ plugin: 'skill-dashboard', key: 'hits' } as const, {})
const hitsThisTurn = atom({ plugin: 'skill-dashboard', key: 'hitsThisTurn' } as const, [])
const installed = atom({ plugin: 'skill-dashboard', key: 'installed' } as const, {})
const turn = atom({ plugin: 'skill-dashboard', key: 'turn' } as const, 0)

const ALIASES: Record<string, string> = {
  humanizer: 'academic-humanizer',
  research: 'deep-research',
  paper: 'academic-paper',
  reviewer: 'academic-paper-reviewer',
  pipeline: 'academic-pipeline',
}

/** The dashboard id a skill or command name stands for: `plugin:name` matches on `name`. */
function idOf(name: string): string | undefined {
  const bare = name.split(':').pop() ?? name
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
      : `這個 app 目前沒有顯示側邊面板（${opened.reason}），開關改放在輸入框上方。`

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

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const panes = await $.ui.panes()
    const isPaneDrawn = panes.some(one => one.id === PANE && one.isPlaced && one.isShown)
    if (e.props.hasSurvey || isPaneDrawn) {
      return next(e)
    }

    const { Box, Button, Text } = $.ui.resolve(e)
    const always = await read($, pinned)
    const once = await read($, armed)
    const thisTurn = await read($, hitsThisTurn)

    return (
      <Box flexDirection="column">
        {SKILLS.map(skill => (
          <Box key={skill.id}>
            <Button key={`pin:${skill.id}`} onPress={() => togglePinned($, skill.id)}>
              {always.includes(skill.id) ? <Text color="green">━━●</Text> : <Text dimColor>○━━</Text>}
            </Button>
            <Text> </Text>
            <Button key={`once:${skill.id}`} onPress={() => toggleArmed($, skill.id)}>
              {once.includes(skill.id) ? <Text color="yellow">⚡</Text> : <Text dimColor>⚡</Text>}
            </Button>
            <Text> {skill.label}{thisTurn.includes(skill.id) ? ' ✓ 本回合已觸發' : ''}</Text>
          </Box>
        ))}
      </Box>
    )
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Button, Text } = $.ui.resolve(e)
    const always = await read($, pinned)
    const once = await read($, armed)
    const counts = await read($, hits)
    const thisTurn = await read($, hitsThisTurn)
    const names = await read($, installed)

    return (
      <Box flexDirection="column">
        {SKILLS.map(skill => {
          const isOn = always.includes(skill.id)
          const isArmed = once.includes(skill.id)
          const hit = counts[skill.id]

          return (
            <Box key={skill.id} flexDirection="column" marginBottom={1}>
              <Text>
                <Text bold>{skill.label}</Text>
                {names[skill.id] ? '' : <Text dimColor> (未安裝)</Text>}
              </Text>
              <Box>
                <Button key={`pin:${skill.id}`} onPress={() => togglePinned($, skill.id)}>
                  {isOn ? <Text color="green">━━● 常駐 ON</Text> : <Text dimColor>○━━ 常駐 OFF</Text>}
                </Button>
                <Text> </Text>
                <Button key={`once:${skill.id}`} onPress={() => toggleArmed($, skill.id)}>
                  {isArmed ? <Text color="yellow">⚡ 下一則：待命</Text> : <Text dimColor>⚡ 下一則</Text>}
                </Button>
              </Box>
              <Text key={`hit:${skill.id}`} dimColor>
                {hit ? `已觸發 ${hit.count} 次 · 最近：第 ${hit.lastTurn} 則訊息` : '本次對話尚未觸發'}
              </Text>
            </Box>
          )
        })}
        <Text key="this-turn">
          本回合觸發：{thisTurn.length > 0 ? thisTurn.join('、') : '無'}
        </Text>
      </Box>
    )
  })
}

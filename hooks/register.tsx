import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Hit } from '../types'

const PANE = 'skill-dashboard'

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

/** The dashboard id a skill or command name stands for: `plugin:name` matches on `name`. */
function idOf(name: string): string | undefined {
  const bare = name.split(':').pop() ?? name
  return SKILLS.find(one => one.id === bare)?.id
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

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const stored = await $.store.get('pinned')
    const ids = Array.isArray(stored) ? stored.filter((one): one is string => typeof one === 'string' && idOf(one) === one) : []
    await update($, pinned, () => ids)
    await refreshInstalled($)
    await $.command.register({ name: 'skills', description: 'Open the skill dashboard panel' })
    void $.ui.open({ id: PANE, title: 'Skills 儀表板' })

    return next(e)
  })

  on('command.run', { command: 'skills' }, async $ => {
    await refreshInstalled($)
    await $.ui.open({ id: PANE, title: 'Skills 儀表板' })

    return { text: 'Skill dashboard opened.' }
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

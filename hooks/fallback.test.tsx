import { expect, mock, test } from 'claude-code/testing'

const BAND = {
  component: 'AbovePrompt',
  props: { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 80, scroll: { offset: 0, bodyRows: 10 }, view: {} },
} as const

const COMMANDS = [
  { name: 'academic-humanizer', description: 'Improve academic prose', source: 'user' },
  { name: 'academic-research-skills:academic-paper-reviewer', description: 'Reviewer', source: 'plugin', plugin: 'academic-research-skills' },
  { name: 'academic-research-skills:deep-research', description: 'Deep research', source: 'plugin', plugin: 'academic-research-skills' },
  { name: 'anthropic-skills:deep-research', description: 'Another deep research', source: 'plugin', plugin: 'anthropic-skills' },
  { name: 'init', description: 'Initialize a CLAUDE.md file', source: 'builtin' },
] as const

const run = (args: string) =>
  ({ command: 'skill-dashboard', args, origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 80 } }) as const

test('nothing is drawn near the prompt, and the command reports and switches where no panel is drawn', async ($, on) => {
  mock.store(on)
  on('command.list', () => ({ value: COMMANDS }))
  on('config.list', () => ({ value: [] }))
  on('ui.open', () => ({ value: { isPlaced: false, reason: 'no-surface' } }))
  // The engine's own band: what shows when no plugin draws there.
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>engine band</Text>
  })

  for (const surface of ['terminal', 'desktop', 'mobile'] as const) {
    const ui = await $.ui.mount({ plugin: 'skill-dashboard', surface, ...BAND })
    expect(await ui.find({ type: 'Text', text: /Academic Humanizer/ })).toBeUndefined()
    expect(await ui.find({ type: 'Text', text: 'engine band' })).toBeDefined()
    await ui.unmount()
  }

  const opened = await $.command.run(run(''))
  expect(opened.text).toContain('沒有顯示側邊面板')
  expect(opened.text).toContain('Academic Humanizer（academic-humanizer）：不強制 · 未載入')

  // The short words of before still work, and so does any listed name.
  const switched = await $.command.run(run('on humanizer'))
  expect(switched.text).toContain('Academic Humanizer（academic-humanizer）：強制')
  const reviewer = await $.command.run(run('on academic-research-skills:academic-paper-reviewer'))
  expect(reviewer.text).toContain('Paper Reviewer（academic-research-skills:academic-paper-reviewer）：強制')

  // A built-in skill can be added to the favorites by name.
  const added = await $.command.run(run('add init'))
  expect(added.text).toContain('init（init）')

  const wrong = await $.command.run(run('on nothing'))
  expect(wrong.text).toContain('找不到')
  const bare = await $.command.run(run('jump humanizer'))
  expect(bare.text).toContain('用法')
})

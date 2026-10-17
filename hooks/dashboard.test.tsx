import { expect, mock, test } from 'claude-code/testing'

const PANE = {
  component: 'Pane',
  requestId: 'skill-dashboard',
  props: {
    title: 'Skills 儀表板',
    isFocused: false,
    bodyColumns: 40,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 30 },
    view: {},
  },
} as const

const COMPOSE = { model: 'm', promptModel: 'm', surfaces: [], tools: [], outputStyle: null, traits: [] } as const
const SUBMIT = { wait: false, origin: { kind: 'composer' } } as const

/** What `$.command.list()` answers in these tests: skills of two plugins and the person's own, a built-in and a same-named skill of another plugin. */
const COMMANDS = [
  { name: 'academic-humanizer', description: 'Improve academic prose', source: 'user' },
  { name: 'cite-verify', description: '核對論文草稿中的引用', source: 'user' },
  { name: 'academic-research-skills:deep-research', description: 'Deep research', source: 'plugin', plugin: 'academic-research-skills' },
  { name: 'academic-research-skills:academic-paper', description: 'Paper', source: 'plugin', plugin: 'academic-research-skills' },
  { name: 'academic-research-skills:academic-paper-reviewer', description: 'Reviewer', source: 'plugin', plugin: 'academic-research-skills' },
  { name: 'academic-research-skills:academic-pipeline', description: 'Pipeline', source: 'plugin', plugin: 'academic-research-skills' },
  { name: 'anthropic-skills:deep-research', description: 'Another deep research', source: 'plugin', plugin: 'anthropic-skills' },
  { name: 'mattpocock-skills:tdd', description: 'Test-driven development', source: 'plugin', plugin: 'mattpocock-skills' },
  { name: 'init', description: 'Initialize a CLAUDE.md file', source: 'builtin' },
  { name: 'skill-dashboard', description: 'Open the skill dashboard panel', source: 'plugin', plugin: 'skill-dashboard' },
] as const

const DEEP = 'academic-research-skills:deep-research'

const dashboardText = async (compose: () => Promise<{ sections: readonly { id: string; text: string }[] }>) =>
  (await compose()).sections.find(one => one.id === 'skill-dashboard:active')?.text

test('lists every skill by group, favorites first, and the switch makes a skill load until it has', async ($, on) => {
  mock.store(on)
  on('command.list', () => ({ value: COMMANDS }))
  on('config.list', () => ({ value: [] }))
  on('prompt.compose', () => ({ sections: [] }))
  on('prompt.submit', (_, e) => ({ text: e.text }))
  on('skill.prompt', (_, e) => ({ text: e.text }))
  const compose = () => $.prompt.compose(COMPOSE)

  await $.prompt.submit({ text: 'hello', ...SUBMIT })

  for (const surface of ['terminal', 'desktop', 'mobile'] as const) {
    const ui = await $.ui.mount({ plugin: 'skill-dashboard', surface, ...PANE })

    // The five skills the dashboard started with are the default favorites, by their own labels.
    expect(await ui.find({ type: 'Text', text: '★ 常用' })).toBeDefined()
    expect(await ui.find({ key: 'pin:academic-humanizer' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: 'Paper Reviewer' })).toBeDefined()
    // Other groups start folded, with a count; a built-in and the dashboard's own command are not listed.
    expect(await ui.find({ type: 'Text', text: 'mattpocock-skills' })).toBeDefined()
    expect(await ui.find({ key: 'pin:mattpocock-skills:tdd' })).toBeUndefined()
    expect(await ui.find({ key: 'pin:init' })).toBeUndefined()
    expect(await ui.find({ key: 'pin:skill-dashboard' })).toBeUndefined()
    await ui.press({ key: 'group:mattpocock-skills' })
    expect(await ui.find({ key: 'pin:mattpocock-skills:tdd' })).toBeDefined()
    await ui.press({ key: 'group:mattpocock-skills' })

    // The switch draws its track, and the active box says the skill is switched on.
    await ui.press({ key: 'pin:academic-humanizer' })
    expect((await ui.find({ key: 'pin:academic-humanizer' }))?.text).toBe('   ●')
    expect((await ui.find({ key: 'active:academic-humanizer' }))?.text).toContain('強制')
    await ui.press({ key: 'pin:academic-humanizer' })
    expect((await ui.find({ key: 'pin:academic-humanizer' }))?.text).toBe('●   ')
    expect(await ui.find({ key: 'active:academic-humanizer' })).toBeUndefined()
    await ui.unmount()
  }

  const ui = await $.ui.mount({ plugin: 'skill-dashboard', surface: 'terminal', ...PANE })

  // The switch asks for the skill to be loaded; once it has loaded, the ask stops and its lamp is lit.
  expect(await dashboardText(compose)).toBeUndefined()
  await ui.press({ key: `pin:${DEEP}` })
  expect(await dashboardText(compose)).toContain(DEEP)
  expect((await ui.find({ key: `active:${DEEP}` }))?.text).toMatch(/^○/)

  // Another plugin's skill of the same name is not this one.
  await $.skill.prompt({ skill: 'anthropic-skills:deep-research', text: 'x', frontmatter: {}, source: 'plugin' })
  expect(await dashboardText(compose)).toContain(DEEP)

  await $.skill.prompt({ skill: DEEP, text: 'x', frontmatter: {}, source: 'plugin' })
  expect(await dashboardText(compose)).toBeUndefined()
  expect((await ui.find({ key: `active:${DEEP}` }))?.text).toMatch(/^●/)
  const lit = (await ui.findAll({ type: 'Text', text: '●' })).filter(one => one.props.inverse !== true)
  expect(lit.length).toBeGreaterThan(0)
  expect(lit.every(one => one.props.bold === true)).toBe(true)

  // A later message dims the lamps: loaded earlier in this conversation, not this turn; the ask stays off.
  await $.prompt.submit({ text: 'next', ...SUBMIT })
  const dim = (await ui.findAll({ type: 'Text', text: '●' })).filter(one => one.props.inverse !== true)
  expect(dim.every(one => one.props.dimColor === true)).toBe(true)
  expect(await dashboardText(compose)).toBeUndefined()

  await ui.unmount()
})

test('details, favorites and search', async ($, on) => {
  mock.store(on)
  on('command.list', () => ({ value: COMMANDS }))
  on('config.list', () => ({ value: [] }))
  on('prompt.submit', (_, e) => ({ text: e.text }))
  await $.prompt.submit({ text: 'hello', ...SUBMIT })

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'skill-dashboard', surface, ...PANE })

    // A favorite leaves its own group, and comes back to it when taken out.
    await ui.press({ key: 'group:我的 skills' })
    await ui.press({ key: 'expand:cite-verify' })
    expect(await ui.find({ type: 'Text', text: '核對論文草稿中的引用' })).toBeDefined()
    await ui.press({ key: 'fav:cite-verify' })
    expect(await ui.find({ type: 'Text', text: '★ 移出常用' })).toBeDefined()
    await ui.press({ key: 'fav:cite-verify' })
    await ui.press({ key: 'expand:cite-verify' })
    await ui.press({ key: 'group:我的 skills' })

    // Typing narrows every group, folded ones included, to what matches.
    await ui.input({ key: 'search', text: 'tdd', kind: 'change' })
    expect(await ui.find({ key: 'pin:mattpocock-skills:tdd' })).toBeDefined()
    expect(await ui.find({ key: 'pin:academic-humanizer' })).toBeUndefined()
    await ui.input({ key: 'search', text: '', kind: 'change' })
    expect(await ui.find({ key: 'pin:academic-humanizer' })).toBeDefined()

    await ui.unmount()
  }

  // Mobile has no text field: no search there, the list still draws.
  const phone = await $.ui.mount({ plugin: 'skill-dashboard', surface: 'mobile', ...PANE })
  expect(await phone.find({ key: 'search' })).toBeUndefined()
  expect(await phone.find({ key: 'pin:academic-humanizer' })).toBeDefined()
  await phone.unmount()
})

test('names stored before 0.3 carry over, and a skill that was removed says so', async ($, on) => {
  mock.store(on, { pinned: ['deep-research', 'gone-skill'] })
  on('command.list', () => ({ value: COMMANDS }))
  on('config.list', () => ({ value: [] }))
  on('prompt.submit', (_, e) => ({ text: e.text }))
  await $.prompt.submit({ text: 'hello', ...SUBMIT })

  const ui = await $.ui.mount({ plugin: 'skill-dashboard', surface: 'terminal', ...PANE })
  expect((await ui.find({ key: `active:${DEEP}` }))?.text).toContain('強制')
  expect((await ui.find({ key: 'active:gone-skill' }))?.text).toContain('已移除')
  await ui.unmount()
})

test('the Remote Control toggle switches its /config row', async ($, on) => {
  mock.store(on)
  let value = 'default'
  const sets: unknown[] = []
  on('command.list', () => ({ value: COMMANDS }))
  on('config.list', () => ({
    value: [
      { key: 'verbose', label: 'Verbose output', kind: 'boolean', value: false, provider: { plugin: 'engine', tier: 'core' }, isLocked: false },
      // As /config lists it: a choice of true, false or default (off unless set).
      { key: 'remoteControl', label: 'Enable Remote Control for all sessions', kind: 'choice', value, options: ['true', 'false', 'default'], provider: { plugin: 'engine', tier: 'core' }, isLocked: false },
    ],
  }))
  on('config.set', (_, e) => {
    sets.push(e.value)
    value = String(e.value)
    return { value: e.value }
  })
  on('prompt.submit', (_, e) => ({ text: e.text }))
  await $.prompt.submit({ text: 'hello', ...SUBMIT })

  const ui = await $.ui.mount({ plugin: 'skill-dashboard', surface: 'terminal', ...PANE })
  expect(await ui.find({ type: 'Text', text: 'Enable Remote Control for all sessions' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'Verbose output' })).toBeUndefined()
  await ui.press({ key: 'remote' })
  expect(sets).toEqual(['true'])
  expect((await ui.find({ key: 'remote' }))?.text).toBe('   ●')
  await ui.press({ key: 'remote' })
  expect(sets).toEqual(['true', 'false'])
  expect((await ui.find({ key: 'remote' }))?.text).toBe('●   ')
  await ui.unmount()
})

test('the panel folds to one summary line and back', async ($, on) => {
  mock.store(on)
  on('command.list', () => ({ value: COMMANDS }))
  on('config.list', () => ({ value: [] }))
  on('prompt.submit', (_, e) => ({ text: e.text }))
  await $.prompt.submit({ text: 'hello', ...SUBMIT })

  for (const surface of ['terminal', 'desktop', 'mobile'] as const) {
    const ui = await $.ui.mount({ plugin: 'skill-dashboard', surface, ...PANE })
    await ui.press({ key: 'pin:academic-humanizer' })

    await ui.press({ key: 'panel' })
    expect(await ui.find({ key: 'pin:academic-humanizer' })).toBeUndefined()
    expect(await ui.find({ type: 'Text', text: /1 強制/ })).toBeDefined()

    await ui.press({ key: 'panel' })
    expect(await ui.find({ key: 'pin:academic-humanizer' })).toBeDefined()

    await ui.press({ key: 'pin:academic-humanizer' })
    await ui.unmount()
  }
})

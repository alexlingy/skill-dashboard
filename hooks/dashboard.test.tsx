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

const dashboardText = async (compose: () => Promise<{ sections: readonly { id: string; text: string }[] }>) =>
  (await compose()).sections.find(one => one.id === 'skill-dashboard:active')?.text

test('switches, one-shot buttons and trigger record work on every surface', async ($, on) => {
  mock.store(on)
  on('prompt.compose', () => ({ sections: [] }))
  on('prompt.submit', (_, e) => ({ text: e.text }))
  on('skill.prompt', (_, e) => ({ text: e.text }))
  const compose = () => $.prompt.compose(COMPOSE)

  for (const surface of ['terminal', 'desktop', 'mobile'] as const) {
    const ui = await $.ui.mount({ plugin: 'skill-dashboard', surface, ...PANE })

    // The slide switch keeps a skill on across turns.
    await ui.press({ key: 'pin:academic-humanizer' })
    expect(await dashboardText(compose)).toContain('academic-humanizer')
    expect(await ui.find({ type: 'Text', text: '    ● ' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: ' ●    ' })).toBeDefined()
    await ui.press({ key: 'pin:academic-humanizer' })
    expect(await dashboardText(compose)).toBeUndefined()

    // The one-shot button applies to the next message only.
    await ui.press({ key: 'once:deep-research' })
    await $.prompt.submit({ text: 'find papers', ...SUBMIT })
    expect(await dashboardText(compose)).toContain('THIS request')

    // Another plugin's skill of the same name is not counted.
    await $.skill.prompt({ skill: 'anthropic-skills:deep-research', text: 'x', frontmatter: {}, source: 'plugin' })
    expect(await ui.find({ type: 'Text', text: '  ✓' })).toBeUndefined()

    // A skill loading shows up as triggered, and the details say how often once expanded.
    await $.skill.prompt({ skill: 'academic-research-skills:deep-research', text: 'x', frontmatter: {}, source: 'plugin' })
    expect(await ui.find({ type: 'Text', text: '  ✓' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: 'deep-research' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /已觸發 \d+ 次/ })).toBeUndefined()
    await ui.press({ key: 'expand:deep-research' })
    expect(await ui.find({ type: 'Text', text: /已觸發 \d+ 次/ })).toBeDefined()
    await ui.press({ key: 'expand:deep-research' })

    // The one-shot is spent: the following message carries nothing.
    await $.prompt.submit({ text: 'thanks', ...SUBMIT })
    expect(await dashboardText(compose)).toBeUndefined()
    expect(await ui.find({ type: 'Text', text: '無' })).toBeDefined()

    await ui.unmount()
  }
})

test('the panel folds to one summary line and back', async ($, on) => {
  mock.store(on)

  for (const surface of ['terminal', 'desktop', 'mobile'] as const) {
    const ui = await $.ui.mount({ plugin: 'skill-dashboard', surface, ...PANE })
    await ui.press({ key: 'pin:academic-paper' })

    await ui.press({ key: 'panel' })
    expect(await ui.find({ key: 'pin:academic-paper' })).toBeUndefined()
    expect(await ui.find({ type: 'Text', text: /1 常駐/ })).toBeDefined()

    await ui.press({ key: 'panel' })
    expect(await ui.find({ key: 'pin:academic-paper' })).toBeDefined()

    await ui.press({ key: 'pin:academic-paper' })
    await ui.unmount()
  }
})

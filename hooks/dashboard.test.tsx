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

const dashboardText = async (compose: () => Promise<{ sections: readonly { id: string; text: string }[] }>) =>
  (await compose()).sections.find(one => one.id === 'skill-dashboard:active')?.text

test('switches, one-shot buttons and trigger counts work on every surface', async ($, on) => {
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
    expect(await ui.find({ type: 'Text', text: /常駐 ON/ })).toBeDefined()
    await ui.press({ key: 'pin:academic-humanizer' })
    expect(await dashboardText(compose)).toBeUndefined()

    // The one-shot button applies to the next message only.
    await ui.press({ key: 'once:deep-research' })
    await $.prompt.submit({ text: 'find papers', wait: false, origin: { kind: 'composer' } })
    expect(await dashboardText(compose)).toContain('THIS request')

    // A skill loading shows up as triggered.
    await $.skill.prompt({ skill: 'academic-research-skills:deep-research', text: 'x', frontmatter: {}, source: 'plugin' })
    expect(await ui.find({ type: 'Text', text: /已觸發 \d+ 次/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /本回合觸發：.*deep-research/ })).toBeDefined()


    // The one-shot is spent: the following message carries nothing.
    await $.prompt.submit({ text: 'thanks', wait: false, origin: { kind: 'composer' } })
    expect(await dashboardText(compose)).toBeUndefined()
    expect(await ui.find({ type: 'Text', text: /本回合觸發：無/ })).toBeDefined()

    await ui.unmount()
  }
})

import { expect, mock, test } from 'claude-code/testing'

const BAND = {
  component: 'AbovePrompt',
  props: { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 80, scroll: { offset: 0, bodyRows: 10 }, view: {} },
} as const

const run = (args: string) =>
  ({ command: 'skill-dashboard', args, origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 80 } }) as const

test('nothing is drawn near the prompt, and the command reports and switches where no panel is drawn', async ($, on) => {
  mock.store(on)
  on('command.list', () => ({ value: [] }))
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
  expect(opened.text).toContain('Academic Humanizer：常駐 OFF')

  const switched = await $.command.run(run('on humanizer'))
  expect(switched.text).toContain('Academic Humanizer：常駐 ON')

  const armed = await $.command.run(run('once reviewer'))
  expect(armed.text).toContain('Paper Reviewer：常駐 OFF · ⚡ 下一則待命')

  const wrong = await $.command.run(run('on nothing'))
  expect(wrong.text).toContain('用法')
})

import { expect, mock, test } from 'claude-code/testing'

const START = { cwd: '/work', surface: 'desktop', isInteractive: true } as const

test('session start opens the panel and registers a command that is not a built-in', async ($, on) => {
  mock.store(on)
  const opened: string[] = []
  const registered: string[] = []
  on('command.list', () => ({ value: [] }))
  on('ui.open', (_, e) => {
    opened.push(e.id)
    return { value: { isPlaced: true } }
  })
  on('command.register', (_, e) => {
    registered.push(e.name)
    return { value: { command: e.name } }
  })
  on('session.start', (_, e) => ({ cwd: e.cwd }))

  await $.session.start(START)

  expect(opened).toContain('skill-dashboard')
  expect(registered).toEqual(['skill-dashboard'])
})

test('the panel still opens when registering the command is refused', async ($, on) => {
  mock.store(on)
  const opened: string[] = []
  on('command.list', () => ({ value: [] }))
  on('ui.open', (_, e) => {
    opened.push(e.id)
    return { value: { isPlaced: true } }
  })
  on('command.register', () => {
    throw new Error("a built-in's name is refused")
  })
  on('session.start', (_, e) => ({ cwd: e.cwd }))

  await $.session.start(START)

  expect(opened).toContain('skill-dashboard')
})

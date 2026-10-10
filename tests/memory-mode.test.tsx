import { test, expect } from 'claude-code/testing'

import { filter, allowed } from '../hooks/register'

const SNAP =
  'hi <user_memory_snapshot><profile>P</profile><preferences>R</preferences><memory_listing>L</memory_listing></user_memory_snapshot> bye'

test('filter keeps, trims or drops the snapshot per mode', async () => {
  expect(filter(SNAP, 'full')).toBe(SNAP)
  expect(filter(SNAP, null)).toBe(SNAP)
  expect(filter(SNAP, 'none')).toBe('hi bye')
  const prefs = filter(SNAP, 'prefs')
  expect(prefs.includes('<preferences>R</preferences>')).toBe(true)
  expect(prefs.includes('<profile>')).toBe(false)
  expect(prefs.includes('<memory_listing>')).toBe(false)
})

test('memory reads are gated per mode', async () => {
  const r = 'mcp__memory__memory_read'
  expect(allowed(r, '/profile.md', 'full')).toBe(true)
  expect(allowed(r, '/profile.md', 'prefs')).toBe(false)
  expect(allowed(r, '/preferences.md', 'prefs')).toBe(true)
  expect(allowed(r, '/preferences.md', 'none')).toBe(false)
  expect(allowed('mcp__memory__memory_list', undefined, 'prefs')).toBe(false)
  expect(allowed('mcp__memory__memory_write', '/x.md', 'none')).toBe(true)
  expect(allowed('WebSearch', undefined, 'none')).toBe(true)
})

test('the toggle sets the mode and gates memory reads, on every surface', async ($, on) => {
  on('tool.call', () => ({ result: 'read ok' }))
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({
      plugin: 'memory-mode',
      surface,
      component: 'AbovePrompt',
      props: { hasSurvey: false, isWorking: false, maxRows: 3, bodyColumns: 80, scroll: { offset: 0, bodyRows: 20 }, view: {} },
    })
    await ui.press({ key: 'none' })
    expect(JSON.stringify(await ui.find({ key: 'none' }))).toContain('● None')
    const blocked = await $.tool.call({ tool: 'mcp__memory__memory_read', path: '/preferences.md' })
    expect(blocked.deny).toContain('None')

    await ui.press({ key: 'prefs' })
    expect(JSON.stringify(await ui.find({ key: 'prefs' }))).toContain('● Prefs')
    const prefs = await $.tool.call({ tool: 'mcp__memory__memory_read', path: '/preferences.md' })
    expect(prefs.deny).toBeUndefined()
    const profile = await $.tool.call({ tool: 'mcp__memory__memory_read', path: '/profile.md' })
    expect(profile.deny).toContain('Prefs')
    await ui.unmount()
  }
})

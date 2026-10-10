import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Mode } from '../types'

const mode = atom({ plugin: 'memory-mode', key: 'mode' } as const, null)

const LABELS: Record<Mode, string> = { full: 'Full', prefs: 'Prefs', none: 'None' }
const STATUS: Record<Mode, string> = {
  full: 'Memory: Full',
  prefs: 'Memory: Prefs only',
  none: 'Memory: None',
}

/** What each mode tells Claude, added last to the system prompt. */
const NOTE: Record<Mode, string> = {
  full:
    'Memory mode for this conversation: Full. Read only the memory files that bear on the request; skip the rest.',
  prefs:
    "Memory mode for this conversation: Prefs only. Follow the user's saved preferences. Do not use the profile or read other memory files.",
  none:
    'Memory mode for this conversation: None. No memory about the user is loaded. Do not read or list memory files; answer from the request alone.',
}

const strip = (text: string, tag: string) =>
  text.replace(new RegExp(`<${tag}>[\\s\\S]*?</${tag}>\\s*`, 'g'), '')

/** Filters any text that carries the memory snapshot, per mode. */
export const filter = (text: string, m: Mode | null): string => {
  if (m === null || m === 'full' || !text.includes('<user_memory_snapshot>')) {
    return text
  }
  if (m === 'none') {
    return strip(text, 'user_memory_snapshot')
  }
  return strip(strip(text, 'profile'), 'memory_listing')
}

/** Whether a memory tool call is allowed under a mode. */
export const allowed = (tool: string, path: unknown, m: Mode | null): boolean => {
  if (!tool.startsWith('mcp__memory__') || m === null || m === 'full') return true
  const isRead = tool.endsWith('memory_read') || tool.endsWith('memory_list') || tool.endsWith('memory_search')
  if (!isRead) return true
  if (m === 'none') return false
  const paths = Array.isArray(path) ? path : [path]
  return tool.endsWith('memory_read') && paths.every(p => p === '/preferences.md')
}

const choose = async ($: EngineInterface, m: Mode) => {
  await update($, mode, () => m)
  $.ui.status(STATUS[m])
  $.ui.invalidate('prompt.context')
  $.ui.invalidate('prompt.attachment')
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const m = await read($, mode)
    $.ui.status(m ? STATUS[m] : 'Memory: pick one')
    return next(e)
  })

  // First message with nothing picked: ask.
  on('prompt.submit', async ($, e, next) => {
    if ((await read($, mode)) === null) {
      let picked: Mode = 'full'
      try {
        const answer = await $.ui.ask('How much of your memory should I load for this conversation?', {
          header: 'Memory',
          options: ['Full', 'Prefs', 'None'],
        })
        picked = answer === 'None' ? 'none' : answer === 'Prefs' ? 'prefs' : 'full'
      } catch {
        $.ui.toast('No pick made, so memory is on Full.')
      }
      await choose($, picked)
    }
    return next(e)
  }).catch(($, e, next) => next(e))

  // Strip the memory snapshot wherever it rides.
  on('prompt.context', async ($, e, next) => {
    const m = await read($, mode)
    const res = await next(e)
    return { ...res, blocks: res.blocks.map(b => ({ ...b, text: filter(b.text, m) })) }
  })

  on('prompt.attachment', async ($, e, next) => {
    const m = await read($, mode)
    const res = await next(e)
    return res.text == null ? res : { ...res, text: filter(res.text, m) }
  })

  on('prompt.compose', async ($, e, next) => {
    const m = await read($, mode)
    const res = await next(e)
    if (m === null) return res
    return { sections: [...res.sections, { id: 'memory-mode:note', text: NOTE[m], scope: 'session' }] }
  })

  // Gate memory reads.
  on('tool.call', async ($, e, next) => {
    const m = await read($, mode)
    const path = (e as { path?: unknown }).path
    if (!allowed(e.tool, path, m)) {
      return { deny: `Memory is set to ${LABELS[m ?? 'full']} for this conversation, so this memory read is off.` }
    }
    return next(e)
  }).catch(($, e, next) => next(e))

  // The toggle above the prompt.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    const m = await read($, mode)
    const { Box, Button, Text } = $.ui.resolve(e)
    return (
      <Box>
        <Text dimColor>Memory: </Text>
        {(['full', 'prefs', 'none'] as const).map(k => (
          <Button
            key={k}
            label={m === k ? `● ${LABELS[k]}` : LABELS[k]}
            variant={m === k ? 'primary' : 'secondary'}
            onPress={() => choose($, k)}
          />
        ))}
      </Box>
    )
  })
}

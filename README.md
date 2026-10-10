# memory-mode

A Claude mod that lets you choose, for each conversation, how much of your saved memory Claude loads before it responds.

Three buttons sit above the prompt box:

| Button | What Claude loads |
| --- | --- |
| **Full** | Profile, preferences and memory files, reading only the files that bear on the request |
| **Prefs** | Your saved preferences only, with the profile and other memory files skipped |
| **None** | Nothing; memory reads are blocked, which suits quick tasks like a product search |

Nothing is picked when a conversation starts. Pick a button before your first message. If you don't, Claude asks when you send it. A status entry shows the current mode.

## Install

In a Claude Code terminal session:

```
/plugin install memory-mode --marketplace <your-github-username>/memory-mode
```

Answer `y` to add the marketplace, then press Enter to install for your user.

## Develop

```
claude plugin validate .
claude plugin test .
claude --plugin-dir .
```

## Files

- `.claude-plugin/plugin.json`: the manifest
- `.claude-plugin/marketplace.json`: makes this repo installable
- `hooks/register.tsx`: the hooks (buttons, first-message question, memory filter, memory-read gate)
- `types/index.d.ts`: the mod's state contract
- `tests/memory-mode.test.tsx`: tests

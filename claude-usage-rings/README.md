# Usage Rings for Claude Code

Four items in the VS Code status bar, each in its own colour:

- **context** (blue): how full the session's context window is
- **5h** (green) and **7d** (purple): the usage limits used, and the time until each resets
- **cost** (yellow): what the session has cost so far

An item turns to the warning background when it gets high (a limit at 80%, the context at 85%). The reset times count
down by themselves.

## Where the numbers come from

The extension does not talk to Claude itself. It reads `~/.claude/usage-status.json` and updates whenever the file
changes. Something on the Claude Code side has to write it after each turn, for example a Claude Code plugin or a
status line command. The file looks like this:

```json
{
  "ctx": 48,
  "windows": [
    { "kind": "five_hour", "percent": 9, "resetsAt": "2026-11-10T18:00:00Z" },
    { "kind": "seven_day", "percent": 31, "resetsAt": "2026-11-14T09:00:00Z" }
  ],
  "usd": 12.4
}
```

Any field may be missing or `null`; its item is then hidden.

Not affiliated with or endorsed by Anthropic.

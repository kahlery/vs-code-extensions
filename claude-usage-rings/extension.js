// Claude Code's usage in the status bar, from ~/.claude/usage-status.json (written after every
// turn by a Claude Code plugin or status line command; see the README): four items side by side, each its own colour and icon so they read apart at a glance (the context window in
// blue, the 5-hour limit in green, the 7-day limit in purple, the session's cost in yellow); an item past its mark (a
// limit at 80%, the context at 85%) gets the warning background. The reset times count down by themselves; the items
// update whenever the file changes.
const vscode = require('vscode')
const fs = require('fs')
const os = require('os')
const path = require('path')

const FILE = path.join(os.homedir(), '.claude', 'usage-status.json')

// Each item: where it sits (higher is further left), its icon, its colour and what its tooltip says.
const ITEMS = {
  ctx: { priority: 104, icon: 'database', color: '#4FC1FF', tip: 'Context window used' },
  five_hour: { priority: 103, icon: 'clock', color: '#89D185', tip: '5-hour usage limit used (↻ resets in)' },
  seven_day: { priority: 102, icon: 'calendar', color: '#C586C0', tip: '7-day usage limit used (↻ resets in)' },
  usd: { priority: 101, icon: 'credit-card', color: '#E5C07B', tip: 'This session\'s cost so far' },
}
const NAMES = { five_hour: '5h', seven_day: '7d', spend_limit: 'spend' }

function until(iso) {
  if (!iso) return ''
  const ms = Date.parse(iso) - Date.now()
  if (!(ms > 0)) return ''
  const m = Math.round(ms / 60000)
  if (m >= 1440) return `${Math.floor(m / 1440)}d ${Math.floor((m % 1440) / 60)}h`
  if (m >= 60) return `${Math.floor(m / 60)}h ${m % 60}m`
  return `${m}m`
}

function activate(context) {
  const items = {}
  const item = key => {
    if (!items[key]) {
      const spec = ITEMS[key] || { priority: 100, icon: 'pulse', color: '#D7BA7D', tip: key }
      const it = vscode.window.createStatusBarItem(`claude-usage.${key}`, vscode.StatusBarAlignment.Right, spec.priority)
      it.name = `Claude usage: ${NAMES[key] || key}`
      it.color = spec.color
      it.tooltip = spec.tip
      it.spec = spec
      context.subscriptions.push(it)
      items[key] = it
    }
    return items[key]
  }
  const set = (key, text, isHot) => {
    const it = item(key)
    it.text = `$(${it.spec.icon}) ${text}`
    it.backgroundColor = isHot ? new vscode.ThemeColor('statusBarItem.warningBackground') : undefined
    it.color = isHot ? undefined : it.spec.color
    it.show()
  }

  const draw = () => {
    let data
    try {
      data = JSON.parse(fs.readFileSync(FILE, 'utf8'))
    } catch {
      for (const it of Object.values(items)) it.hide()
      return
    }
    const shown = new Set()
    if (data.ctx !== null && data.ctx !== undefined) {
      set('ctx', `ctx ${data.ctx}%`, data.ctx >= 85)
      shown.add('ctx')
    }
    for (const w of data.windows || []) {
      const left = until(w.resetsAt)
      set(w.kind, `${NAMES[w.kind] || w.kind} ${w.percent}%${left ? `  ↻ ${left}` : ''}`, w.percent >= 80)
      shown.add(w.kind)
    }
    if (data.usd !== null && data.usd !== undefined) {
      set('usd', `$${Number(data.usd).toFixed(2)}`, false)
      shown.add('usd')
    }
    for (const [key, it] of Object.entries(items)) if (!shown.has(key)) it.hide()
  }

  draw()
  fs.watchFile(FILE, { interval: 2000 }, draw)
  const timer = setInterval(draw, 60000)
  context.subscriptions.push({ dispose: () => { fs.unwatchFile(FILE, draw); clearInterval(timer) } })
}

function deactivate() {}

module.exports = { activate, deactivate }

// The workspace's shell scripts as a grid of buttons in their own view in the activity bar. Each script's arguments
// come from the usage line in its header comment (the line that names the script, `Usage:` before it or not):
//
//   client/tools/build_map.sh kizilay [more of the build script's args]
//   client/tools/play_map.sh kizilay [--foes]     # a comment after the usage is left out
//   deploy/firewall.sh <list of Cloudflare's addresses> [port]
//
// and become fields: <name> a field that must be filled, a plain word a field filled in with it, `--flag value` a
// field for the flag's value, [--flag] a checkbox, [anything else] a field that may stay empty (a leading `--` or
// flag kept in front of what is typed), a word holding <name> (res://tools/<scene>.tscn) a field for the name. A script
// with no fields runs at a click; one with fields opens them, and Run runs it. Every script also takes extra arguments.
// Folders left out: the shButtons.exclude setting (globs; .claude, build and dist by default). It runs in its own terminal, from the workspace's root. What was typed is kept for the next time.
const vscode = require('vscode')
const path = require('path')

// Never looked in; what the shButtons.exclude setting adds (in .vscode/settings.json or the user's settings) comes on top.
const ALWAYS = ['**/node_modules/**', '**/.git/**', '**/.godot/**']
const exclude = () => {
  const own = vscode.workspace.getConfiguration('shButtons').get('exclude') || []
  return `{${[...ALWAYS, ...own].map(g => g.replace(/[{},]/g, '')).join(',')}}`
}

// The usage line's arguments, as fields.
function parseUsage(args) {
  const fields = []
  const tokens = []
  let i = 0
  while (i < args.length) {
    const c = args[i]
    if (/\s/.test(c)) { i++; continue }
    if (c === '[') {
      let depth = 0, j = i
      for (; j < args.length; j++) {
        if (args[j] === '[') depth++
        else if (args[j] === ']' && --depth === 0) break
      }
      tokens.push({ optional: true, text: args.slice(i + 1, j).trim() })
      i = j + 1
      continue
    }
    if (c === '<' && args.indexOf('>', i) > 0 && !/\S/.test(args[args.indexOf('>', i) + 1] || '')) {
      const j = args.indexOf('>', i)
      tokens.push({ required: true, text: args.slice(i + 1, j).trim() })
      i = j + 1
      continue
    }
    let j = i
    while (j < args.length && !/\s/.test(args[j])) {
      if (args[j] === '<') { const k = args.indexOf('>', j); if (k > 0) { j = k + 1; continue } }
      j++
    }
    tokens.push({ word: args.slice(i, j) })
    i = j
  }
  let n = 0
  for (let t = 0; t < tokens.length; t++) {
    const tok = tokens[t]
    if (tok.optional) {
      const words = tok.text.split(/\s+/).filter(Boolean)
      if (words.length === 1 && words[0].startsWith('-')) {
        fields.push({ kind: 'check', label: words[0], flag: words[0] })
        continue
      }
      const prefix = []
      while (words.length > 1 && words[0].startsWith('-')) prefix.push(words.shift())
      fields.push({ kind: 'text', label: tok.text, placeholder: words.join(' '), prefix: prefix.join(' '), optional: true })
    } else if (tok.required) {
      fields.push({ kind: 'text', label: tok.text, placeholder: tok.text, required: true })
    } else if (tok.word.startsWith('-') && tok.word !== '--') {
      const next = tokens[t + 1]
      if (next && next.word && !next.word.startsWith('-')) {
        fields.push({ kind: 'text', label: tok.word, value: next.word.replace(/<[^>]*>/g, ''), prefix: tok.word })
        t++
      } else {
        fields.push({ kind: 'check', label: tok.word, flag: tok.word, value: true })
      }
    } else if (/<[^>]+>/.test(tok.word)) {
      const name = tok.word.match(/<([^>]+)>/)[1]
      fields.push({ kind: 'text', label: name, placeholder: name, template: tok.word, required: true })
    } else if (tok.word === '...' || tok.word === '--') {
      continue
    } else {
      n++
      fields.push({ kind: 'text', label: `arg ${n}`, value: tok.word })
    }
  }
  return fields
}

// A script's header: what it says first (the tooltip), its usage (the fields), whether it is meant for another machine.
function readScript(rel, text) {
  const base = path.basename(rel)
  const header = []
  for (const line of text.split('\n')) {
    if (line.startsWith('#!')) continue
    if (!line.startsWith('#')) break
    header.push(line.replace(/^#\s?/, ''))
  }
  let usage = null
  for (const line of header) {
    const l = line.replace(/^\s*usage:\s*/i, '').trim()
    const m = l.match(/^(\S+)(\s.*)?$/)
    if (m && path.basename(m[1]) === base) {
      usage = (m[2] || '').replace(/\s#.*$/, '').trim()
      break
    }
  }
  const prose = header.join(' ').replace(/\s+/g, ' ').trim()
  const about = (prose.match(/^.*?[.:](\s|$)/) || [prose])[0].trim()
  return {
    rel,
    name: base.replace(/\.sh$/, ''),
    group: path.dirname(rel),
    about,
    usage,
    fields: usage ? parseUsage(usage) : [],
    remote: /\brun as (root|postgres)\b/i.test(prose),
  }
}

const quote = s => (/^[\w@%+=:,./-]+$/.test(s) ? s : `'${s.replace(/'/g, `'\\''`)}'`)

class GridView {
  constructor(context) {
    this.context = context
    this.scripts = []
  }

  async scan() {
    const root = vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders[0]
    if (!root) { this.scripts = []; return }
    const files = await vscode.workspace.findFiles('**/*.sh', exclude(), 500)
    const scripts = []
    for (const uri of files) {
      const rel = path.relative(root.uri.fsPath, uri.fsPath).split(path.sep).join('/')
      try {
        const text = Buffer.from(await vscode.workspace.fs.readFile(uri)).toString('utf8')
        scripts.push(readScript(rel, text))
      } catch {}
    }
    scripts.sort((a, b) => a.group.localeCompare(b.group) || a.name.localeCompare(b.name))
    this.scripts = scripts
  }

  async refresh() {
    await this.scan()
    if (this.view) this.view.webview.postMessage({ type: 'scripts', scripts: this.scripts })
  }

  run(rel, args) {
    const root = vscode.workspace.workspaceFolders[0].uri.fsPath
    const name = `sh: ${path.basename(rel, '.sh')}`
    let term = vscode.window.terminals.find(t => t.name === name && t.exitStatus === undefined)
    if (!term) term = vscode.window.createTerminal({ name, cwd: root })
    term.show(true)
    term.sendText(['bash', quote(rel), ...args].join(' ').trim())
  }

  resolveWebviewView(view) {
    this.view = view
    view.webview.options = { enableScripts: true }
    view.webview.html = page()
    view.webview.onDidReceiveMessage(m => {
      if (m.type === 'ready') this.refresh()
      else if (m.type === 'run') this.run(m.rel, m.args)
      else if (m.type === 'open') vscode.window.showTextDocument(vscode.Uri.joinPath(vscode.workspace.workspaceFolders[0].uri, m.rel))
    })
  }
}

function page() {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
body { padding: 6px 8px; font-family: var(--vscode-font-family); font-size: var(--vscode-font-size); color: var(--vscode-foreground); }
h3 { font-size: 11px; text-transform: uppercase; letter-spacing: .04em; opacity: .7; margin: 12px 0 6px; font-weight: 600; }
h3:first-child { margin-top: 2px; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(104px, 1fr)); gap: 6px; }
.grid button { padding: 8px 6px; border: 1px solid var(--vscode-button-border, transparent); border-radius: 4px; cursor: pointer;
  background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground);
  font: inherit; text-align: center; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.grid button:hover { background: var(--vscode-button-secondaryHoverBackground); }
.grid button.on { background: var(--vscode-button-background); color: var(--vscode-button-foreground); }
.grid button .n { display: block; font-size: 10px; opacity: .65; margin-top: 2px; }
form { margin: 8px 0 4px; padding: 8px; border: 1px solid var(--vscode-widget-border, var(--vscode-panel-border)); border-radius: 4px;
  background: var(--vscode-sideBar-background); grid-column: 1 / -1; }
form .about { opacity: .75; margin-bottom: 8px; line-height: 1.35; }
form .usage { font-family: var(--vscode-editor-font-family); font-size: 11px; opacity: .7; margin-bottom: 8px; word-break: break-all; }
label { display: block; margin-bottom: 7px; }
label span { display: block; font-size: 11px; opacity: .85; margin-bottom: 2px; }
label.check { display: flex; gap: 6px; align-items: center; }
label.check span { display: inline; margin: 0; font-family: var(--vscode-editor-font-family); }
input[type=text] { width: 100%; box-sizing: border-box; padding: 4px 6px; border-radius: 2px; font: inherit;
  background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border, transparent); }
input[type=text]:focus { outline: 1px solid var(--vscode-focusBorder); }
input.bad { border-color: var(--vscode-inputValidation-errorBorder); }
.row { display: flex; gap: 6px; margin-top: 4px; }
.row button { padding: 4px 12px; border: none; border-radius: 2px; cursor: pointer; font: inherit; }
.run { background: var(--vscode-button-background); color: var(--vscode-button-foreground); }
.run:hover { background: var(--vscode-button-hoverBackground); }
.alt { background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); }
.warn { color: var(--vscode-editorWarning-foreground); margin-bottom: 8px; }
.empty { opacity: .7; }
</style></head><body><div id="app"><p class="empty">Looking for scripts…</p></div><script>
const vscode = acquireVsCodeApi()
const state = vscode.getState() || { values: {}, open: null }
let scripts = []
const app = document.getElementById('app')
const el = (tag, props = {}, ...kids) => { const e = Object.assign(document.createElement(tag), props); e.append(...kids); return e }
const save = () => vscode.setState(state)

function args(s, form) {
  const out = []
  let ok = true
  s.fields.forEach((f, i) => {
    const input = form.querySelector('[data-i="' + i + '"]')
    if (f.kind === 'check') { if (input.checked) out.push(f.flag); return }
    const v = input.value.trim()
    input.classList.toggle('bad', f.required && !v)
    if (!v) { if (f.required) ok = false; return }
    if (f.template) out.push(f.template.replace(/<[^>]+>/, v))
    else out.push((f.prefix ? f.prefix + ' ' : '') + v)
  })
  const extra = form.querySelector('[data-i="extra"]').value.trim()
  if (extra) out.push(extra)
  return ok ? out : null
}

function remember(s, form) {
  const v = {}
  form.querySelectorAll('[data-i]').forEach(i => v[i.dataset.i] = i.type === 'checkbox' ? i.checked : i.value)
  state.values[s.rel] = v
  save()
}

function formFor(s) {
  const kept = state.values[s.rel] || {}
  const form = el('form')
  if (s.about) form.append(el('div', { className: 'about', textContent: s.about }))
  if (s.remote) form.append(el('div', { className: 'warn', textContent: 'Meant to run on the server (as root/postgres), not here.' }))
  form.append(el('div', { className: 'usage', textContent: s.rel + (s.usage ? ' ' + s.usage : '') }))
  s.fields.forEach((f, i) => {
    if (f.kind === 'check') {
      const box = el('input', { type: 'checkbox', checked: i in kept ? kept[i] : !!f.value })
      box.dataset.i = i
      form.append(el('label', { className: 'check' }, box, el('span', { textContent: f.label })))
    } else {
      const input = el('input', { type: 'text', value: i in kept ? kept[i] : (f.value || ''), placeholder: f.placeholder || '' })
      input.dataset.i = i
      form.append(el('label', {}, el('span', { textContent: f.label + (f.required ? ' *' : '') }), input))
    }
  })
  const extra = el('input', { type: 'text', value: kept.extra || '', placeholder: 'more arguments, as typed' })
  extra.dataset.i = 'extra'
  form.append(el('label', {}, el('span', { textContent: 'extra' }), extra))
  const close = el('button', { type: 'button', className: 'alt', textContent: 'Close' })
  close.onclick = () => { state.open = null; save(); draw() }
  const open = el('button', { type: 'button', className: 'alt', textContent: 'Open file' })
  open.onclick = () => vscode.postMessage({ type: 'open', rel: s.rel })
  form.append(el('div', { className: 'row' }, el('button', { type: 'submit', className: 'run', textContent: 'Run' }), open, close))
  form.oninput = () => remember(s, form)
  form.onsubmit = e => {
    e.preventDefault()
    remember(s, form)
    const a = args(s, form)
    if (a) vscode.postMessage({ type: 'run', rel: s.rel, args: a })
  }
  return form
}

function draw() {
  app.textContent = ''
  if (!scripts.length) { app.append(el('p', { className: 'empty', textContent: 'No .sh files in this workspace.' })); return }
  let grid = null, group = null
  for (const s of scripts) {
    if (s.group !== group) {
      group = s.group
      app.append(el('h3', { textContent: group === '.' ? 'root' : group }))
      grid = el('div', { className: 'grid' })
      app.append(grid)
    }
    const b = el('button', { title: s.about || s.rel, className: state.open === s.rel ? 'on' : '' },
      s.name, el('span', { className: 'n', textContent: s.fields.length ? s.fields.length + ' field' + (s.fields.length > 1 ? 's' : '') : 'run' }))
    b.onclick = () => {
      if (!s.fields.length && !s.remote && !b.classList.contains('on')) {
        vscode.postMessage({ type: 'run', rel: s.rel, args: [] })
        return
      }
      state.open = state.open === s.rel ? null : s.rel
      save()
      draw()
    }
    // Right-click (or Alt-click) opens the fields of a script that would run at once, for its extra arguments.
    b.oncontextmenu = e => { e.preventDefault(); state.open = s.rel; save(); draw() }
    grid.append(b)
    if (state.open === s.rel) {
      const f = formFor(s)
      grid.append(f)
      const first = f.querySelector('input[type=text]')
      if (first) first.focus()
    }
  }
}

window.addEventListener('message', e => { if (e.data.type === 'scripts') { scripts = e.data.scripts; draw() } })
vscode.postMessage({ type: 'ready' })
</script></body></html>`
}

function activate(context) {
  const grid = new GridView(context)
  context.subscriptions.push(vscode.window.registerWebviewViewProvider('shButtons.grid', grid))
  const watcher = vscode.workspace.createFileSystemWatcher('**/*.sh')
  let timer
  const later = () => { clearTimeout(timer); timer = setTimeout(() => grid.refresh(), 300) }
  watcher.onDidCreate(later); watcher.onDidChange(later); watcher.onDidDelete(later)
  context.subscriptions.push(
    watcher,
    vscode.commands.registerCommand('shButtons.refresh', () => grid.refresh()),
    vscode.commands.registerCommand('shButtons.settings', () =>
      vscode.commands.executeCommand('workbench.action.openWorkspaceSettings', 'shButtons.exclude')),
    vscode.workspace.onDidChangeConfiguration(e => { if (e.affectsConfiguration('shButtons')) grid.refresh() }),
  )
}

function deactivate() {}

module.exports = { activate, deactivate, parseUsage, readScript }

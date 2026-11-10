// Builds the Marketplace screenshots' mock-ups: a VS Code window (Default Dark Modern or Default Light Modern) with the
// Scripts view open beside a terminal. The view is the extension's own page (page() in ../extension.js), fed sample
// scripts read by its own readScript(), with VS Code's theme variables filled in. render.sh writes mock-<theme>.html
// with this and renders it with headless Chrome.
//
//   node build.js dark|light > mock.html
const Module = require('module')
const load = Module._load
Module._load = (r, ...a) => (r === 'vscode' ? {} : load(r, ...a))
const { readScript, page } = require('../extension.js')

const theme = process.argv[2] === 'light' ? 'light' : 'dark'

const SAMPLES = {
  'scripts/build.sh': '#!/bin/bash\n# Builds the app for production into dist/.\n',
  'scripts/test.sh': '#!/bin/bash\n# Runs the test suite.\n#\n#   scripts/test.sh [--watch] [--coverage]\n',
  'scripts/lint.sh': '#!/bin/bash\n# Lints and formats the sources.\n',
  'scripts/dev.sh': '#!/bin/bash\n# Starts the dev server with live reload.\n#\n#   scripts/dev.sh --port 3000 [--open]\n',
  'scripts/deploy.sh': '#!/bin/bash\n# Deploys a build to one of the servers.\n#\n#   scripts/deploy.sh <host> --env staging [--dry-run] [more rsync flags]\n',
  'tools/release.sh': '#!/bin/bash\n# Tags a release and writes the changelog.\n#\n#   tools/release.sh <version> [--push]\n',
  'tools/screenshot.sh': '#!/bin/bash\n# Takes a screenshot of a page.\n#\n#   tools/screenshot.sh --size 1280x720 pages/<page>.html\n',
  'tools/clean.sh': '#!/bin/bash\n# Removes build output and caches.\n',
}
const scripts = Object.entries(SAMPLES)
  .map(([rel, text]) => readScript(rel, text))
  .sort((a, b) => a.group.localeCompare(b.group) || a.name.localeCompare(b.name))

const VARS = {
  dark: {
    'font-family': '-apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif', 'font-size': '13px',
    'editor-font-family': 'Menlo, Monaco, monospace', foreground: '#cccccc',
    'button-background': '#0078d4', 'button-foreground': '#ffffff', 'button-hoverBackground': '#026ec1',
    'button-secondaryBackground': '#313131', 'button-secondaryForeground': '#cccccc', 'button-secondaryHoverBackground': '#3c3c3c',
    'button-border': '#ffffff12', 'input-background': '#313131', 'input-foreground': '#cccccc', 'input-border': '#3c3c3c',
    'widget-border': '#313131', 'sideBar-background': '#1f1f1f', focusBorder: '#0078d4',
    'editorWarning-foreground': '#cca700', 'inputValidation-errorBorder': '#be1100',
  },
  light: {
    'font-family': '-apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif', 'font-size': '13px',
    'editor-font-family': 'Menlo, Monaco, monospace', foreground: '#3b3b3b',
    'button-background': '#005fb8', 'button-foreground': '#ffffff', 'button-hoverBackground': '#0258a8',
    'button-secondaryBackground': '#e5e5e5', 'button-secondaryForeground': '#3b3b3b', 'button-secondaryHoverBackground': '#cccccc',
    'button-border': '#0000001a', 'input-background': '#ffffff', 'input-foreground': '#3b3b3b', 'input-border': '#cecece',
    'widget-border': '#e5e5e5', 'sideBar-background': '#ffffff', focusBorder: '#005fb8',
    'editorWarning-foreground': '#bf8803', 'inputValidation-errorBorder': '#be1100',
  },
}[theme]

// The view's page, with the theme's variables, a stand-in for the webview API, the scripts and the deploy form open
// with something typed in.
const kept = { 0: 'staging.example.com', 1: 'staging', 2: true, extra: '' }
const view = page()
  .replace('<style>', `<style>:root{${Object.entries(VARS).map(([k, v]) => `--vscode-${k}:${v}`).join(';')}} body{margin:0;background:transparent}\n`)
  .replace('<script>', `<script>
window.acquireVsCodeApi = () => ({
  getState: () => ({ open: 'scripts/deploy.sh', values: { 'scripts/deploy.sh': ${JSON.stringify(kept)} } }),
  setState() {}, postMessage(m) { if (m.type === 'ready') setTimeout(() => window.postMessage({ type: 'scripts', scripts: ${JSON.stringify(scripts)} }, '*')) },
})
document.addEventListener('focusin', e => e.target.blur())
`)

const C = {
  dark: { bg: '#181818', editor: '#1f1f1f', border: '#2b2b2b', fg: '#cccccc', muted: '#9d9d9d', act: '#868686', actOn: '#d7d7d7',
    accent: '#0078d4', search: '#313131', searchBorder: '#3c3c3c', term: '#181818', prompt: '#3fb950', path: '#3794ff', ok: '#3fb950' },
  light: { bg: '#f8f8f8', editor: '#ffffff', border: '#e5e5e5', fg: '#3b3b3b', muted: '#717171', act: '#616161', actOn: '#1f1f1f',
    accent: '#005fb8', search: '#ffffff', searchBorder: '#cecece', term: '#ffffff', prompt: '#116329', path: '#0451a5', ok: '#116329' },
}[theme]

const ACT = [
  '<path d="M8 5.5V3.5h7l5 5V18a1 1 0 0 1-1 1h-3"/><path d="M15 3.5v5h5"/><rect x="4" y="7" width="12" height="14" rx="1"/>',
  '<circle cx="10" cy="10" r="6.5"/><path d="M14.8 14.8 21 21"/>',
  '<circle cx="6" cy="4.5" r="2"/><circle cx="6" cy="19.5" r="2"/><circle cx="18" cy="8" r="2"/><path d="M6 6.5v11M18 10c0 4-12 3-12 7.5"/>',
  '<path d="M6 4v16l13-8z"/>',
  '<rect x="3" y="3" width="7.5" height="7.5" rx="1.5"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5"/><path d="M14 15l2.5 2-2.5 2M18 19.5h3"/>',
]
const activity = ACT.map((p, i) => `<div class="act${i === 4 ? ' on' : ''}" style="top:${i * 48}px"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round">${p}</svg></div>`).join('')

const term = [
  `<span class="p">~/web-app</span> <span class="g">❯</span> bash scripts/deploy.sh staging.example.com --env staging --dry-run`,
  'Building…',
  '  dist/index.html          1.2 kB',
  '  dist/assets/app.js     148.6 kB',
  '  dist/assets/app.css     12.9 kB',
  'Dry run: 14 files would go to staging.example.com:/srv/web-app',
  `<span class="g">✓</span> Nothing was changed.`,
  `<span class="p">~/web-app</span> <span class="g">❯</span> <span class="cur"></span>`,
].join('\n')

process.stdout.write(`<!doctype html><html><head><meta charset="utf-8"><title>Shell Script Buttons mock-up</title><style>
* { box-sizing: border-box; }
html, body { margin: 0; height: 100%; overflow: hidden; }
body { background: ${C.bg}; color: ${C.fg}; font: 13px/22px -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif; -webkit-font-smoothing: antialiased; }
.abs { position: absolute; }
#title { left: 0; right: 0; top: 0; height: 35px; border-bottom: 1px solid ${C.border}; }
.dot { position: absolute; top: 11px; width: 12px; height: 12px; border-radius: 50%; }
#search { position: absolute; top: 5px; height: 24px; width: 300px; left: 50%; transform: translateX(-50%); background: ${C.search};
  border: 1px solid ${C.searchBorder}; border-radius: 6px; display: flex; align-items: center; justify-content: center; gap: 6px; color: ${C.muted}; }
#activity { left: 0; top: 35px; bottom: 22px; width: 48px; border-right: 1px solid ${C.border}; }
.act { position: absolute; left: 0; width: 48px; height: 48px; display: flex; align-items: center; justify-content: center; color: ${C.act}; }
.act.on { color: ${C.actOn}; }
.act.on::before { content: ""; position: absolute; left: 0; top: 0; bottom: 0; width: 2px; background: ${C.accent}; }
#side { left: 48px; top: 35px; bottom: 22px; width: 400px; border-right: 1px solid ${C.border}; display: flex; flex-direction: column; }
#side .head { height: 35px; padding: 0 12px 0 20px; display: flex; align-items: center; font-size: 11px; flex-shrink: 0; }
#side .head .tools { margin-left: auto; display: flex; gap: 6px; opacity: .9; }
#side iframe { border: 0; flex: 1; width: 100%; }
#main { left: 448px; right: 0; top: 35px; bottom: 22px; background: ${C.editor}; }
#tabs { height: 35px; display: flex; gap: 18px; align-items: flex-end; padding: 0 14px; border-bottom: 1px solid ${C.border}; font-size: 11px; background: ${C.bg}; }
#tabs span { padding-bottom: 8px; color: ${C.muted}; letter-spacing: .02em; }
#tabs span.on { color: ${C.fg}; border-bottom: 1px solid ${C.fg}; }
#tabs .name { margin-left: auto; text-transform: none; color: ${C.fg}; display: flex; gap: 6px; align-items: center; }
pre { margin: 0; padding: 10px 16px; font: 12px/18px Menlo, Monaco, monospace; white-space: pre-wrap; background: ${C.term}; height: calc(100% - 35px); }
.p { color: ${C.path}; } .g { color: ${C.ok}; }
.cur { display: inline-block; width: 7px; height: 14px; background: ${C.fg}; vertical-align: -2px; }
#status { left: 0; right: 0; bottom: 0; height: 22px; border-top: 1px solid ${C.border}; font-size: 12px; display: flex; align-items: center; padding: 0 10px; gap: 14px; }
#status .r { margin-left: auto; display: flex; gap: 14px; }
</style></head><body>
<div id="title" class="abs"><div class="dot" style="left:13px;background:#ff5f57"></div><div class="dot" style="left:33px;background:#febc2e"></div><div class="dot" style="left:53px;background:#28c840"></div>
<div id="search"><svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3"><circle cx="6.5" cy="6.5" r="5"/><path d="M10.2 10.2 15 15"/></svg>web-app</div></div>
<div id="activity" class="abs">${activity}</div>
<div id="side" class="abs"><div class="head">SCRIPTS<span class="tools">
<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2"><path d="M13.2 8.6A5.3 5.3 0 1 1 11 3.6"/><path d="M11.5 1v3.2H8.3"/></svg>
<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.1"><circle cx="8" cy="8" r="2"/><path d="M6.9 1.5h2.2l.4 1.8 1.3.6 1.6-1 1.5 1.5-1 1.6.6 1.3 1.8.4v2.2l-1.8.4-.6 1.3 1 1.6-1.5 1.5-1.6-1-1.3.6-.4 1.8H6.9l-.4-1.8-1.3-.6-1.6 1-1.5-1.5 1-1.6-.6-1.3-1.8-.4V6.9l1.8-.4.6-1.3-1-1.6 1.5-1.5 1.6 1 1.3-.6z"/></svg>
</span></div><iframe srcdoc="${view.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}"></iframe></div>
<div id="main" class="abs"><div id="tabs"><span>PROBLEMS</span><span>OUTPUT</span><span class="on">TERMINAL</span><span>PORTS</span>
<span class="name"><svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2"><path d="M2.5 4.5 6 8l-3.5 3.5M7.5 12h6"/></svg>sh: deploy</span></div><pre>${term}</pre></div>
<div id="status" class="abs"><span>main</span><span>⊗ 0  ⚠ 0</span><span class="r"><span>Spaces: 2</span><span>UTF-8</span><span>LF</span><span>Shell Script</span></span></div>
</body></html>`)

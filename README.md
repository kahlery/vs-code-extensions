# VS Code extensions

My VS Code extensions, one folder each.

| Extension | What it does | Marketplace |
|---|---|---|
| [Explorer Sizes](explorer-sizes) | File and folder sizes in the Explorer | [kahlery.explorer-sizes](https://marketplace.visualstudio.com/items?itemName=kahlery.explorer-sizes) |
| [Shell Script Buttons](shell-script-buttons) | The workspace's `.sh` scripts as a grid of buttons; their flags as input fields | [kahlery.shell-script-buttons](https://marketplace.visualstudio.com/items?itemName=kahlery.shell-script-buttons) |
| [Usage Rings for Claude Code](claude-usage-rings) | Claude Code's context, 5-hour and 7-day limits and cost in the status bar | [kahlery.claude-usage-rings](https://marketplace.visualstudio.com/items?itemName=kahlery.claude-usage-rings) |

## Packaging

Each folder packages on its own:

```sh
cd shell-script-buttons && npx @vscode/vsce package
```

(Explorer Sizes has its own `build.py`; see its README.)

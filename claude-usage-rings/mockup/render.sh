#!/bin/sh
# Renders the Marketplace screenshots from mock.html with headless Chrome (never a visible window) into ../images/.
set -e
cd "$(dirname "$0")"
here="$(pwd)"
chrome="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
mkdir -p ../images
shot() { # out width height query
  "$chrome" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=2 \
    --user-data-dir="$here/.chrome-profile" --window-size="$2,$3" --screenshot="$here/../images/$1" \
    "file://$here/mock.html?$4" 2>/dev/null
}
shot statusbar-dark.png 1000 190 "theme=dark&tip=five_hour"
shot statusbar-hot.png 1000 190 "theme=dark&hot=1&tip=five_hour"

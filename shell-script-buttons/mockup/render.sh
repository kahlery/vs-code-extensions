#!/bin/sh
# Renders the Marketplace screenshots from build.js's mock-ups with headless Chrome (never a visible window) into
# ../images/.
set -e
cd "$(dirname "$0")"
here="$(pwd)"
chrome="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
mkdir -p ../images
for theme in dark light; do
  node build.js $theme > "mock-$theme.html"
  "$chrome" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=2 \
    --user-data-dir="$here/.chrome-profile" --window-size=1120,700 --virtual-time-budget=2000 \
    --screenshot="$here/../images/scripts-$theme.png" "file://$here/mock-$theme.html" 2>/dev/null
done

#!/usr/bin/env sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
PLUGIN_DIR="$SCRIPT_DIR/gifFolders"
VENCORD_DIR="${1:-${VENCORD_DIR:-}}"

if [ -z "$VENCORD_DIR" ]; then
    if [ -d "$HOME/Documents/Vencord/src" ]; then
        VENCORD_DIR="$HOME/Documents/Vencord"
    else
        echo "Usage: ./install-userplugin.sh /path/to/Vencord" >&2
        echo "You can also set VENCORD_DIR=/path/to/Vencord." >&2
        exit 1
    fi
fi

if [ ! -d "$PLUGIN_DIR" ]; then
    echo "Plugin folder not found: $PLUGIN_DIR" >&2
    exit 1
fi

if [ ! -d "$VENCORD_DIR/src" ]; then
    echo "This does not look like a Vencord source folder: $VENCORD_DIR" >&2
    echo "Expected to find: $VENCORD_DIR/src" >&2
    exit 1
fi

TARGET_DIR="$VENCORD_DIR/src/userplugins/gifFolders"

mkdir -p "$TARGET_DIR"
cp -R "$PLUGIN_DIR/." "$TARGET_DIR/"

echo "GifFolders copied to: $TARGET_DIR"
echo
echo "Next steps:"
echo "  cd \"$VENCORD_DIR\""
echo "  pnpm build --dev"
echo
echo "Discord Desktop:"
echo "  pnpm inject"
echo "  Restart Discord, then enable GifFolders in Vencord plugins."
echo
echo "Vesktop:"
echo "  Open Vesktop Settings > Vencord Location > Change"
echo "  Select: $VENCORD_DIR/dist"
echo "  Fully restart Vesktop, then enable GifFolders in Vencord plugins."

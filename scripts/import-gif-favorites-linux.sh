#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd -- "$SCRIPT_DIR/.." && pwd)"

if ! command -v node >/dev/null 2>&1; then
    echo "Erreur: Node.js 18+ est requis." >&2
    exit 1
fi

NEEDS_TOKEN=1
for arg in "$@"; do
    case "$arg" in
        --help|-h|--dry-run|--token)
            NEEDS_TOKEN=0
            ;;
    esac
done

if [[ "$NEEDS_TOKEN" -eq 1 && -z "${DISCORD_TOKEN:-}" ]]; then
    read -r -s -p "Discord token: " DISCORD_TOKEN
    echo
    export DISCORD_TOKEN
fi

node "$REPO_DIR/scripts/import-gif-favorites.mjs" "$@"

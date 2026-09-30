#!/bin/sh
set -eu

revision="${SOURCE_COMMIT:-${NEXO_SOURCE_COMMIT:-unknown}}"
case "$revision" in
  ''|*[!a-fA-F0-9-]*) revision="unknown" ;;
esac

printf '{"revision":"%s"}\n' "$revision" > /usr/share/nginx/html/nexo-build.json

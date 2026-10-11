#!/usr/bin/env bash
set -euo pipefail
SOURCE=$(cd -- "$(dirname -- "$0")" && pwd)
ROOT=/opt/xiaoheihehe-updates
BACKUP=/var/backups/xiaoheihehe-updates/$(date -u +%Y%m%dT%H%M%SZ)
install -d -m 700 "$BACKUP"
install -d -m 755 "$ROOT" "$ROOT/releases"
install -m 644 "$SOURCE/index.html" "$ROOT/index.html"
install -m 644 "$SOURCE/publish.py" "$ROOT/publish.py"
SNIPPET=/etc/nginx/snippets/xiaoheihehe-updates.conf
if [ -e "$SNIPPET" ]; then cp -p "$SNIPPET" "$BACKUP/nginx-snippet.backup"; fi
install -m 644 "$SOURCE/nginx.conf" "$SNIPPET"
python3 - "$BACKUP" <<'PY'
import pathlib, shutil, sys
target = pathlib.Path('/etc/nginx/sites-enabled/cjbtj.xyz').resolve()
backup = pathlib.Path(sys.argv[1]) / 'nginx-site.backup'
shutil.copy2(target, backup)
text = target.read_text()
include = '    include /etc/nginx/snippets/xiaoheihehe-updates.conf;\n'
if include.strip() not in text:
    anchor = '    location /qingyu/ {'
    if text.count(anchor) != 1:
        raise SystemExit('Existing HTTPS server block could not be identified; no site changes made.')
    target.write_text(text.replace(anchor, include + '\n' + anchor, 1))
PY
if ! nginx -t; then
    cp -p "$BACKUP/nginx-site.backup" "$(readlink -f /etc/nginx/sites-enabled/cjbtj.xyz)"
    if [ -e "$BACKUP/nginx-snippet.backup" ]; then cp -p "$BACKUP/nginx-snippet.backup" "$SNIPPET"; fi
    exit 1
fi
systemctl reload nginx
echo "Update routes installed. Configuration backups: $BACKUP"

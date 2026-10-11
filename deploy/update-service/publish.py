"""Authenticated SSH publishing only; no public upload or administrator endpoint."""
import fcntl
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import sys
import tempfile

ROOT = Path('/opt/xiaoheihehe-updates')
BASE = 'https://cjbtj.xyz/xiaoheihehe/releases/'


def publish(source):
    manifest = json.loads((source / 'manifest.json').read_text(encoding='utf-8-sig'))
    version = manifest['version']
    if not re.fullmatch(r'(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)', version):
        raise ValueError('Invalid stable version')
    name = f'xiaoheihehe_{version}_x64-setup.exe'
    installer = source / 'installer.exe'
    if installer.read_bytes()[:2] != b'MZ' or not 0 < installer.stat().st_size <= 200 * 1024 * 1024:
        raise ValueError('Invalid Windows installer')
    digest = hashlib.sha256(installer.read_bytes()).hexdigest()
    if manifest['platform'] != 'windows-x86_64' or manifest['downloadUrl'] != BASE + version + '/' + name:
        raise ValueError('Invalid platform or download URL')
    if manifest['sha256'] != digest or manifest['size'] != installer.stat().st_size:
        raise ValueError('Installer does not match manifest')
    if not isinstance(manifest['notes'], str) or len(manifest['notes'].encode()) > 16 * 1024:
        raise ValueError('Invalid release notes')
    if not isinstance(manifest['publishedAt'], str) or len(manifest['publishedAt']) > 64:
        raise ValueError('Invalid publication date')
    ROOT.mkdir(parents=True, exist_ok=True)
    with (ROOT / '.publish.lock').open('w') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        latest = ROOT / 'latest.json'
        if latest.exists():
            previous = json.loads(latest.read_text())
            if tuple(map(int, previous['version'].split('.'))) > tuple(map(int, version.split('.'))):
                raise ValueError('Publishing an older version requires explicit manual rollback')
        folder = ROOT / 'releases' / version
        folder.mkdir(parents=True, exist_ok=True)
        target = folder / name
        if target.exists() and hashlib.sha256(target.read_bytes()).hexdigest() != digest:
            raise ValueError('Version already exists with a different installer; increase the version')
        if not target.exists():
            temporary = folder / (name + '.uploading')
            shutil.copyfile(installer, temporary)
            os.chmod(temporary, 0o644)
            os.replace(temporary, target)
        contents = json.dumps(manifest, ensure_ascii=False, indent=2).encode() + b'\n'
        (folder / 'manifest.json').write_bytes(contents)
        os.chmod(folder / 'manifest.json', 0o644)
        fd, temporary = tempfile.mkstemp(prefix='.latest-', dir=ROOT)
        with os.fdopen(fd, 'wb') as output:
            output.write(contents)
            output.flush()
            os.fsync(output.fileno())
        os.chmod(temporary, 0o644)
        os.replace(temporary, latest)
    print(f'Published {version}: {manifest["downloadUrl"]}')


if __name__ == '__main__':
    publish(Path(sys.argv[1]))

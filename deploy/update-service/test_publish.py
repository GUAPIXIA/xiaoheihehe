import hashlib
import json
from pathlib import Path
import tempfile
import unittest
import publish


class PublishingTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='heybox-publish-test-')
        self.root = Path(self.temp.name)
        self.original_root = publish.ROOT
        publish.ROOT = self.root / 'server'

    def tearDown(self):
        publish.ROOT = self.original_root
        self.temp.cleanup()

    def source(self, version='0.1.1', content=b'MZ-test-installer'):
        folder = self.root / ('stage-' + str(len(list(self.root.iterdir()))))
        folder.mkdir()
        (folder / 'installer.exe').write_bytes(content)
        manifest = {'version': version, 'notes': 'test', 'publishedAt': '2026-10-11T00:00:00Z',
                    'platform': 'windows-x86_64', 'size': len(content),
                    'sha256': hashlib.sha256(content).hexdigest(),
                    'downloadUrl': f'{publish.BASE}{version}/xiaoheihehe_{version}_x64-setup.exe'}
        (folder / 'manifest.json').write_text(json.dumps(manifest))
        return folder

    def test_publish_keeps_installer_and_latest_in_sync(self):
        publish.publish(self.source())
        publish.publish(self.source('0.1.2'))
        latest = json.loads((publish.ROOT / 'latest.json').read_text())
        self.assertEqual(latest['version'], '0.1.2')
        self.assertTrue((publish.ROOT / 'releases/0.1.1/xiaoheihehe_0.1.1_x64-setup.exe').exists())
        self.assertTrue((publish.ROOT / 'releases/0.1.2/xiaoheihehe_0.1.2_x64-setup.exe').exists())

    def test_invalid_hash_overwrite_and_downgrade_preserve_latest(self):
        publish.publish(self.source('0.1.2'))
        latest = (publish.ROOT / 'latest.json').read_bytes()
        wrong = self.source('0.1.3')
        (wrong / 'installer.exe').write_bytes(b'MZ-changed')
        for source in [wrong, self.source('0.1.2', b'MZ-different'), self.source('0.1.1')]:
            with self.assertRaises(ValueError):
                publish.publish(source)
            self.assertEqual((publish.ROOT / 'latest.json').read_bytes(), latest)

    def test_invalid_version_never_creates_release(self):
        source = self.source('../1.2.3')
        with self.assertRaises(ValueError):
            publish.publish(source)
        self.assertFalse((publish.ROOT / 'latest.json').exists())


if __name__ == '__main__':
    unittest.main()

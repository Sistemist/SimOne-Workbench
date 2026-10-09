import importlib.util
from pathlib import Path
import tempfile
import time
import os
spec = importlib.util.spec_from_file_location('retention', Path(__file__).with_name('sysdom-retention-host.py'))
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
with tempfile.TemporaryDirectory() as tmp:
    root = Path(tmp); now = time.time()
    backup = root / m.DATA / 'data/backups/paperclip-20200101-000000.sql.gz'
    backup.parent.mkdir(parents=True); backup.write_text('fixture')
    other = backup.with_name('unrelated.tar.gz'); other.write_text('fixture')
    link = backup.with_name('paperclip-20200102-000000.sql.gz'); link.symlink_to(other)
    log = root / 'var/log/sysdom/app.log-20200101'; log.parent.mkdir(parents=True); log.write_text('fixture'); os.utime(log, (0,0))
    assert {p for p,_ in m.inventory(root, now)} == {backup, log}
    assert other.exists() and link.is_symlink() and backup.exists(), 'inventory must not delete'
    cold = root / m.COLD / 'database.tar.gz'; cold.parent.mkdir(parents=True); cold.write_text('fixture'); os.utime(cold,(0,0))
    try: m.inventory(root, now)
    except RuntimeError: pass
    else: raise AssertionError('Unreconciled rollback must be protected')
print('Host retention scope, symlink, dry-run and rollback safeguards passed')

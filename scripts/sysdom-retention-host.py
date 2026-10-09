#!/usr/bin/env python3
"""Approved Sysdom-only file retention. Defaults to inventory; never prunes Docker/volumes."""
import argparse
import datetime as dt
import json
from pathlib import Path
import re
import time

DAY = 86400
DATA = 'root/simone-workbench-data/public-paperclip/instances/default'
COLD = 'root/sysdom-release-backups/2026-10-09-review'
COLD_NAMES = {'database.tar.gz', 'config.tar.gz', 'app.sysdom.ai.conf', 'mcp.sysdom.ai.conf'}

def inventory(root, now):
    result = []
    backups = []
    for p in (root / DATA / 'data/backups').glob('paperclip-*.sql*'):
        match = re.fullmatch(r'paperclip-(\d{8}-\d{6})\.sql(?:\.gz)?', p.name)
        if p.is_symlink() or not p.is_file() or not match:
            continue
        stamp = dt.datetime.strptime(match[1], '%Y%m%d-%H%M%S').replace(tzinfo=dt.timezone.utc).timestamp()
        age = now - min(stamp, p.stat().st_mtime)
        backups.append((p, age))
        if age >= 30 * DAY:
            result.append((p, 'database-backup'))
    for folder, pattern in [(root / 'var/log/sysdom', '*.log-*'), (root / DATA / 'logs', 'server.log-*')]:
        for p in folder.glob(pattern):
            if p.is_file() and not p.is_symlink() and now - p.stat().st_mtime >= 29 * DAY:
                result.append((p, 'rotated-log'))
    cold = [root / COLD / name for name in COLD_NAMES]
    expired = [p for p in cold if p.is_file() and not p.is_symlink() and now - p.stat().st_mtime >= 30 * DAY]
    if expired:
        proof = root / 'root/sysdom-retention/restore-verified.json'
        verified = proof.is_file() and json.loads(proof.read_text()).get('restoreAndRetentionVerified') is True
        if not verified or not any(age < DAY for _, age in backups):
            raise RuntimeError('Cold rollback expiry requires a verified restore and a fresh database backup; preserve artifacts and notify operator')
        result.extend((p, 'reconciled-cold-backup') for p in expired)
    return result

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args()
    rows = inventory(Path('/'), time.time())
    print(json.dumps({'apply': args.apply, 'candidates': [{'path': str(p), 'class': kind, 'bytes': p.stat().st_size} for p, kind in rows]}))
    if args.apply:
        for p, _ in rows:
            if p.is_symlink() or not p.is_file():
                raise RuntimeError('Candidate changed; stopped')
            p.unlink()
        print(json.dumps({'deleted': len(rows)}))

#!/usr/bin/env python3
"""Planification pure des versions stables. Métadonnées publiques seulement, aucun secret.
Version stable v1.0.N, code Android 100000 + N. Un même commit retrouve toujours sa version."""
import re

def plan(sha, releases=None):
    if not re.fullmatch(r'[0-9a-f]{40}', sha):
        raise ValueError('SHA complet attendu')
    patches = []
    for release in releases or []:
        m = re.fullmatch(r'v1\.0\.(0|[1-9][0-9]*)', release.get('tag_name', ''))
        if not m:
            continue
        patch = int(m.group(1))
        if release.get('target_commitish') == sha:
            return {'version': f'1.0.{patch}', 'code': 100000 + patch, 'tag': f'v1.0.{patch}', 'sha': sha}
        patches.append(patch)
    patch = max(patches, default=-1) + 1
    return {'version': f'1.0.{patch}', 'code': 100000 + patch, 'tag': f'v1.0.{patch}', 'sha': sha}

if __name__ == '__main__':
    import json, sys
    history = json.load(open(sys.argv[2])) if len(sys.argv) > 2 else []
    print(json.dumps(plan(sys.argv[1], history)))

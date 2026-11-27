#!/usr/bin/env python3
import importlib.util, os
spec = importlib.util.spec_from_file_location('rp', os.path.join(os.path.dirname(__file__), 'release-plan.py'))
rp = importlib.util.module_from_spec(spec); spec.loader.exec_module(rp)
A, B, C = 'a' * 40, 'b' * 40, 'c' * 40
assert rp.plan(A, [])['tag'] == 'v1.0.0' and rp.plan(A, [])['code'] == 100000
h = [{'tag_name': 'v1.0.0', 'target_commitish': A}, {'tag_name': 'v0.1.2-test', 'target_commitish': B}, {'tag_name': 'v1.0.3', 'target_commitish': C, 'draft': True}]
assert rp.plan(B, h)['tag'] == 'v1.0.4', 'prochain = plus grand patch + 1, brouillons réservés, pré-releases de test ignorées'
assert rp.plan(A, h)['tag'] == 'v1.0.0', 'un commit déjà publié garde sa version'
assert rp.plan(C, h)['code'] == 100003
try: rp.plan('abc', []); raise SystemExit('SHA invalide accepté')
except ValueError: pass
print('release-plan OK')

#!/usr/bin/env python3
"""Run all end-to-end suites in tests/e2e/ one after another.

    python3 tests/e2e/run.py                # all
    python3 tests/e2e/run.py uml rainer     # only suites whose name contains one of the words
"""
import subprocess
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
suites = sorted(HERE.glob('test_*.py'))
if len(sys.argv) > 1:
    suites = [s for s in suites if any(a in s.stem for a in sys.argv[1:])]

failed = []
for s in suites:
    t = time.time()
    r = subprocess.run([sys.executable, s.name], cwd=s.parent, capture_output=True, text=True)
    fails = [line for line in r.stdout.splitlines() if line.startswith('FAIL ')]
    good = r.returncode == 0 and not fails
    print(f"{'ok  ' if good else 'FAIL'} {s.stem:<24} {time.time() - t:5.1f}s")
    if not good:
        failed.append(s.stem)
        for line in fails:
            print('     ' + line)
        if r.returncode and not fails:
            print((r.stderr or r.stdout)[-1500:])
print(f"\n{len(suites) - len(failed)}/{len(suites)} suites passed")
sys.exit(1 if failed else 0)

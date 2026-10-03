"""Shared helpers for the end-to-end tests."""
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DIST = ROOT / 'dist' / 'index.html'
OUT = ROOT / 'tests' / 'output'
OUT.mkdir(parents=True, exist_ok=True)

if not DIST.exists():
    sys.exit('dist/index.html is missing. Run "npm run build" first.')

#: URL of the built app. Set APP_URL to test e.g. a local server instead.
APP = os.environ.get('APP_URL', DIST.as_uri())


def out(name: str) -> str:
    """Path for screenshots and test files (tests/output/, not versioned)."""
    return str(OUT / name)


def finish(fails):
    """Exit the suite with exit code 1 if any check failed."""
    if fails:
        sys.exit(1)

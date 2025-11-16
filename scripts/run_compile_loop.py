#!/usr/bin/env python3
import sys
from pathlib import Path
import json
from subprocess import run

source = sys.argv[1] if len(sys.argv) > 1 else '42'
run(['node', 'dist/main.js'], input=source.encode())

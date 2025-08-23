#!/usr/bin/env python3
"""Download all JSON files from a GitHub repo and copy them into components/mappings.

Usage:
  python3 components/update_mappings.py
  python3 components/update_mappings.py --repo https://github.com/owner/repo.git --dest components/mappings --depth 1

The script:
- clones the repo into a temporary directory
- searches for all .json files
- copies them into the destination directory preserving relative paths
- cleans up the temporary clone (unless --keep-tmp is passed)
"""
from __future__ import annotations
import argparse
import tempfile
import subprocess
import shutil
import os
import sys

def run(cmd: str) -> None:
    subprocess.check_call(cmd, shell=True)

def find_json_files(root: str):
    for dirpath, dirs, files in os.walk(root):
        for f in files:
            if f.lower().endswith('.json'):
                yield os.path.join(dirpath, f)

def main() -> int:
    p = argparse.ArgumentParser(
        description='Download JSON files from a GitHub repo into components/mappings'
    )
    p.add_argument(
        '--repo',
        default='https://github.com/patrickdobler/llm-text-normalizer-mappings.git',
        help='Git repository URL'
    )
    p.add_argument(
        '--dest',
        default='components/mappings',
        help='Destination directory inside this project'
    )
    p.add_argument(
        '--depth',
        type=int,
        default=1,
        help='git clone --depth value (0 for full clone)'
    )
    p.add_argument(
        '--keep-tmp',
        action='store_true',
        help='Do not delete the temporary clone directory (for debugging)'
    )
    args = p.parse_args()

    tmp = tempfile.mkdtemp(prefix='mappings_')
    try:
        depth_arg = '' if args.depth == 0 else f'--depth {args.depth}'
        print(f'Cloning {args.repo} into {tmp}')
        run(f'git clone {depth_arg} {args.repo} "{tmp}"')

        copied = 0
        files = list(find_json_files(tmp))
        if not files:
            print('No JSON files found in repository.')
            return 0

        for src in files:
            rel = os.path.relpath(src, tmp)
            dest_path = os.path.join(args.dest, os.path.dirname(rel))
            os.makedirs(dest_path, exist_ok=True)
            dst = os.path.join(dest_path, os.path.basename(src))
            shutil.copy2(src, dst)
            copied += 1
            print(f'Copied: {rel} -> {dst}')

        print(f'Done. Copied {copied} JSON files into {args.dest}')
        if args.keep_tmp:
            print(f'Temporary clone retained at {tmp}')
    finally:
        if not args.keep_tmp:
            try:
                shutil.rmtree(tmp)
            except Exception as e:
                print(f'Warning: failed to remove temp dir {tmp}: {e}', file=sys.stderr)

    return 0

if __name__ == '__main__':
    sys.exit(main())
#!/usr/bin/env python3
"""Download all JSON files from a GitHub repo and copy them into components/mappings.

Usage:
  python3 components/update_mappings.py
  python3 components/update_mappings.py --repo https://github.com/owner/repo.git --dest components/mappings --depth 1

The script:
- clones the repo into a temporary directory
- searches for all .json files
- copies them into the destination directory preserving relative paths
- updates the EMBEDDED_MAPPINGS in scripts/optimizer.js with the new JSON content
- cleans up the temporary clone (unless --keep-tmp is passed)
"""
from __future__ import annotations
import argparse
import tempfile
import subprocess
import shutil
import os
import sys
import json
import re

def run(cmd: str) -> None:
    subprocess.check_call(cmd, shell=True)

def find_json_files(root: str):
    for dirpath, dirs, files in os.walk(root):
        for f in files:
            if f.lower().endswith('.json'):
                yield os.path.join(dirpath, f)

def update_embedded_mappings(mappings_dir: str, optimizer_js_path: str = 'scripts/optimizer.js'):
    """Update the EMBEDDED_MAPPINGS constant in optimizer.js with the content of JSON files."""
    if not os.path.exists(optimizer_js_path):
        print(f'Warning: {optimizer_js_path} not found, skipping EMBEDDED_MAPPINGS update')
        return
    
    # Read all JSON mapping files
    mappings = {}
    mapping_files_dir = os.path.join(mappings_dir, 'mappings')
    
    if os.path.exists(mapping_files_dir):
        for filename in os.listdir(mapping_files_dir):
            if filename.endswith('.json'):
                filepath = os.path.join(mapping_files_dir, filename)
                try:
                    with open(filepath, 'r', encoding='utf-8') as f:
                        content = json.load(f)
                        # Extract language name from filename (e.g., 'swiss-german.json' -> 'swiss-german')
                        lang_key = filename[:-5]  # Remove .json extension
                        mappings[lang_key] = content
                        print(f'Loaded mapping: {lang_key}')
                except Exception as e:
                    print(f'Warning: Failed to load {filepath}: {e}')
    
    if not mappings:
        print('No mapping files found, skipping EMBEDDED_MAPPINGS update')
        return
    
    # Read the current optimizer.js file
    with open(optimizer_js_path, 'r', encoding='utf-8') as f:
        js_content = f.read()
    
    # Generate the new EMBEDDED_MAPPINGS constant
    mappings_js = 'const EMBEDDED_MAPPINGS = ' + json.dumps(mappings, indent=2, ensure_ascii=False) + ';'
    
    # Replace the existing EMBEDDED_MAPPINGS constant
    pattern = r'const EMBEDDED_MAPPINGS = \{[^}]*(?:\{[^}]*\}[^}]*)*\};'
    if re.search(pattern, js_content, re.DOTALL):
        new_js_content = re.sub(pattern, mappings_js, js_content, flags=re.DOTALL)
        
        # Write the updated content back
        with open(optimizer_js_path, 'w', encoding='utf-8') as f:
            f.write(new_js_content)
        
        print(f'Updated EMBEDDED_MAPPINGS in {optimizer_js_path} with {len(mappings)} language mappings')
    else:
        print(f'Warning: Could not find EMBEDDED_MAPPINGS constant in {optimizer_js_path}')

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
        
        # Update EMBEDDED_MAPPINGS in optimizer.js
        if copied > 0:
            print('Updating EMBEDDED_MAPPINGS in optimizer.js...')
            update_embedded_mappings(args.dest)
        
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
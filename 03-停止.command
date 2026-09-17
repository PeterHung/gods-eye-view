#!/bin/bash
set -u
PROJECT_DIR="$(cd -- "$(dirname -- "$0")" && pwd)"
/usr/bin/python3 "$PROJECT_DIR/scripts/manage.py" stop "$@"
result=$?
if [[ -t 0 ]]; then
  printf '\n按 Enter 關閉此視窗…'
  read -r _
fi
exit "$result"

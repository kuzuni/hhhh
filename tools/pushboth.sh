#!/bin/bash
# main에 커밋 → main + 지정 브랜치 양쪽에 push (네트워크 실패 시 지수 백오프 재시도)
set -e
BR="claude/handoff-spec-completion-2n1rg2"
push(){ local ref="$1"; local d=2
  for i in 1 2 3 4 5; do
    if git push -u origin "$ref"; then return 0; fi
    [ $i -eq 5 ] && return 1
    echo "push $ref 실패 — ${d}s 후 재시도"; sleep $d; d=$((d*2))
  done; }
push main
git branch -f "$BR" main
push "$BR":"$BR"

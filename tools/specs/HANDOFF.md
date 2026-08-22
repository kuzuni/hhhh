# 인수인계 — 캐릭터 쇼케이스 마무리 작업

이 리포는 GitHub Pages(https://kuzuni.github.io/hhhh/)로 서빙되는 2D 리깅 캐릭터 쇼케이스다.
`main`에 push = 배포. 허브는 `heroes.html`, 문서는 `architecture.html`.

## 완성된 것 (건드리지 말 것)
`index.html`, `spiderbot.html`, `hero-blade.html`, `hero-puppet.html`, `hero-live.html`, `heroes.html`, `architecture.html`

## 남은 작업 (우선순위 순)
각 페이지의 스펙은 이 폴더의 md 파일들이다. **먼저 spec-common.md를 정독**하고, 대상별 스펙을 읽어라.
심사 패널은 돌리지 않는다 — **빌더 자가검증(스크린샷 보고 고치기 ≥4회)만으로 완성** 처리한다.

1. **미완성/스텁 페이지 완성** — 각 파일이 스펙 대비 완성인지 확인하고, 스텁이거나 미완이면 스펙대로 완성하라:
   - `chibi-bone.html` (spec-common → spec-chibi-common → spec-cbone)
   - `chibi-puppet.html` (spec-common → spec-chibi-common → spec-cpuppet)
   - `boar-bone.html`, `boar-puppet.html` (spec-common → spec-monster-common → spec-boar)
   - `pump-bone.html`, `pump-puppet.html` (spec-common → spec-monster-common → spec-pump)
2. **리코 전투 업그레이드** — 두 chibi 페이지 완성 후 spec-chibi-combat.md 적용 (베기 6종 + 스킬 이펙트 3종).
3. 페이지 하나가 완성될 때마다 **즉시 commit + push** (부분 배포 환영).

## 검증 방법 (환경별)
- Windows 로컬: `bash tools/shot2.sh <파일>.html?montage tools/<key>_iterN.png` (헤드리스 Edge)
- 리눅스/클라우드: Edge가 없으니 헤드리스 크로미엄으로 대체:
  `npx playwright install chromium` 후
  `npx playwright screenshot --viewport-size=1680,1500 "file://$PWD/<파일>.html?montage" out.png`
  또는 `chromium --headless --disable-gpu --screenshot=out.png --window-size=1680,1500 "file://..."`
- 찍은 PNG를 **직접 보고** 결함을 고쳐라. `?montage` 모드가 심사용 그리드다.

## 파일별 현재 상태 (2026-08-23 06:35 기준)
| 파일 | 상태 |
|---|---|
| boar-bone.html | 거의 완성 (자가검증 4회까지 진행됨) — 스펙 대비 점검 후 마무리만 |
| pump-bone.html | 본편 완성, 검증 1회 — 검증 루프 마저 돌리기 |
| pump-puppet.html | 본편 완성, 검증 1회 — 검증 루프 마저 돌리기 |
| boar-puppet.html | 중간 초안 (33KB) — 스펙 대비 부족분 완성 필요 |
| chibi-puppet.html | 초안 스텁 (18KB) — 사실상 재작성 필요 |
| chibi-bone.html | 잘린 스텁 (7KB) — 재작성 필요 |

## 완성 기준
- `?montage`에 Row A/B/C가 스펙 레이아웃대로 렌더, 빈칸·에러 텍스트 없음
- 아바타 2벌이 몽타주에 모두 등장, 몬스터는 죽음(음식 조각) 시퀀스 필수 (잔인함 0)
- 일반 모드(쿼리 없음)에서 UI·애니 버튼 동작, 에러 없음

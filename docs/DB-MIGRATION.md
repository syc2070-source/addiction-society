# DB 마이그레이션 운영 절차 (AS-OBS-M2.5)

`synchronize`는 기본 **꺼져 있습니다**(`DB_SYNCHRONIZE` 미설정 시 false).
스키마 변경은 **오직 마이그레이션 파일로만** 합니다. 엔티티를 고쳤다고 운영 테이블이
자동으로 바뀌지 않습니다(=컬럼이 삭제될 위험 없음).

관련 파일: `backend/src/data-source.ts`(CLI 전용 DataSource), `backend/src/migrations/`.

---

## 스키마 변경 절차 (기존 DB)

1. 엔티티 파일 수정 (`*.entity.ts`)
2. 마이그레이션 생성
   ```
   npm run migration:generate -- src/migrations/<변경이름>
   ```
3. 생성된 `src/migrations/<timestamp>-<변경이름>.ts`의 `up()`/`down()` **검토**
   (의도치 않은 DROP이 없는지 반드시 확인)
4. 적용
   ```
   npm run migration:run
   ```
5. **마이그레이션 파일까지 함께 커밋**

되돌리기: `npm run migration:revert` (마지막 1개), 상태 확인: `npm run migration:show`

---

## 신규 DB 구축 (예: Supabase 이전)

빈 DB에 접속 정보를 `.env`에 설정한 뒤:
```
npm run migration:run    # 전체 스키마 생성 (Baseline + 이후 전부)
npm run seed:tags        # 기본 태그 17건
npm run seed:sources     # 데이터 관측소 소스 23건
npm run backfill:next    # next_expected_at 계산
```
> 리서치/정책/회복자원 등 운영 데이터는 관리자 화면 또는 자동수집으로 채웁니다.

---

## ⚠️ DB_SYNCHRONIZE 경고

- 기본값 **false**. `.env`에 `DB_SYNCHRONIZE=true`를 **명시**한 경우에만 켜집니다.
- `true`는 **로컬 실험 전용**입니다. 엔티티와 DB를 강제로 맞추며,
  **컬럼/테이블을 삭제**할 수 있습니다. **운영에서 절대 금지.**

---

## 엔티티 추가 시 두 곳 등록

새 엔티티는 반드시 **두 파일 모두**에 등록해야 합니다(둘 중 하나라도 빠지면
런타임 또는 마이그레이션에서 누락됩니다):
- `backend/src/app.module.ts` — TypeOrmModule의 `entities` 배열
- `backend/src/data-source.ts` — CLI DataSource의 `entities` 배열

두 파일에 서로를 가리키는 주석을 남겨 두었습니다.

---

## 베이스라인 처리 메모

- `1784357488932-Baseline.ts` = 기존 로컬 스키마(엔티티 7 + 조인 3, 총 10 테이블)의 박제.
  빈 DB 대비로 생성했으며, 빈 DB에 `migration:run` 시 실DB와 스키마가 완전 일치함을 검증함.
- 데이터가 이미 있던 기존 로컬 DB에는 **실행하지 않고**(테이블 충돌 방지),
  `migrations` 기록 테이블에 "이미 적용됨"으로 1행만 기록해 두었습니다
  (`migration:show`에서 `[X] Baseline`).

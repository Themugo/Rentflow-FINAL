# CALQULUS PMS — MASTER UPDATED REPOSITORY

This archive is a **complete repository snapshot**, not a patch. It was rebuilt from the supplied `CALQULUS-PMS-main` archive and includes the full project tree plus the completed Utilities, Amenities & Contract Document Control initiative.

## Copy target
Extract the contents so the project root becomes:

`C:\Users\hp\Desktop\CALQULUS-PMS`

Do not copy this archive inside the project as a nested folder. The extracted project root should contain `package.json`, `src`, `supabase`, `public`, `scripts`, etc.

## Verify
```cmd
cd /d C:\Users\hp\Desktop\CALQULUS-PMS
npm ci
npm run test -- src/test/utilitiesAmenitiesContractsInitiative.test.ts
npm run typecheck
npm run build
```

## Commit and push
After verification and after the Supabase migration is applied through your normal deployment workflow:

```cmd
cd /d C:\Users\hp\Desktop\CALQULUS-PMS && git add -A && git commit -m "feat: complete utilities amenities and contract document control" && git push origin main
```

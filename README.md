# Ingatlanfelvétel – önálló Next.js webapp, 1.0

## Indítás Windows alatt
1. Telepíts Node.js 22 LTS-t, ha még nincs.
2. Csomagold ki a projektet például az `F:\ingatlanfelvetel-app` mappába.
3. Nyiss terminált ebben a mappában, majd:

```powershell
npm ci
npm run dev
```

Nyisd meg: http://localhost:3000

## Ellenőrzés – Git – Vercel

```powershell
npm run check
npm run build
```

Sikeres ellenőrzés után hozz létre egy saját Git-repozitóriumot, és töltsd fel a teljes projektet. A node_modules és .next nem kerül a Gitbe.
Vercelben importáld a repozitóriumot. Framework: Next.js. Root Directory: a package.json mappája. A build beállítása automatikus. Ehhez a verzióhoz nincs szükség környezeti változókra.

## Tartalom
Ötlépéses felvétel; ingatlantípus szerinti mezők; további tulajdonosok; helyiséglista összesítéssel; legfeljebb 20 optimalizált fotó; sorrendezés és borítókép; képernyős aláírás; változtatás után új aláírás; nyomtatás és Mentés PDF-ként; piszkozatlista; keresés; JSON export/import.
A fotók sorrendje a PDF-ben is megmarad. A belső megjegyzés nem szerepel a nyomtatott adatlapon, de az export tartalmazza.

## Adatok és költözés
Ez az első, helyben mentő verzió: IndexedDB-ben, az adott böngészőben és webcímen tárol. Nincs felhős szinkron és fiókos belépés. A Vercelre feltöltött program nem tölti fel az ügyféladatokat.
A korábbi próbaoldal adatai nem költöznek át automatikusan. A régi oldalon felvételenként exportálj biztonsági másolatot, az új oldalon a Mentett felvételek alatt töltsd vissza. Importálás új felvételt hoz létre.
Az inkognitómód, a böngészőadatok törlése vagy a készülék elvesztése adatvesztést okozhat; rendszeresen exportálj. A JSON-ban a fotók és az aláírás is benne van, kezeld bizalmasan.

## Mobil
Reszponzív felület, érintéses aláírás, kezdőképernyőre helyezéshez alkalmazásmanifest és ikonok. Az oldal első megnyitásához internet kell; teljes offline indítás még nincs.

## Dokumentum
Az elkészített PDF ingatlanfelvételi összefoglaló. Nem megbízási szerződés. A képernyőre rajzolt aláírás képként kerül bele.

## Forrás felépítése
app/page.js: React kliensbelépő; app/layout.js: magyar metaadatok; app/globals.css: elfogadott arculat; lib/shell.js: rögzített alkalmazásváz; lib/intake-controller.js: a korábban kipróbált kliensoldali működés. Nincs iframe, külső CDN vagy futásidejű kódkiértékelés.

## 02 – Rendezett munka borító
A kezdőlap a kiválasztott 2. tervet követi: világos zöld–arany arculat, nagy betűk, tabletes munkatérkép, működő Új felvétel és Mentett felvételek gomb. Fejléc: Ingatlanfelvétel / Digitális adatlap. Az adatlapból a Kezdőlap gombbal visszaléphetsz. A korábbi böngészős adatok azonos webcímen megmaradnak.
Frissítés: a ZIP ingatlanfelvetel-app mappájának tartalmát másold a meglévő projektmappába, felülírással. A .git, node_modules, .next mappát ne töröld. Futtasd: npm run build, majd git add ., git commit és git push.

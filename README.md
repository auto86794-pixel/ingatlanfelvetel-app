# Ingatlanfelvétel 06 – egységes összegzés és PDF

## Frissítés Windows alatt
A csomag ingatlanfelvetel-app mappájának tartalmát másold az F:\ingatlanfelvetel-app projektbe felülírással. Ne töröld a .git mappát. Új függőségek is vannak, ezért:

```cmd
cd /d F:\ingatlanfelvetel-app
npm ci
npm test
npm run build
```

Sikeres ellenőrzés után Git → Vercel. A megszokott dev indítás: npm run dev, majd http://localhost:3000.

## Új, külön Supabase projekt
Név: ingatlanfelvetel. Régió: Frankfurt. Projektazonosító: axwszwjfbinregsydtqg.
A táblát, privát fájltárat, verzióellenőrzött mentést és tulajdonosi hozzáférési szabályokat már létrehoztuk. A database/04-cloud.sql a telepített séma dokumentációja: ezen a projekten ne futtasd újra.
A program kizárólag a nyilvános publishable kulcsot tartalmazza, nincs benne admin vagy service-role kulcs. Külön Vercel env beállítás nem szükséges ehhez a csomaghoz.

## Egyszeri e-mail-beállítás, saját fiók létrehozása előtt
Supabase Dashboard → ingatlanfelvetel → Authentication → URL Configuration.
Site URL: https://ingatlanfelvetel-app.vercel.app
Redirect URLs:
- https://ingatlanfelvetel-app.vercel.app
- https://ingatlanfelvetel-app.vercel.app/?recovery=1
- http://localhost:3000
- http://localhost:3000/?recovery=1

Az e-mail/jelszó szolgáltató maradjon engedélyezve. Az e-mail-megerősítés maradhat bekapcsolva. Másik saját domain használatakor a Site URL-t és a visszatérési címeket is frissítsd.

A Fiók és felhős mentés résznél add meg a saját e-mail-címedet és legalább 8 karakteres jelszavadat, majd Fiók létrehozása. Erősítsd meg az e-mailt, és lépj be. A jelszavadat ne küldd el chatben. Az Elfelejtett jelszó gomb e-mailt kér; a levélből visszatérve adható meg az új jelszó.

## Helyi és felhős működés
- Belépés nélkül a korábbi helyi mód változatlanul elérhető.
- Minden fiók saját, külön helyi adatbázist kap ezen a készüléken.
- A mentés először helyben történik. A Szinkronizálás gomb tölti fel a változásokat, és tölti le a másik készülék felvételeit. Nincs automatikus felhős szinkron ebben a verzióban.
- A mentett listában látszik: csak helyi, felhős mentésre vár, illetve felhőben is mentve.
- A képek és aláírás a privát fájltárban, az adatlap részeként mentődnek. Közvetlen nyilvános fájllink nincs.
- Kilépés a helyi módban nyitja újra az appot. A fiók helyi adatai ezen a készüléken maradnak; a kilépés nem készüléktörlés vagy helyi titkosítás.
- Lejárt munkamenettel offline folytatható a helyi munka; felhős mentéshez újra belépés kellhet.

## Korábbi felvételek átvitele
A régi, belépés nélküli módban nyisd meg a felvételt, az 5. lépésben exportáld a biztonsági másolatot. Lépj be a saját fiókodba, majd Mentett felvételek → Biztonsági másolat visszatöltése. Importálás új azonosítót ad. Ezután Szinkronizálás.
A régi felvételek nem kerülnek automatikusan az éppen bejelentkező fiókhoz.

## Két készülék próbája
1. Gépen lépj be, hozz létre egy próbafelvételt, mentsd el és szinkronizáld.
2. Telefonon ugyanazzal a fiókkal lépj be, majd Szinkronizálás: megjelenik az adatlap.
3. Módosítsd telefonon, mentsd és szinkronizáld; gépen ismét szinkronizálj.
4. Offline módban is szerkeszthető; internet után külön szinkronizálj.
5. Ha két eszközön is változott ugyanaz: a felhős változat az eredeti azonosítón, a helyi változat külön „helyi eltérés” nevű felvételként marad meg. Az újabb szinkron ezt a másolatot is feltölti.

## Offline és frissítések
Internet mellett várd meg az Offline használatra kész jelzést. A teljes app, a felhős kezelőfelülettel együtt, helyben elérhető. A belépés, regisztráció, jelszóhelyreállítás és szinkronizálás internetet igényel. Az új programverziót a Mentés és frissítés gomb tölti be; nincs kitöltés közbeni automatikus újratöltés.
A build a saját forrásból állítja elő a public/offline-* és public/sw.js fájlokat. Ezek generáltak; a Gitbe nem kerülnek. A scripts mappát is másold át.

## Ellenőrzés és határok
A build és a működési tesztek sikeresek. Automatizált teszt: offline csomag .next nélküli mappában; feltöltés és letöltés szimulált felhővel; konfliktusmegőrzés; hálózati hiba utáni újrapróbálás; másik fiók kizárása. A valódi adatbázison, visszagörgetett teszttranzakcióban: saját olvasás, idegen olvasás/írás tiltása, verzióütközés tiltása és idempotens mentés. A biztonsági advisor nem jelzett hibát.
Böngészőben ellenőrizve a frissítési folyamat, a fiókpanel megjelenése és a régi helyi felvételek megőrzése. Valódi e-mailes regisztrációt, belépést és két fizikai készülék közötti átvitelt a saját fiókoddal, az URL-beállítás után kell kipróbálni. Nem történt valódi ügyféladat-feltöltés.
A privát tárhely minden mentésből új verziót őriz meg; régi verziók automatikus törlése nincs. A helyi export továbbra is ajánlott biztonsági másolat.

## 05 – Közvetítői díj
Az Ingatlan (2.) lépésben, az irányár alatti Közvetítői díj részben adható meg a százalék. Például 2,5 és 2.5 egyaránt elfogadott. Díjmód: Bruttó díj / Nettó díj + áfa / Áfamentes díj. Nettó módnál külön megadandó az alkalmazott áfa százaléka; nincs automatikusan rögzített áfamérték. Az opcionális minimumdíjat ugyanabban a nettó/bruttó/áfamentes módban kell megadni. A számítás az irányárból készül, egész forintra kerekítve. A nettó díj és az áfa külön kerekített összege adja a bruttó összeget. Nem tényleges eladási áron alapuló jutalékelszámolás.
A díj és a számítás megjelenik az összegzésben és a PDF nyomtatott tartalmában, a JSON export/import és a felhős szinkron is megőrzi. A régi, díj nélküli felvételek tovább használhatók. Az új mezők opcionálisak; részben kitöltött vagy hibás díj esetén a PDF-készítés javítást kér.
Nem kell új SQL-t futtatni. A meglévő adatbázist, fiókokat és hozzáférést használja.

További javítások: a fejléc Fiók és felhő gombja közvetlenül a fiókrészre visz. Új felvétel és kezdőlapra/listára váltás megvárja a helyi mentést. Sikertelen mentéskor a folyamat az adatlapon marad; a PDF-készítés sem folytatódik. Fotófeldolgozás alatt az új felvétel indítása várakoztatást kér.

Ellenőrzés: a build és minden teszt sikeres. Számítási tesztek: tizedesvessző, nettó/bruttó mód, felhasználó által megadott áfa, minimum, nulla, kerekítés, hibás és hiányos értékek. Mentési hibákra célzott teszt. A felhős szinkron szimulált tesztjében az új mezők is megmaradtak. Böngészőben kitöltve 64 900 000 Ft / 2,5% / nettó + 27%: 1 622 500 Ft nettó, 438 075 Ft áfa, 2 060 575 Ft bruttó; mentés és visszanyitás után is helyes. A valódi fiókos szinkron és a telefonos PDF-mentés az élesítés utáni saját próbával ellenőrizendő.

## 06 – Egységes dokumentum és visszanyitás
A dokumentum előnézete, az 5. lépés összegzése és a nyomtatási tartalom ugyanabból a közös dokumentumkészítőből épül fel (lib/document-render.js). A fejezetek, fotósorrend, díjösszegek és aláírás ezért azonosak. Magyar dátum-, forint- és területformázás, egységes zöld–arany fejléc. A belső megjegyzés továbbra sem szerepel az átadott dokumentumban.

Fotók: az összegzésben is láthatók, sorszámmal és Borítókép jelöléssel. A PDF-ben a fotómelléklet új oldalon indul. A képarány megmarad; nincs levágás. Az aláírás a fotók után kerül a dokumentumba, egyben tartott blokkban. Az aláírás nélküli adatlap ezt külön jelzi.

PDF-készítés előtt a program ment és megvárja a fotók, aláírás betöltését. Hibás vagy nem betölthető kép esetén nem készít hiányos nyomatot, hanem javítást kér. A nyomtatási tartalom a gomb megnyomásakor rögzített adatmásolatból készül.

Aláírás: a képernyőméret változásakor a korábbi kép képarányosan visszakerül az aláírásmezőbe. Egy üres érintés nem hoz létre aláírást. Az adatlap módosítása továbbra is új aláírást kér.

Ellenőrzések: sikeres build és teljes tesztcsomag. A szimulált felhős szinkron tesztje fotósorrendet, közvetítői díjat, aláírót és aláírást is ellenőriz. Böngészőben régi felvétel megőrzése frissítés után; 4 fotós, aláírt próbafelvétel importálása, mentése, visszanyitása, összegzése és nyomtatási tartalma. A közös nyomtatási HTML-ből külön PDF-rendelővel készült 3 oldalas próbanyomat minden oldalát vizuálisan ellenőriztük; ékezetek, díj, fotók, aláírás és a belső megjegyzés kihagyása rendben. Ez nem helyettesíti az Android/iPhone saját nyomtatási és PDF-mentési próbáját. Fizikai telefonos forgatást és a valódi kétfiókos szinkront ebben a körben nem futtattunk.

Frissítés: a teljes ingatlanfelvetel-app mappa tartalmát másold a meglévőbe felülírással, különösen a lib/document-render.js új fájlt és a scripts mappát. npm ci → npm test → npm run build → Git → Vercel. Nem kell új SQL, másik adatbázis vagy új fiók. Az éles appban a Mentés és frissítés gombbal töltsd be az új verziót.

## 07 – Közvetlen PDF-letöltés
Az 5. lépés PDF letöltése gombja valódi PDF-fájlt készít, nyomtatási párbeszéd nélkül. A böngésző a saját letöltési beállítása szerint menti, általában a Letöltések mappába. A kész fájl a Letöltés újra hivatkozással ismét elérhető; szerkesztés után újra kell készíteni.

A PDF a készüléken készül. Nem küldjük automatikusan e-mailben, és nem mentjük külön PDF-ként a felhőbe. A támogatott készülékeken külön megosztási gomb jelenik meg: először PDF előkészítése megosztáshoz, majd PDF megosztása. A megosztás célját a felhasználó választja a készülék menüjében. A Nyomtatás gomb továbbra is elérhető.

A magyar ékezetekhez szükséges betűkészletek a csomag részei, licencükkel együtt. Az Offline használatra kész jelzés után a PDF-készítéshez sem szükséges internet. Hibás kép esetén a program javítást kér. Nincs adatbázis-módosítás.

Ellenőrzés: sikeres teljes tesztcsomag és build; közvetlen böngészős letöltés; kétoldalas PDF vizuális és szöveges ellenőrzése négy fotóval, aláírással és díjszámítással. Fizikai Android/iPhone megosztást saját készüléken kell kipróbálni.

Frissítés: a teljes mappa tartalmát másold a meglévő projektbe felülírással, az új public/fonts mappával és package-lock.json fájllal együtt. npm ci → npm test → npm run build. Élesítés után Mentés és frissítés.

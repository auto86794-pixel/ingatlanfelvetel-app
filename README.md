# Ingatlanfelvétel 04 – belépés és felhős mentés

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

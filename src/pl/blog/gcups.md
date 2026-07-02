---
title: Uruchamianie aplikacji Green Cell UPS (GCUPS) na serwerze GNU/Linux
description: Wiele osób korzysta z homelabów lub serwerów domowych do różnych celów. Po tym jak straciłem część danych z powodu awarii zasilania gdzieś w 2016 roku, zwykle mam jakiś backup lub przynajmniej duplikację danych.
date: 2023-09-16T12:00:00
author: Damian Fajfer
tags: 
    - devops
    - containers
---

PRZETŁUMACZONE MASZYNOWO - OGÓLNIE TODO

Jeśli jesteś jedną z tych osób, prawdopodobnie też chcesz/potrzebujesz UPS-a. Ponieważ instalowałem skrzynkę teleinformatyczną, szukałem UPS-a do obsługi reszty mojego racka 11" i nie mogłem znaleźć niczego atrakcyjnego na lokalnym rynku od APC. Po pewnych poszukiwaniach zdałem sobie sprawę, że chciałbym mieć wymienną baterię, więc w trakcie nabyłem UPS Green Cell. Reklamowali dedykowane oprogramowanie, które do niego dołączają, ale nie miało to dla mnie znaczenia, dopóki nie odkryłem, że obsługuje kilka dystrybucji GNU/Linux.

| | |
|:---:|:---:|
| ![Sygnatura Cosign w Artifactory]({{ '/img/blog/gcups/eon.jpg' }}) | ![Sygnatura Cosign w Artifactory]({{ '/img/blog/gcups/ups.webp' }}) |
| Podoba mi się jak UPS Green Cell wygląda podobnie do EON-a z gry Original War | |

## Aplikacja GC UPS

Na ich [stronie pobierania](https://gcups.greencell.global/en) (edycja: lub mój [GitHub](https://github.com/fajfer/gcups)) oferują gcups (tak się nazywa) dla wszystkich nowoczesnych systemów desktopowych - Windows, MacOS i, co zaskakujące, wsparcie dla Linuxa w postaci .deb, .rpm, .pacman i .tar.gz (z kilkoma skryptami shell). Jest to całkiem solidny wybór wieloplatformowy, ponieważ używają Electrona działającego na Chromium. Najgorszą rzeczą jest to, że to oprogramowanie nie jest open source.

Ogólnie rzecz biorąc, wsparcie dla Linuxa przekonało mnie do wypróbowania. Nie zamierzam robić większej recenzji tego oprogramowania. Gdy przeprowadziłem kilka udanych testów przez webGUI, pomyślałem, że mogłoby być przydatne do uruchomienia, tylko nie na moim desktopie. Próbowałem uruchomić gcups z jakimiś parametrami, żeby go zdemonizować, ale bez powodzenia. W czasie pisania tego artykułu używam wersji 1.1.7 wydanej 02.06.2023. Uruchomienie gcups na moim serwerze dało mi następujący output:

```bash
$ gcups 
[371031:0915/014627.729749:ERROR:ozone_platform_x11.cc(240)] Missing X server or $DISPLAY
[371031:0915/014627.729793:ERROR:env.cc(255)] The platform failed to initialize.  Exiting.
Segmentation fault (core dumped)
```

| |
|:---:|
| ![Sygnatura Cosign w Artifactory]({{ '/img/blog/gcups/gc-odp.png' }}) |
| Support odpowiadający mi, że nie ma sposobu na uruchomienie gcups bez GUI, udowodnijmy, że się mylą |

## Uruchamianie gcups w środowisku CLI

Szukanie informacji na temat uruchamiania gcups nigdzie mnie nie zaprowadziło (wersja 1.0.0 została opublikowana w czerwcu 2022), więc zacząłem majstrować. Nawet gdybym poszedł tak daleko (lub tak blisko) jak uruchomienie tego bez X serwera, nadal musiałbym włączyć serwer HTTP w ustawieniach aplikacji. Robiłem standardowe rzeczy, ale nie zauważyłem żadnych nowych procesów uruchamiających się po włączeniu serwera web, `strings` nie dał mi żadnego wnikliwego outputu niespecyficznego dla Chromium, nie mogłem też niczego znaleźć w `~/.config/gcups`. Jest też katalog `/opt/gcups` tworzony podczas instalacji, więc ostatecznie zacząłem szukać w folderze db i - hurra - to było to miejsce.

```bash
/opt/gcups/db$ ls
gcups-rxdb-0-                                                           gcups-rxdb-0-scheduler-mrview-c37be66b94b0bdae91ef3fcbeab58edf
gcups-rxdb-0-device_parameters                                          gcups-rxdb-0-settings-local
gcups-rxdb-0-device_parameters-local                                    gcups-rxdb-0-test
gcups-rxdb-0-device_parameters-mrview-99560a34de60f5074dcd2be42069d585  gcups-rxdb-0-test-local
gcups-rxdb-0-register                                                   gcups-rxdb-0-test-measurement
gcups-rxdb-0-register-local                                             gcups-rxdb-0-test-measurement-local
gcups-rxdb-0-register-mrview-692a6698c32319395128b449dfae271e           gcups-rxdb-0-test-measurement-mrview-99560a34de60f5074dcd2be42069d585
gcups-rxdb-0-_rxdb_internal                                             gcups-rxdb-0-test-mrview-8b2440dfbb354345cc5c69a011a2beb9
gcups-rxdb-0-scheduler                                                  gcups-rxdb-0-test-mrview-8b851648c605dcf349b861f65fdffef5
gcups-rxdb-0-scheduler-local                                            gcups-rxdb-1-settings  <--- ten jest interesujący
gcups-rxdb-0-scheduler-mrview-2f6b156c4b77dd00407dbed941ee1abf          pouch__all_dbs__
```

Uzyskałem dostęp do bazy danych gcups-rxdb-1-settings używając LevelDB przez pythona:

```python3
import plyvel
db = plyvel.DB('/opt/gcups/db/gcups-rxdb-1-settings')

for key, value in db:
    print(f"{key.decode()}: {value.decode()}")
```

Co daje nam interesujący output:

```
ÿby-sequenceÿ0000000000000001: {"api":{"port":8080,"password":"hash hasła tutaj","enable":true,"salt":"sól hasła tutaj"},"_attachments":{},"_id":"a733f0a7-4fe2-4120-8603-775370fd871a","_rev":"12-c2e2e2d475614a9aed42806e63a38338"}
```

Rozbijając najciekawsze części:

- **port** jest dość oczywisty, to po prostu port HTTP dla naszego serwera web
- **enable** mówi nam, czy serwer HTTP jest domyślnie włączony przy uruchomieniu gcups

Odkryłem, że można po prostu zastąpić pierwszą i jedyną sekwencję, żeby gcups działał. Jest klucz (4ty od końca) o nazwie `document-store`, który przechowuje wszystkie revy poprzednich sekwencji oraz `winningRev`, ale w tym przypadku liczy się tylko wartość `seq`, która w większości przypadków jest twoją ostatnią `by-sequence`.

## Generowanie własnej by-sequence

Teraz gdy wiemy jak uzyskać dostęp do ustawień gcups bez uruchamiania samego gcups, musimy zastąpić port (opcjonalnie), enabled, password i salt. Nie wiem jak wygenerować salt i password ręcznie, więc zalecam zainstalowanie gcups lokalnie, skonfigurowanie go, a następnie wyeksportowanie tego ustawienia na swój serwer. **Pamiętaj, że nie możesz zmienić hasła z webGUI**. Aby to zrobić, po prostu zainstaluj gcups lokalnie, ustaw hasło i włącz serwer HTTP w ustawieniach. Następnie przejdź do `/opt/gcups/db/gcups-rxdb-1-settings` i wykonaj PUT na swoich danych:

```python3
import plyvel
db = plyvel.DB('/opt/gcups/db/gcups-rxdb-1-settings')

db.put(b'\xc3\xbfby-sequence\xc3\xbf0000000000000001', b'{"api":{"port":8080,"password":"hash hasła tutaj","enable":true,"salt":"sól hasła tutaj"},"_attachments":{},"_id":"a733f0a7-4fe2-4120-8603-775370fd871a","_rev":"12-c2e2e2d475614a9aed42806e63a38338"}')
```

Nie musisz robić nic więcej. Naśladowałem xserver używając `xvfb` i pozwala to na uruchomienie gcups na serwerze w ten sposób:

`xvfb-run gcups`

Następnie możesz uzyskać dostęp do webGUI gcups na `host:port` na swoim serwerze, który określiłeś w `by-sequence`

## Podsumowanie

Skontaktowałem się z supportem dwa razy, aby potwierdzić, że oprogramowanie nie ma działać bez GUI. Będzie czysto CLI-owe rozwiązanie dla gcups i jest ono na roadmapie Green Cell, ale nie wiadomo kiedy zostanie wydane, co sprawiło, że spędziłem jeden wieczór próbując uruchomić to w niezamierzony sposób.

Myślę o konteneryzacji kompletnego rozwiązania jeszcze w tym roku, zaktualizuję wpis na blogu później i dostarczę gotowy docker-compose z przekazaniem USB do kontenera (UPS łączy się przez USB z maszyną, żeby gcups był funkcjonalny). Fajnie byłoby też, gdybym nauczył się jak generować kombinację pass/salt dla gcups, bo nie poświęciłem temu zbyt wiele uwagi.

I last but not least - nie ma sensu, żeby takie oprogramowanie **NIE** było wolnym oprogramowaniem. Jedyną znaczącą rzeczą, którą by to ujawniło, byłby schemat komunikacji między oprogramowaniem a UPS-em. I co z tego? Każdy producent UPS-ów komunikuje się ze swoim UPS-em w inny sposób, ponieważ nie ma ogólnego protokołu określającego jak to powinno być zrobione. Nie sądzę, żeby to był wielki sekret i że ostatecznie nie mógłby zostać ujawniony przy odrobinie pracy. Nawet gdyby gcups był wolny i ludzie zdecydowali się używać rozwiązań nieopracowanych przez Green Cell, nadal byłoby to korzystne dla Green Cell, ponieważ z powodu różnych schematów komunikacji, te rozwiązania firm trzecich nadal obsługiwałyby tylko ich produkt.

Teraz gdy jest to closed source, moja praca skupiła się na obejściu wymagania xservera zamiast ulepszaniu ich produktu, a ich produkt nie istniałby, gdyby nie open source.

## AKTUALIZACJA 03.04.2024

Hej! Zmotywowany komentarzami od Roberta udało mi się zdockeryzować powyższe rozwiązanie. Jest jeszcze trochę pracy, ale jestem gotów się jej podjąć i utrzymywać projekt.

https://github.com/fajfer/gcups

`docker pull ghcr.io/fajfer/gcups:1.1.7`

## AKTUALIZACJA 19.08.2024

Ze względu na popularne zapotrzebowanie utworzyłem pokój czatowy Matrix, żebym mógł pomagać wam na zawołanie (lub trochę później) - https://matrix.to/#/#gcups:fsfe.org

<meta name="fediverse:creator" content="@fajfer@mastodon.social">

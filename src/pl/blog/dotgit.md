---
title: Serwowanie stron z gita i bezpieczeństwo
description: Czyli jak zrobić sobie krzywdę popularnym narzędziem
date: 2026-02-19T01:03:00
author: Damian Fajfer
tags: 
    - security
    - edu
    - git
---

Przeczytałem kiedyś na [Niebezpieczniku](https://niebezpiecznik.pl/post/incydent-w-sklepie-weroniki-sowy-wersow-com-dane-osobowe-byly-dostepne-publicznie/) artykuł o wycieku w sklepie influencerki Wersow. Artykuł zainspirował mnie przede wszystkim do zainstalowania wtyczki [DotGit](https://addons.mozilla.org/en-US/firefox/addon/dotgit/), ale do tej pory nie udało mi się znaleźc niczego spektakularnie ciekawego. Ot, proste strony statyczne czy kod, który i tak jest publiczny. Do dziś wątpiłem, że ktoś na serio wrzuciłby kredki do gita na prywatne repozytorium a potem rzucał `git pull` do synchronizacji w tym samym repozytorium.

Wyprzedzając pytania - administrator został powiadomiony i wpis został umieszczony już po naprawieniu problemu.

## Od .git/config do haseł

Serfując po internecie z wyżej wymienioną wtyczką dostaniemy _popup_ o znalezionym repozytorium `.git`, adresy zbierają się też w samym narzędziu więc można co jakiś czas spojrzeć co udało się przypadkowo zebrać. Spróbujmy wyciągnąć z tego coś sensownego.

| |
|:---:|
| ![Dotgit download all tooltip]({{ '/img/blog/dotgit/dotgit.png' }}) |
| Poręczna funkcjonalność |

Pobieramy repozytorium przez wtyczkę, wypakowujemy, przechodzimy do katalogu i możemy zobaczyć, że jest pusty. Po wpisaniu polecenia `git status` widać jednak jakie pliki są usunięte:

```bash
On branch master
Your branch is based on 'origin/master', but the upstream is gone.
  (use "git branch --unset-upstream" to fixup)

Changes not staged for commit:
  (use "git add/rm <file>..." to update what will be committed)
  (use "git restore <file>..." to discard changes in working directory)
        deleted:    .gitignore
        deleted:    .htaccess
        deleted:    .htpasswd
(...)

no changes added to commit (use "git add" and/or "git commit -a")
```

Git służy do przechowywania historii zmian. Poprzednie commity są w formacie binarnym, w najprostszy sposób możemy dotrzeć do nich używając polecenia `git restore .`

```bash
$ ls -a
.     .gitignore  admin     assets      cron         index.php   mediacacheAdv            modules     static
..    .htaccess   admin321  class       css          js          mediacacheArticle        resource    templates
.git  .htpasswd   ajax.php  config.php  imagick.php  mediaCache  mediacachePhotorelation  robots.txt  tmp
```

Jak widać powyżej, pliki się odtworzyły. Pomijając hasła wpisane na sztywno w skryptach. Możemy nawet udać na potrzeby edukacyjne, że ich nie było. Najbardziej zaciekawił mnie plik `.htpasswd`[^htpasswd]

Byłem ciekaw, czy uda mi się odgadnąć hasło do znalezionego użytkownika. Przykład jest zmyślony, ale ciąg zdarzeń analogiczny. Dla poniższego wpisu w `.htpasswd`:

```bash
admin:6YPqJe88Wz5fQ
```

Napisałem _snippet_ w Pythonie i dopisałem kilka propozycji dla powyższego użytkownika, (chciałem chwilę później spróbować metodą słownikową) wyglądało to mniej więcej tak:

```python
import crypt

passwords = ['admin', 'password', '123456', 'admin123']
hash = "6YPqJe88Wz5fQ"

for password in passwords:
    if crypt.crypt(password, hash) == hash:
        print(f"Password found: {password}")
        break
else:
    print("Password not found in common list")
```

Po uruchomieniu dostałem potwierdzenie:

```bash
$ python3 htpasswd.py 
Password found: admin123
```

## Co stało się dalej?

Po moim zgłoszeniu część rzeczy została ukryta w taki sposób:

![403 Forbidden z serwera Apache2]({{ '/img/blog/dotgit/forbidden.png' }})

Tu się będę już czepiał, ale chcę pokazać dlaczego jawna wersja oprogramowania w komunikacie błędu daje atakującemu nadmierną ilość informacji. Powyższa wersja Apache2 wskazuje prawdopodobnie na Ubuntu 22.04 LTS (jammy). Dlaczego? Bo ostatnia najnowsza wersja z Ubuntu 20.04 LTS (focal) to 2.4.41[^focal], natomiast w jammy już 2.4.52[^jammy]. Najnowszy commit również wskazywałby, że strona nie jest juz jakiś czas aktualizowana

![Najnowszy znaleziony commit]({{ '/img/blog/dotgit/commit.png' }})


[^htpasswd]: [https://pl.wikipedia.org/wiki/.htpasswd](https://pl.wikipedia.org/wiki/.htpasswd) Dostęp 19.02.2026
[^focal]: [https://launchpad.net/ubuntu/focal/+source/apache2](https://launchpad.net/ubuntu/focal/+source/apache2) Dostęp 19.02.2026
[^jammy]: [https://packages.ubuntu.com/jammy/apache2](https://packages.ubuntu.com/jammy/apache2) Dostęp 19.02.2026

## Wnioski

Ogromna prośba, żeby nie trzymać w gicie jawnie haseł. To nie jest odpowiednie miejsce. Jak widać, nawet w przypadku korzystania z prywatnego repozytorium coś po drodze może pójść nie tak i hasła mogą wyciec.

<meta name="fediverse:creator" content="@fajfer@mastodon.social">

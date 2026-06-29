---
title: Cykl życia sygnatur Cosign w Artifactory
description: W tym artykule omówimy proces podpisywania kontenerów Docker za pomocą Cosign oraz cykl życia sygnatur w rejestrze docker Artifactory.
date: 2023-07-23T12:00:00
author: Damian Fajfer
tags: 
    - devops
    - ansible
    - artifactory
    - cosign
    - containers
---

PRZETŁUMACZONE MASZYNOWO - OGÓLNIE TODO

Dodatkowo zagłębimy się w proponowane rozwiązanie kopiowania sygnatury do docelowego repozytorium podczas fazy promocji lub kopiowania artefaktów, odnosząc się do potencjalnych wyzwań w tym procesie.

Szczegóły dotyczące podpisywania i weryfikacji kontenerów docker nie będą omawiane w tym wpisie. Zostało to bardzo dobrze wyjaśnione w innych wpisach blogowych[^signing], jak również w oficjalnej dokumentacji[^docs-signing][^docs-verifying]. Można śmiało powiedzieć, że działa to co najmniej od 2021 roku.

## Praca z Artifactory

Przed przystąpieniem do podpisywania musimy uwierzytelnić się w rejestrze docker. Jako przykład w tym scenariuszu używam rejestru docker Artifactory[^artifactory].
```bash
{% raw %}cosign login -u {{ username }} -p '{{ password }}' x.artifactory.com
{% endraw %}
```
Cosign może zwrócić błąd, jeśli podasz URL ze schematem:

```
Error: registries must be valid RFC 3986 URI authorities: https://x.artifactory.com
main.go:74: error during command execution: registries must be valid RFC 3986 URI authorities: https://x.artifactory.com
```
Rozwiązaniem jest po prostu pominięcie schematu (https:// w powyższym przykładzie).

Gdy cosign pomyślnie się zaloguje, zbuduj i wypchnij obraz jak zwykle. Następnie powinieneś podpisać swój obraz docker używając cosign sign. Jeśli do tego momentu wszystko zrobiłeś poprawnie, wykonanie cosign verify jako testu na tej samej maszynie da następujący wynik:

```bash
$ cosign verify --key cosign.pub x.artifactory.com/fajfer/image:example
The following checks were performed on these signatures:
  - The cosign claims were validated
  - The signatures were verified against the specified public key
{"Critical":{"Identity":{"docker-reference":""},"Image":{"Docker-manifest-digest":"sha256:87ef60f558bad79beea6425a3b28989f01dd417164150ab3baab98dcbf04def8"},"Type":"cosign container image signature"},"Optional":null}
```

Możesz powtórzyć polecenie na innej maszynie, aby zweryfikować, że sygnatura została pomyślnie przesłana. Wynik powinien być taki sam, a sygnatura powinna być widoczna w interfejsie webowym:

![Sygnatura Cosign w Artifactory]({{ '/img/blog/cosign-artifactory/sig.png' }})

## Więc jaki jest problem?

Zgodnie z dokumentacją:

Dokumentacja Cosign @ af555d5
```
Sygnatury są przechowywane jako osobne obiekty w rejestrze OCI, z jedynie słabym odniesieniem do obiektu, który "podpisują". Oznacza to, że ta relacja jest nieprzezroczysta dla rejestru, a sygnatury nie zostaną usunięte ani odśmiecone po usunięciu obrazu. Podobnie można je łatwo skopiować z jednego środowiska do drugiego, ale nie dzieje się to automatycznie.
```

Jeśli cykl życia twojego artefaktu kończy się tutaj, a obrazy stąd są wdrażane na produkcję lub są dostępne publicznie, to wszystko, skończyłeś. W przeciwnym razie, jeśli chcesz promować swoje obrazy lub skopiować je gdzieś indziej, zauważysz, że podczas gdy twoje artefakty są promowane do docelowego repozytorium, ich sygnatury pozostają nienaruszone w repozytorium źródłowym. Co oznacza, że jeśli zbudujesz i podpiszesz artefakty w repozytorium x, to po promocji do repozytorium y cosign da ci tę smutną odpowiedź:

```bash
$ cosign verify --key cosign.pub y.artifactory.com/fajfer/image:example
Error: no matching signatures:

main.go:52: error during command execution: no matching signatures:
```

Co jest nie tak, prawda? Przecież właśnie działało idealnie w starym repozytorium.

## Proponowane rozwiązanie

Musimy skopiować sygnaturę do docelowego repozytorium. Po żądaniu REST API Promote Docker Image musimy wykonać żądanie Copy Item, aby skopiować sygnaturę. Jest tu ważny szczegół - cosign nazywa sygnaturę po SHA256 manifest.json naszego obrazu. Na szczęście możemy łatwo uzyskać dostęp do tych informacji wykonując żądanie File Info. Możemy również obliczyć to sami, ale zakładam, że nie masz już obrazu lokalnie podczas fazy promocji/kopiowania.

![Pole Digest w sekcji 'Docker Info' w UI również wyświetla hash]({{ '/img/blog/cosign-artifactory/example.png' }})

Aby lepiej zrozumieć rozwiązanie i uzyskać pojęcie o tym, jak powinny wyglądać twoje żądania, oto przykład w kodzie Ansible, który mógłby zostać użyty do implementacji rozwiązania w twoim systemie CI:

```yaml
{% raw %}- name: Promote Docker Image
  # https://jfrog.com/help/r/jfrog-rest-apis/promote-docker-image
  uri:
    url: "{{ artifactory_url }}/api/docker/{{ source_repo }}/v2/promote"
    method: POST
    url_username: "{{ username }}"
    url_password: "{{ password }}"
    force_basic_auth: true
    body_format: json
    body:
      targetRepo: "{{ target_repo }}"
      dockerRepository: "{{ docker_repository }}"
      copy: true

- name: Get manifest.json (File Info)
  # https://jfrog.com/help/r/jfrog-rest-apis/file-info
  uri:
    url: "{{ artifactory_url }}/api/storage/{{ source_repo }}/\
      {{ file_path }}/{{ tag }}/manifest.json"
    method: GET
    url_username: "{{ username }}"
    url_password: "{{ password }}"
    force_basic_auth: true
  register: manifest

- name: Copy cosign signature (Copy Item)
  # https://jfrog.com/help/r/jfrog-rest-apis/copy-item
  uri:
    url: "{{ artifactory_url }}/api/copy/{{ source_repo }}/\
      {{ source_file_path }}/sha256-{{ manifest.json.checksums.sha256 }}.sig\
      ?to=/{{ target_repo }}/{{ target_file_path }}"
    method: POST
    url_username: "{{ username }}"
    url_password: "{{ password }}"
    force_basic_auth: true
{% endraw %}
```

To podejście najlepiej wykorzystuje API Artifactory i nie wymaga wcale pobierania obrazu i sygnatury lokalnie.

## Podsumowanie

Wsparcie Cosign dla Artifactory jest bardzo dobrze zrealizowane, a Artifactory wie, że serwuje podpisane obrazy, ponieważ wysyła sygnaturę wraz z kontenerem po wykonaniu docker pull. API tego jednak nie odzwierciedla, ale miejmy nadzieję, że zmieni się to w przyszłości. Podpisywanie kontenerów staje się coraz bardziej popularne i dostępne dzięki narzędziom takim jak cosign, notary i kyverno, żeby wymienić tylko kilka, więc wykonywanie obejść takich jak to nie powinno być wymagane w przyszłości.

[^signing]: Jabar Asadi, "Digital Signature With Cosign" 4 maja 2023. https://eng.d2iq.com/blog/digital-signature-with-cosign/ Dostęp 22.07.2023

[^docs-signing]: Sigstore, "Signing Containers" https://docs.sigstore.dev/cosign/signing_with_containers/ GitHub: 18b11e2

[^docs-verifying]: Sigstore, "Verifying" https://docs.sigstore.dev/cosign/verify GitHub: 4186c93

[^artifactory]: JFrog Artifactory Documentation, "Docker Registry" https://jfrog.com/help/r/jfrog-artifactory-documentation/docker-registry Dostęp: 23.07.2023

<meta name="fediverse:creator" content="@fajfer@mastodon.social">

# Plan implementacji frontendu

## Cel dokumentu

Dokument opisuje iteracyjny plan wdrozenia aplikacji frontendowej dla projektu Wielka Piatka na podstawie aktualnego backendu w katalogu `/backend` oraz istniejacego szkieletu aplikacji Vue w katalogu `/frontend`.

Plan ma sluzyc jako mapa pracy na kolejne prompty i sprinty. Kazda faza jest mala, logicznie zamknieta i mozliwa do wdrozenia niezaleznie.

## Ustalone decyzje architektoniczne

- Warstwa HTTP: natywny `fetch` z cienkim wrapperem API.
- Stylowanie: `Tailwind CSS`.
- Identyfikacja klienta: automatycznie generowany `UUID`, przechowywany w `localStorage`.
- Powiadomienia: polling co 30 minut.
- Zakres MVP: pelny zakres funkcjonalny.
- UX bledow i ladowania: podstawowy, bez rozbudowanych skeletonow i toastow.

## Stan obecny

### Backend

Backend ASP.NET Core udostepnia REST API oraz eksport kalendarzy iCal/CalDAV. Nie ma klasycznego logowania ani autoryzacji tokenowej. Identyfikacja klienta odbywa sie przez `clientId` przekazywany w query string albo body.

Istotne obserwacje:

- CORS jest juz skonfigurowany dla `http://localhost:5173` i `http://localhost:5174`.
- Backend nie wymusza uwierzytelnienia.
- Baza danych jest oparta o SQLite.
- Synchronizacja z zewnetrznym API Degra dziala w tle oraz moze byc uruchamiana recznie.
- Czesc endpointow ma charakter stanowy, np. `GET /api/schedule/events` oznacza zmiany jako odczytane po pobraniu.

### Frontend

Aktualny frontend to szkielet w Vue 3 z:

- Vue Router,
- Pinia,
- widokiem planu zajec opartym o mocki,
- recznie napisanym CSS,
- brakiem warstwy integracji z backendem,
- brakiem modelu sesji klienta,
- brakiem proxy Vite i centralnej konfiguracji API.

## Analiza backendu pod frontend

### 1. Modul planu zajec

#### Endpointy

- `GET /api/schedule/events`
  - Zwraca liste wydarzen planu jako `ScheduleEvent[]`.
  - Zawiera pole `changeStatus` z wartoscia `added`, `removed` albo `null`.
  - Po pobraniu oznacza oczekujace zmiany jako `Dismissed = true`.

- `GET /api/schedule/subjects`
  - Zwraca liste przedmiotow jako `SubjectDto[]`.

- `GET /api/schedule/sync/status`
  - Zwraca status synchronizacji jako `SyncStatusDto`.

- `POST /api/schedule/sync/trigger`
  - Uruchamia reczna synchronizacje.

- `POST /api/schedule/changes/dismiss`
  - Oznacza wszystkie oczekujace zmiany jako odczytane.

- `GET /api/schedule/subject/{subjectId}/entries`
  - Zwraca szczegolowy widok przedmiotu jako `SubjectScheduleResponse`.
  - Obsluguje filtry `types`, `groups`, `studyCourseId`, `semester`.
  - Zawiera dane do rysowania kolizji (`parallelIndex`, `parallelCount`).

#### Wnioski frontendowe

- Widok glownego planu moze zostac oparty o istniejacy board, ale wymaga zasilenia danymi z API.
- Wartosci `LeafId` z backendu nie sa obecnie mapowane na strukture sidebaru z mockow, wiec frontend musi odejsc od obecnego modelu drzewa opartego o sztuczne identyfikatory.
- Pole `SlotId` jest budowane na backendzie jako `wd-{startHourId}` nawet dla wpisow weekendowych, wiec frontend nie powinien zakladac, ze `slotId` samodzielnie rozroznia typ dnia.
- Dla szczegolowego widoku przedmiotu frontend dostaje wystarczajaco duzo danych, aby pokazac filtrowanie i kolizje bez dodatkowej logiki po stronie klienta.

### 2. Modul sledzenia przedmiotow

#### Endpointy

- `GET /api/tracking/subjects?clientId=...`
- `POST /api/tracking/subjects`
- `POST /api/tracking/subjects/add?clientId=...&subjectId=...`
- `DELETE /api/tracking/subjects/remove?clientId=...&subjectId=...`

#### Wnioski frontendowe

- Najprostszy UX to ekran listy przedmiotow z checkboxami i przyciskiem zapisu calosci.
- Alternatywnie mozna pozniej dodac szybkie akcje `add/remove`, ale dla pierwszej iteracji bezpieczniej oprzec sie na `SetTrackedSubjects`.
- `clientId` musi byc dostepny globalnie i automatycznie dolaczany do zapytan.

### 3. Modul powiadomien

#### Endpointy

- `GET /api/notification?clientId=...&unreadOnly=...`
- `GET /api/notification/count?clientId=...`
- `POST /api/notification/{id}/read`
- `POST /api/notification/read-all?clientId=...`
- `DELETE /api/notification?clientId=...`

#### Wnioski frontendowe

- Frontend potrzebuje prostego centrum powiadomien z lista i licznikiem nieprzeczytanych.
- Polling co 30 minut powinien aktualizowac przynajmniej licznik oraz liste po otwarciu widoku.
- Poniewaz backend filtruje powiadomienia po `clientId`, brak logowania nie blokuje wdrozenia.

### 4. Modul personalizacji planu

#### Endpointy

- `GET /api/userplan/profile?clientId=...`
- `PUT /api/userplan/profile`
- `GET /api/userplan/overrides?clientId=...`
- `PUT /api/userplan/overrides`
- `PUT /api/userplan/overrides/single?clientId=...`

#### Wnioski frontendowe

- Ten modul jest kluczowy dla personalizacji planu studenta.
- Frontend musi udostepnic formularz profilu z polami: kierunek, specjalnosc, semestr, domyslna grupa.
- Brakuje endpointu do pobrania listy kierunkow i specjalnosci, wiec na tym etapie sa trzy mozliwe drogi implementacyjne:
  - uzyc danych posrednich z innych endpointow,
  - tymczasowo wprowadzic backendowe endpointy lookup,
  - przyjac wersje ograniczona z wpisywaniem identyfikatorow.

Najbardziej sensowne produktowo bedzie dopisanie w backendzie endpointow lookup dla kierunkow, specjalnosci i nauczycieli, bo bez tego UX konfiguracji profilu bedzie slaby. Ten punkt nalezy uwzglednic w planie jako zaleznosc.

### 5. Eksport iCal / CalDAV

#### Endpointy

- `GET /caldav/schedule.ics`
- `GET /caldav/course/{studyCourseId}/semester/{semester}/schedule.ics`
- `GET /caldav/course/{studyCourseId}/specialty/{specialtyId}/semester/{semester}/schedule.ics`
- `GET /caldav/teacher/{teacherId}/schedule.ics`
- `GET /caldav/subject/{subjectId}/schedule.ics`
- `GET /caldav/my/{clientId}/schedule.ics`
- `GET /caldav/calendars`

#### Wnioski frontendowe

- Frontend nie musi generowac plikow ICS, tylko prezentowac gotowe URL-e oraz opcje kopiowania/subskrypcji.
- `GET /caldav/calendars` nadaje sie do ekranu eksportu kalendarzy publicznych.
- `GET /caldav/my/{clientId}/schedule.ics` powinien byc pokazany w sekcji profilu uzytkownika jako personalny link eksportu.

## Docelowa architektura frontendu

### Warstwy

1. `core`
   - inicjalizacja aplikacji,
   - konfiguracja zmiennych srodowiskowych,
   - generowanie i odczyt `clientId`.

2. `api`
   - wrapper nad `fetch`,
   - obsluga bazowego URL,
   - helpery do query string,
   - typowane funkcje per modul API.

3. `stores`
   - Pinia jako glowny stan aplikacji,
   - oddzielne store'y dla planu, profilu, sledzonych przedmiotow, powiadomien i eksportu kalendarzy.

4. `features`
   - modul planu,
   - modul profilu,
   - modul sledzenia,
   - modul powiadomien,
   - modul eksportu kalendarza.

5. `ui`
   - komponenty wspolne,
   - komponenty formularzy,
   - layout aplikacji.

### Proponowany podzial store'ow

- `useClientStore`
  - zarzadza `clientId`, inicjalizacja z `localStorage`.

- `useScheduleStore`
  - pobiera wydarzenia,
  - trzyma status synchronizacji,
  - obsluguje odswiezanie planu.

- `useProfileStore`
  - pobiera i zapisuje profil,
  - pobiera i zapisuje nadpisania grup,
  - przygotowuje link do personalnego ICS.

- `useTrackingStore`
  - pobiera liste wszystkich przedmiotow,
  - pobiera liste sledzonych,
  - zapisuje nowy zestaw sledzonych przedmiotow.

- `useNotificationsStore`
  - pobiera licznik nieprzeczytanych,
  - pobiera liste powiadomien,
  - obsluguje polling co 30 minut,
  - oznacza wpisy jako przeczytane.

- `useCalendarsStore`
  - pobiera liste publicznych kalendarzy do eksportu.

### Routing

Minimalny docelowy routing:

- `/` - dashboard / widok planu,
- `/profile` - profil uzytkownika i konfiguracja grup,
- `/tracking` - sledzone przedmioty,
- `/notifications` - powiadomienia,
- `/calendars` - eksport iCal / CalDAV,
- `/subjects/:subjectId` - szczegoly przedmiotu.

## Zaleznosci i przygotowanie techniczne

### Niezbedne zmiany frontendowe

- instalacja i konfiguracja Tailwind CSS,
- dodanie `crypto.randomUUID()` fallback strategy tylko jesli potrzebna dla zgodnosci,
- dodanie `VITE_API_BASE_URL`,
- opcjonalnie konfiguracja proxy Vite dla lokalnego developmentu,
- utworzenie katalogu `src/api` i `src/features`.

### Zaleznosci backendowe rekomendowane przed lub w trakcie wdrozenia

Rekomendowane do dopisania w backendzie, aby frontend byl kompletny produktowo:

- endpoint lookup dla kierunkow,
- endpoint lookup dla specjalnosci,
- endpoint lookup dla nauczycieli,
- opcjonalnie endpoint agregujacy publiczne drzewo nawigacji dla planu.

Bez tych endpointow frontend da sie zbudowac, ale czesc ekranow bedzie oparta o kompromisy albo dane wtornie wyliczane.

## Plan iteracyjny

### Faza 1. Porzadkowanie szkieletu i konfiguracja techniczna

#### Cel

Przygotowac frontend do pracy z prawdziwym API bez dotykania jeszcze logiki biznesowej.

#### Zadania

- zainstalowac i skonfigurowac Tailwind CSS,
- uporzadkowac strukture katalogow `api`, `stores`, `features`, `views`, `components`,
- dodac konfiguracje `VITE_API_BASE_URL`,
- dodac prosty wrapper `fetch` z obsluga `GET`, `POST`, `PUT`, `DELETE`,
- przygotowac typy TypeScript odpowiadajace backendowym DTO,
- utrzymac dzialanie obecnej aplikacji po refaktorze.

#### Wynik fazy

Frontend ma gotowy fundament techniczny i moze wykonywac typowane zapytania do backendu.

#### Kryterium zakoncznia

- aplikacja sie buduje,
- dziala lokalnie,
- warstwa API jest gotowa do podlaczenia store'ow.

### Faza 2. Tozsamosc klienta i bootstrap aplikacji

#### Cel

Wprowadzic trwale `clientId`, na ktorym opiera sie caly backend.

#### Zadania

- utworzyc `useClientStore`,
- przy starcie aplikacji generowac `UUID` i zapisywac go w `localStorage`,
- zapewnic dostep do `clientId` w calym frontendzie,
- dodac prosty ekran lub panel diagnostyczny pokazujacy aktywny identyfikator klienta,
- dopiac `clientId` do helperow API.

#### Wynik fazy

Kazdy uzytkownik przegladarki ma stabilny identyfikator, dzieki czemu mozna wdrazac profil, sledzenie i powiadomienia.

#### Kryterium zakoncznia

- `clientId` nie zmienia sie po odswiezeniu strony,
- store'y i API moga z niego korzystac bez duplikacji logiki.

### Faza 3. Integracja glownego widoku planu z backendem

#### Cel

Zastapic mocki prawdziwymi danymi planu.

#### Zadania

- dodac klienta API dla `schedule/events` i `schedule/sync/status`,
- przebudowac `useScheduleStore`, aby pobieral dane z backendu,
- dodac podstawowe stany `loading` i `error`,
- zachowac istniejacy board jako warstwe prezentacji,
- dodac mapowanie `changeStatus` na warianty wizualne kart wydarzen,
- dodac przycisk recznego odswiezenia planu,
- dodac przycisk recznego wyzwolenia synchronizacji, jesli ma byc dostepny w UI.

#### Uwaga implementacyjna

Obecne drzewo w sidebarze jest mockiem i nie ma odpowiednika w backendzie. Na tym etapie nalezy uproscic nawigacje i pokazac ogolny plan albo wybrany widok oparty na dostepnych danych, zamiast probowac utrzymac sztuczne `leafId`.

#### Wynik fazy

Uzytkownik widzi realne wydarzenia i podstawowy status synchronizacji.

#### Kryterium zakoncznia

- brak zaleznosci od mockow dla glownego planu,
- lista wydarzen renderuje sie na podstawie backendu,
- zmiany `added/removed` sa czytelne w UI.

### Faza 4. Publiczna nawigacja i model filtrowania planu

#### Cel

Zastapic tymczasowa nawigacje modelem zgodnym z backendem.

#### Zadania

- zaprojektowac docelowy model filtrowania planu,
- dodac kontrolki wyboru kontekstu, np. kierunek, specjalnosc, semestr, przedmiot,
- jesli backend nie dostarcza lookupow, uzgodnic i dopisac je,
- usunac lub odsunac na bok mockowe drzewo student/nauczyciel,
- przygotowac routowanie pod ekran szczegolow przedmiotu.

#### Wynik fazy

Frontend ma realny model przechodzenia po danych backendu zamiast makiety.

#### Kryterium zakoncznia

- uzytkownik moze zmieniac kontekst danych bez mockow,
- nawigacja jest zgodna z faktycznym API.

### Faza 5. Szczegoly przedmiotu i obsluga kolizji

#### Cel

Udostepnic ekran szczegolowy przedmiotu z filtrowaniem i wizualizacja kolizji.

#### Zadania

- dodac widok `/subjects/:subjectId`,
- pobierac dane z `GET /api/schedule/subject/{subjectId}/entries`,
- pokazac filtry `types`, `groups`, opcjonalnie `studyCourseId`, `semester`,
- wykorzystac `parallelIndex` i `parallelCount` do rysowania wpisow obok siebie,
- pokazac metadane przedmiotu i informacje o konfliktach.

#### Wynik fazy

Frontend udostepnia zaawansowany wglad w plan pojedynczego przedmiotu.

#### Kryterium zakoncznia

- filtrowanie dziala,
- kolizje sa prezentowane poprawnie,
- widok nie wymaga dodatkowej obrobki backendowej.

### Faza 6. Profil uzytkownika i personalizacja planu

#### Cel

Umolic uzytkownikowi zapis wlasnego profilu studenta i domyslnej grupy.

#### Zadania

- utworzyc `useProfileStore`,
- dodac ekran formularza profilu,
- zintegrowac `GET/PUT /api/userplan/profile`,
- pokazac stany: brak profilu, ladowanie, zapisano, blad,
- dodac sekcje z personalnym linkiem ICS: `/caldav/my/{clientId}/schedule.ics`.

#### Wynik fazy

Uzytkownik moze zapisac podstawowy kontekst studiow i otrzymuje swoj link eksportu kalendarza.

#### Kryterium zakoncznia

- profil zapisuje sie i odczytuje,
- personalny link ICS jest widoczny po zapisaniu profilu.

### Faza 7. Nadpisania grup

#### Cel

Dac uzytkownikowi mozliwosc ustawienia innych grup dla wybranych przedmiotow i typow zajec.

#### Zadania

- pobrac `GET /api/userplan/overrides?clientId=...`,
- dodac UI do przegladania i edycji nadpisan,
- wdrozyc zapis zbiorczy przez `PUT /api/userplan/overrides`,
- opcjonalnie wdrozyc szybka edycje pojedynczej pozycji przez `PUT /api/userplan/overrides/single`.

#### Wynik fazy

Personalizacja planu obejmuje nie tylko profil, ale tez odstępstwa od domyslnej grupy.

#### Kryterium zakoncznia

- nadpisania da sie zapisac i ponownie odczytac,
- UI nie traci spojnosci przy pustej liscie nadpisan.

### Faza 8. Sledzone przedmioty

#### Cel

Wdrozec modul sledzenia przedmiotow powiazany z kontem anonimowego klienta.

#### Zadania

- utworzyc `useTrackingStore`,
- pobierac wszystkie przedmioty z `GET /api/schedule/subjects`,
- pobierac sledzone przedmioty z `GET /api/tracking/subjects`,
- przygotowac ekran wyboru przedmiotow,
- zapisywac zmiany przez `POST /api/tracking/subjects`,
- dodac podstawowy komunikat sukcesu lub bledu.

#### Wynik fazy

Uzytkownik moze okreslic, ktore przedmioty chce sledzic w systemie powiadomien.

#### Kryterium zakoncznia

- wybor przedmiotow zapisuje sie dla danego `clientId`,
- ponowne wejscie do widoku odtwarza stan.

### Faza 9. Powiadomienia i polling

#### Cel

Udostepnic centrum powiadomien o zmianach w planie.

#### Zadania

- utworzyc `useNotificationsStore`,
- pobierac licznik nieprzeczytanych z `GET /api/notification/count`,
- pobierac liste powiadomien z `GET /api/notification`,
- wdrozyc polling co 30 minut,
- dodac oznaczanie pojedynczych wpisow jako przeczytane,
- dodac akcje `read-all` i `clear-all`.

#### Wynik fazy

Uzytkownik otrzymuje podstawowy wglad w zmiany dotyczace sledzonych przedmiotow.

#### Kryterium zakoncznia

- licznik aktualizuje sie cyklicznie,
- lista powiadomien odpowiada backendowi,
- oznaczanie jako przeczytane dziala poprawnie.

### Faza 10. Eksport kalendarzy iCal / CalDAV

#### Cel

Udostepnic ekran z gotowymi linkami do eksportu kalendarzy.

#### Zadania

- pobierac liste z `GET /caldav/calendars`,
- pokazac publiczne kalendarze dla kierunkow i nauczycieli,
- pokazac osobno personalny link ICS uzytkownika,
- dodac przycisk kopiowania URL,
- dodac krotki opis uzycia linku w Google Calendar / Apple Calendar / Outlook.

#### Wynik fazy

Frontend zamyka pelny przeplyw produktu, lacznie z integracja z zewnetrznymi kalendarzami.

#### Kryterium zakoncznia

- lista kalendarzy jest pobierana i prezentowana,
- link personalny i publiczne linki sa latwe do skopiowania.

### Faza 11. Porzadki koncowe i testy

#### Cel

Uspojnic architekture i ograniczyc regresje.

#### Zadania

- usunac pozostale mocki nieuzywane w produkcyjnym przeplywie,
- zaktualizowac testy jednostkowe store'ow,
- dodac testy komponentow dla krytycznych widokow,
- dodac przynajmniej jeden scenariusz e2e dla profilu, sledzenia i powiadomien,
- sprawdzic obsluge pustych stanow oraz odpowiedzi `404` z backendu,
- uporzadkowac nazewnictwo typow i mapowan enumow.

#### Wynik fazy

Kod jest przygotowany do dalszego rozwijania bez chaosu architektonicznego.

#### Kryterium zakoncznia

- aplikacja przechodzi podstawowe testy,
- mocki nie steruja juz glownym przeplywem,
- typy i store'y sa spojne.

## Rekomendowana kolejnosc realizacji w przyszlych promptach

1. Faza 1 i 2.
2. Faza 3.
3. Faza 4.
4. Faza 5.
5. Faza 6 i 7.
6. Faza 8 i 9.
7. Faza 10 i 11.

## Ryzyka i uwagi

- Najwieksza luka produktowa po stronie backendu to brak endpointow lookup dla danych potrzebnych do wygodnej konfiguracji profilu i filtrowania planu.
- Obecny mockowy model sidebaru nie odpowiada strukturze danych z backendu, wiec jego utrzymywanie bedzie prowadzilo do sztucznych obejsc.
- `GET /api/schedule/events` ma efekt uboczny w postaci oznaczania zmian jako odczytane. Frontend musi to traktowac jako akcje konsumujaca stan zmian.
- Brak autoryzacji upraszcza wdrozenie, ale oznacza tez, ze `clientId` jest jedynym identyfikatorem uzytkownika i trzeba go traktowac jako lokalny klucz sesji, a nie bezpieczne uwierzytelnienie.

## Definicja minimalnego sukcesu MVP

Za minimalny sukces nalezy uznac stan, w ktorym frontend:

- korzysta z realnego API zamiast mockow,
- generuje i utrzymuje `clientId`,
- pozwala zapisac profil i nadpisania grup,
- pozwala sledzic przedmioty,
- pokazuje powiadomienia z pollingiem co 30 minut,
- prezentuje link personalnego i publicznych kalendarzy ICS.
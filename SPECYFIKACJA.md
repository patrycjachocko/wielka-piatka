# Specyfikacja Techniczna i Biznesowa - System Planów Zajęć WI PB

## 1. Cel projektu

Stworzenie aplikacji webowej umożliwiającej przeglądanie i personalizowanie planów zajęć Wydziału Informatyki Politechniki Białostockiej. Aplikacja ma działać analogicznie do istniejącego systemu uczelnianego ([degra.wi.pb.edu.pl](https://degra.wi.pb.edu.pl/rozklady/rozklad.php)), ale z dodatkową funkcjonalnością personalizacji, powiadomień o zmianach i eksportu do CalDAV.

---

## 2. Stos technologiczny

| Warstwa       | Technologia        |
|---------------|--------------------|
| Frontend      | Vue.js             |
| Backend       | .NET (C# / ASP.NET Core) |
| Baza danych   | SQLite (lokalna)   |
| Źródło danych | XML API: `https://degra.wi.pb.edu.pl/rozklady/webservices.php` |

---

## 3. Źródło danych - API

### 3.1 Endpoint

**URL:** `https://degra.wi.pb.edu.pl/rozklady/webservices.php`

**Format:** XML (UTF-8), pojedynczy endpoint zwracający kompletny dump wszystkich tabel w elemencie `<conversation>`.

**Brak parametrów zapytania** - endpoint zwraca zawsze pełen zbiór danych.

### 3.2 Struktura tabel API

#### 3.2.1 `tabela_sale` - Sale wykładowe

| Pole XML | Opis | Typ |
|----------|------|-----|
| `@data-aktualizacji` | Timestamp ostatniej aktualizacji (atrybut elementu) | Unix timestamp |
| `ID` | Klucz główny | Integer |
| `NAZWA` | Nazwa sali (np. "C25/1", "WA-214M", "MS Teams") | String |

**Liczba rekordów:** ~96

#### 3.2.2 `tabela_nauczyciele` - Nauczyciele

| Pole XML | Opis | Typ |
|----------|------|-----|
| `@data-aktualizacji` | Timestamp ostatniej aktualizacji | Unix timestamp |
| `ID` | Klucz główny | Integer |
| `NAZW` | Nazwisko | String |
| `IMIE` | Imię | String |
| `IM_SK` | Skrót imienia (1-2 znaki) | String |
| `ID_TYT` | FK -> tabela_tytuly.ID | Integer |

**Liczba rekordów:** ~270 (w tym wpisy specjalne: "VACAT", "???", koła naukowe itp.)

#### 3.2.3 `tabela_tytuly` - Tytuły naukowe

| Pole XML | Opis | Typ |
|----------|------|-----|
| `@data-aktualizacji` | Timestamp ostatniej aktualizacji | Unix timestamp |
| `ID` | Klucz główny | Integer |
| `NAZWA` | Nazwa tytułu | String |

**Wartości:**

| ID | Tytuł |
|----|-------|
| 0  | *(brak)* |
| 1  | mgr |
| 2  | mgr inż. |
| 3  | dr |
| 4  | dr inż. |
| 5  | dr hab. |
| 6  | dr hab. inż. |
| 7  | prof. dr hab. |
| 8  | prof. dr hab. inż. |
| 9  | prof. |

#### 3.2.4 `tabela_studia` - Kierunki studiów

| Pole XML | Opis | Typ |
|----------|------|-----|
| `@data-aktualizacji` | Timestamp ostatniej aktualizacji | Unix timestamp |
| `ID` | Klucz główny | Integer |
| `NAZWA` | Nazwa kierunku/trybu studiów | String |

**Zawiera:** Kierunki na różnych stopniach (I st., II st., III st.), tryby (stac., niest.) - Informatyka, Matematyka stosowana, Informatyka i ekonometria, Data Science, studia podyplomowe itp.

#### 3.2.5 `tabela_specjalnosci` - Specjalności

| Pole XML | Opis | Typ |
|----------|------|-----|
| `@data-aktualizacji` | Timestamp ostatniej aktualizacji | Unix timestamp |
| `ID` | Klucz główny | Integer |
| `NAZWA` | Nazwa specjalności | String |

**Liczba rekordów:** ~30 (inżynieria oprogramowania, bezpieczeństwo informacji, analityka danych, biometria, Front End Development, ERASMUS itp.)

**Ważne:** Wiele specjalności jest archiwalnych. Należy wyświetlać tylko te, które mają przypisane zajęcia w `tabela_rozklad`.

#### 3.2.6 `tabela_przedmioty` - Przedmioty

| Pole XML | Opis | Typ |
|----------|------|-----|
| `@data-aktualizacji` | Timestamp ostatniej aktualizacji | Unix timestamp |
| `ID` | Klucz główny | Integer |
| `NAZWA` | Pełna nazwa przedmiotu | String |
| `NAZ_SK` | Skrócona nazwa przedmiotu | String |

**Liczba rekordów:** 100+

#### 3.2.7 `tabela_rozklad` - Rozkład zajęć (KLUCZOWA TABELA)

| Pole XML | Opis | Typ |
|----------|------|-----|
| `@data-aktualizacji` | Timestamp ostatniej aktualizacji (do śledzenia zmian!) | Unix timestamp |
| `DZIEN` | Dzień tygodnia (1-7, pon-ndz) | Integer |
| `GODZ` | Slot godzinowy (1-14) | Integer |
| `ILOSC` | Liczba zajmowanych slotów (zazwyczaj 2) | Integer |
| `TYG` | Tydzień: 0=co tydzień, 1=parzyste, 2=nieparzyste | Integer |
| `ID_NAUCZ` | FK -> tabela_nauczyciele.ID | Integer |
| `ID_SALA` | FK -> tabela_sale.ID | Integer |
| `ID_PRZ` | FK -> tabela_przedmioty.ID | Integer |
| `RODZ` | Rodzaj zajęć (skrót, np. "Ps", "W", "L", "C") | String |
| `GRUPA` | Numer grupy | Integer |
| `ID_ST` | FK -> tabela_studia.ID | Integer |
| `SEM` | Numer semestru | Integer |
| `ID_SPEC` | FK -> tabela_specjalnosci.ID (0 = brak specjalności) | Integer |

**Przykład rekordu XML:**
```xml
<tabela_rozklad data-aktualizacji="1773473446">
  <DZIEN>3</DZIEN>
  <GODZ>7</GODZ>
  <ILOSC>2</ILOSC>
  <TYG>0</TYG>
  <ID_NAUCZ>36</ID_NAUCZ>
  <ID_SALA>153</ID_SALA>
  <ID_PRZ>22</ID_PRZ>
  <RODZ>Ps</RODZ>
  <GRUPA>1</GRUPA>
  <ID_ST>13</ID_ST>
  <SEM>2</SEM>
  <ID_SPEC>0</ID_SPEC>
</tabela_rozklad>
```

#### 3.2.8 `tabela_konsultacje` - Konsultacje nauczycieli

| Pole XML | Opis | Typ |
|----------|------|-----|
| `id_user` | FK -> tabela_nauczyciele.ID | Integer |
| `dzien` | Dzień tygodnia (1-7) | Integer |
| `godzina` | Slot godzinowy (1-14) | Integer |
| `opis` | Opis (np. "Konsultacje", nazwa sali itp.) | String |
| `typ` | Typ: NULL=konsultacje, "D"=dodatkowe (inne niż zajęcia/konsultacje) | String/NULL |

**Przykład rekordu XML:**
```xml
<tabela_konsultacje>
  <id_user>43</id_user>
  <dzien>1</dzien>
  <godzina>5</godzina>
  <opis>Konsultacje</opis>
</tabela_konsultacje>
```

---

## 4. Siatka godzin

### 4.1 Dni robocze (poniedziałek - piątek, DZIEN 1-5)

| Slot | Godziny       |
|------|---------------|
| 1    | 8:30 - 9:15   |
| 2    | 9:15 - 10:00  |
| 3    | 10:15 - 11:00 |
| 4    | 11:00 - 11:45 |
| 5    | 12:00 - 12:45 |
| 6    | 12:45 - 13:30 |
| 7    | 14:00 - 14:45 |
| 8    | 14:45 - 15:30 |
| 9    | 16:00 - 16:45 |
| 10   | 16:45 - 17:30 |
| 11   | 17:40 - 18:25 |
| 12   | 18:25 - 19:10 |
| 13   | 19:20 - 20:05 |
| 14   | 20:05 - 20:50 |

### 4.2 Weekend (sobota - niedziela, DZIEN 6-7)

| Slot | Godziny       |
|------|---------------|
| 1    | 8:00 - 8:45   |
| 2    | 8:50 - 9:35   |
| 3    | 9:50 - 10:35  |
| 4    | 10:40 - 11:25 |
| 5    | 11:40 - 12:25 |
| 6    | 12:30 - 13:15 |
| 7    | 13:30 - 14:15 |
| 8    | 14:20 - 15:05 |
| 9    | 15:10 - 15:55 |
| 10   | 16:00 - 16:45 |
| 11   | 16:50 - 17:35 |
| 12   | 17:40 - 18:25 |
| 13   | 18:30 - 19:15 |
| 14   | 19:20 - 20:05 |

### 4.3 Logika slotów

Pole `ILOSC` określa ile kolejnych slotów zajmuje dane zajęcie. Najczęstsza wartość to 2.

**Przykład:** `GODZ=7, ILOSC=2` w dzień roboczy oznacza zajęcia od 14:00 do 15:30 (slot 7 + slot 8).

**Obliczanie czasu zakończenia:**
- Godzina rozpoczęcia = czas_rozpoczecia[GODZ]
- Godzina zakończenia = czas_zakonczenia[GODZ + ILOSC - 1]

---

## 5. Rodzaje zajęć (pole RODZ)

Znane z API skróty (pełną listę należy ustalić dynamicznie z danych API):

| Skrót | Rodzaj zajęć |
|-------|-------------|
| W     | Wykład |
| C     | Ćwiczenia |
| L     | Laboratorium |
| Ps    | Pracownia specjalistyczna |
| P     | Projekt (prawdopodobnie) |
| S     | Seminarium (prawdopodobnie) |

**Ważne:** Pełna lista rodzajów zajęć musi być pobierana dynamicznie z API (z unikalnych wartości `RODZ` w `tabela_rozklad`).

---

## 6. Wymagania funkcjonalne

### 6.1 System kont użytkowników

- Rejestracja i logowanie użytkowników
- Na koncie zapisywany jest spersonalizowany plan zajęć
- Plan jest powiązany z kontem i dostępny po zalogowaniu

### 6.2 Widok planu dla studentów

#### 6.2.1 Wybór parametrów planu

Formularz wyboru zawiera pola:
1. **Kierunek studiów** (z `tabela_studia`)
2. **Semestr** (I - VII)
3. **Specjalność** (z `tabela_specjalnosci` - tylko te, które mają przypisane zajęcia w rozkładzie)
4. **Grupy zajęciowe** - osobne pole dla każdego rodzaju zajęć dostępnego dla danego kierunku/semestru:
   - Grupa wykładowa (W)
   - Grupa ćwiczeniowa (C)
   - Grupa laboratoryjna (L)
   - Grupa pracowni specjalistycznej (Ps)
   - Grupa projektowa (P)
   - Grupa seminaryjna (S)
   - Grupa językowa
   - Grupa WF
   - *(dynamicznie na podstawie rodzajów zajęć w danym rozkładzie)*

#### 6.2.2 Wyświetlanie planu

- Tabela z dniami tygodnia (kolumny) i slotami godzinowymi (wiersze)
- Każda komórka zawiera informacje o zajęciach: przedmiot, nauczyciel, sala, rodzaj, grupa
- Wizualne rozróżnienie typów tygodni (co tydzień / parzysty / nieparzysty)
- Obsługa zajęć wieloslotowych (ILOSC > 1) - łączenie komórek

### 6.3 Personalizacja planu (KLUCZOWA FUNKCJONALNOŚĆ)

Użytkownik może modyfikować swój plan poprzez:
- **Usunięcie konkretnych zajęć** z domyślnego planu swojej grupy
- **Dodanie zajęć z innej grupy** tego samego przedmiotu

**Przykład użycia:** Student jest w grupie Ps 2, ale na Matematykę Dyskretną chodzi z grupą Ps 4. Może:
1. Usunąć z planu zajęcia Ps 2 z Matematyki Dyskretnej
2. Dodać zajęcia Ps 4 z Matematyki Dyskretnej
3. Reszta planu pozostaje bez zmian

### 6.4 Widok planu nauczyciela

- Dropdown z listą nauczycieli (tylko aktywni w bieżącym semestrze)
- Wyszukiwanie/filtrowanie nauczycieli (autocomplete)
- Wyświetlenie wszystkich zajęć danego nauczyciela w formie tabeli tygodniowej
- Wyświetlenie konsultacji nauczyciela (z `tabela_konsultacje`)

### 6.5 System powiadomień

- **Automatyczne sprawdzanie co godzinę** czy nastąpiły zmiany w API
- Mechanizm porównywania: pole `data-aktualizacji` w `tabela_rozklad` dla śledzonych zajęć
- Jeśli `data-aktualizacji` uległa zmianie -> wygenerowanie powiadomienia
- Powiadomienia dotyczą tylko zajęć dodanych do spersonalizowanego planu użytkownika
- Użytkownik widzi listę powiadomień w interfejsie

### 6.6 Eksport CalDAV

- Możliwość wyeksportowania spersonalizowanego planu zajęć do pliku CalDAV (.ics)
- Plik powinien zawierać:
  - Nazwę przedmiotu
  - Nauczyciela
  - Salę
  - Godziny (z poprawnym mapowaniem slotów na rzeczywiste godziny)
  - Powtarzalność (co tydzień / co 2 tygodnie - parzyste/nieparzyste)

---

## 7. Wymagania niefunkcjonalne

### 7.1 Synchronizacja danych

- Cykliczne pobieranie danych z API (co godzinę)
- Przechowywanie danych lokalnie w SQLite
- Porównywanie `data-aktualizacji` w celu wykrycia zmian
- Minimalizacja requestów do API (pobieranie pełnego dumpu, porównanienie lokalne)

### 7.2 Filtrowanie specjalności

- Wyświetlanie tylko specjalności, które mają przypisane zajęcia w `tabela_rozklad`
- Wiele specjalności w API jest archiwalnych i nie powinno być widocznych

### 7.3 Dynamiczne rodzaje zajęć

- Lista rodzajów zajęć (RODZ) i odpowiadające im pola grup powinny być generowane dynamicznie z danych API
- Nie hardkodować listy rodzajów

---

## 8. Model danych - SQLite

### 8.1 Tabele lustrzane API

Tabele odzwierciedlające strukturę API z dodatkowym polem `data_aktualizacji`:

- `sale` (id, nazwa, data_aktualizacji)
- `nauczyciele` (id, nazwisko, imie, imie_skrot, id_tytulu, data_aktualizacji)
- `tytuly` (id, nazwa, data_aktualizacji)
- `studia` (id, nazwa, data_aktualizacji)
- `specjalnosci` (id, nazwa, data_aktualizacji)
- `przedmioty` (id, nazwa, nazwa_skrot, data_aktualizacji)
- `rozklad` (dzien, godzina, ilosc, tydzien, id_nauczyciela, id_sali, id_przedmiotu, rodzaj, grupa, id_studiow, semestr, id_specjalnosci, data_aktualizacji)
- `konsultacje` (id_nauczyciela, dzien, godzina, opis, typ)

### 8.2 Tabele aplikacyjne

- `uzytkownicy` (id, login/email, haslo_hash, created_at)
- `plan_uzytkownika` (id, id_uzytkownika, id_studiow, semestr, id_specjalnosci)
- `plan_grupy` (id, id_planu, rodzaj_zajec, numer_grupy)
- `plan_modyfikacje` (id, id_planu, id_wpisu_rozkladu, typ_modyfikacji [dodano/usunieto])
- `powiadomienia` (id, id_uzytkownika, tresc, data_utworzenia, przeczytane, data_aktualizacji_stara, data_aktualizacji_nowa)
- `sync_log` (id, timestamp, status, szczegoly)

---

## 9. Architektura API backendu (.NET)

### 9.1 Endpointy REST API

#### Dane referencyjne
- `GET /api/studia` - lista kierunków
- `GET /api/specjalnosci?idStudiow={id}&semestr={sem}` - specjalności z zajęciami
- `GET /api/przedmioty` - lista przedmiotów
- `GET /api/nauczyciele` - lista nauczycieli (aktywnych)
- `GET /api/sale` - lista sal
- `GET /api/rodzaje-zajec?idStudiow={id}&semestr={sem}` - rodzaje zajęć dla danego kierunku/semestru

#### Rozkład zajęć
- `GET /api/rozklad?idStudiow={id}&semestr={sem}&idSpec={id}` - rozkład dla kierunku/semestru
- `GET /api/rozklad/nauczyciel/{idNauczyciela}` - rozkład nauczyciela
- `GET /api/konsultacje/{idNauczyciela}` - konsultacje nauczyciela

#### Użytkownicy i personalizacja
- `POST /api/auth/rejestracja` - rejestracja
- `POST /api/auth/logowanie` - logowanie
- `GET /api/plan` - pobranie spersonalizowanego planu zalogowanego użytkownika
- `POST /api/plan` - zapisanie/aktualizacja planu
- `POST /api/plan/modyfikacje` - dodanie modyfikacji (zamiana grupy)
- `DELETE /api/plan/modyfikacje/{id}` - usunięcie modyfikacji

#### Powiadomienia
- `GET /api/powiadomienia` - lista powiadomień użytkownika
- `PUT /api/powiadomienia/{id}/przeczytane` - oznaczenie jako przeczytane

#### Eksport
- `GET /api/eksport/caldav` - eksport planu do pliku .ics

### 9.2 Serwis synchronizacji (Background Service)

- Hosted Service / Background Worker w .NET
- Uruchamiany co godzinę
- Pobiera dane z API uczelnianego
- Parsuje XML
- Porównuje `data-aktualizacji` ze stanem w SQLite
- Aktualizuje bazę danych
- Generuje powiadomienia dla użytkowników, których plan zawiera zmienione zajęcia

---

## 10. Architektura frontendu (Vue.js)

### 10.1 Widoki (strony)

1. **Strona główna** - wybór trybu (plan studenta / plan nauczyciela)
2. **Logowanie / Rejestracja**
3. **Plan studenta** - formularz wyboru + tabela planu
4. **Plan nauczyciela** - dropdown nauczyciela + tabela planu z konsultacjami
5. **Mój plan** (po zalogowaniu) - spersonalizowany plan z możliwością edycji
6. **Powiadomienia** - lista zmian w śledzonych zajęciach

### 10.2 Komponenty

- `TimetableGrid` - główna tabela planu zajęć (wieloużywalna)
- `TimeSlotCell` - komórka z zajęciami (obsługa łączenia slotów)
- `StudySelector` - formularz wyboru kierunku/semestru/specjalności/grup
- `TeacherSelector` - dropdown z wyszukiwaniem nauczyciela
- `NotificationBadge` - licznik nieprzeczytanych powiadomień
- `NotificationList` - lista powiadomień
- `GroupModifier` - interfejs do zamiany grup w personalizacji

---

## 11. Referencje

- System uczelniany (plan studenta): https://degra.wi.pb.edu.pl/rozklady/rozklad.php?page=st
- System uczelniany (plan nauczyciela): https://degra.wi.pb.edu.pl/rozklady/rozklad.php?page=nau
- System uczelniany (plan spersonalizowany, eksperymentalny): https://degra.wi.pb.edu.pl/rozklady/rozklad.php?page=student
- API (XML dump): https://degra.wi.pb.edu.pl/rozklady/webservices.php
- Kontakt ws. rozkładów: wi.rozklady@pb.edu.pl

---

## 12. Priorytety implementacji (sugerowana kolejność)

1. **Faza 1 - Fundament:** Projekt .NET + Vue, konfiguracja SQLite, serwis pobierania i parsowania XML z API
2. **Faza 2 - Dane:** Model danych, migracje, import danych do SQLite
3. **Faza 3 - Plan studenta:** Endpointy REST, formularz wyboru, komponent tabeli planu
4. **Faza 4 - Plan nauczyciela:** Widok nauczyciela z konsultacjami
5. **Faza 5 - Konta i personalizacja:** System użytkowników, zapisywanie planu, modyfikacje grup
6. **Faza 6 - Powiadomienia:** Background service co godzinę, detekcja zmian, UI powiadomień
7. **Faza 7 - Eksport:** Generowanie plików .ics (CalDAV)

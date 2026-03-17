# Instrukcja uruchomienia — Plan Zajęć WI PB

## 1. Wymagane oprogramowanie

Zanim zaczniesz, zainstaluj następujące narzędzia:

### .NET SDK 10 (backend)
- Pobierz: https://dotnet.microsoft.com/download/dotnet/10.0
- Wybierz **SDK** (nie Runtime) dla swojego systemu (Windows x64)
- Po instalacji sprawdź w terminalu:
  ```
  dotnet --version
  ```
  Powinno wyświetlić wersję zaczynającą się od `10.`

### Node.js 20+ (frontend)
- Pobierz: https://nodejs.org/ — wersja **LTS** (20.x lub nowsza)
- Instalator automatycznie doda `node` i `npm` do PATH
- Po instalacji sprawdź w terminalu:
  ```
  node --version
  npm --version
  ```

### Edytor kodu (opcjonalnie)
- Visual Studio Code: https://code.visualstudio.com/
- Przydatne rozszerzenia: C# Dev Kit, Vue - Official (Volar)

---

## 2. Przygotowanie projektu

### 2.1. Backend — przywrócenie zależności

Otwórz **pierwszy terminal** i przejdź do folderu backendu:

```
cd "ścieżka/do/projektu/Backend/TimetableApp"
```

Przywróć pakiety NuGet:

```
dotnet restore
```

Poczekaj aż się zakończy (pobierze Entity Framework, Ical.Net itp.).

### 2.2. Frontend — instalacja zależności

Otwórz **drugi terminal** i przejdź do folderu frontendu:

```
cd "ścieżka/do/projektu/Frontend"
```

Zainstaluj pakiety npm:

```
npm install
```

Poczekaj aż się zakończy (pobierze Vue, Vite, Tailwind, axios itp.).

---

## 3. Uruchomienie aplikacji

**WAŻNE:** Potrzebujesz **dwóch oddzielnych terminali** działających jednocześnie — jeden dla backendu, drugi dla frontendu. Nie zamykaj żadnego z nich w trakcie korzystania z aplikacji.

### Terminal 1 — Backend (.NET)

```
cd "ścieżka/do/projektu/Backend/TimetableApp"
dotnet run
```

Poczekaj aż zobaczysz w logach coś w stylu:
```
info: Microsoft.Hosting.Lifetime[14]
      Now listening on: http://localhost:5289
```

Backend automatycznie:
- Utworzy plik bazy danych `timetable.db` (SQLite) w folderze `Backend/TimetableApp/`
- Po ~5 sekundach pobierze dane z API uczelni (pierwsza synchronizacja)
- Będzie synchronizował dane co 1 godzinę w tle

### Terminal 2 — Frontend (Vue + Vite)

```
cd "ścieżka/do/projektu/Frontend"
npm run dev
```

Zobaczysz:
```
  VITE v6.x.x  ready in xxx ms

  ➜  Local:   http://localhost:5173/
```

### 4. Otwórz aplikację

Otwórz przeglądarkę i wejdź na:

```
http://localhost:5173
```

Gotowe! Powinieneś zobaczyć stronę główną z trzema kafelkami.

---

## 4. Jak korzystać z aplikacji

### Plan studenta
1. Kliknij **"Plan studenta"** w nawigacji
2. Wybierz **Kierunek** z listy (np. "Informatyka")
3. Wybierz **Semestr**
4. Wybierz **Specjalność** (jeśli jest do wyboru)
5. Siatka planu załaduje się automatycznie
6. Filtruj grupy za pomocą selektorów nad siatką
7. Kliknij **"Zapisz plan"** aby zachować ten widok w zakładce "Mój plan"

### Plan nauczyciela
1. Kliknij **"Plan nauczyciela"**
2. Wpisz nazwisko w pole wyszukiwania
3. Kliknij na nauczyciela z listy — załaduje się jego plan i konsultacje

### Mój plan
1. Kliknij **"Mój plan"** — zobaczysz listę wcześniej zapisanych planów
2. Kliknij **"Otwórz"** na wybranym planie
3. Jeśli uczelnia zaktualizowała dane od ostatniego zapisu, zmienione kafelki będą oznaczone czerwoną obwódką i badge'em **"ZMIANA"**
4. Kliknij **"Zatwierdź zmiany"** aby oznaczyć zmiany jako przeczytane
5. Kliknij **"Eksportuj do kalendarza (.ics)"** aby pobrać plan jako plik kalendarza

---

## 5. Rozwiązywanie problemów

### "Brak danych do wyświetlenia" po wybraniu kierunku/semestru
Backend nie zdążył jeszcze pobrać danych z API uczelni. Poczekaj ~10 sekund od uruchomienia backendu i odśwież stronę.

### Błąd CORS / Network Error w konsoli przeglądarki
Backend nie działa lub działa na innym porcie. Upewnij się, że:
- Terminal z backendem jest uruchomiony i nie pokazuje błędów
- Backend nasłuchuje na `http://localhost:5289`

### `dotnet run` nie działa
- Sprawdź czy masz SDK 10: `dotnet --list-sdks`
- Jeśli masz starszą wersję, pobierz .NET 10 SDK

### `npm install` lub `npm run dev` nie działa
- Sprawdź wersję Node: `node --version` — potrzebna 20+
- Jeśli `npm install` się zawiesiło, usuń folder `node_modules` i plik `package-lock.json`, potem uruchom `npm install` ponownie

### Port 5289 lub 5173 jest zajęty
- Zamknij inną instancję aplikacji lub proces, który używa tego portu
- Na Windows: `netstat -ano | findstr :5289` żeby znaleźć PID procesu, potem `taskkill /PID <numer> /F`

### Baza danych jest uszkodzona
Usuń plik `Backend/TimetableApp/timetable.db` i uruchom backend ponownie — baza zostanie utworzona od nowa i zsynchronizowana z API.

---

## 6. Zatrzymywanie aplikacji

W każdym terminalu naciśnij `Ctrl+C` aby zatrzymać serwer.

Dane w bazie SQLite (`timetable.db`) i zapisane plany pozostają zachowane między uruchomieniami.

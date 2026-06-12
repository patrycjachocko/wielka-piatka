# Mikrousługi - wariant wydzielony

Ten katalog dodaje fizyczny podział backendu na dwie działające mikrousługi oraz wspólny projekt kontraktów.
Stary backend zostaje w repo jako wariant monolityczny.

## Usługi

### TimetableService

Ścieżka: `Microservices/TimetableService`

Odpowiedzialność bounded contextu:
- pobieranie XML z API Degra,
- utrzymanie własnej bazy rozkładu,
- odczyt studiów, semestrów, specjalności, grup, nauczycieli, rozkładu i konsultacji,
- publikacja zdarzenia domenowego po synchronizacji.

Magazyn danych:
- SQLite: `timetable-service.db`

Najważniejsze endpointy:
- `GET http://localhost:5289/api/studia`
- `GET http://localhost:5289/api/rozklad?idStudiow=...&semestr=...&idSpec=...`
- `GET http://localhost:5289/api/nauczyciele`
- `POST http://localhost:5289/api/sync`

### PlansService

Ścieżka: `Microservices/PlansService`

Odpowiedzialność bounded contextu:
- zapisane plany studenta i nauczyciela,
- snapshoty zmian,
- nadpisania kafelków,
- eksport `.ics`,
- lokalna projekcja rozkładu budowana ze zdarzeń.

Magazyn danych:
- dokument JSON: `plans-store.json`

Najważniejsze endpointy:
- `GET http://localhost:5290/api/schedules`
- `POST http://localhost:5290/api/schedules`
- `GET http://localhost:5290/api/schedules/{id}`
- `PUT http://localhost:5290/api/schedules/{id}/overrides`
- `GET http://localhost:5290/api/schedules/{id}/export`
- `GET http://localhost:5290/api/projection/status`

## Event-driven i eventual consistency

`TimetableService` publikuje zdarzenie:

`timetable.snapshot.refreshed`

Kontrakt zdarzenia znajduje się w:

`Microservices/Contracts/Events/TimetableSnapshotRefreshed.cs`

Przepływ:
1. `TimetableService` wykonuje synchronizację XML i aktualizuje swoją bazę SQLite.
2. Po zapisie publikuje `TimetableSnapshotRefreshed` do RabbitMQ.
3. `PlansService` odbiera zdarzenie z kolejki `plans-service.timetable-snapshot`.
4. `PlansService` aktualizuje własny dokumentowy read model rozkładu.
5. Zapisane plany wykrywają zmiany przez porównanie własnego snapshotu z lokalną projekcją.

To pokazuje eventual consistency: przez krótki czas po synchronizacji `PlansService` może mieć starszą projekcję, dopóki nie odbierze eventu.

## Uruchomienie przez Docker Compose

```powershell
docker compose -f docker-compose.microservices.yml up --build
```

Usługi:
- RabbitMQ UI: `http://localhost:15672` (`guest` / `guest`)
- TimetableService: `http://localhost:5289`
- PlansService: `http://localhost:5290`

Po starcie `TimetableService` wykonuje synchronizację po około 10 sekundach. Projekcję w `PlansService` można sprawdzić:

```powershell
Invoke-RestMethod http://localhost:5290/api/projection/status
```

Ręczne wymuszenie synchronizacji:

```powershell
Invoke-RestMethod -Method Post http://localhost:5289/api/sync
```

## Frontend z dwiema usługami

Frontend domyślnie nadal działa z jednym backendem pod `http://localhost:5289/api`.
Do uruchomienia z mikrousługami ustaw:

```powershell
$env:VITE_TIMETABLE_API_URL="http://localhost:5289/api"
$env:VITE_PLANS_API_URL="http://localhost:5290/api"
npm run dev
```

Wtedy żądania rozkładu idą do `TimetableService`, a żądania `/schedules` i `/projection` do `PlansService`.

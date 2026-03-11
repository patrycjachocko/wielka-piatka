using Microsoft.EntityFrameworkCore;
using wielkapiatka.Data;
using wielkapiatka.Models.Degra;

namespace wielkapiatka.Services
{
    public class ScheduleSyncService : BackgroundService
    {
        private readonly IServiceProvider _serviceProvider;
        private readonly ILogger<ScheduleSyncService> _logger;
        private readonly TimeSpan _interval;

        public ScheduleSyncService(IServiceProvider serviceProvider, IConfiguration config, ILogger<ScheduleSyncService> logger)
        {
            _serviceProvider = serviceProvider;
            _logger = logger;
            var minutes = config.GetValue("DegraApi:SyncIntervalMinutes", 60);
            _interval = TimeSpan.FromMinutes(minutes);
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation("ScheduleSyncService uruchomiony. Interwał: {Interval}", _interval);

            // Synchronizacja przy starcie aplikacji
            await SyncAsync(stoppingToken);

            using var timer = new PeriodicTimer(_interval);
            while (await timer.WaitForNextTickAsync(stoppingToken))
            {
                await SyncAsync(stoppingToken);
            }
        }

        public async Task SyncAsync(CancellationToken ct = default)
        {
            try
            {
                _logger.LogInformation("Rozpoczęcie synchronizacji z API Degra...");

                using var scope = _serviceProvider.CreateScope();
                var api = scope.ServiceProvider.GetRequiredService<DegraApiService>();
                var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

                await db.Database.EnsureCreatedAsync(ct);

                var snapshot = await api.FetchSnapshotAsync(ct);
                if (snapshot == null)
                {
                    _logger.LogWarning("Nie udało się pobrać danych z API.");
                    return;
                }

                await UpsertLookupTablesAsync(db, snapshot, ct);
                var (added, removed) = await DetectAndApplyChangesAsync(db, snapshot, ct);
                await CreateNotificationsAsync(db, added, removed, ct);

                var version = await db.SyncInfos.MaxAsync(s => (int?)s.Version, ct) ?? 0;
                version++;

                db.SyncInfos.Add(new SyncInfo
                {
                    Version = version,
                    SyncedAt = DateTime.UtcNow,
                    EntriesCount = snapshot.ScheduleEntries.Count,
                    AddedCount = added.Count,
                    RemovedCount = removed.Count
                });

                await db.SaveChangesAsync(ct);
                _logger.LogInformation("Synchronizacja zakończona. Wersja: {V}, Dodane: {A}, Usunięte: {R}",
                    version, added.Count, removed.Count);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Błąd podczas synchronizacji: {Message}", ex.InnerException?.Message ?? ex.Message);
            }
        }

        private async Task UpsertLookupTablesAsync(AppDbContext db, DegraSnapshot snap, CancellationToken ct)
        {
            await UpsertEntitiesAsync(db.AcademicTitles, snap.Titles, t => t.Id, ct);
            await UpsertEntitiesAsync(db.Rooms, snap.Rooms, r => r.Id, ct);
            await UpsertEntitiesAsync(db.StudyCourses, snap.StudyCourses, s => s.Id, ct);
            await UpsertEntitiesAsync(db.Specialties, snap.Specialties, s => s.Id, ct);
            await UpsertEntitiesAsync(db.Subjects, snap.Subjects, s => s.Id, ct);
            await db.SaveChangesAsync(ct);

            // Nauczyciele - wymagają istniejących tytułów
            var existingTitleIds = await db.AcademicTitles.Select(t => t.Id).ToHashSetAsync(ct);
            foreach (var teacher in snap.Teachers)
            {
                if (!existingTitleIds.Contains(teacher.TitleId))
                {
                    db.AcademicTitles.Add(new AcademicTitle { Id = teacher.TitleId, Name = $"Tytuł {teacher.TitleId}" });
                    existingTitleIds.Add(teacher.TitleId);
                }
            }
            await db.SaveChangesAsync(ct);

            var existingTeachers = await db.Teachers.ToDictionaryAsync(t => t.Id, ct);
            foreach (var t in snap.Teachers)
            {
                if (existingTeachers.TryGetValue(t.Id, out var existing))
                {
                    existing.LastName = t.LastName;
                    existing.FirstName = t.FirstName;
                    existing.ShortName = t.ShortName;
                    existing.TitleId = t.TitleId;
                }
                else if (!existingTeachers.ContainsKey(t.Id))
                {
                    db.Teachers.Add(t);
                    existingTeachers[t.Id] = t;
                }
            }
            await db.SaveChangesAsync(ct);
        }

        private async Task UpsertEntitiesAsync<T>(DbSet<T> dbSet, List<T> newEntities, Func<T, int> keySelector, CancellationToken ct) where T : class
        {
            var existingEntities = await dbSet.ToListAsync(ct);
            var existingIds = existingEntities.Select(keySelector).ToHashSet();
            foreach (var entity in newEntities)
            {
                if (!existingIds.Contains(keySelector(entity)))
                {
                    dbSet.Add(entity);
                    existingIds.Add(keySelector(entity));
                }
            }
        }

        private async Task<(List<ScheduleChange> added, List<ScheduleChange> removed)> DetectAndApplyChangesAsync(
            AppDbContext db, DegraSnapshot snap, CancellationToken ct)
        {
            var existingHashes = await db.ScheduleEntries.Select(e => e.DataHash).ToHashSetAsync(ct);
            var newHashes = snap.ScheduleEntries.Select(e => e.DataHash).ToHashSet();

            var version = (await db.SyncInfos.MaxAsync(s => (int?)s.Version, ct) ?? 0) + 1;

            // Wpisy usunięte z rozkładu (były w bazie, nie ma w nowych danych)
            var removedHashes = existingHashes.Except(newHashes).ToHashSet();
            var removedEntries = await db.ScheduleEntries
                .Where(e => removedHashes.Contains(e.DataHash))
                .ToListAsync(ct);

            var removedChanges = removedEntries.Select(e => new ScheduleChange
            {
                SyncVersion = version,
                ChangeType = "removed",
                DayOfWeek = e.DayOfWeek,
                StartHourId = e.StartHourId,
                DurationSlots = e.DurationSlots,
                WeekType = e.WeekType,
                TeacherId = e.TeacherId,
                RoomId = e.RoomId,
                SubjectId = e.SubjectId,
                StudyCourseId = e.StudyCourseId,
                SpecialtyId = e.SpecialtyId,
                Type = e.Type,
                GroupNumber = e.GroupNumber,
                Semester = e.Semester,
                DataHash = e.DataHash
            }).ToList();

            // Wpisy dodane do rozkładu (są w nowych, nie było w bazie)
            var addedHashes = newHashes.Except(existingHashes).ToHashSet();
            var addedEntries = snap.ScheduleEntries.Where(e => addedHashes.Contains(e.DataHash)).ToList();

            var addedChanges = addedEntries.Select(e => new ScheduleChange
            {
                SyncVersion = version,
                ChangeType = "added",
                DayOfWeek = e.DayOfWeek,
                StartHourId = e.StartHourId,
                DurationSlots = e.DurationSlots,
                WeekType = e.WeekType,
                TeacherId = e.TeacherId,
                RoomId = e.RoomId,
                SubjectId = e.SubjectId,
                StudyCourseId = e.StudyCourseId,
                SpecialtyId = e.SpecialtyId,
                Type = e.Type,
                GroupNumber = e.GroupNumber,
                Semester = e.Semester,
                DataHash = e.DataHash
            }).ToList();

            if (removedChanges.Count > 0 || addedChanges.Count > 0)
            {
                // Odznacz stare oczekujące zmiany
                var oldChanges = await db.ScheduleChanges.Where(c => !c.Dismissed).ToListAsync(ct);
                foreach (var c in oldChanges)
                    c.Dismissed = true;

                db.ScheduleChanges.AddRange(removedChanges);
                db.ScheduleChanges.AddRange(addedChanges);

                // Aktualizacja tabeli wpisów rozkładu
                db.ScheduleEntries.RemoveRange(removedEntries);

                // Upewnij się, że klucze obce istnieją
                var roomIds = await db.Rooms.Select(r => r.Id).ToHashSetAsync(ct);
                var teacherIds = await db.Teachers.Select(t => t.Id).ToHashSetAsync(ct);
                var subjectIds = await db.Subjects.Select(s => s.Id).ToHashSetAsync(ct);
                var courseIds = await db.StudyCourses.Select(s => s.Id).ToHashSetAsync(ct);
                var specIds = await db.Specialties.Select(s => s.Id).ToHashSetAsync(ct);
                var titleIds = await db.AcademicTitles.Select(t => t.Id).ToHashSetAsync(ct);
                var defaultTitleId = titleIds.Count > 0 ? titleIds.First() : 1;
                if (!titleIds.Contains(defaultTitleId))
                {
                    db.AcademicTitles.Add(new AcademicTitle { Id = defaultTitleId, Name = "Brak tytułu" });
                    titleIds.Add(defaultTitleId);
                }

                foreach (var entry in addedEntries)
                {
                    if (!roomIds.Contains(entry.RoomId))
                    {
                        db.Rooms.Add(new Room { Id = entry.RoomId, Name = $"Sala {entry.RoomId}" });
                        roomIds.Add(entry.RoomId);
                    }
                    if (!teacherIds.Contains(entry.TeacherId))
                    {
                        db.Teachers.Add(new Teacher { Id = entry.TeacherId, LastName = $"Nauczyciel {entry.TeacherId}", TitleId = defaultTitleId });
                        teacherIds.Add(entry.TeacherId);
                    }
                    if (!subjectIds.Contains(entry.SubjectId))
                    {
                        db.Subjects.Add(new Subject { Id = entry.SubjectId, Name = $"Przedmiot {entry.SubjectId}" });
                        subjectIds.Add(entry.SubjectId);
                    }
                    if (!courseIds.Contains(entry.StudyCourseId))
                    {
                        db.StudyCourses.Add(new StudyCourse { Id = entry.StudyCourseId, Name = $"Kierunek {entry.StudyCourseId}" });
                        courseIds.Add(entry.StudyCourseId);
                    }
                    if (!specIds.Contains(entry.SpecialtyId))
                    {
                        db.Specialties.Add(new Specialty { Id = entry.SpecialtyId, Name = $"Specjalność {entry.SpecialtyId}" });
                        specIds.Add(entry.SpecialtyId);
                    }

                    entry.Id = 0; // EF wygeneruje nowe ID
                    db.ScheduleEntries.Add(entry);
                }

                await db.SaveChangesAsync(ct);

                _logger.LogInformation("Wykryto zmiany: +{Added} / -{Removed}", addedChanges.Count, removedChanges.Count);
            }
            else if (!await db.ScheduleEntries.AnyAsync(ct) && snap.ScheduleEntries.Count > 0)
            {
                // Pierwsza synchronizacja - załaduj wszystkie bez zmian
                var roomIds = await db.Rooms.Select(r => r.Id).ToHashSetAsync(ct);
                var teacherIds = await db.Teachers.Select(t => t.Id).ToHashSetAsync(ct);
                var subjectIds = await db.Subjects.Select(s => s.Id).ToHashSetAsync(ct);
                var courseIds = await db.StudyCourses.Select(s => s.Id).ToHashSetAsync(ct);
                var specIds = await db.Specialties.Select(s => s.Id).ToHashSetAsync(ct);
                var titleIds = await db.AcademicTitles.Select(t => t.Id).ToHashSetAsync(ct);
                var defaultTitleId = titleIds.Count > 0 ? titleIds.First() : 1;
                if (!titleIds.Contains(defaultTitleId))
                {
                    db.AcademicTitles.Add(new AcademicTitle { Id = defaultTitleId, Name = "Brak tytułu" });
                    titleIds.Add(defaultTitleId);
                }

                foreach (var entry in snap.ScheduleEntries)
                {
                    if (!roomIds.Contains(entry.RoomId))
                    {
                        db.Rooms.Add(new Room { Id = entry.RoomId, Name = $"Sala {entry.RoomId}" });
                        roomIds.Add(entry.RoomId);
                    }
                    if (!teacherIds.Contains(entry.TeacherId))
                    {
                        db.Teachers.Add(new Teacher { Id = entry.TeacherId, LastName = $"Nauczyciel {entry.TeacherId}", TitleId = defaultTitleId });
                        teacherIds.Add(entry.TeacherId);
                    }
                    if (!subjectIds.Contains(entry.SubjectId))
                    {
                        db.Subjects.Add(new Subject { Id = entry.SubjectId, Name = $"Przedmiot {entry.SubjectId}" });
                        subjectIds.Add(entry.SubjectId);
                    }
                    if (!courseIds.Contains(entry.StudyCourseId))
                    {
                        db.StudyCourses.Add(new StudyCourse { Id = entry.StudyCourseId, Name = $"Kierunek {entry.StudyCourseId}" });
                        courseIds.Add(entry.StudyCourseId);
                    }
                    if (!specIds.Contains(entry.SpecialtyId))
                    {
                        db.Specialties.Add(new Specialty { Id = entry.SpecialtyId, Name = $"Specjalność {entry.SpecialtyId}" });
                        specIds.Add(entry.SpecialtyId);
                    }

                    entry.Id = 0;
                    db.ScheduleEntries.Add(entry);
                }
                await db.SaveChangesAsync(ct);
                _logger.LogInformation("Pierwsza synchronizacja: załadowano {Count} wpisów", snap.ScheduleEntries.Count);
            }
            else
            {
                _logger.LogInformation("Brak zmian w rozkładzie.");
            }

            return (addedChanges, removedChanges);
        }

        private async Task CreateNotificationsAsync(AppDbContext db, List<ScheduleChange> added, List<ScheduleChange> removed, CancellationToken ct)
        {
            if (added.Count == 0 && removed.Count == 0)
                return;

            var changedSubjectIds = added.Select(c => c.SubjectId)
                .Union(removed.Select(c => c.SubjectId))
                .Distinct()
                .ToHashSet();

            var trackingEntries = await db.TrackedSubjects
                .Where(ts => changedSubjectIds.Contains(ts.SubjectId))
                .Include(ts => ts.Subject)
                .ToListAsync(ct);

            var notifications = new List<ScheduleNotification>();

            foreach (var tracking in trackingEntries)
            {
                var subjectAdded = added.Where(c => c.SubjectId == tracking.SubjectId).ToList();
                var subjectRemoved = removed.Where(c => c.SubjectId == tracking.SubjectId).ToList();

                if (subjectRemoved.Count > 0)
                {
                    notifications.Add(new ScheduleNotification
                    {
                        ClientId = tracking.ClientId,
                        SubjectId = tracking.SubjectId,
                        ChangeType = "removed",
                        Message = $"Usunięto {subjectRemoved.Count} zajęć z przedmiotu \"{tracking.Subject.Name}\""
                    });
                }

                if (subjectAdded.Count > 0)
                {
                    notifications.Add(new ScheduleNotification
                    {
                        ClientId = tracking.ClientId,
                        SubjectId = tracking.SubjectId,
                        ChangeType = "added",
                        Message = $"Dodano {subjectAdded.Count} nowych zajęć z przedmiotu \"{tracking.Subject.Name}\""
                    });
                }
            }

            if (notifications.Count > 0)
            {
                db.ScheduleNotifications.AddRange(notifications);
                await db.SaveChangesAsync(ct);
                _logger.LogInformation("Utworzono {Count} powiadomień", notifications.Count);
            }
        }
    }

    internal static class AsyncEnumerableExtensions
    {
        public static async Task<HashSet<T>> ToHashSetAsync<T>(this IQueryable<T> source, CancellationToken ct = default)
        {
            var set = new HashSet<T>();
            await foreach (var item in source.AsAsyncEnumerable().WithCancellation(ct))
                set.Add(item);
            return set;
        }
    }
}

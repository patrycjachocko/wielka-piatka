using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using wielkapiatka.Data;
using wielkapiatka.Models;
using wielkapiatka.Models.Degra;
using wielkapiatka.Models.Frontend;

namespace wielkapiatka.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class UserPlanController : ControllerBase
    {
        private readonly AppDbContext _context;

        public UserPlanController(AppDbContext context)
        {
            _context = context;
        }

        // ─── Profil użytkownika ──────────────────────────────────────

        /// <summary>
        /// Pobierz profil użytkownika.
        /// </summary>
        [HttpGet("profile")]
        public async Task<ActionResult<UserProfileDto>> GetProfile([FromQuery] string clientId)
        {
            var profile = await _context.UserProfiles
                .FirstOrDefaultAsync(p => p.ClientId == clientId);

            if (profile == null)
                return NotFound(new { message = "Profil nie istnieje. Ustaw profil przez PUT /api/userplan/profile." });

            return Ok(new UserProfileDto
            {
                ClientId = profile.ClientId,
                StudyCourseId = profile.StudyCourseId,
                SpecialtyId = profile.SpecialtyId,
                Semester = profile.Semester,
                DefaultGroup = profile.DefaultGroup
            });
        }

        /// <summary>
        /// Utwórz lub zaktualizuj profil użytkownika.
        /// Przykład: "Jestem na Informatyce (kier. 1), spec. 2, semestr 4, grupa 1"
        /// </summary>
        [HttpPut("profile")]
        public async Task<ActionResult> SetProfile([FromBody] UserProfileDto dto)
        {
            var profile = await _context.UserProfiles
                .FirstOrDefaultAsync(p => p.ClientId == dto.ClientId);

            if (profile == null)
            {
                profile = new UserProfile { ClientId = dto.ClientId };
                _context.UserProfiles.Add(profile);
            }

            profile.StudyCourseId = dto.StudyCourseId;
            profile.SpecialtyId = dto.SpecialtyId;
            profile.Semester = dto.Semester;
            profile.DefaultGroup = dto.DefaultGroup;

            await _context.SaveChangesAsync();
            return Ok(new { message = "Profil zapisany" });
        }

        // ─── Nadpisania grup ─────────────────────────────────────────

        /// <summary>
        /// Pobierz nadpisania grup użytkownika.
        /// </summary>
        [HttpGet("overrides")]
        public async Task<ActionResult<List<GroupOverrideDto>>> GetOverrides([FromQuery] string clientId)
        {
            var overrides = await _context.UserGroupOverrides
                .Where(o => o.ClientId == clientId)
                .Select(o => new GroupOverrideDto
                {
                    SubjectId = o.SubjectId,
                    Type = o.Type,
                    GroupNumber = o.GroupNumber
                })
                .ToListAsync();

            return Ok(overrides);
        }

        /// <summary>
        /// Ustaw nadpisania grup (zastępuje wszystkie istniejące).
        /// Przykład: "Na Angielskim ĆW chodzę z grupą 2, na Fizyce L z grupą 3"
        /// </summary>
        [HttpPut("overrides")]
        public async Task<ActionResult> SetOverrides([FromBody] SetOverridesRequest request)
        {
            var existing = await _context.UserGroupOverrides
                .Where(o => o.ClientId == request.ClientId)
                .ToListAsync();

            _context.UserGroupOverrides.RemoveRange(existing);

            foreach (var dto in request.Overrides)
            {
                _context.UserGroupOverrides.Add(new UserGroupOverride
                {
                    ClientId = request.ClientId,
                    SubjectId = dto.SubjectId,
                    Type = dto.Type,
                    GroupNumber = dto.GroupNumber
                });
            }

            await _context.SaveChangesAsync();
            return Ok(new { message = $"Zapisano {request.Overrides.Count} nadpisań grup" });
        }

        /// <summary>
        /// Dodaj/zaktualizuj pojedyncze nadpisanie grupy.
        /// </summary>
        [HttpPut("overrides/single")]
        public async Task<ActionResult> SetSingleOverride(
            [FromQuery] string clientId, [FromBody] GroupOverrideDto dto)
        {
            var existing = await _context.UserGroupOverrides
                .FirstOrDefaultAsync(o =>
                    o.ClientId == clientId &&
                    o.SubjectId == dto.SubjectId &&
                    o.Type == dto.Type);

            if (existing != null)
            {
                existing.GroupNumber = dto.GroupNumber;
            }
            else
            {
                _context.UserGroupOverrides.Add(new UserGroupOverride
                {
                    ClientId = clientId,
                    SubjectId = dto.SubjectId,
                    Type = dto.Type,
                    GroupNumber = dto.GroupNumber
                });
            }

            await _context.SaveChangesAsync();
            return Ok(new { message = "Nadpisanie zapisane" });
        }

        /// <summary>
        /// Usuń nadpisanie grupy (wróć do domyślnej).
        /// </summary>
        [HttpDelete("overrides")]
        public async Task<ActionResult> RemoveOverride(
            [FromQuery] string clientId, [FromQuery] int subjectId, [FromQuery] string type)
        {
            var existing = await _context.UserGroupOverrides
                .FirstOrDefaultAsync(o =>
                    o.ClientId == clientId &&
                    o.SubjectId == subjectId &&
                    o.Type == type);

            if (existing == null)
                return NotFound();

            _context.UserGroupOverrides.Remove(existing);
            await _context.SaveChangesAsync();
            return Ok(new { message = "Nadpisanie usunięte" });
        }

        // ─── Spersonalizowany plan ───────────────────────────────────

        /// <summary>
        /// Zwraca spersonalizowany plan użytkownika.
        /// Logika: bierze wpisy pasujące do profilu (kierunek, specjalność, semestr),
        /// filtruje po domyślnej grupie, a następnie stosuje nadpisania.
        /// </summary>
        [HttpGet("my-plan")]
        public async Task<ActionResult<List<ScheduleEvent>>> GetMyPlan([FromQuery] string clientId)
        {
            var profile = await _context.UserProfiles
                .FirstOrDefaultAsync(p => p.ClientId == clientId);

            if (profile == null)
                return BadRequest(new { message = "Najpierw ustaw profil (PUT /api/userplan/profile)" });

            var overrides = await _context.UserGroupOverrides
                .Where(o => o.ClientId == clientId)
                .ToListAsync();

            // Budujemy lookup: (SubjectId, Type) → GroupNumber
            var overrideMap = overrides.ToDictionary(
                o => (o.SubjectId, o.Type),
                o => o.GroupNumber);

            // Pobierz wszystkie wpisy dla kierunku, specjalności i semestru
            var allEntries = await _context.ScheduleEntries
                .Include(e => e.Room)
                .Include(e => e.Teacher).ThenInclude(t => t.Title)
                .Include(e => e.Subject)
                .Include(e => e.StudyCourse)
                .Include(e => e.Specialty)
                .Where(e =>
                    e.StudyCourseId == profile.StudyCourseId &&
                    e.SpecialtyId == profile.SpecialtyId &&
                    e.Semester == profile.Semester)
                .ToListAsync();

            // Filtruj: dla każdego wpisu sprawdź, czy pasuje do grupy użytkownika
            var myEntries = allEntries.Where(e =>
            {
                // Sprawdź, czy jest nadpisanie dla tego przedmiotu i typu
                if (overrideMap.TryGetValue((e.SubjectId, e.Type), out var overrideGroup))
                    return e.GroupNumber == overrideGroup;

                // Wykłady (W) — wszyscy, niezależnie od grupy
                if (e.Type == "W")
                    return true;

                // Domyślna grupa
                return e.GroupNumber == profile.DefaultGroup;
            }).ToList();

            // Mapuj na ScheduleEvent
            var events = myEntries.Select(e => new ScheduleEvent
            {
                Id = e.Id.ToString(),
                LeafId = $"student-{e.StudyCourseId}-spec-{e.SpecialtyId}-sem-{e.Semester}",
                Day = MapDayKey(e.DayOfWeek),
                SlotId = $"wd-{e.StartHourId}",
                Subject = $"{e.Type} {e.Subject.Name}",
                Room = e.Room?.Name ?? "Brak",
                Lecturer = e.Teacher != null
                    ? $"{e.Teacher.Title?.Name} {e.Teacher.FirstName} {e.Teacher.LastName}".Trim()
                    : "Brak danych",
                GroupLabel = overrideMap.ContainsKey((e.SubjectId, e.Type))
                    ? $"Gr {e.GroupNumber} ✱"
                    : $"Gr {e.GroupNumber}"
            }).ToList();

            return Ok(events);
        }

        /// <summary>
        /// Pobiera dostępne grupy dla danego przedmiotu i typu w kontekście profilu użytkownika.
        /// Przydatne do wyświetlenia listy wyboru na froncie.
        /// </summary>
        [HttpGet("available-groups")]
        public async Task<ActionResult> GetAvailableGroups(
            [FromQuery] string clientId, [FromQuery] int subjectId, [FromQuery] string type)
        {
            var profile = await _context.UserProfiles
                .FirstOrDefaultAsync(p => p.ClientId == clientId);

            if (profile == null)
                return BadRequest(new { message = "Najpierw ustaw profil" });

            var groups = await _context.ScheduleEntries
                .Where(e =>
                    e.StudyCourseId == profile.StudyCourseId &&
                    e.SpecialtyId == profile.SpecialtyId &&
                    e.Semester == profile.Semester &&
                    e.SubjectId == subjectId &&
                    e.Type == type)
                .Select(e => e.GroupNumber)
                .Distinct()
                .OrderBy(g => g)
                .ToListAsync();

            var currentOverride = await _context.UserGroupOverrides
                .FirstOrDefaultAsync(o =>
                    o.ClientId == clientId &&
                    o.SubjectId == subjectId &&
                    o.Type == type);

            return Ok(new
            {
                subjectId,
                type,
                availableGroups = groups,
                currentGroup = currentOverride?.GroupNumber ?? profile.DefaultGroup,
                isOverridden = currentOverride != null
            });
        }

        private static DayKey MapDayKey(int dayFromDb)
        {
            return dayFromDb switch
            {
                1 => DayKey.monday,
                2 => DayKey.tuesday,
                3 => DayKey.wednesday,
                4 => DayKey.thursday,
                5 => DayKey.friday,
                6 => DayKey.saturday,
                7 => DayKey.sunday,
                _ => DayKey.monday
            };
        }
    }
}

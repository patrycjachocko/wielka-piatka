using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using wielkapiatka.Data;
using wielkapiatka.Models;
using wielkapiatka.Models.Frontend;

namespace wielkapiatka.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class ScheduleController : ControllerBase
    {
        private readonly AppDbContext _context;

        public ScheduleController(AppDbContext context)
        {
            _context = context;
        }

        [HttpGet("events")]
        public async Task<ActionResult<IEnumerable<ScheduleEvent>>> GetEvents()
        {
            // Pobieramy wpisy z bazy i od razu zaciągamy dane powiązane
            var dbEntries = await _context.ScheduleEntries
                .Include(e => e.Room)
                .Include(e => e.Teacher).ThenInclude(t => t.Title)
                .Include(e => e.Subject)
                .ToListAsync();

            // Mapujemy na strukturę jakiej oczekuje frontend w Vue
            var frontendEvents = dbEntries.Select(e => new ScheduleEvent
            {
                Id = e.Id.ToString(),
                LeafId = "placeholder-leaf-id", // Do podmiany na faktyczną logikę grup
                Day = MapDayKey(e.DayOfWeek), 
                SlotId = e.StartHourId.ToString(),
                Subject = $"{e.Type} {e.Subject.Name}", // Np. "W Analiza matematyczna"
                Room = e.Room != null ? e.Room.Name : "Brak",
                Lecturer = e.Teacher != null 
                    ? $"{e.Teacher.Title?.Name} {e.Teacher.FirstName} {e.Teacher.LastName}".Trim()
                    : "Brak danych",
                GroupLabel = $"Gr {e.GroupNumber}"
            });

            return Ok(frontendEvents);
        }

        // Pomocnicza metoda zamieniająca cyfrę z bazy na Enum dla frontendu
        private DayKey MapDayKey(int dayFromDb)
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
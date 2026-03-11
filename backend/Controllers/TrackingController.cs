using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using wielkapiatka.Data;
using wielkapiatka.Models.Degra;
using wielkapiatka.Models.Frontend;

namespace wielkapiatka.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class TrackingController : ControllerBase
    {
        private readonly AppDbContext _context;

        public TrackingController(AppDbContext context)
        {
            _context = context;
        }

        /// <summary>
        /// Pobierz listę śledzonych przedmiotów dla danego klienta.
        /// </summary>
        [HttpGet("subjects")]
        public async Task<ActionResult<IEnumerable<SubjectDto>>> GetTrackedSubjects([FromQuery] string clientId)
        {
            if (string.IsNullOrWhiteSpace(clientId))
                return BadRequest("clientId jest wymagany");

            var tracked = await _context.TrackedSubjects
                .Where(ts => ts.ClientId == clientId)
                .Include(ts => ts.Subject)
                .Select(ts => new SubjectDto
                {
                    Id = ts.Subject.Id,
                    Name = ts.Subject.Name,
                    ShortName = ts.Subject.ShortName
                })
                .ToListAsync();

            return Ok(tracked);
        }

        /// <summary>
        /// Ustaw listę śledzonych przedmiotów. Zastępuje poprzednią listę.
        /// </summary>
        [HttpPost("subjects")]
        public async Task<ActionResult> SetTrackedSubjects([FromBody] TrackSubjectsRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.ClientId))
                return BadRequest("clientId jest wymagany");

            var existing = await _context.TrackedSubjects
                .Where(ts => ts.ClientId == request.ClientId)
                .ToListAsync();
            _context.TrackedSubjects.RemoveRange(existing);

            var validSubjectIds = await _context.Subjects
                .Where(s => request.SubjectIds.Contains(s.Id))
                .Select(s => s.Id)
                .ToListAsync();

            foreach (var subjectId in validSubjectIds)
            {
                _context.TrackedSubjects.Add(new TrackedSubject
                {
                    ClientId = request.ClientId,
                    SubjectId = subjectId
                });
            }

            await _context.SaveChangesAsync();
            return Ok(new { tracked = validSubjectIds.Count });
        }

        /// <summary>
        /// Dodaj pojedynczy przedmiot do śledzenia.
        /// </summary>
        [HttpPost("subjects/add")]
        public async Task<ActionResult> AddTrackedSubject([FromQuery] string clientId, [FromQuery] int subjectId)
        {
            if (string.IsNullOrWhiteSpace(clientId))
                return BadRequest("clientId jest wymagany");

            var exists = await _context.TrackedSubjects
                .AnyAsync(ts => ts.ClientId == clientId && ts.SubjectId == subjectId);
            if (exists)
                return Ok(new { message = "Przedmiot jest już śledzony" });

            var subjectExists = await _context.Subjects.AnyAsync(s => s.Id == subjectId);
            if (!subjectExists)
                return NotFound("Przedmiot nie istnieje");

            _context.TrackedSubjects.Add(new TrackedSubject
            {
                ClientId = clientId,
                SubjectId = subjectId
            });
            await _context.SaveChangesAsync();

            return Ok(new { message = "Dodano do śledzenia" });
        }

        /// <summary>
        /// Usuń pojedynczy przedmiot ze śledzenia.
        /// </summary>
        [HttpDelete("subjects/remove")]
        public async Task<ActionResult> RemoveTrackedSubject([FromQuery] string clientId, [FromQuery] int subjectId)
        {
            if (string.IsNullOrWhiteSpace(clientId))
                return BadRequest("clientId jest wymagany");

            var entry = await _context.TrackedSubjects
                .FirstOrDefaultAsync(ts => ts.ClientId == clientId && ts.SubjectId == subjectId);

            if (entry == null)
                return NotFound("Przedmiot nie jest śledzony");

            _context.TrackedSubjects.Remove(entry);
            await _context.SaveChangesAsync();

            return Ok(new { message = "Usunięto ze śledzenia" });
        }
    }
}

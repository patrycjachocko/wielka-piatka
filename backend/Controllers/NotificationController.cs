using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using wielkapiatka.Data;
using wielkapiatka.Models.Frontend;

namespace wielkapiatka.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class NotificationController : ControllerBase
    {
        private readonly AppDbContext _context;

        public NotificationController(AppDbContext context)
        {
            _context = context;
        }

        /// <summary>
        /// Pobierz powiadomienia dla danego klienta.
        /// </summary>
        [HttpGet]
        public async Task<ActionResult<IEnumerable<NotificationDto>>> GetNotifications(
            [FromQuery] string clientId,
            [FromQuery] bool unreadOnly = false)
        {
            if (string.IsNullOrWhiteSpace(clientId))
                return BadRequest("clientId jest wymagany");

            var query = _context.ScheduleNotifications
                .Where(n => n.ClientId == clientId);

            if (unreadOnly)
                query = query.Where(n => !n.IsRead);

            var notifications = await query
                .OrderByDescending(n => n.CreatedAt)
                .Select(n => new NotificationDto
                {
                    Id = n.Id,
                    Message = n.Message,
                    CreatedAt = n.CreatedAt,
                    IsRead = n.IsRead,
                    SubjectId = n.SubjectId,
                    ChangeType = n.ChangeType
                })
                .ToListAsync();

            return Ok(notifications);
        }

        /// <summary>
        /// Ilość nieprzeczytanych powiadomień.
        /// </summary>
        [HttpGet("count")]
        public async Task<ActionResult> GetUnreadCount([FromQuery] string clientId)
        {
            if (string.IsNullOrWhiteSpace(clientId))
                return BadRequest("clientId jest wymagany");

            var count = await _context.ScheduleNotifications
                .CountAsync(n => n.ClientId == clientId && !n.IsRead);

            return Ok(new { unreadCount = count });
        }

        /// <summary>
        /// Oznacz powiadomienie jako przeczytane.
        /// </summary>
        [HttpPost("{id}/read")]
        public async Task<ActionResult> MarkAsRead(int id)
        {
            var notification = await _context.ScheduleNotifications.FindAsync(id);
            if (notification == null)
                return NotFound();

            notification.IsRead = true;
            await _context.SaveChangesAsync();

            return Ok();
        }

        /// <summary>
        /// Oznacz wszystkie powiadomienia klienta jako przeczytane.
        /// </summary>
        [HttpPost("read-all")]
        public async Task<ActionResult> MarkAllAsRead([FromQuery] string clientId)
        {
            if (string.IsNullOrWhiteSpace(clientId))
                return BadRequest("clientId jest wymagany");

            var unread = await _context.ScheduleNotifications
                .Where(n => n.ClientId == clientId && !n.IsRead)
                .ToListAsync();

            foreach (var n in unread)
                n.IsRead = true;

            await _context.SaveChangesAsync();
            return Ok(new { markedRead = unread.Count });
        }

        /// <summary>
        /// Usuń wszystkie powiadomienia klienta.
        /// </summary>
        [HttpDelete]
        public async Task<ActionResult> ClearNotifications([FromQuery] string clientId)
        {
            if (string.IsNullOrWhiteSpace(clientId))
                return BadRequest("clientId jest wymagany");

            var all = await _context.ScheduleNotifications
                .Where(n => n.ClientId == clientId)
                .ToListAsync();

            _context.ScheduleNotifications.RemoveRange(all);
            await _context.SaveChangesAsync();

            return Ok(new { deleted = all.Count });
        }
    }
}

using System.Text;
using System.Xml.Linq;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using wielkapiatka.Data;
using wielkapiatka.Services;

namespace wielkapiatka.Controllers
{
    [Route("caldav")]
    [ApiController]
    public class CalDavController : ControllerBase
    {
        private readonly CalendarExportService _calService;
        private readonly AppDbContext _context;

        private static readonly XNamespace DavNs = "DAV:";
        private static readonly XNamespace CalDavNs = "urn:ietf:params:xml:ns:caldav";

        public CalDavController(CalendarExportService calService, AppDbContext context)
        {
            _calService = calService;
            _context = context;
        }

        // ─── iCal subscription endpoints (GET) ──────────────────────────

        [HttpGet("schedule.ics")]
        public async Task<IActionResult> GetFullCalendar(CancellationToken ct)
        {
            var ics = await _calService.GenerateIcsAsync(ct: ct);
            return IcsResult(ics);
        }

        [HttpGet("course/{studyCourseId}/semester/{semester}/schedule.ics")]
        public async Task<IActionResult> GetCourseCalendar(
            int studyCourseId, int semester, [FromQuery] int? specialtyId, CancellationToken ct)
        {
            var ics = await _calService.GenerateIcsAsync(studyCourseId, semester, specialtyId, ct: ct);
            return IcsResult(ics);
        }

        [HttpGet("course/{studyCourseId}/specialty/{specialtyId}/semester/{semester}/schedule.ics")]
        public async Task<IActionResult> GetCourseSpecialtyCalendar(
            int studyCourseId, int specialtyId, int semester, CancellationToken ct)
        {
            var ics = await _calService.GenerateIcsAsync(studyCourseId, semester, specialtyId, ct: ct);
            return IcsResult(ics);
        }

        [HttpGet("teacher/{teacherId}/schedule.ics")]
        public async Task<IActionResult> GetTeacherCalendar(int teacherId, CancellationToken ct)
        {
            var ics = await _calService.GenerateIcsAsync(teacherId: teacherId, ct: ct);
            return IcsResult(ics);
        }

        /// <summary>
        /// Kalendarz przedmiotu — wszystkie terminy danego przedmiotu.
        /// Opcjonalnie: ?groups=1,2 i ?types=ĆW,L
        /// </summary>
        [HttpGet("subject/{subjectId}/schedule.ics")]
        public async Task<IActionResult> GetSubjectCalendar(
            int subjectId, [FromQuery] string? groups, [FromQuery] string? types, CancellationToken ct)
        {
            var ics = await _calService.GenerateSubjectIcsAsync(subjectId, groups, types, ct);
            return IcsResult(ics);
        }

        /// <summary>
        /// Spersonalizowany kalendarz użytkownika (profil + nadpisania grup) do subskrypcji w kalendarzu.
        /// </summary>
        [HttpGet("my/{clientId}/schedule.ics")]
        public async Task<IActionResult> GetPersonalCalendar(string clientId, CancellationToken ct)
        {
            var profile = await _context.UserProfiles
                .FirstOrDefaultAsync(p => p.ClientId == clientId, ct);

            if (profile == null)
                return NotFound("Profil nie istnieje");

            var overrides = await _context.UserGroupOverrides
                .Where(o => o.ClientId == clientId)
                .ToListAsync(ct);

            var ics = await _calService.GeneratePersonalIcsAsync(profile, overrides, ct);
            return IcsResult(ics);
        }

        /// <summary>
        /// Lista dostępnych kalendarzy (do wyświetlenia na froncie).
        /// </summary>
        [HttpGet("calendars")]
        public async Task<ActionResult<List<CalendarInfo>>> GetAvailableCalendars(CancellationToken ct)
        {
            var calendars = await _calService.GetAvailableCalendarsAsync(ct);
            return Ok(calendars);
        }

        // ─── CalDAV protocol endpoints ───────────────────────────────────

        [AcceptVerbs("OPTIONS")]
        [Route("")]
        [Route("{*path}")]
        public IActionResult CalDavOptions()
        {
            Response.Headers["DAV"] = "1, 2, calendar-access";
            Response.Headers["Allow"] = "OPTIONS, GET, HEAD, PROPFIND, REPORT";
            return Ok();
        }

        [AcceptVerbs("PROPFIND")]
        [Route("")]
        public IActionResult PropfindRoot()
        {
            var baseUrl = $"{Request.Scheme}://{Request.Host}";

            var xml = new XDocument(
                new XDeclaration("1.0", "utf-8", null),
                new XElement(DavNs + "multistatus",
                    new XAttribute(XNamespace.Xmlns + "d", DavNs.NamespaceName),
                    new XAttribute(XNamespace.Xmlns + "c", CalDavNs.NamespaceName),
                    new XElement(DavNs + "response",
                        new XElement(DavNs + "href", "/caldav/"),
                        new XElement(DavNs + "propstat",
                            new XElement(DavNs + "prop",
                                new XElement(DavNs + "resourcetype",
                                    new XElement(DavNs + "collection")),
                                new XElement(DavNs + "current-user-principal",
                                    new XElement(DavNs + "href", "/caldav/principal/")),
                                new XElement(DavNs + "displayname", "WielkaPiątka CalDAV")),
                            new XElement(DavNs + "status", "HTTP/1.1 200 OK")))));

            return DavXmlResult(xml);
        }

        [AcceptVerbs("PROPFIND")]
        [Route("principal")]
        [Route("principal/")]
        public IActionResult PropfindPrincipal()
        {
            var xml = new XDocument(
                new XDeclaration("1.0", "utf-8", null),
                new XElement(DavNs + "multistatus",
                    new XAttribute(XNamespace.Xmlns + "d", DavNs.NamespaceName),
                    new XAttribute(XNamespace.Xmlns + "c", CalDavNs.NamespaceName),
                    new XElement(DavNs + "response",
                        new XElement(DavNs + "href", "/caldav/principal/"),
                        new XElement(DavNs + "propstat",
                            new XElement(DavNs + "prop",
                                new XElement(DavNs + "resourcetype",
                                    new XElement(DavNs + "collection"),
                                    new XElement(DavNs + "principal")),
                                new XElement(CalDavNs + "calendar-home-set",
                                    new XElement(DavNs + "href", "/caldav/calendars/")),
                                new XElement(DavNs + "displayname", "WielkaPiątka")),
                            new XElement(DavNs + "status", "HTTP/1.1 200 OK")))));

            return DavXmlResult(xml);
        }

        [AcceptVerbs("PROPFIND")]
        [Route("calendars")]
        [Route("calendars/")]
        public async Task<IActionResult> PropfindCalendars(CancellationToken ct)
        {
            var calendars = await _calService.GetAvailableCalendarsAsync(ct);

            var responses = new List<XElement>
            {
                new(DavNs + "response",
                    new XElement(DavNs + "href", "/caldav/calendars/"),
                    new XElement(DavNs + "propstat",
                        new XElement(DavNs + "prop",
                            new XElement(DavNs + "resourcetype",
                                new XElement(DavNs + "collection")),
                            new XElement(DavNs + "displayname", "Kalendarze")),
                        new XElement(DavNs + "status", "HTTP/1.1 200 OK")))
            };

            foreach (var cal in calendars)
            {
                responses.Add(new XElement(DavNs + "response",
                    new XElement(DavNs + "href", cal.Url),
                    new XElement(DavNs + "propstat",
                        new XElement(DavNs + "prop",
                            new XElement(DavNs + "resourcetype",
                                new XElement(DavNs + "collection"),
                                new XElement(CalDavNs + "calendar")),
                            new XElement(DavNs + "displayname", cal.DisplayName),
                            new XElement(CalDavNs + "supported-calendar-component-set",
                                new XElement(CalDavNs + "comp",
                                    new XAttribute("name", "VEVENT"))),
                            new XElement(DavNs + "getcontenttype", "text/calendar; charset=utf-8")),
                        new XElement(DavNs + "status", "HTTP/1.1 200 OK"))));
            }

            var xml = new XDocument(
                new XDeclaration("1.0", "utf-8", null),
                new XElement(DavNs + "multistatus",
                    new XAttribute(XNamespace.Xmlns + "d", DavNs.NamespaceName),
                    new XAttribute(XNamespace.Xmlns + "c", CalDavNs.NamespaceName),
                    responses));

            return DavXmlResult(xml);
        }

        // ─── Helpers ─────────────────────────────────────────────────────

        private FileContentResult IcsResult(string icsContent)
        {
            var bytes = Encoding.UTF8.GetBytes(icsContent);
            return File(bytes, "text/calendar; charset=utf-8", "schedule.ics");
        }

        private ContentResult DavXmlResult(XDocument xml)
        {
            Response.StatusCode = 207; // Multi-Status
            Response.Headers["DAV"] = "1, 2, calendar-access";
            return Content(xml.ToString(), "application/xml; charset=utf-8", Encoding.UTF8);
        }
    }

    /// <summary>
    /// Obsługa /.well-known/caldav → redirect do /caldav/
    /// </summary>
    [Route(".well-known")]
    [ApiController]
    public class WellKnownController : ControllerBase
    {
        [AcceptVerbs("GET", "PROPFIND")]
        [Route("caldav")]
        public IActionResult CalDavDiscovery()
        {
            return RedirectPermanent("/caldav/");
        }
    }
}

using System.Xml.Linq;
using wielkapiatka.Models.Degra;

namespace wielkapiatka.Services
{
    public class DegraApiService
    {
        private readonly HttpClient _httpClient;
        private readonly ILogger<DegraApiService> _logger;
        private readonly string _apiUrl;

        public DegraApiService(HttpClient httpClient, IConfiguration config, ILogger<DegraApiService> logger)
        {
            _httpClient = httpClient;
            _logger = logger;
            _apiUrl = config["DegraApi:Url"] ?? "https://degra.wi.pb.edu.pl/rozklady/webservices.php";
        }

        public async Task<DegraSnapshot?> FetchSnapshotAsync(CancellationToken ct = default)
        {
            try
            {
                _logger.LogInformation("Pobieranie danych z API Degra: {Url}", _apiUrl);
                var xml = await _httpClient.GetStringAsync(_apiUrl, ct);
                return ParseXml(xml);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Błąd podczas pobierania danych z API Degra");
                return null;
            }
        }

        private DegraSnapshot ParseXml(string xml)
        {
            var doc = XDocument.Parse(xml);
            var root = doc.Root!;
            var snapshot = new DegraSnapshot();

            foreach (var el in root.Elements("tabela_tytuly"))
            {
                snapshot.Titles.Add(new AcademicTitle
                {
                    Id = ParseInt(el.Element("ID")),
                    Name = el.Element("NAZWA")?.Value ?? string.Empty
                });
            }

            foreach (var el in root.Elements("tabela_sale"))
            {
                snapshot.Rooms.Add(new Room
                {
                    Id = ParseInt(el.Element("ID")),
                    Name = el.Element("NAZWA")?.Value ?? string.Empty,
                    LastUpdated = ParseLong(el.Attribute("data-aktualizacji"))
                });
            }

            foreach (var el in root.Elements("tabela_nauczyciele"))
            {
                snapshot.Teachers.Add(new Teacher
                {
                    Id = ParseInt(el.Element("ID")),
                    LastName = el.Element("NAZW")?.Value ?? string.Empty,
                    FirstName = el.Element("IMIE")?.Value ?? string.Empty,
                    ShortName = el.Element("IM_SK")?.Value ?? string.Empty,
                    TitleId = ParseInt(el.Element("ID_TYT"))
                });
            }

            foreach (var el in root.Elements("tabela_studia"))
            {
                snapshot.StudyCourses.Add(new StudyCourse
                {
                    Id = ParseInt(el.Element("ID")),
                    Name = el.Element("NAZWA")?.Value ?? string.Empty
                });
            }

            foreach (var el in root.Elements("tabela_specjalnosci"))
            {
                snapshot.Specialties.Add(new Specialty
                {
                    Id = ParseInt(el.Element("ID")),
                    Name = el.Element("NAZWA")?.Value ?? string.Empty
                });
            }

            foreach (var el in root.Elements("tabela_przedmioty"))
            {
                snapshot.Subjects.Add(new Subject
                {
                    Id = ParseInt(el.Element("ID")),
                    Name = el.Element("NAZWA")?.Value ?? string.Empty,
                    ShortName = el.Element("NAZ_SK")?.Value ?? string.Empty
                });
            }

            foreach (var el in root.Elements("tabela_rozklad"))
            {
                var entry = new ScheduleEntry
                {
                    DayOfWeek = ParseInt(el.Element("DZIEN")),
                    StartHourId = ParseInt(el.Element("GODZ")),
                    DurationSlots = ParseInt(el.Element("ILOSC")),
                    WeekType = ParseInt(el.Element("TYG")),
                    TeacherId = ParseInt(el.Element("ID_NAUCZ")),
                    RoomId = ParseInt(el.Element("ID_SALA")),
                    SubjectId = ParseInt(el.Element("ID_PRZ")),
                    Type = el.Element("RODZ")?.Value ?? string.Empty,
                    GroupNumber = ParseInt(el.Element("GRUPA")),
                    StudyCourseId = ParseInt(el.Element("ID_ST")),
                    Semester = ParseInt(el.Element("SEM")),
                    SpecialtyId = ParseInt(el.Element("ID_SPEC"))
                };
                entry.DataHash = entry.ComputeHash();
                snapshot.ScheduleEntries.Add(entry);
            }

            _logger.LogInformation(
                "Sparsowano: {Rooms} sal, {Teachers} nauczycieli, {Subjects} przedmiotów, {Entries} wpisów rozkładu",
                snapshot.Rooms.Count, snapshot.Teachers.Count, snapshot.Subjects.Count, snapshot.ScheduleEntries.Count);

            return snapshot;
        }

        private static int ParseInt(XElement? el) => int.TryParse(el?.Value, out var v) ? v : 0;
        private static int ParseInt(XAttribute? attr) => int.TryParse(attr?.Value, out var v) ? v : 0;
        private static long ParseLong(XAttribute? attr) => long.TryParse(attr?.Value, out var v) ? v : 0;
    }

    public class DegraSnapshot
    {
        public List<Room> Rooms { get; set; } = new();
        public List<AcademicTitle> Titles { get; set; } = new();
        public List<Teacher> Teachers { get; set; } = new();
        public List<StudyCourse> StudyCourses { get; set; } = new();
        public List<Specialty> Specialties { get; set; } = new();
        public List<Subject> Subjects { get; set; } = new();
        public List<ScheduleEntry> ScheduleEntries { get; set; } = new();
    }
}

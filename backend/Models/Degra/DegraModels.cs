using System.ComponentModel.DataAnnotations;
using System.Security.Cryptography;
using System.Text;

namespace wielkapiatka.Models.Degra
{
    public class Room
    {
        [Key]
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public long LastUpdated { get; set; }
    }

    public class AcademicTitle
    {
        [Key]
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
    }

    public class StudyCourse
    {
        [Key]
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
    }

    public class Specialty
    {
        [Key]
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
    }

    public class Teacher
    {
        [Key]
        public int Id { get; set; }
        public string LastName { get; set; } = string.Empty;
        public string FirstName { get; set; } = string.Empty;
        public string ShortName { get; set; } = string.Empty;

        public int TitleId { get; set; }
        public AcademicTitle Title { get; set; } = null!;
    }

    public class Subject
    {
        [Key]
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string ShortName { get; set; } = string.Empty;
    }

    public class ScheduleEntry
    {
        [Key]
        public int Id { get; set; }

        public int DayOfWeek { get; set; }
        public int StartHourId { get; set; }
        public int DurationSlots { get; set; }
        public int WeekType { get; set; }

        public int TeacherId { get; set; }
        public int RoomId { get; set; }
        public int SubjectId { get; set; }
        public int StudyCourseId { get; set; }
        public int SpecialtyId { get; set; }

        public string Type { get; set; } = string.Empty;
        public int GroupNumber { get; set; }
        public int Semester { get; set; }

        public string DataHash { get; set; } = string.Empty;

        public Teacher Teacher { get; set; } = null!;
        public Room Room { get; set; } = null!;
        public Subject Subject { get; set; } = null!;
        public StudyCourse StudyCourse { get; set; } = null!;
        public Specialty Specialty { get; set; } = null!;

        public string ComputeHash()
        {
            var raw = $"{DayOfWeek}|{StartHourId}|{DurationSlots}|{WeekType}|{TeacherId}|{RoomId}|{SubjectId}|{StudyCourseId}|{SpecialtyId}|{Type}|{GroupNumber}|{Semester}";
            var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(raw));
            return Convert.ToHexString(bytes);
        }
    }

    public class ScheduleChange
    {
        [Key]
        public int Id { get; set; }
        public int SyncVersion { get; set; }
        public DateTime DetectedAt { get; set; } = DateTime.UtcNow;

        public string ChangeType { get; set; } = string.Empty; // "added" / "removed"

        public int DayOfWeek { get; set; }
        public int StartHourId { get; set; }
        public int DurationSlots { get; set; }
        public int WeekType { get; set; }
        public int TeacherId { get; set; }
        public int RoomId { get; set; }
        public int SubjectId { get; set; }
        public int StudyCourseId { get; set; }
        public int SpecialtyId { get; set; }
        public string Type { get; set; } = string.Empty;
        public int GroupNumber { get; set; }
        public int Semester { get; set; }
        public string DataHash { get; set; } = string.Empty;

        public bool Dismissed { get; set; }
    }

    public class TrackedSubject
    {
        [Key]
        public int Id { get; set; }
        public string ClientId { get; set; } = string.Empty;
        public int SubjectId { get; set; }
        public Subject Subject { get; set; } = null!;
    }

    public class ScheduleNotification
    {
        [Key]
        public int Id { get; set; }
        public string ClientId { get; set; } = string.Empty;
        public string Message { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public bool IsRead { get; set; }
        public int SubjectId { get; set; }
        public string ChangeType { get; set; } = string.Empty;
    }

    public class SyncInfo
    {
        [Key]
        public int Id { get; set; }
        public int Version { get; set; }
        public DateTime SyncedAt { get; set; } = DateTime.UtcNow;
        public int EntriesCount { get; set; }
        public int AddedCount { get; set; }
        public int RemovedCount { get; set; }
    }

    /// <summary>
    /// Profil użytkownika — określa kierunek, specjalność, semestr i domyślną grupę.
    /// </summary>
    public class UserProfile
    {
        [Key]
        public int Id { get; set; }
        public string ClientId { get; set; } = string.Empty;
        public int StudyCourseId { get; set; }
        public int SpecialtyId { get; set; }
        public int Semester { get; set; }
        public int DefaultGroup { get; set; }

        public StudyCourse StudyCourse { get; set; } = null!;
        public Specialty Specialty { get; set; } = null!;
    }

    /// <summary>
    /// Nadpisanie grupy — "na danym przedmiocie (typ) chodzę z inną grupą niż domyślna".
    /// </summary>
    public class UserGroupOverride
    {
        [Key]
        public int Id { get; set; }
        public string ClientId { get; set; } = string.Empty;
        public int SubjectId { get; set; }
        public string Type { get; set; } = string.Empty; // "W", "ĆW", "L", "PS", ...
        public int GroupNumber { get; set; }

        public Subject Subject { get; set; } = null!;
    }
}
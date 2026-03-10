using System.ComponentModel.DataAnnotations;

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
        public int Id { get; set; } // Automatyczne ID dla naszej bazy
        
        public int DayOfWeek { get; set; } // np. 1 = poniedziałek
        public int StartHourId { get; set; } 
        public int DurationSlots { get; set; } 
        public int WeekType { get; set; } // 0, 1, 2 (np. parzyste/nieparzyste)
        
        public int TeacherId { get; set; }
        public int RoomId { get; set; }
        public int SubjectId { get; set; }
        public int StudyCourseId { get; set; }
        public int SpecialtyId { get; set; }
        
        public string Type { get; set; } = string.Empty; // np. W, Ćw, L
        public int GroupNumber { get; set; }
        public int Semester { get; set; }

        // Relacje (aby EF Core sam dociągał dane z innych tabel)
        public Teacher Teacher { get; set; } = null!;
        public Room Room { get; set; } = null!;
        public Subject Subject { get; set; } = null!;
        public StudyCourse StudyCourse { get; set; } = null!;
        public Specialty Specialty { get; set; } = null!;
    }
}
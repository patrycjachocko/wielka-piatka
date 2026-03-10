namespace wielkapiatka.Models.Frontend
{
    public class TimeSlot
    {
        public string Id { get; set; } = string.Empty;
        public string Label { get; set; } = string.Empty;
        public SlotGroup SlotGroup { get; set; }
        public string Start { get; set; } = string.Empty;
        public string End { get; set; } = string.Empty;
    }

    public class ScheduleEvent
    {
        public string Id { get; set; } = string.Empty;
        public string LeafId { get; set; } = string.Empty;
        public DayKey Day { get; set; }
        public string SlotId { get; set; } = string.Empty;
        public string Subject { get; set; } = string.Empty;
        public string Room { get; set; } = string.Empty;
        public string Lecturer { get; set; } = string.Empty;
        public string? GroupLabel { get; set; }
    }
}
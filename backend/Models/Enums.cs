using System.Text.Json.Serialization;

namespace wielkapiatka.Models
{
    [JsonConverter(typeof(JsonStringEnumConverter))]
    public enum AudienceKind { student, teacher }

    [JsonConverter(typeof(JsonStringEnumConverter))]
    public enum StudyMode { full_time, part_time }

    [JsonConverter(typeof(JsonStringEnumConverter))]
    public enum DayKey { monday, tuesday, wednesday, thursday, friday, saturday, sunday }

    [JsonConverter(typeof(JsonStringEnumConverter))]
    public enum SlotGroup { weekday, weekend }
}
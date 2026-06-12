namespace TimetableApp.Contracts.Messaging;

public sealed class RabbitMqHttpOptions
{
    public string ManagementBaseUrl { get; set; } = "http://localhost:15672";
    public string UserName { get; set; } = "guest";
    public string Password { get; set; } = "guest";
    public string VHost { get; set; } = "/";
    public string Exchange { get; set; } = "timetable.events";
}

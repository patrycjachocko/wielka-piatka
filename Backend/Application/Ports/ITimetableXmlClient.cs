namespace TimetableApp.Application.Ports;

public interface ITimetableXmlClient
{
    Task<string> FetchXmlAsync(CancellationToken ct = default);
}

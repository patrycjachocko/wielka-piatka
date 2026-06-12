using TimetableApp.Application.Ports;

namespace TimetableApp.Infrastructure.External;

public class DegraTimetableXmlClient : ITimetableXmlClient
{
    private const string ApiUrl = "https://degra.wi.pb.edu.pl/rozklady/webservices.php";

    private readonly HttpClient _httpClient;

    public DegraTimetableXmlClient(HttpClient httpClient)
    {
        _httpClient = httpClient;
    }

    public async Task<string> FetchXmlAsync(CancellationToken ct = default)
    {
        var response = await _httpClient.GetAsync(ApiUrl, ct);
        response.EnsureSuccessStatusCode();
        return await response.Content.ReadAsStringAsync(ct);
    }
}

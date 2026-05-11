using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;

namespace TimetableApp.Endpoints 
{
    public static class VulnerableEndpoints
    {
        public static void MapVulnerableEndpoints(this IEndpointRouteBuilder app)
        {
            var group = app.MapGroup("/api/vulnerable");

            group.MapGet("/search", (string? searchQuery) =>
            {
                var query = searchQuery ?? string.Empty;

                var html = $"""
                    <html>
                    <head><title>Wyniki Wyszukiwania</title></head>
                    <body>
                        <h1>Wyniki Wyszukiwania</h1>
                        <p>Wyszukiwana fraza: {query}</p>
                    </body>
                    </html>
                    """;

                return Results.Text(html, "text/html");
            });
        }
    }
}
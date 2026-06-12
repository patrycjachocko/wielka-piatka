FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

COPY Microservices/Contracts/TimetableApp.Contracts.csproj Microservices/Contracts/
COPY Microservices/PlansService/PlansService.csproj Microservices/PlansService/
RUN dotnet restore Microservices/PlansService/PlansService.csproj

COPY Microservices/Contracts/ Microservices/Contracts/
COPY Microservices/PlansService/ Microservices/PlansService/
RUN dotnet publish Microservices/PlansService/PlansService.csproj -c Release -o /app/publish --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
COPY --from=build /app/publish .
EXPOSE 8080
ENTRYPOINT ["dotnet", "PlansService.dll"]

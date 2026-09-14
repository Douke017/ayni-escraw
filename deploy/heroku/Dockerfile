# Stage 1: Build Angular Frontend
FROM node:22-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install --legacy-peer-deps
COPY frontend/ ./
RUN npm run build

# Stage 2: Build .NET 9 API
FROM mcr.microsoft.com/dotnet/sdk:9.0 AS dotnet-build
WORKDIR /src
COPY backend/Directory.Build.props backend/
COPY backend/Ayni.sln backend/
COPY backend/src/Ayni.Core/Ayni.Core.csproj backend/src/Ayni.Core/
COPY backend/src/Ayni.Infrastructure/Ayni.Infrastructure.csproj backend/src/Ayni.Infrastructure/
COPY backend/src/Ayni.Api/Ayni.Api.csproj backend/src/Ayni.Api/
RUN dotnet restore backend/src/Ayni.Api/Ayni.Api.csproj
COPY backend/src/ backend/src/
RUN dotnet publish backend/src/Ayni.Api/Ayni.Api.csproj -c Release -o /app/publish /p:UseAppHost=false

# Stage 3: Runtime image (.NET 9 + Python 3 + AI Agents + Angular SPA)
FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS final
WORKDIR /app

# Install Python 3, pip, venv, curl
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    python3-venv \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Set up AI Agents virtual environment
WORKDIR /app/ai-agents
COPY ai-agents/requirements.txt .
RUN python3 -m venv .venv && \
    .venv/bin/pip install --no-cache-dir -r requirements.txt
COPY ai-agents/ .

# Copy published .NET application and Angular SPA
WORKDIR /app
COPY --from=dotnet-build /app/publish .
COPY --from=frontend-build /app/frontend/dist/frontend/browser ./wwwroot

# Create uploads directory for fallback storage
RUN mkdir -p ./wwwroot/uploads

# Environment variables
ENV ASPNETCORE_ENVIRONMENT=Production \
    PYTHON_PATH=/app/ai-agents/.venv/bin/python3 \
    AI_AGENTS_RUNNER_PATH=/app/ai-agents/runner.py

EXPOSE 5000

CMD ["dotnet", "Ayni.Api.dll"]

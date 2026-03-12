# What-If Analysis Tool

A full-stack application for performing what-if scenario analysis using Google OR-Tools CP-SAT solver with LLM-generated optimization configurations.

## Overview

This tool allows users to:
- Upload CSV data as input for scenarios
- Configure scenario parameters and variables
- Define formulas and constraints for optimization
- Create and run multiple scenarios with different parameters
- View optimization results and impact analysis

The application uses an LLM to translate user-defined formulas and constraints into a structured optimization configuration, which is then executed deterministically using Google's OR-Tools CP-SAT solver.

## Tech Stack

**Frontend:**
- Next.js 16.1 with App Router
- React 19.2 with TypeScript
- Tailwind CSS v4 with glassmorphism design
- Lucide React for icons

**Backend:**
- FastAPI with Python 3.12
- Pydantic for data validation
- LangGraph for workflow orchestration
- LangChain for LLM integration
- Google OR-Tools CP-SAT for constraint solving
- Pandas for data manipulation

## Quick Start

### Prerequisites

**Option A: Docker (Recommended)**
- Docker and Docker Compose installed
- A local or remote LLM endpoint (OpenAI-compatible) running on the host

**Option B: Local Development**
- Node.js 20+ and npm (for frontend)
- Python 3.12 and pip (for backend)
- A local or remote LLM endpoint (OpenAI-compatible)

---

## Docker Setup (Recommended)

The Docker setup uses a **LiteLLM sidecar pattern** to connect to an LLM server running on the host machine.

### Architecture

```
+-------------------+     +-------------------+     +-------------------+
|   Frontend        | <-- |   Backend         | <-- |   LiteLLM Sidecar |
|   (Next.js:3000)  |     |   (FastAPI:8000)  |     |   (:4000)         |
+-------------------+     +-------------------+     +-------------------+
                                                        |
                                                        | HTTP
                                                        v
                                         +--------------------------+
                                         |  Host LLM Server        |
                                         |  (host.docker.internal) |
                                         +--------------------------+
```

### 1. Configure Environment Variables

Copy and customize the Docker environment file:

```bash
cp .env.docker .env
```

Edit `.env` to match your LLM server configuration:

```bash
# Model name referenced by backend
LLM_MODEL_NAME=qwen-30b

# Model path on host LLM server (e.g., vLLM)
LLM_MODEL_PATH=openai//models/Qwen/Qwen3-30B-A3B-Instruct-FP8

# API base URL of LLM server running on host
LLM_API_BASE=http://host.docker.internal:8000/v1

# API key (can be dummy-key for local servers)
OPENAI_API_KEY=sk-dummy-token
```

### 2. Build and Run

```bash
# Build all services
docker-compose build

# Start all services
docker-compose up -d

# View logs
docker-compose logs -f
```

The application will be available at `http://localhost:3000`

### 3. Docker Services

| Service | Description | Ports |
|---------|-------------|-------|
| `frontend` | Next.js application | `3000:3000` |
| `backend` | FastAPI with CP-SAT | - |
| `litellm` | LiteLLM sidecar proxy | - |

### 4. Common Docker Commands

```bash
# Stop all services
docker-compose down

# Rebuild a specific service
docker-compose build backend
docker-compose up -d backend

# View logs for specific service
docker-compose logs -f backend

# Access backend debug volume (CP-SAT configs)
docker-compose exec backend ls -la /tmp/what-if-cpsat-debug/

# Clean up volumes
docker-compose down -v
```

### 5. Troubleshooting Docker

**LiteLLM cannot connect to host LLM:**
- Ensure host's LLM server is running on the configured port (default 8000)
- On Linux, you may need to use `--add-host=host.docker.internal:host-gateway` in docker-compose

**Frontend cannot reach backend:**
- Ensure services are on the same Docker network (`what-if-network`)
- Check backend logs: `docker-compose logs backend`

**Build errors:**
- Clear Docker cache: `docker-compose build --no-cache`

---

## Local Development Setup

### Backend Setup

```bash
cd backend

# Install dependencies
pip install -r requirements.txt

# Create .env file from example
cp .env.example .env

# Edit .env with your LLM configuration
nano .env

# Start development server
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

The backend will be available at `http://localhost:8000`

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

The frontend will be available at `http://localhost:3000`

### Access the Application

Open `http://localhost:3000` in your browser to start using the What-If Analysis Tool.

## Configuration

### LLM Configuration

The backend uses an OpenAI-compatible LLM endpoint. Configure it in `backend/.env`:

```bash
# Local vLLM example
OPENAI_BASE_URL=http://localhost:8000/v1
OPENAI_MODEL=llama-3-70b-instruct

# OpenAI API example
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o
OPENAI_API_KEY=sk-your-api-key

# Anthropic (requires LLM_TYPE=anthropic)
ANTHROPIC_API_KEY=sk-ant-your-key
LLM_TYPE=anthropic
```

### Debug Directory

Generated optimization configurations are saved to `/tmp/what-if-cpsat-debug` by default. Override with:

```bash
export CPSAT_DEBUG_DIR=/path/to/debug/dir
```

## Architecture

The application follows a three-pane layout design:

1. **Control Center (Left)** - Configure parameters, variables, formulas, constraints, and objectives
2. **Manipulation Grid (Center)** - Create and manage scenarios with parameter overrides
3. **Impact Viewer (Right)** - View optimization results and activity logs

### Backend Workflow

1. User runs a scenario from the frontend
2. Backend receives configuration and CSV data via API
3. LLM translates user formulas into structured `CPSatConfig` JSON
4. `CPSatService` executes the config deterministically using OR-Tools
5. Results are returned to the frontend for display

### Key Components

- **LLMService** - Generates structured optimization configs using LangChain
- **CPSatService** - Executes configs with OR-Tools CP-SAT solver
- **LangGraph Workflow** - Orchestrates generation and execution with retry logic

## Development

### Frontend Commands

```bash
npm run dev      # Start development server
npm run build    # Build for production
npm start        # Start production server
npm run lint     # Run linter
```

### Backend Commands

```bash
# Development server with auto-reload
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# Production server
python -m uvicorn main:app --host 0.0.0.0 --port 8000
```

### Project Structure

```
what-if-optimization/
├── docker-compose.yml          # Docker Compose configuration
├── litellm_config.yaml         # LiteLLM sidecar configuration
├── .env.docker                 # Docker environment template
├── frontend/                   # Next.js frontend application
│   ├── Dockerfile             # Frontend Dockerfile
│   ├── .dockerignore          # Frontend Docker ignore patterns
│   ├── app/
│   │   ├── components/        # React components
│   │   ├── lib/              # Utilities and constants
│   │   └── types/            # TypeScript types
└── backend/                   # FastAPI backend application
    ├── Dockerfile            # Backend Dockerfile
    ├── .dockerignore         # Backend Docker ignore patterns
    ├── api/                  # API endpoints
    ├── services/             # Business logic
    ├── models.py             # Pydantic models
    └── main.py              # FastAPI entry point
```

## API Endpoints

### `POST /api/run_scenario`
Main endpoint for running scenario optimization using CP-SAT.

### `POST /api/run_scenario_legacy`
Legacy endpoint using formula evaluation (for backward compatibility).

### `GET /api/health`
Health check endpoint.

## Debugging

When optimizations fail:

1. Check `CPSAT_DEBUG_DIR` (default: `/tmp/what-if-cpsat-debug`)
2. Review `cpsat_generated_config_*.json` files
3. Check `cpsat_error_context_*.txt` for error messages
4. Review backend logs for detailed workflow traces

## License

[Add your license here]

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

For `docker-compose`, you usually only need to provide environment variables that the containers read:

```bash
# In the repo root (or export these in your shell)
export OPENAI_API_KEY=${OPENAI_API_KEY:-sk-dummy-token}

# Optional: the backend uses this when calling the OpenAI-compatible API.
# If your LiteLLM reports an "unknown model" error, set it to the model id used by the `litellm` service
# (see `docker-compose.yml`).
export LLM_MODEL_NAME=${LLM_MODEL_NAME:-openai//models/Qwen/Qwen3-30B-A3B-Instruct-FP8}
```

Your host LLM server must be reachable at `http://host.docker.internal:8000/v1` (this is hard-coded in `docker-compose.yml` via the LiteLLM sidecar command).

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

The backend API will be available at `http://localhost:8080/api`

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

### Formula Syntax

When writing formulas in the UI, use the following syntax:

- `{VariableName}` for decision variables and scenario parameters
  - Examples: `{staff_count}`, `{resource_pool_cost}`, `{type_ratio}`
- `(ColumnName)` for CSV column constants
  - Examples: `(cost_rate_per_resource)`, `(country)`

Examples:

- `{staff_count} * (cost_rate_per_resource)`
- `{revenue} - {cost}`
- `{units} * 12.5`

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

Generated optimization configurations are saved to the directory configured by `CPSAT_DEBUG_DIR` (see `backend/.env`). Override with:

```bash
export CPSAT_DEBUG_DIR=/path/to/debug/dir
```

## Use Case Example (Playwright E2E)

This is the same end-to-end configuration created by `tests/example.spec.ts` and optimized by the real backend (CP-SAT via `POST /api/run_scenario`). The screenshots below are generated by the same test.

### Input CSV (`sample_data.csv`)

`sample_data.csv` contains 30 rows (15 `country` x 2 `resource_type` values). The CP-SAT model uses:

- `country`: `group_by` dimension for portfolio variables like `staff_per_region` and `regional_cost`
- `resource_type`: used to filter `staff_senior_total` vs `staff_junior_total` (Senior vs Junior)
- `cost_rate_per_resource`: constant coefficient used to compute row cost: `{staff_count} * (cost_rate_per_resource)`

### Variables (what the solver optimizes)

- Scenario parameter: `type_ratio` (the test runs scenarios `0.2` through `0.7`)
- Row input decision variables: one `staff_count[i]` per CSV row (bounds set in the UI to `min=1`, `max=100`)
- Row intermediate: `resource_pool_cost[i] = staff_count[i] * cost_rate_per_resource[i]`
- Portfolio intermediates (aggregations across rows): `staff_per_region[country] = sum(staff_count)` grouped by `country`
- Portfolio intermediates (aggregations across rows): `staff_senior_total = sum(staff_count)` where `resource_type == "Senior"`
- Portfolio intermediates (aggregations across rows): `staff_junior_total = sum(staff_count)` where `resource_type == "Junior"`
- Portfolio intermediates (aggregations across rows): `regional_cost[country] = sum(resource_pool_cost)` grouped by `country`
- Portfolio intermediates (aggregations across rows): `total_staff_count = sum(staff_count)` (all rows)
- Portfolio intermediates (aggregations across rows): `total_cost = sum(resource_pool_cost)` (all rows)

### Generated `CPSatConfig` (representative shape)

For `type_ratio = 0.2`, the generated structured config has (abridged):

```json
{
  "row_inputs": [
    { "name_prefix": "staff_count", "min_value": 1.0, "max_value": 100.0 }
  ],
  "row_intermediates": [
    {
      "name_prefix": "resource_pool_cost",
      "terms": [
        { "term_type": "row_input", "name_or_value": "staff_count", "coefficient": "cost_rate_per_resource" }
      ]
    }
  ],
  "portfolio_variables": [
    { "portfolio_name": "staff_per_region", "group_by_columns": ["country"], "aggregate_function": "sum", "source_row_variable": "staff_count" },
    { "portfolio_name": "staff_senior_total", "group_by_columns": [], "aggregate_function": "sum", "source_row_variable": "staff_count", "if_condition": { "enabled": true, "column": "resource_type", "operator": "==", "value": "Senior" } },
    { "portfolio_name": "staff_junior_total", "group_by_columns": [], "aggregate_function": "sum", "source_row_variable": "staff_count", "if_condition": { "enabled": true, "column": "resource_type", "operator": "==", "value": "Junior" } },
    { "portfolio_name": "regional_cost", "group_by_columns": ["country"], "aggregate_function": "sum", "source_row_variable": "resource_pool_cost" },
    { "portfolio_name": "total_staff_count", "group_by_columns": [], "aggregate_function": "sum", "source_row_variable": "staff_count" },
    { "portfolio_name": "total_cost", "group_by_columns": [], "aggregate_function": "sum", "source_row_variable": "resource_pool_cost" }
  ],
  "constraints": [
    {
      "description": "Percent of staff count per each region to total staff count <= 20%",
      "left_terms": [{ "term_type": "portfolio_var", "name_or_value": "staff_per_region", "coefficient": 1.0 }],
      "operator": "<=",
      "right_terms": [{ "term_type": "portfolio_var", "name_or_value": "total_staff_count", "coefficient": 0.2 }]
    },
    {
      "description": "ratio of number of senior staff to number of junior staff >= type_ratio",
      "left_terms": [{ "term_type": "portfolio_var", "name_or_value": "staff_senior_total", "coefficient": 1.0 }],
      "operator": ">=",
      "right_terms": [{ "term_type": "portfolio_var", "name_or_value": "staff_junior_total", "coefficient": "type_ratio" }]
    }
  ],
  "objective": {
    "direction": "minimize",
    "terms": [{ "term_type": "portfolio_var", "name_or_value": "total_cost", "coefficient": 1.0 }]
  }
}
```

### Final optimized input values (example: `type_ratio = 0.2`)

The solver returns an optimal solution with:

- `Objective Value (min total_cost)`: `7171.32`
- `total_staff_count = 100.00` (enforced by the constraint)
- `staff_by_type[Senior] = 16.67`, `staff_by_type[Junior] = 83.33`

Optimized `staff_count[i]` (one per CSV row, `i=0..29`):

`[2.67, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 17.28, 1.0, 1.0, 1.0, 1.0, 1.0, 7.36, 1.0, 16.16, 1.0, 15.56, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 16.97, 1.0, 1.0]`

### Screenshots from the test run

Line chart (compare scenarios, objective vs `type_ratio`):

![Compare scenario line chart](./test-results/e2e-compare-scenario-line-chart.png)

Bar chart (row-level `staff_count` optimized values):

![Row input bar chart](./test-results/e2e-bar-chart.png)

### Conclusion / Insight

With `total_staff_count` fixed at 100 and all share constraints active (region staff <= 20%, region cost <= 15%), raising `type_ratio` tightens the allowed senior/junior mix. Because the objective is to minimize `total_cost`, the optimal total cost increases as `type_ratio` goes up (from `7171.32` at `0.2` to `8767.76` at `0.7` in the line chart).

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
what-if/
├── docker-compose.yml          # Docker Compose configuration
├── litellm_config.yaml         # LiteLLM sidecar configuration
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

1. Check `CPSAT_DEBUG_DIR` (Docker: `/tmp/what-if-cpsat-debug`; local: whatever is set in `backend/.env`, or otherwise the backend working dir `what-if-cpsat-debug`)
2. Review `cpsat_generated_config_*.json` files
3. Check `cpsat_error_context_*.txt` for error messages
4. Review backend logs for detailed workflow traces

## License

[Add your license here]

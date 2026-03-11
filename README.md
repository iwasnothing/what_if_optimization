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

- Node.js 20+ and npm (for frontend)
- Python 3.12 and pip (for backend)
- A local or remote LLM endpoint (OpenAI-compatible)

### 1. Backend Setup

```bash
cd backend

# Install dependencies
pip install -r requirements.txt

# Create .env file
cat > .env << EOF
OPENAI_BASE_URL=http://localhost:4000/v1
OPENAI_MODEL=Qwen3-30B-A3B-Instruct-FP8
OPENAI_API_KEY=dummy-key
EOF

# Start development server
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

The backend will be available at `http://localhost:8000`

### 2. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

The frontend will be available at `http://localhost:3000`

### 3. Access the Application

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
├── frontend/           # Next.js frontend application
│   ├── app/
│   │   ├── components/  # React components
│   │   ├── lib/        # Utilities and constants
│   │   └── types/      # TypeScript types
└── backend/            # FastAPI backend application
    ├── api/            # API endpoints
    ├── services/       # Business logic
    ├── models.py       # Pydantic models
    └── main.py        # FastAPI entry point
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

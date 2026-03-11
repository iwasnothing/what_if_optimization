# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **What-If Analysis Tool** built as a full-stack application with a Next.js frontend and FastAPI backend. The application allows users to upload CSV data, configure parameters and variables, define formulas and constraints, create scenarios, and perform what-if analysis using Google OR-Tools CP-SAT solver with LLM-generated optimization code.

## Development Commands

### Frontend (`frontend/` directory)
```bash
# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run linter
npm run lint
```

### Backend (`backend/` directory)
```bash
# Install dependencies
pip install -r requirements.txt

# Development server with auto-reload
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# Production server
python -m uvicorn main:app --host 0.0.0.0 --port 8000
```

### Environment Variables

The backend loads environment variables from a `.env` file in the `backend/` directory using `python-dotenv`.

**Setting up .env file:**
1. Copy `backend/.env.example` to `backend/.env`
2. Edit `.env` with your LLM configuration
3. No need to set environment variables manually

**Default Configuration (Local LLM):**
- `OPENAI_API_KEY` - API key (defaults to "dummy-key" for local LLM)
- `OPENAI_BASE_URL` - Base URL for OpenAI-compatible endpoint (default: "http://localhost:11434/v1" for Ollama)
- `OPENAI_MODEL` - Model name to use (default: "llama3")

For Anthropic models:
- `ANTHROPIC_API_KEY` - API key for Anthropic
- `LLM_TYPE` - Set to "openai" or "anthropic" (default: "openai")

**.env Examples:**
```bash
# Default: Local LLM (Ollama with llama3)
OPENAI_BASE_URL=http://localhost:11434/v1
OPENAI_MODEL=llama3
OPENAI_API_KEY=dummy-key

# Local vLLM
OPENAI_BASE_URL=http://localhost:8000/v1
OPENAI_MODEL=llama-3-70b-instruct

# OpenAI API
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o
OPENAI_API_KEY=sk-your-openai-api-key

# Azure OpenAI
OPENAI_BASE_URL=https://your-resource.openai.azure.com/openai/deployments/your-deployment
OPENAI_MODEL=gpt-4
OPENAI_API_KEY=your-azure-key

# Anthropic (uncomment to use)
ANTHROPIC_API_KEY=sk-ant-your-key
LLM_TYPE=anthropic
```

## Architecture

### Tech Stack

**Frontend:**
- **Next.js 16.1** with App Router
- **React 19.2** with TypeScript strict mode
- **Tailwind CSS v4** with glassmorphism design system
- **Lucide React** for icons

**Backend:**
- **FastAPI** with Python 3.12
- **Pydantic** for data validation
- **Uvicorn** as ASGI server
- **LangGraph** for workflow orchestration
- **LangChain** for LLM integration
- **Google OR-Tools CP-SAT** for constraint solving
- **OpenAI GPT-4o** or **Anthropic Claude 3.5 Sonnet** for code generation

### Project Structure
```
what-if/
├── frontend/
│   ├── app/
│   │   ├── components/      # React components organized by feature
│   │   ├── lib/            # Utility functions and constants
│   │   ├── types/          # TypeScript type definitions
│   │   ├── layout.tsx      # Root layout with Geist fonts
│   │   ├── page.tsx        # Main application entry
│   │   └── globals.css     # Global styles and custom scrollbar
│   ├── public/             # Static assets
│   └── package.json
└── backend/
    ├── main.py             # FastAPI application entry
    ├── models.py           # Pydantic models for request/response
    ├── requirements.txt     # Python dependencies
    ├── api/                # API route handlers
    │   └── scenario.py     # Scenario optimization endpoints
    ├── services/           # Business logic layer
    │   ├── optimization.py   # Legacy optimization (formula evaluation)
    │   ├── cpsat_service.py # CP-SAT code verification and execution
    │   ├── llm_service.py  # LLM code generation and fixing
    │   └── langgraph_workflow.py  # Workflow orchestration
    └── debug/              # Auto-saved generated CP-SAT code for debugging
```

### Application Layout (Three-Pane Design)

The main application (`frontend/app/page.tsx`) uses a three-pane layout:

1. **Control Center (Left Pane)** - Four tabs:
   - **Input Tab** (`InputTab.tsx`) - Configure scenario parameters and row-level input variables from CSV columns
   - **Formula Tab** (`FormulaTab.tsx`) - Define row-level and portfolio-level intermediate variables with formulas
   - **Constraint Tab** (`ConstraintTab.tsx`) - Manage constraints
   - **Objective Tab** (`ObjectiveTab.tsx`) - Define optimization objectives

2. **Manipulation Grid (Center Pane)** - `ManipulationGrid.tsx`
   - Displays scenarios with parameter values and input variable overrides
   - Supports inline editing of scenario parameters and input variable overrides
   - "Run Optimization" button for each scenario triggers backend API call
   - Visual indicators for running and completed optimization states

3. **Impact Viewer (Right Pane)** - `ImpactViewer.tsx`
   - Displays optimization results: objective value, variable values
   - Shows activity log with timestamped entries
   - Displays constraint violations if any

### Backend Service Layer Architecture

The backend follows a layered service architecture:

**API Layer (`backend/api/scenario.py`)**:
- `POST /api/run_scenario` - Main endpoint using CP-SAT/LangGraph workflow
- `POST /api/run_scenario_legacy` - Legacy endpoint using formula evaluation (for backward compatibility)
- `GET /api/health` - Health check endpoint

**Services Layer (`backend/services/`)**:

1. **`LLMService`** (`llm_service.py`):
   - `generate_cpsat_code()` - Generates CP-SAT Python code from problem context
   - `fix_cpsat_code()` - Fixes code based on error messages with retry logic
   - Builds detailed prompts with context from scenario, config, and CSV data

2. **`CPSatService`** (`cpsat_service.py`):
   - `verify_cpsat_code()` - Syntax validation and structure checking
   - `execute_cpsat_code()` - Executes code in sandboxed environment
   - Extracts variable values and objective values from solver
   - Automatically saves generated code to `backend/debug/` directory

3. **`OptimizationService`** (`optimization.py`):
   - `evaluate_formula()` - Safe formula evaluation with variable substitution
   - `check_condition()` - Comparison operator evaluation
   - `calculate_portfolio_result()` - Portfolio-level aggregations (sum, min, max)
   - Legacy formula-based optimization (not used in CP-SAT mode)

4. **`run_cpsat_optimization()`** (`langgraph_workflow.py`):
   - Entry point for CP-SAT optimization workflow
   - Initializes and runs LangGraph StateGraph

### LangGraph Workflow

The CP-SAT optimization uses a state machine workflow with retry logic:

**Workflow States**:
- `initialize` - Build context from request data
- `generate` - Generate initial CP-SAT code using LLM
- `verify` - Verify code syntax and structure
- `fix` - Fix invalid code (up to 3 retries)
- `execute` - Run verified code with OR-Tools solver
- `failure` - Handle final failure after all retries

**Conditional Edges**:
- After `verify`: Retry if invalid and retries < 3, otherwise execute or fail
- After `execute`: Return success if solver finds solution, otherwise fail

**Workflow State** (`WorkflowState` TypedDict):
- Input: `config`, `scenario`, `csv_data`, `context`
- Generated code: `generated_code`, `original_code`
- Verification: `is_valid`, `error_message`
- Execution: `execution_result`, `final_variable_values`, `final_objective_value`
- Retry tracking: `retry_count`, `max_retries`

### CP-SAT Code Generation Process

1. **Context Creation** - `create_context_from_request()` builds a dictionary with:
   - Spreadsheet columns and data
   - Scenario parameters and current values
   - Row-level input variables (with min/max ranges)
   - Row-level intermediate variables (with formulas)
   - Portfolio-level variables (with aggregation functions)
   - Constraints and objectives

2. **LLM Prompt Building** - Constructs detailed prompt instructing LLM to:
   - Import OR-Tools CP-SAT
   - Create model and solver
   - Create decision variables for each row
   - Add constraints based on formulas
   - Set objective function
   - Extract and return results

3. **Code Verification** - Checks:
   - Valid Python syntax (AST parsing)
   - Required imports (ortools, cp_model)
   - Model creation (CpModel())
   - Solver creation (CpSolver())
   - Solve() call present

4. **Code Execution** - Runs generated code with:
   - Sandboxed namespace
   - Captured stdout
   - Timeout (default 30s)
   - Variable value extraction
   - Objective value extraction

5. **Debug File Saving** - Automatically saves:
   - `cpsat_executed_*.py` - Code before execution
   - `cpsat_fixed_*.py` - Code after retry fixes
   - `cpsat_error_context_*.txt` - Error messages and original code

### State Management (Frontend)

The frontend uses React's built-in `useState` for local state management. Key state in `frontend/app/page.tsx`:

- `csvData` - Parsed CSV file contents with columns and rows
- `csvFileName` - Name of uploaded CSV file
- `config` - Configuration state containing:
  - `scenarioParameters` - Global parameters for scenarios
  - `rowLevelInputVariables` - Variables mapped to CSV columns
  - `rowLevelIntermediateVariables` - Calculated row-level variables with formulas
  - `portfolioLevelIntermediateVariables` - Aggregated portfolio variables
  - `constraints` - Constraint definitions
  - `objectives` - Optimization objectives
- `logs` - Activity log entries
- `scenarios` - Array of scenario objects with parameter values and overrides

Props flow downward from `page.tsx` to child components, with callbacks bubbling back up.

### Key Data Types (`frontend/app/types/index.ts`)

- `ScenarioParameter` - Global parameter definition (id, name, description, defaultValue)
- `RowLevelInputVariable` - Input variable mapped to CSV column (column, dataType, min, max)
- `RowLevelIntermediateVariable` - Row-level calculated variable with formula
- `PortfolioLevelIntermediateVariable` - Portfolio-level aggregated variable (aggregateFunction, sourceVariables, groupByColumn, ifCondition)
- `Scenario` - Scenario with parameterValues, inputVariableOverrides, optimizationResult
- `OptimizationResult` - Backend API response with objectiveValue, portfolioResults, constraintViolations
- `ConfigState` - Complete application configuration
- `LogEntry` - Activity log entry with id, time, message

### CSV Parsing (`frontend/app/lib/helpers.ts`)

The `parseCSV` function handles:
- Quote-enclosed values
- Escaped quotes (`""`)
- Type conversion (numbers vs strings)
- Returns `{ columns, rows }` structure

### Glassmorphism Design System (`frontend/app/lib/constants.ts`)

Shared Tailwind classes for consistent glassmorphism styling:
- `glassPanel` - Main panel container with blur and border
- `glassInput` - Input fields with dark background
- `glassButton` - Button styling with hover effects

All components use these classes for visual consistency.

### Client-Server Communication

**Scenario Optimization Flow:**
1. Frontend: User clicks "Run Optimization" on a scenario
2. Frontend: Calls `POST http://localhost:8000/api/run_scenario` with:
   - `config`: Full configuration from all tabs
   - `scenario`: Scenario with parameterValues and inputVariableOverrides
   - `csvData`: Parsed CSV with columns and rows
3. Backend API route (`scenario.py`) logs all request attributes
4. Backend: Calls `run_cpsat_optimization()` workflow:
   - Initializes `LLMService` and `CPSatService`
   - Builds context dictionary from request data
   - Runs LangGraph workflow (generate → verify → fix → execute)
   - On each retry, LLM fixes code based on error messages
   - Code automatically saved to `backend/debug/`
5. Backend: Returns `OptimizationResult` with:
   - `objectiveValue` - From CP-SAT solver
   - `portfolioResults` - Variable values mapped for compatibility
   - `constraintViolations` - Empty list (CP-SAT handles constraints internally)
6. Frontend: Updates scenario state with results and logs completion

**CORS:** Backend is configured to allow requests from `http://localhost:3000` and `http://localhost:3001`.

### Formula Evaluation

Formulas use `[VariableName]` syntax for variable references:
- Row-level intermediate variables can reference scenario parameters and row-level input variables
- Portfolio-level variables aggregate row-level intermediate variables
- Only basic arithmetic operations are supported (addition, subtraction, multiplication, division)

Example: `[Revenue] - [Cost]` would calculate profit.

**Note:** The CP-SAT mode converts formulas to CP-SAT constraints, not formula evaluation. Formula evaluation is only used in legacy mode (`/api/run_scenario_legacy`).

## Debugging CP-SAT Issues

When CP-SAT optimization fails:

1. Check `backend/debug/` directory for generated code files
2. Look at most recent `cpsat_executed_*.py` or `cpsat_fixed_*.py`
3. Review `cpsat_error_context_*.txt` for error messages
4. Check backend logs for detailed workflow trace
5. Common issues:
   - Invalid CP-SAT API usage
   - Incorrect variable bounds
   - Incompatible constraint definitions
   - Missing or incorrect objective function

## Important Notes

- **Backend required**: The frontend calls backend API at `http://localhost:8000/api/run_scenario`. The backend must be running for optimizations to work.
- **Type safety**: Strict TypeScript in frontend, Pydantic models in backend ensure type consistency across the API boundary.
- **Glassmorphism**: All panels use `glassPanel` class from `lib/constants.ts`. Custom scrollbar is defined in `globals.css` with `.custom-scrollbar` class.
- **Icons**: Use `lucide-react` for all icons.
- **Responsive layout**: All panels use `flex-1` for responsive layout; avoid fixed heights unless necessary.
- **Formula safety**: Backend uses `eval()` with restricted builtins for formula evaluation (legacy mode only) - only safe expressions are allowed.
- **Logging**: Backend includes comprehensive logging of all workflow stages, request attributes, and optimization results.
- **Debug files**: All generated CP-SAT code is automatically saved to `backend/debug/` for debugging purposes. Old files can be safely deleted.

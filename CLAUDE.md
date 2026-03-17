# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **What-If Analysis Tool** built as a full-stack application with a Next.js frontend and FastAPI backend. The application allows users to upload CSV data, configure parameters and variables, define formulas and constraints, create scenarios, and perform what-if analysis using Google OR-Tools CP-SAT solver with an LLM-generated structured optimization configuration.

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
1. Create `backend/.env`
2. Edit `.env` with your LLM configuration
3. No need to set environment variables manually

**Default Configuration (Local LLM):**
- `OPENAI_API_KEY` - API key (defaults to "dummy-key" for local LLM)
- `OPENAI_BASE_URL` - Base URL for OpenAI-compatible endpoint (default: "http://localhost:4000/v1")
- `OPENAI_MODEL` - Model name to use (default: "Qwen3-30B-A3B-Instruct-FP8")
- `CPSAT_DEBUG_DIR` - Directory for debug files (default: `/tmp/what-if-cpsat-debug`)

**.env Examples:**
```bash
# Default: Local LLM (port 4000)
OPENAI_BASE_URL=http://localhost:4000/v1
OPENAI_MODEL=Qwen3-30B-A3B-Instruct-FP8
OPENAI_API_KEY=dummy-key

# Local vLLM
OPENAI_BASE_URL=http://localhost:8000/v1
OPENAI_MODEL=llama-3-70b-instruct

# OpenAI API
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o
OPENAI_API_KEY=sk-your-openai-api-key
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
- **LangChain** for LLM integration with structured output
- **Google OR-Tools CP-SAT** for constraint solving
- **Pandas** for DataFrame operations

### Project Structure
```
what-if/
├── frontend/
│   ├── app/
│   │   ├── components/      # React components organized by feature
│   │   ├── lib/            # Utility functions and constants
│   │   ├── types/          # TypeScript type definitions
│   │   ├── layout.tsx      # Root layout
│   │   ├── page.tsx        # Main application entry
│   │   └── globals.css     # Global styles
│   └── package.json
└── backend/
    ├── main.py             # FastAPI application entry (with LangChain patch)
    ├── models.py           # Pydantic models including CPSatConfig
    ├── requirements.txt     # Python dependencies
    ├── api/
    │   └── scenario.py     # Scenario optimization endpoints
    ├── services/
    │   ├── optimization.py       # Legacy optimization (formula evaluation)
    │   ├── cpsat_service.py     # CP-SAT config execution (deterministic)
    │   ├── llm_service.py       # LLM generates structured CPSatConfig
    │   └── langgraph_workflow.py # Workflow orchestration
    └── debug/              # Auto-saved generated configs (default: /tmp/what-if-cpsat-debug)
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

The backend follows a layered service architecture with a **structured config approach** (not code generation):

**API Layer (`backend/api/scenario.py`)**:
- `POST /api/run_scenario` - Main endpoint using CP-SAT/LangGraph workflow
- `POST /api/run_scenario_legacy` - Legacy endpoint using formula evaluation
- `GET /api/health` - Health check endpoint

**Services Layer (`backend/services/`)**:

1. **`LLMService`** (`llm_service.py`):
   - `generate_cpsat_config()` - Generates structured `CPSatConfig` JSON from problem context using LangChain's structured output
   - Builds detailed prompts with context from scenario, config, and CSV data
   - Returns a Pydantic `CPSatConfig` object, not executable code

2. **`CPSatService`** (`cpsat_service.py`):
   - `execute_cpsat_config()` - Executes structured config deterministically (no code generation/verification)
   - Creates CP-SAT model, solver, variables, constraints, and objective from config
   - Handles floating-point values with scaling (SCALE = 100)
   - Automatically saves generated config to `CPSAT_DEBUG_DIR` directory

3. **`OptimizationService`** (`optimization.py`):
   - `evaluate_formula()` - Safe formula evaluation with variable substitution
   - `check_condition()` - Comparison operator evaluation
   - `calculate_portfolio_result()` - Portfolio-level aggregations (sum, min, max)
   - Legacy formula-based optimization (not used in CP-SAT mode)

4. **`run_cpsat_optimization()`** (`langgraph_workflow.py`):
   - Entry point for CP-SAT optimization workflow
   - Initializes and runs LangGraph StateGraph

### LangGraph Workflow

The CP-SAT optimization uses a simple state machine workflow:

**Workflow States**:
- `initialize` - Build context from request data
- `generate` - Generate structured `CPSatConfig` using LLM (retries up to 3 times on error)
- `execute` - Run config deterministically with OR-Tools solver
- `failure` - Handle final failure after all retries

**Conditional Edges**:
- After `generate`: Execute if success, retry if failed and retries < 3, otherwise fail
- After `execute`: Return success if solver finds solution, otherwise fail

**Workflow State** (`WorkflowState` TypedDict):
- Input: `config`, `scenario`, `csv_data`, `context`
- Generated config: `generated_config` (CPSatConfig), `is_valid`, `error_message`
- Execution: `execution_result`, `final_variable_values`, `final_objective_value`
- Retry tracking: `retry_count`, `max_retries`

### CP-SAT Config Generation Process

1. **Context Creation** - `create_context_from_request()` builds a dictionary with:
   - Spreadsheet columns and data
   - Scenario parameters and current values
   - Row-level input variables (with min/max ranges)
   - Row-level intermediate variables (with formulas)
   - Portfolio-level variables (with aggregation functions)
   - Constraints and objectives

2. **LLM Prompt Building** - Constructs prompt instructing LLM to:
   - Translate formulas into linear `Term` objects (sum of [variable/column/parameter * coefficient])
   - NOT attempt to scale floats in the JSON (backend handles scaling)
   - Map `[name]` tags from user formulas to correct `term_type`

3. **Structured Output** - Uses LangChain's `with_structured_output(CPSatConfig)` for type-safe generation

4. **Config Execution** - Runs generated config with:
   - Pandas DataFrame for CSV data
   - CP-SAT model and solver creation
   - Decision variables for each row (with scaling factor of 100)
   - Constraints built from `Term` objects
   - Objective function built from `Term` objects
   - Timeout (default 30s)

5. **Debug File Saving** - Automatically saves:
   - `cpsat_generated_config_*.json` - Structured config before execution
   - `cpsat_error_context_*.txt` - Error messages

### Important Backend Details

**LangChain Module Patch** (`main.py`):
- The app patches the `langchain` module to work around a `langchain.verbose` attribute issue
- LangSmith tracing is disabled to avoid unauthorized upload attempts

**Floating-Point Scaling** (`cpsat_service.py`):
- CP-SAT only supports integers, so all floating-point values are scaled by 100 (SCALE constant)
- Objective values are divided by SCALE before returning to frontend
- Variable values are divided by SCALE when collected

**Constraint Scopes** (`cpsat_service.py`):
- Constraints are classified by scope: `row`, `portfolio`, `global`, or `mixed`
- Mixed constraints (row + portfolio terms) are not allowed and will raise an error

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

### CP-SAT Data Models (`backend/models.py`)

The `CPSatConfig` Pydantic model defines the structured JSON schema:

- `CPSatRowInputVariable` - Row-level input variable with name_prefix, min_value, max_value
- `CPSatRowIntermediateVariable` - Row-level intermediate with name_prefix and list of `Term` objects
- `CPSatPortfolioVariable` - Portfolio variable with portfolio_name, group_by_columns, aggregate_function, source_row_variable
- `CPSatConstraint` - Constraint with description, left_terms, operator, right_terms (all as `Term` lists)
- `CPSatObjective` - Objective with direction ("maximize"/"minimize") and list of `Term` objects
- `Term` - Atomic term with term_type, name_or_value, coefficient

Term types: `"row_input"`, `"row_intermediate"`, `"portfolio_var"`, `"column"`, `"parameter"`, `"constant"`

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
   - Runs LangGraph workflow (initialize → generate_config → execute)
   - LLM generates structured `CPSatConfig` JSON
   - `CPSatService` executes config deterministically
   - Config automatically saved to `CPSAT_DEBUG_DIR`
5. Backend: Returns `OptimizationResult` with:
   - `objectiveValue` - From CP-SAT solver (scaled down by 100)
   - `portfolioResults` - Variable values mapped for compatibility
   - `constraintViolations` - Empty list (CP-SAT handles constraints internally)
6. Frontend: Updates scenario state with results and logs completion

**CORS:** Backend is configured to allow requests from `http://localhost:3000` and `http://localhost:3001`.

### Formula Syntax

Formulas use two distinct syntax patterns:

**Decision Variables:** `{VariableName}`
- These are CP-SAT decision variables that can change during optimization
- Enclosed in curly braces: `{staff_count}`, `{units}`, `{profit}`
- Can be: row-level input variables, row-level intermediate variables, scenario parameters, or portfolio variables

**DataFrame Constants:** `(ColumnName)`
- These are fixed values from the uploaded CSV data
- Enclosed in parentheses: `(price_per_unit)`, `(quantity)`, `(cost_rate)`
- Treated as constant coefficients when multiplied with variables
- Example: `{staff_count} * (cost_rate)` becomes a variable with a column-specific coefficient

**Formula Translation:**
- Row-level intermediate variables can reference scenario parameters and row-level input variables
- Portfolio-level variables aggregate row-level intermediate variables
- Only basic arithmetic operations are supported (addition, subtraction, multiplication, division)
- The LLM translates formulas into linear `Term` objects for CP-SAT

Examples:
- `{Revenue} - {Cost}` → profit calculation
- `{staff_count} * (hourly_rate)` → cost with per-row coefficient
- `{quantity} * {price_per_unit} + {shipping_cost}` → total cost
- `{units} * 12.50` → variable with numeric coefficient

**Note:** The CP-SAT mode converts formulas to structured `Term` objects in `CPSatConfig`, not formula evaluation. Formula evaluation is only used in legacy mode (`/api/run_scenario_legacy`).

## Debugging CP-SAT Issues

When CP-SAT optimization fails:

1. Check `CPSAT_DEBUG_DIR` (default: `/tmp/what-if-cpsat-debug`) for generated config files
2. Look at most recent `cpsat_generated_config_*.json`
3. Review `cpsat_error_context_*.txt` for error messages
4. Check backend logs for detailed workflow trace
5. Common issues:
   - Invalid term_type mapping in generated config
   - Incorrect variable bounds
   - Mixed constraint scopes (row + portfolio terms)
   - Incompatible constraint definitions
   - Missing or incorrect objective function

## Important Notes

- **Backend required**: The frontend calls backend API at `http://localhost:8000/api/run_scenario`. The backend must be running for optimizations to work.
- **Type safety**: Strict TypeScript in frontend, Pydantic models in backend ensure type consistency across the API boundary.
- **LangChain patch**: The backend patches the `langchain` module to work around a module issue - this is intentional.
- **LangSmith disabled**: LangSmith tracing is disabled to avoid unauthorized upload attempts.
- **Floating-point scaling**: All floating-point values are scaled by 100 (SCALE) for CP-SAT, then divided when returning results.
- **Constraint scope validation**: Mixed row/portfolio constraints are not allowed and will raise an error.
- **Icons**: Use `lucide-react` for all icons.
- **Responsive layout**: All panels use `flex-1` for responsive layout; avoid fixed heights unless necessary.
- **Formula safety**: Backend uses `eval()` with restricted builtins for formula evaluation (legacy mode only) - only safe expressions are allowed.
- **Logging**: Backend includes comprehensive logging of all workflow stages, request attributes, and optimization results.
- **Debug files**: All generated CP-SAT configs are automatically saved to `CPSAT_DEBUG_DIR` for debugging purposes. Old files can be safely deleted.

# What-If Analysis Backend

FastAPI backend for the What-If Analysis Tool.

## Installation

```bash
pip install -r requirements.txt
```

## Running the Server

### Development mode with auto-reload:
```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### Production mode:
```bash
python -m uvicorn main:app --host 0.0.0.0 --port 8000
```

Or use the provided startup script:
```bash
./start.sh
```

## API Endpoints

### `GET /`
Health check endpoint.

### `GET /health`
Health check endpoint.

### `POST /run_scenario`
Run a scenario optimization.

**Request Body:**
```json
{
  "config": {
    "scenarioParameters": [...],
    "rowLevelInputVariables": [...],
    "rowLevelIntermediateVariables": [...],
    "portfolioLevelIntermediateVariables": [...],
    "constraints": [...],
    "objectives": [...]
  },
  "scenario": {
    "id": 123,
    "name": "Scenario 1",
    "parameterValues": {"Param1": 100},
    "inputVariableOverrides": {"Var1": 50}
  },
  "csvData": {
    "columns": ["col1", "col2"],
    "rows": [{"data": {"col1": "value1", "col2": "value2"}}]
  }
}
```

**Response:**
```json
{
  "objectiveValue": 150.0,
  "portfolioResults": [
    {"variableName": "TotalRevenue", "value": 5000.0}
  ],
  "constraintViolations": []
}
```

## Development

The API includes CORS support for the frontend running on `http://localhost:3000` or `http://localhost:3001`.

# API router for scenario endpoints

import json
import logging
from fastapi import APIRouter, HTTPException

from models import (
    RunScenarioRequest,
    OptimizationResult,
)
from services.optimization import OptimizationService
from services.langgraph_workflow import run_cpsat_optimization

router = APIRouter(prefix="/api", tags=["scenarios"])
logger = logging.getLogger(__name__)


@router.post("/run_scenario_legacy", response_model=OptimizationResult)
async def run_scenario_legacy(request: RunScenarioRequest):
    """
    Legacy endpoint - Original optimization without LLM/CP-SAT.

    Kept for backward compatibility and testing.
    """
    try:
        # Log incoming request for verification
        logger.info("=" * 80)
        logger.info("RUN SCENARIO - INCOMING REQUEST (LEGACY MODE)")
        logger.info("=" * 80)

        # Log scenario details
        logger.info(f"Scenario ID: {request.scenario.id}")
        logger.info(f"Scenario Name: {request.scenario.name}")
        logger.info(f"Scenario Parameter Values: {json.dumps(request.scenario.parameterValues, indent=2)}")
        logger.info(f"Input Variable Overrides: {json.dumps(request.scenario.inputVariableOverrides, indent=2)}")

        # Log configuration
        logger.info("\n--- Configuration ---")
        logger.info(f"Scenario Parameters: {len(request.config.scenarioParameters)} items")
        for param in request.config.scenarioParameters:
            logger.info(f"  - {param.name}: {param.description} (default: {param.defaultValue})")

        logger.info(f"Row Level Input Variables: {len(request.config.rowLevelInputVariables)} items")
        for var in request.config.rowLevelInputVariables:
            logger.info(f"  - {var.name}: {var.description} (column: {var.column}, type: {var.dataType})")

        logger.info(f"Row Level Intermediate Variables: {len(request.config.rowLevelIntermediateVariables)} items")
        for var in request.config.rowLevelIntermediateVariables:
            logger.info(f"  - {var.name}: {var.description} (formula: {var.formula})")

        logger.info(f"Portfolio Level Intermediate Variables: {len(request.config.portfolioLevelIntermediateVariables)} items")
        for var in request.config.portfolioLevelIntermediateVariables:
            logger.info(f"  - {var.name}: {var.description} (aggregate: {var.aggregateFunction}, sources: {var.sourceVariables})")

        # Log CSV spreadsheet data
        logger.info("\n--- CSV Spreadsheet Data ---")
        logger.info(f"Columns: {request.csvData.columns}")
        logger.info(f"Total Rows: {len(request.csvData.rows)}")

        # Show first 5 rows for verification
        logger.info("First 5 rows:")
        for i, row in enumerate(request.csvData.rows[:5]):
            logger.info(f"  Row {i+1}: {json.dumps(row.data, indent=4)}")

        if len(request.csvData.rows) > 5:
            logger.info(f"  ... and {len(request.csvData.rows) - 5} more rows")

        logger.info("=" * 80)
        logger.info("RUN SCENARIO - STARTING CALCULATION")
        logger.info("=" * 80)

        # Calculate portfolio-level results
        portfolio_results = OptimizationService.calculate_portfolio_result(
            config=request.config,
            scenario=request.scenario,
            csv_rows=request.csvData.rows,
        )

        # Check constraints
        constraint_violations = OptimizationService.check_constraints(request.config, portfolio_results)

        # Calculate objective
        objective_value = OptimizationService.calculate_objective(request.config, portfolio_results)

        # Log results
        logger.info("\n--- Results ---")
        logger.info(f"Objective Value: {objective_value}")
        logger.info(f"Portfolio Results: {json.dumps([r.dict() for r in portfolio_results], indent=2)}")
        logger.info(f"Constraint Violations: {constraint_violations}")
        logger.info("=" * 80)
        logger.info("RUN SCENARIO COMPLETED SUCCESSFULLY")
        logger.info("=" * 80)

        return OptimizationResult(
            objectiveValue=objective_value,
            portfolioResults=portfolio_results,
            constraintViolations=constraint_violations,
        )

    except Exception as e:
        logger.error("=" * 100)
        logger.error(f"ERROR RUNNING SCENARIO: {e}")
        logger.error("=" * 100)
        logger.error(f"Full error details:", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/run_scenario", response_model=OptimizationResult)
async def run_scenario(request: RunScenarioRequest):
    """
    Run scenario optimization using LLM-generated structured CPSatConfig via LangGraph workflow.

    The endpoint receives:
    - config: All configuration from the left pane (parameters, variables, formulas, constraints, objectives)
    - scenario: The scenario to run with its parameter values and input variable overrides
    - csvData: The spreadsheet data

    Returns:
    - objectiveValue: Calculated objective value from deterministic CP-SAT engine
    - portfolioResults: Flattened solved variables for compatibility
    - constraintViolations: Empty list (for compatibility)
    """
    try:
        # ========================================================================
        # COMPREHENSIVE LOGGING - EVERY ATTRIBUTE
        # ========================================================================
        logger.info("=" * 100)
        logger.info("RUN SCENARIO - INCOMING REQUEST - CP-SAT MODE via LangGraph")
        logger.info("=" * 100)

        # ========================================================================
        # SCENARIO ATTRIBUTES
        # ========================================================================
        logger.info("\n" + "=" * 100)
        logger.info("SCENARIO ATTRIBUTES (ScenarioInput)")
        logger.info("=" * 100)
        logger.info(f"  scenario.id: {request.scenario.id}")
        logger.info(f"  scenario.name: {request.scenario.name}")
        logger.info(f"  scenario.parameterValues: {json.dumps(request.scenario.parameterValues, indent=2)}")
        logger.info(f"  scenario.inputVariableOverrides: {json.dumps(request.scenario.inputVariableOverrides, indent=2)}")

        # ========================================================================
        # CONFIG ATTRIBUTES - SCENARIO PARAMETERS
        # ========================================================================
        logger.info("\n" + "=" * 100)
        logger.info("CONFIG - SCENARIO PARAMETERS")
        logger.info("=" * 100)
        logger.info(f"  Total scenarioParameters: {len(request.config.scenarioParameters)}")
        for idx, param in enumerate(request.config.scenarioParameters, 1):
            logger.info(f"\n  [{idx}] ScenarioParameter:")
            logger.info(f"      id: {param.id}")
            logger.info(f"      name: {param.name}")
            logger.info(f"      description: {param.description}")
            logger.info(f"      defaultValue: {param.defaultValue}")

        # ========================================================================
        # CONFIG ATTRIBUTES - ROW LEVEL INPUT VARIABLES
        # ========================================================================
        logger.info("\n" + "=" * 100)
        logger.info("CONFIG - ROW LEVEL INPUT VARIABLES")
        logger.info("=" * 100)
        logger.info(f"  Total rowLevelInputVariables: {len(request.config.rowLevelInputVariables)}")
        for idx, var in enumerate(request.config.rowLevelInputVariables, 1):
            logger.info(f"\n  [{idx}] RowLevelInputVariable:")
            logger.info(f"      id: {var.id}")
            logger.info(f"      name: {var.name}")
            logger.info(f"      description: {var.description}")
            logger.info(f"      column: {var.column}")
            logger.info(f"      dataType: {var.dataType}")
            logger.info(f"      min: {var.min}")
            logger.info(f"      max: {var.max}")

        # ========================================================================
        # CONFIG ATTRIBUTES - ROW LEVEL INTERMEDIATE VARIABLES
        # ========================================================================
        logger.info("\n" + "=" * 100)
        logger.info("CONFIG - ROW LEVEL INTERMEDIATE VARIABLES")
        logger.info("=" * 100)
        logger.info(f"  Total rowLevelIntermediateVariables: {len(request.config.rowLevelIntermediateVariables)}")
        for idx, var in enumerate(request.config.rowLevelIntermediateVariables, 1):
            logger.info(f"\n  [{idx}] RowLevelIntermediateVariable:")
            logger.info(f"      id: {var.id}")
            logger.info(f"      name: {var.name}")
            logger.info(f"      description: {var.description}")
            logger.info(f"      formula: {var.formula}")

        # ========================================================================
        # CONFIG ATTRIBUTES - PORTFOLIO LEVEL INTERMEDIATE VARIABLES
        # ========================================================================
        logger.info("\n" + "=" * 100)
        logger.info("CONFIG - PORTFOLIO LEVEL INTERMEDIATE VARIABLES")
        logger.info("=" * 100)
        logger.info(f"  Total portfolioLevelIntermediateVariables: {len(request.config.portfolioLevelIntermediateVariables)}")
        for idx, var in enumerate(request.config.portfolioLevelIntermediateVariables, 1):
            logger.info(f"\n  [{idx}] PortfolioLevelIntermediateVariable:")
            logger.info(f"      id: {var.id}")
            logger.info(f"      name: {var.name}")
            logger.info(f"      description: {var.description}")
            logger.info(f"      aggregateFunction: {var.aggregateFunction}")
            logger.info(f"      sourceVariables: {json.dumps(var.sourceVariables, indent=2)}")
            logger.info(f"      groupByColumn: {var.groupByColumn}")
            if var.ifCondition:
                logger.info(f"      ifCondition:")
                logger.info(f"          column: {var.ifCondition.column}")
                logger.info(f"          operator: {var.ifCondition.operator}")
                logger.info(f"          value: {var.ifCondition.value}")
            else:
                logger.info(f"      ifCondition: None")

        # ========================================================================
        # CONFIG ATTRIBUTES - CONSTRAINTS
        # ========================================================================
        logger.info("\n" + "=" * 100)
        logger.info("CONFIG - CONSTRAINTS")
        logger.info("=" * 100)
        logger.info(f"  Total constraints: {len(request.config.constraints)}")
        for idx, constraint in enumerate(request.config.constraints, 1):
            logger.info(f"\n  [{idx}] Constraint:")
            logger.info(f"      id: {constraint.id}")
            logger.info(f"      name: {constraint.name}")
            logger.info(f"      description: {constraint.description}")

        # ========================================================================
        # CONFIG ATTRIBUTES - OBJECTIVES
        # ========================================================================
        logger.info("\n" + "=" * 100)
        logger.info("CONFIG - OBJECTIVES")
        logger.info("=" * 100)
        logger.info(f"  Total objectives: {len(request.config.objectives)}")
        for idx, objective in enumerate(request.config.objectives, 1):
            logger.info(f"\n  [{idx}] Objective:")
            logger.info(f"      id: {objective.id}")
            logger.info(f"      name: {objective.name}")
            logger.info(f"      description: {objective.description}")

        # ========================================================================
        # CSV DATA ATTRIBUTES
        # ========================================================================
        logger.info("\n" + "=" * 100)
        logger.info("CSV DATA ATTRIBUTES")
        logger.info("=" * 100)
        logger.info(f"  csvData.columns: {json.dumps(request.csvData.columns, indent=2)}")
        logger.info(f"  csvData.rows total count: {len(request.csvData.rows)}")
        logger.info("\n  ALL ROWS (CSVRow.data for each row):")
        for idx, row in enumerate(request.csvData.rows, 1):
            logger.info(f"\n  [{idx}] CSVRow {idx}:")
            logger.info(f"      data: {json.dumps(row.data, indent=2)}")

        # ========================================================================
        # SUMMARY
        # ========================================================================
        logger.info("\n" + "=" * 100)
        logger.info("SUMMARY - ALL ATTRIBUTES LOGGED")
        logger.info("=" * 100)
        logger.info("  Scenario attributes: id, name, parameterValues, inputVariableOverrides")
        logger.info("  Config.scenarioParameters: id, name, description, defaultValue")
        logger.info("  Config.rowLevelInputVariables: id, name, description, column, dataType, min, max")
        logger.info("  Config.rowLevelIntermediateVariables: id, name, description, formula")
        logger.info("  Config.portfolioLevelIntermediateVariables: id, name, description, aggregateFunction, sourceVariables, groupByColumn, ifCondition(column, operator, value)")
        logger.info("  Config.constraints: id, name, description")
        logger.info("  Config.objectives: id, name, description")
        logger.info("  csvData.columns: list of column names")
        logger.info("  csvData.rows: list of rows, each with data dict")
        logger.info("=" * 100)
        logger.info("\nRUN LANGGRAPH WORKFLOW FOR CP-SAT OPTIMIZATION")
        logger.info("=" * 100)

        # ========================================================================
        # RUN LANGGRAPH WORKFLOW
        # ========================================================================
        workflow_result = run_cpsat_optimization(
            config=request.config,
            scenario=request.scenario,
            csv_data=request.csvData,
        )

        # ========================================================================
        # RESULTS
        # ========================================================================
        if workflow_result['success']:
            logger.info("\n" + "=" * 100)
            logger.info("OPTIMIZATION RESULTS - CP-SAT MODE SUCCESS")
            logger.info("=" * 100)
            logger.info(f"  objectiveValue: {workflow_result['objective_value']}")
            logger.info(f"\n  Variable values found: {len(workflow_result['variable_values'])}")
            for var_name, var_value in list(workflow_result['variable_values'].items())[:10]:
                logger.info(f"    {var_name}: {var_value}")
            if len(workflow_result['variable_values']) > 10:
                logger.info(f"    ... and {len(workflow_result['variable_values']) - 10} more variables")
            logger.info(f"  Debug file: {workflow_result.get('debug_filepath', 'Not saved')}")
            logger.info("=" * 100)
            logger.info("RUN SCENARIO COMPLETED SUCCESSFULLY")
            logger.info("=" * 100)

            # Map variable values to portfolio results format for compatibility
            portfolio_results = []
            for var_name, var_value in workflow_result['variable_values'].items():
                portfolio_results.append({
                    'variableName': var_name,
                    'value': float(var_value) if isinstance(var_value, (int, float)) else 0.0
                })

            return OptimizationResult(
                objectiveValue=workflow_result['objective_value'],
                portfolioResults=portfolio_results,
                constraintViolations=[],
            )
        else:
            logger.error("\n" + "=" * 100)
            logger.error("OPTIMIZATION FAILED - CP-SAT MODE")
            logger.error("=" * 100)
            logger.error(f"  Error: {workflow_result['error']}")
            logger.error(f"  Debug file: {workflow_result.get('debug_filepath', 'Not saved')}")
            logger.error("=" * 100)

            raise HTTPException(status_code=500, detail=workflow_result.get('error', 'Unknown error'))

    except Exception as e:
        logger.error("=" * 100)
        logger.error(f"ERROR RUNNING SCENARIO: {e}")
        logger.error("=" * 100)
        logger.error(f"Full error details:", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/health")
def health_check() -> dict[str, str]:
    """Health check endpoint."""
    logger.info("Health check requested")
    return {"status": "healthy"}

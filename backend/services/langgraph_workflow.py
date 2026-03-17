"""LangGraph workflow for structured CPSatConfig generation and safe execution."""

import logging
from typing import Any, Dict, Optional

from typing_extensions import TypedDict
from langgraph.graph import END, StateGraph

from .cpsat_service import CPSatExecutionResult, CPSatService, create_context_from_request
from .llm_service import LLMService

logger = logging.getLogger(__name__)


class WorkflowState(TypedDict):
    config: Any
    scenario: Any
    csv_data: Any
    context: Dict[str, Any]
    generated_config: Any
    is_valid: bool
    error_message: str
    execution_result: CPSatExecutionResult
    retry_count: int
    max_retries: int
    final_variable_values: Dict[str, Any]
    final_objective_value: float
    debug_filepath: Optional[str]


def create_langgraph_workflow(llm_service: LLMService, cpsat_service: CPSatService) -> StateGraph:
    def initialize(state: WorkflowState) -> WorkflowState:
        context = create_context_from_request(
            config=state['config'],
            scenario=state['scenario'],
            csv_data=state['csv_data'],
        )
        return {
            **state,
            'context': context,
            'generated_config': None,
            'is_valid': False,
            'error_message': '',
            'execution_result': CPSatExecutionResult(
                success=False,
                output='',
                variable_values={},
                objective_value=None,
                error='Not yet executed',
                debug_filepath=None,
            ),
            'retry_count': 0,
            'max_retries': 3,
            'final_variable_values': {},
            'final_objective_value': 0.0,
            'debug_filepath': None,
        }

    def generate_config(state: WorkflowState) -> WorkflowState:
        logger.info(f"WORKFLOW - GENERATE CPSAT CONFIG (attempt {state['retry_count'] + 1})")
        try:
            generated = llm_service.generate_cpsat_config(
                context=state['context'],
                error_feedback=state['error_message'] if state['retry_count'] > 0 else None,
            )
            return {
                **state,
                'generated_config': generated,
                'is_valid': True,
                'error_message': '',
            }
        except Exception as e:
            logger.error(f"CPSatConfig generation failed: {e}", exc_info=True)
            return {
                **state,
                'generated_config': None,
                'is_valid': False,
                'error_message': str(e),
                'retry_count': state['retry_count'] + 1,
            }

    def execute_cpsat(state: WorkflowState) -> WorkflowState:
        result = cpsat_service.execute_cpsat_config(
            config=state['generated_config'],
            spreadsheet_data=state['context'].get('spreadsheet_data', []),
            scenario_params=state['context'].get('scenario_values', {}),
        )
        return {
            **state,
            'execution_result': result,
            'final_variable_values': result['variable_values'],
            'final_objective_value': result['objective_value'] or 0.0,
            'debug_filepath': result.get('debug_filepath'),
        }

    def handle_failure(state: WorkflowState) -> WorkflowState:
        failure_error = (
            state['error_message']
            or state['execution_result'].get('error')
            or "Workflow failed before execution"
        )
        return {
            **state,
            'execution_result': CPSatExecutionResult(
                success=False,
                output=state['execution_result'].get('output', ''),
                variable_values={},
                objective_value=None,
                error=failure_error,
                debug_filepath=state.get('debug_filepath'),
            ),
            'final_variable_values': {},
            'final_objective_value': 0.0,
        }

    def should_retry_generate(state: WorkflowState) -> str:
        if state['is_valid']:
            return "execute"
        if state['retry_count'] < state['max_retries']:
            return "generate"
        return "failure"

    def execution_success(state: WorkflowState) -> str:
        if state['execution_result']['success']:
            return "success"
        return "failure"

    workflow = StateGraph(WorkflowState)
    # Add nodes
    workflow.add_node("initialize", initialize)
    workflow.add_node("generate", generate_config)
    workflow.add_node("execute", execute_cpsat)
    workflow.add_node("failure", handle_failure)

    workflow.set_entry_point("initialize")
    workflow.add_edge("initialize", "generate")
    workflow.add_conditional_edges(
        "generate",
        should_retry_generate,
        {
            "generate": "generate",
            "execute": "execute",
            "failure": "failure",
        },
    )
    workflow.add_conditional_edges(
        "execute",
        execution_success,
        {
            "success": END,
            "failure": "failure",
        },
    )
    workflow.add_edge("failure", END)
    return workflow


def run_cpsat_optimization(config: Any, scenario: Any, csv_data: Any) -> Dict[str, Any]:
    llm_service = LLMService()
    cpsat_service = CPSatService(max_retries=3)
    workflow = create_langgraph_workflow(llm_service, cpsat_service)
    initial_state: WorkflowState = {
        'config': config,
        'scenario': scenario,
        'csv_data': csv_data,
        'context': {},
        'generated_config': None,
        'is_valid': False,
        'error_message': '',
        'execution_result': CPSatExecutionResult(
            success=False,
            output='',
            variable_values={},
            objective_value=None,
            error='Not executed',
            debug_filepath=None,
        ),
        'retry_count': 0,
        'max_retries': 3,
        'final_variable_values': {},
        'final_objective_value': 0.0,
        'debug_filepath': None,
    }
    try:
        app = workflow.compile()
        result = app.invoke(initial_state)
        return {
            'success': bool(result['execution_result']['success']),
            'variable_values': result['final_variable_values'],
            'objective_value': result['final_objective_value'],
            'error': result['execution_result'].get('error') if not result['execution_result']['success'] else None,
            'debug_filepath': result.get('debug_filepath'),
        }
    except Exception as e:
        logger.error(f"Workflow error: {e}", exc_info=True)
        return {
            'success': False,
            'variable_values': {},
            'objective_value': 0.0,
            'error': str(e),
            'debug_filepath': None,
        }

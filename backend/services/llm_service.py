# LLM service for generating structured CP-SAT config (JSON) via LangChain

import json
import logging
import os
from typing import Any, Dict, List

from dotenv import load_dotenv
from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI

from models import CPSatConfig

load_dotenv()

logger = logging.getLogger(__name__)


class LLMService:
    """Service for translating user optimization requirements into CPSatConfig."""

    def __init__(self):
        base_url = os.getenv("OPENAI_BASE_URL", "http://localhost:4000/v1")
        model_name = os.getenv("OPENAI_MODEL", "Qwen3-30B-A3B-Instruct-FP8")
        api_key = os.getenv("OPENAI_API_KEY")

        init_kwargs = {
            "model": model_name,
            "temperature": 0.0,
            "base_url": base_url,
        }
        if api_key:
            init_kwargs["api_key"] = api_key

        self.model = ChatOpenAI(**init_kwargs)
        endpoint_info = f" (endpoint: {base_url})" if base_url else " (default endpoint)"
        logger.info(f"Initialized LLMService with model '{model_name}'{endpoint_info}")

    def generate_cpsat_config(
        self,
        context: Dict[str, Any],
        error_feedback: str | None = None,
    ) -> CPSatConfig:
        """
        Generate structured CPSatConfig (not executable code).
        """
        prompt = self._build_prompt()
        structured_llm = self.model.with_structured_output(CPSatConfig)
        chain = prompt | structured_llm

        payload = {
            "df_schema": self._build_df_schema(context),
            "scenario_parameters": json.dumps(context.get("scenario_values", {}), indent=2, ensure_ascii=True),
            "user_requirements": self._build_user_requirements(context, error_feedback),
        }

        result = chain.invoke(payload)
        logger.info(
            "Generated CPSatConfig: row_inputs=%d row_intermediates=%d portfolio_variables=%d constraints=%d",
            len(result.row_inputs),
            len(result.row_intermediates),
            len(result.portfolio_variables),
            len(result.constraints),
        )
        return result

    def _build_prompt(self) -> ChatPromptTemplate:
        system_prompt = """
You are an expert Operations Research engineer configuring a CP-SAT optimization model.
Your task is to translate the user's optimization rules into a strict JSON configuration.

### Data Context
DataFrame Columns and Types:
{df_schema}

Scenario Parameters:
{scenario_parameters}

### Rules for Translation:
1. Break down all formulas into linear `Term` objects (sum of [variable/column/parameter * coefficient]).
2. Do not attempt to scale floats in the JSON. The backend execution engine will automatically apply scaling.
3. Map [name] tags from user formulas to the correct `term_type` - CHECK ALL SOURCES FIRST:
   - "parameter": scenario parameter (check scenario_parameters list)
   - "row_input": row-level input variable prefix (check row_level_input_variables)
   - "row_intermediate": row-level intermediate variable prefix (check row_level_intermediate_variables)
   - "portfolio_var": portfolio variable name (MUST be defined in portfolio_variables section)
   - "column": dataframe column (only if NOT found in any other category)
   - "constant": numeric constant

IMPORTANT: When translating formulas, always check row_level_input_variables and row_level_intermediate_variables FIRST before assuming a term is a "column".
Example: Formula "[staff_count] * [cost_rate_per_resource]" becomes:
- First term: term_type="row_input", name_or_value="staff_count" (since staff_count is in row_level_input_variables)
- Second term: term_type="column", name_or_value="cost_rate_per_resource" (since it's a dataframe column)

### CRITICAL RULES FOR VARIABLE CREATION:
You MUST create THREE types of variables in your output:

1. row_inputs: Map rowLevelInputVariables to row_inputs section (name_prefix, min_value, max_value)

2. row_intermediates: Map rowLevelIntermediateVariables to row_intermediates section (name_prefix, terms from formula)

3. portfolio_variables: Map portfolioLevelIntermediateVariables to portfolio_variables section:
   - portfolio_name: the variable name
   - group_by_columns: the grouping columns (from groupByColumn, or [] for no grouping)
   - aggregate_function: the aggregation function (from aggregateFunction)
   - source_row_variable: the source row variable (from sourceVariables)
   - if_condition: optional filter condition

DO NOT create row_intermediates from portfolioLevelIntermediateVariables - they MUST go in portfolio_variables.

### CRITICAL RULES FOR PORTFOLIO VARIABLES IN CONSTRAINTS:
When you translate constraints and objectives, you MUST ensure ALL portfolio variables referenced are defined in "portfolio_variables":

1. Check all portfolio variables referenced in constraints/objectives
2. If any portfolio variable doesn't exist in your portfolio_variables list, CREATE IT
3. Example: If constraint says "staff per region <= 0.33 * total_staff_count", you MUST create total_staff_count as a portfolio variable

5. Output only the schema-compliant structure via structured output.
"""

        user_prompt = """
Please convert the following requirements into the optimization schema:
{user_requirements}
"""
        return ChatPromptTemplate.from_messages(
            [("system", system_prompt), ("human", user_prompt)]
        )

    def _build_df_schema(self, context: Dict[str, Any]) -> str:
        columns = context.get("spreadsheet_columns", [])
        rows = context.get("spreadsheet_data", [])
        if not columns:
            return "[]"

        sample_row = rows[0] if rows else {}
        typed = []
        for col in columns:
            value = sample_row.get(col)
            value_type = type(value).__name__ if value is not None else "unknown"
            typed.append({"column": col, "type": value_type})
        return json.dumps(typed, indent=2, ensure_ascii=True)

    def _build_user_requirements(
        self,
        context: Dict[str, Any],
        error_feedback: str | None,
    ) -> str:
        payload = {
            "row_level_input_variables": context.get("row_level_input_vars", []),
            "row_level_intermediate_variables": context.get("row_level_intermediate_vars", []),
            "portfolio_level_variables": context.get("portfolio_level_vars", []),
            "constraints": context.get("constraints", []),
            "objectives": context.get("objectives", []),
        }
        if error_feedback:
            payload["previous_attempt_error"] = error_feedback
        return json.dumps(payload, indent=2, ensure_ascii=True)

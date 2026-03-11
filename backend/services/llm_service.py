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
3. Map [name] tags from user formulas to the correct `term_type`:
   - "column": dataframe column
   - "parameter": scenario parameter
   - "row_input": row-level input variable prefix
   - "row_intermediate": row-level intermediate variable prefix
   - "portfolio_var": portfolio variable name
   - "constant": numeric constant
4. Output only the schema-compliant structure via structured output.
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

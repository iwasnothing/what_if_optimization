# Optimization service layer - business logic for scenario optimization

import re
import logging
from typing import Dict, List, Any

from models import (
    ConfigState,
    ScenarioInput,
    CSVRow,
    PortfolioResult,
)

logger = logging.getLogger(__name__)


class OptimizationService:
    """Service for handling scenario optimization logic."""

    @staticmethod
    def evaluate_formula(formula: str, variable_context: Dict[str, Any]) -> float:
        """
        Safely evaluate a formula with variable substitution.
        Supports basic arithmetic operations and variable references like {VariableName}.
        NOTE: This is legacy mode - CP-SAT mode uses structured Term objects instead.
        """
        # Replace {VariableName} with actual values
        substituted_formula = formula
        for var_name, var_value in variable_context.items():
            pattern = r"\{" + re.escape(str(var_name)) + r"\}"
            substituted_formula = re.sub(pattern, str(var_value), substituted_formula)

        # Replace (ColumnName) with 0 (columns are constants in CP-SAT, not variables)
        substituted_formula = re.sub(r"\([^)]+\)", "0", substituted_formula)

        # Evaluate the formula safely (only allow basic math operations)
        allowed_chars = set("0123456789+-*/(). ")
        if not all(c in allowed_chars or c.isalnum() for c in substituted_formula):
            return 0.0

        try:
            return eval(substituted_formula, {"__builtins__": {}}, {})
        except Exception:
            return 0.0

    @staticmethod
    def check_condition(
        condition_type: str,
        left_value: Any,
        right_value: Any,
    ) -> bool:
        """Check if a condition is met based on operator."""
        try:
            left_num = float(left_value)
            right_num = float(right_value)
        except (ValueError, TypeError):
            # Fallback to string comparison
            left_str = str(left_value)
            right_str = str(right_value)

            if condition_type == "=":
                return left_str == right_str
            elif condition_type == "!=":
                return left_str != right_str
            else:
                return False

        if condition_type == "=":
            return left_num == right_num
        elif condition_type == "!=":
            return left_num != right_num
        elif condition_type == ">":
            return left_num > right_num
        elif condition_type == "<":
            return left_num < right_num
        elif condition_type == ">=":
            return left_num >= right_num
        elif condition_type == "<=":
            return left_num <= right_num
        return False

    @staticmethod
    def calculate_portfolio_result(
        config: ConfigState,
        scenario: ScenarioInput,
        csv_rows: List[CSVRow],
    ) -> List[PortfolioResult]:
        """
        Calculate portfolio-level intermediate variables based on the scenario and CSV data.
        """
        results: List[PortfolioResult] = []

        # Build variable context for row-level calculations
        # Include scenario parameter values
        variable_context: Dict[str, Any] = {**scenario.parameterValues}

        # For each portfolio-level intermediate variable
        for portfolio_var in config.portfolioLevelIntermediateVariables:
            values: List[float] = []

            for row in csv_rows:
                # Apply if condition if present
                if portfolio_var.ifCondition:
                    row_value = row.data.get(portfolio_var.ifCondition.column)
                    if not OptimizationService.check_condition(
                        portfolio_var.ifCondition.operator,
                        row_value,
                        portfolio_var.ifCondition.value,
                    ):
                        continue

                # Build row context
                row_context = {**variable_context}

                # Add CSV column values
                for var in config.rowLevelInputVariables:
                    var_value = row.data.get(var.column)
                    # Apply input variable override if exists
                    if var.name in scenario.inputVariableOverrides:
                        var_value = scenario.inputVariableOverrides[var.name]
                    row_context[var.name] = var_value

                # Calculate row-level intermediate variables
                for row_inter_var in config.rowLevelIntermediateVariables:
                    row_context[row_inter_var.name] = OptimizationService.evaluate_formula(
                        row_inter_var.formula, row_context
                    )

                # Get values for aggregation
                if portfolio_var.sourceVariables:
                    row_value = 0.0
                    for source_var_name in portfolio_var.sourceVariables:
                        if source_var_name in row_context:
                            row_value += float(row_context[source_var_name])
                    values.append(row_value)

            # Apply aggregation function
            aggregated_value = 0.0
            if values:
                if portfolio_var.aggregateFunction == "sum":
                    aggregated_value = sum(values)
                elif portfolio_var.aggregateFunction == "min":
                    aggregated_value = min(values)
                elif portfolio_var.aggregateFunction == "max":
                    aggregated_value = max(values)

            results.append(
                PortfolioResult(variableName=portfolio_var.name, value=aggregated_value)
            )

        return results

    @staticmethod
    def check_constraints(
        _config: ConfigState,
        _portfolio_results: List[PortfolioResult],
    ) -> List[str]:
        """
        Check if any constraints are violated.
        For now, this is a placeholder - actual constraint logic would be defined
        in a more sophisticated system.
        """
        violations: List[str] = []

        # Placeholder for constraint checking logic
        # In a real implementation, you would define constraint rules
        # and check if portfolio_results violate any of them

        return violations

    @staticmethod
    def calculate_objective(
        _config: ConfigState,
        portfolio_results: List[PortfolioResult],
    ) -> float:
        """
        Calculate the objective value based on portfolio results.
        For now, this is a placeholder - actual objective logic would be
        defined based on the objectives configuration.
        """
        # Placeholder: return sum of all portfolio results
        # In a real implementation, this would use the objectives configuration
        # to determine how to calculate the objective value
        return sum(result.value for result in portfolio_results)

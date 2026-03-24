import json
import logging
import math
import os
from datetime import datetime
from fractions import Fraction
from typing import Any, Dict, List, Optional, TypedDict

import pandas as pd
from ortools.sat.python import cp_model

from models import CPSatConfig, Term

logger = logging.getLogger(__name__)

DEBUG_DIR = os.getenv(
    "CPSAT_DEBUG_DIR",
    os.path.join(os.getcwd(), "what-if-cpsat-debug"),
)
os.makedirs(DEBUG_DIR, exist_ok=True)

SCALE = 100
BIG_BOUND = 10**12


def _log_cp_sat_solver_chunk(msg: str) -> None:
    """OR-Tools log_callback often splits one logical line across chunks or prefixes with \\n; normalize to one log line each."""
    if not msg:
        return
    for line in msg.replace("\r\n", "\n").split("\n"):
        s = line.strip()
        if s:
            logger.info("[cp-sat] %s", s)


def _model_dump(model: Any) -> Dict[str, Any]:
    if hasattr(model, "model_dump"):
        return model.model_dump()
    return model.dict()


def save_generated_json(payload: Dict[str, Any], stage: str = "generated") -> str:
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
    filename = f"cpsat_{stage}_{timestamp}.json"
    filepath = os.path.join(DEBUG_DIR, filename)
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2, ensure_ascii=True)
    logger.info(f"Saved CP-SAT JSON to: {filepath}")
    return filepath


def save_error_context(stage: str, error_message: str, details: Optional[Dict[str, Any]] = None) -> str:
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
    filename = f"cpsat_{stage}_{timestamp}.txt"
    filepath = os.path.join(DEBUG_DIR, filename)
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(f"# CP-SAT Error Context - {stage.upper()}\n")
        f.write(f"# Generated at: {datetime.now().isoformat()}\n")
        f.write(f"# {'=' * 75}\n\n")
        f.write("ERROR MESSAGE:\n")
        f.write(f"{error_message}\n")
        if details:
            f.write("\nDETAILS:\n")
            f.write(json.dumps(details, indent=2, ensure_ascii=True, default=str))
    logger.info(f"Saved CP-SAT error context to: {filepath}")
    return filepath


def save_execution_debug(
    variables: Dict[str, List[Dict[str, Any]]],
    constraints: List[Dict[str, Any]],
    objective: Dict[str, Any],
    solver_status: str,
    solver_result: Optional[Dict[str, Any]] = None,
) -> str:
    """Save detailed execution debug information including all variables and constraints."""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
    filename = f"cpsat_execution_debug_{timestamp}.txt"
    filepath = os.path.join(DEBUG_DIR, filename)
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(f"# CP-SAT Execution Debug - {timestamp}\n")
        f.write(f"# Generated at: {datetime.now().isoformat()}\n")
        f.write(f"# {'=' * 75}\n\n")

        # Variables section
        f.write("# VARIABLES\n")
        f.write(f"# {'=' * 75}\n\n")
        total_vars = 0
        for var_type, var_list in variables.items():
            f.write(f"## {var_type.upper()} ({len(var_list)} variables)\n")
            for var_info in var_list:
                f.write(f"  Name: {var_info['name']}\n")
                f.write(f"    Type: {var_info['type']}\n")
                if 'bounds' in var_info:
                    f.write(f"    Bounds: [{var_info['bounds'][0]}, {var_info['bounds'][1]}]\n")
                if 'definition' in var_info:
                    f.write(f"    Definition: {var_info['definition']}\n")
                if 'group_key' in var_info:
                    f.write(f"    Group Key: {var_info['group_key']}\n")
                if 'row_index' in var_info:
                    f.write(f"    Row Index: {var_info['row_index']}\n")
                total_vars += 1
            f.write("\n")

        f.write(f"Total Variables: {total_vars}\n\n")

        # Constraints section
        f.write(f"# CONSTRAINTS\n")
        f.write(f"# {'=' * 75}\n\n")
        for i, constraint in enumerate(constraints, 1):
            f.write(f"## Constraint {i}: {constraint['description']}\n")
            f.write(f"  Type: {constraint['type']}\n")
            f.write(f"  Expression: {constraint['expression']}\n")
            if 'group_key' in constraint:
                f.write(f"  Group Key: {constraint['group_key']}\n")
            if 'row_index' in constraint:
                f.write(f"  Row Index: {constraint['row_index']}\n")
            f.write("\n")

        f.write(f"Total Constraints: {len(constraints)}\n\n")

        # Objective section
        f.write(f"# OBJECTIVE\n")
        f.write(f"# {'=' * 75}\n\n")
        f.write(f"Direction: {objective['direction']}\n")
        f.write(f"Expression: {objective['expression']}\n\n")

        # Solver results
        f.write(f"# SOLVER RESULTS\n")
        f.write(f"# {'=' * 75}\n\n")
        f.write(f"Status: {solver_status}\n")
        if solver_result:
            if 'objective_value' in solver_result:
                f.write(f"Objective Value: {solver_result['objective_value']}\n")
            if 'num_booleans' in solver_result:
                f.write(f"Num Booleans: {solver_result['num_booleans']}\n")
            if 'num_branches' in solver_result:
                f.write(f"Num Branches: {solver_result['num_branches']}\n")
            if 'wall_time' in solver_result:
                f.write(f"Wall Time: {solver_result['wall_time']}s\n")
        f.write("\n")

        # Variable values (if available)
        if solver_result and 'variable_values' in solver_result:
            f.write(f"# VARIABLE VALUES (solution)\n")
            f.write(f"# {'=' * 75}\n\n")
            for var_name, value in solver_result['variable_values'].items():
                f.write(f"{var_name} = {value}\n")

    logger.info(f"Saved CP-SAT execution debug to: {filepath}")
    return filepath


class CPSatExecutionResult(TypedDict):
    success: bool
    output: str
    variable_values: Dict[str, Any]
    objective_value: Optional[float]
    error: Optional[str]
    debug_filepath: Optional[str]


class _DebugTracker(TypedDict):
    variables: Dict[str, List[Dict[str, Any]]]
    constraints: List[Dict[str, Any]]


class _ExprParts(TypedDict):
    coeffs: Dict[Any, Fraction]
    constant: Fraction


class CPSatService:
    """Service for deterministic CP-SAT execution from structured CPSatConfig."""

    def __init__(self, max_retries: int = 3, enable_debug_logging: bool = True):
        self.max_retries = max_retries
        self.enable_debug_logging = enable_debug_logging
        self._debug: _DebugTracker = {"variables": {}, "constraints": []}

    def _reset_debug_tracker(self) -> None:
        """Reset the debug tracker for a new execution."""
        self._debug = {"variables": {}, "constraints": []}

    def _log_variable(self, var_type: str, name: str, **kwargs: Any) -> None:
        """Log a variable creation."""
        if var_type not in self._debug["variables"]:
            self._debug["variables"][var_type] = []
        var_info = {"name": name, "type": var_type}
        var_info.update(kwargs)
        self._debug["variables"][var_type].append(var_info)
        logger.debug(f"Created {var_type} variable: {name} {kwargs}")

    def _log_constraint(
        self,
        constraint_type: str,
        description: str,
        expression: str,
        **kwargs: Any,
    ) -> None:
        """Log a constraint addition."""
        constraint = {
            "type": constraint_type,
            "description": description,
            "expression": expression,
        }
        constraint.update(kwargs)
        self._debug["constraints"].append(constraint)
        logger.debug(f"Added {constraint_type} constraint: {description} - {expression}")

    def _format_expr_debug(self, expr: _ExprParts) -> str:
        """Format an expression for debug output."""
        parts = []
        constant = expr["constant"]
        if constant != 0:
            parts.append(f"{constant}")
        for var, coeff in expr["coeffs"].items():
            coeff_val = float(coeff)
            if coeff_val == 0:
                continue
            var_name = getattr(var, "Name", lambda: str(var))()
            sign = "+" if coeff_val > 0 else "-"
            abs_coeff = abs(coeff_val)
            if abs_coeff == 1:
                parts.append(f"{sign} {var_name}")
            else:
                parts.append(f"{sign} {abs_coeff} * {var_name}")
        return " ".join(parts) if parts else "0"

    def execute_cpsat_config(
        self,
        config: CPSatConfig,
        spreadsheet_data: Optional[List[Dict[str, Any]]] = None,
        scenario_params: Optional[Dict[str, Any]] = None,
        timeout: int = 30,
    ) -> CPSatExecutionResult:
        spreadsheet_data = spreadsheet_data or []
        scenario_params = scenario_params or {}
        self._reset_debug_tracker()
        debug_filepath: Optional[str] = None

        try:
            save_generated_json(_model_dump(config), stage="generated_config")
        except Exception as e:
            logger.warning(f"Failed to save generated config: {e}")

        try:
            df = pd.DataFrame(spreadsheet_data)
            model = cp_model.CpModel()
            solver = cp_model.CpSolver()
            solver.parameters.max_time_in_seconds = float(timeout)

            # OR-Tools presolve + search trace (via Python logging, not raw stdout).
            solver.parameters.log_search_progress = True
            solver.log_callback = _log_cp_sat_solver_chunk

            num_workers_raw = os.getenv("CPSAT_NUM_SEARCH_WORKERS", "").strip()
            if num_workers_raw.isdigit():
                solver.parameters.num_search_workers = int(num_workers_raw)
                logger.info("CP-SAT num_search_workers=%s", num_workers_raw)

            row_vars: Dict[str, Dict[int, Any]] = {}
            portfolio_vars: Dict[str, Dict[str, Any]] = {}

            # 1) Row inputs
            for row_input in config.row_inputs:
                row_vars[row_input.name_prefix] = {}
                for index, row in df.iterrows():
                    idx = int(index)
                    lb = self._resolve_bound_value(row_input.min_value, row, scenario_params)
                    ub = self._resolve_bound_value(row_input.max_value, row, scenario_params)
                    if lb > ub:
                        lb, ub = ub, lb
                    var = model.NewIntVar(
                        lb,
                        ub,
                        f"{row_input.name_prefix}_{idx}",
                    )
                    row_vars[row_input.name_prefix][idx] = var
                    if self.enable_debug_logging:
                        self._log_variable(
                            "row_input",
                            f"{row_input.name_prefix}_{idx}",
                            bounds=(lb / SCALE, ub / SCALE),
                            row_index=idx,
                        )

            # 2) Row intermediates
            for row_inter in config.row_intermediates:
                row_vars[row_inter.name_prefix] = {}
                for index, row in df.iterrows():
                    idx = int(index)
                    var = model.NewIntVar(-BIG_BOUND, BIG_BOUND, f"{row_inter.name_prefix}_{idx}")
                    row_vars[row_inter.name_prefix][idx] = var
                    if self.enable_debug_logging:
                        self._log_variable(
                            "row_intermediate",
                            f"{row_inter.name_prefix}_{idx}",
                            bounds=(-BIG_BOUND / SCALE, BIG_BOUND / SCALE),
                            row_index=idx,
                        )
                    right_expr = self._build_expr_for_terms(
                        terms=row_inter.terms,
                        row_index=idx,
                        row=row,
                        scenario_params=scenario_params,
                        row_vars=row_vars,
                        portfolio_vars=portfolio_vars,
                        group_key=None,
                    )
                    self._add_linear_constraint(model, self._single_var_expr(var), "==", right_expr)
                    if self.enable_debug_logging:
                        expr_str = self._format_expr_debug(right_expr)
                        self._log_constraint(
                            "row_intermediate_definition",
                            f"{row_inter.name_prefix}_{idx}",
                            f"{row_inter.name_prefix}_{idx} == {expr_str}",
                            row_index=idx,
                        )

            # 3) Portfolio variables
            for p_var in config.portfolio_variables:
                p_name = p_var.portfolio_name
                portfolio_vars[p_name] = {}

                filtered_df = self._apply_if_condition(df, p_var.if_condition)
                groups = (
                    filtered_df.groupby(p_var.group_by_columns, dropna=False, sort=False)
                    if p_var.group_by_columns
                    else [("All", filtered_df)]
                )

                for raw_group_key, group_df in groups:
                    group_key = self._normalize_group_key(raw_group_key)
                    agg_var = model.NewIntVar(-BIG_BOUND, BIG_BOUND, f"{p_name}_{group_key}")
                    portfolio_vars[p_name][group_key] = agg_var
                    if self.enable_debug_logging:
                        self._log_variable(
                            "portfolio",
                            f"{p_name}_{group_key}",
                            bounds=(-BIG_BOUND / SCALE, BIG_BOUND / SCALE),
                            group_key=group_key,
                            source_variable=p_var.source_row_variable,
                        )

                    target_vars = [
                        row_vars[p_var.source_row_variable][int(idx)]
                        for idx in group_df.index
                        if p_var.source_row_variable in row_vars and int(idx) in row_vars[p_var.source_row_variable]
                    ]

                    target_names = [f"{p_var.source_row_variable}_{idx}" for idx in group_df.index if p_var.source_row_variable in row_vars and int(idx) in row_vars[p_var.source_row_variable]]

                    if not target_vars:
                        model.Add(agg_var == 0)
                        if self.enable_debug_logging:
                            self._log_constraint(
                                "portfolio_definition",
                                f"{p_name}_{group_key}",
                                f"{p_name}_{group_key} == 0",
                                group_key=group_key,
                            )
                    elif p_var.aggregate_function == "sum":
                        model.Add(agg_var == sum(target_vars))
                        if self.enable_debug_logging:
                            target_str = " + ".join(target_names)
                            self._log_constraint(
                                "portfolio_sum",
                                f"{p_name}_{group_key}",
                                f"{p_name}_{group_key} == {target_str}",
                                group_key=group_key,
                            )
                    elif p_var.aggregate_function == "max":
                        model.AddMaxEquality(agg_var, target_vars)
                        if self.enable_debug_logging:
                            target_str = ", ".join(target_names)
                            self._log_constraint(
                                "portfolio_max",
                                f"{p_name}_{group_key}",
                                f"{p_name}_{group_key} == max({target_str})",
                                group_key=group_key,
                            )
                    elif p_var.aggregate_function == "min":
                        model.AddMinEquality(agg_var, target_vars)
                        if self.enable_debug_logging:
                            target_str = ", ".join(target_names)
                            self._log_constraint(
                                "portfolio_min",
                                f"{p_name}_{group_key}",
                                f"{p_name}_{group_key} == min({target_str})",
                                group_key=group_key,
                            )
                    else:
                        raise ValueError(f"Unsupported aggregate function: {p_var.aggregate_function}")

            # 4) Constraints
            for constraint in config.constraints:
                self._add_config_constraint(
                    model=model,
                    constraint=constraint,
                    df=df,
                    scenario_params=scenario_params,
                    row_vars=row_vars,
                    portfolio_vars=portfolio_vars,
                )

            # 5) Objective
            objective_expr, objective_factor = self._build_objective_expr(
                config=config,
                df=df,
                scenario_params=scenario_params,
                row_vars=row_vars,
                portfolio_vars=portfolio_vars,
            )

            objective_debug = {
                "direction": config.objective.direction,
                "expression": f"objective_expr (factor: {objective_factor})",
            }

            if config.objective.direction == "maximize":
                model.Maximize(objective_expr)
            else:
                model.Minimize(objective_expr)

            # 6) Solve
            proto = model.Proto()
            num_proto_vars = len(proto.variables)
            num_proto_cts = len(proto.constraints)
            logger.info(
                "CP-SAT solve starting: %s variables, %s constraints, max_time=%ss",
                num_proto_vars,
                num_proto_cts,
                timeout,
            )
            status = solver.Solve(model)
            status_name = solver.StatusName(status)
            logger.info(
                "CP-SAT solve finished: status=%s wall_time=%.3fs user_time=%.3fs "
                "conflicts=%s branches=%s booleans=%s",
                status_name,
                solver.WallTime(),
                solver.UserTime(),
                solver.NumConflicts(),
                solver.NumBranches(),
                solver.NumBooleans(),
            )
            logger.debug("CP-SAT ResponseStats:\n%s", solver.ResponseStats())

            # Save debug file
            if self.enable_debug_logging:
                solver_result = None
                if status in (cp_model.OPTIMAL, cp_model.FEASIBLE):
                    solver_result = {
                        "objective_value": float(solver.ObjectiveValue()) / float(objective_factor * SCALE),
                        "num_booleans": solver.NumBooleans(),
                        "num_branches": solver.NumBranches(),
                        "wall_time": solver.WallTime(),
                        "variable_values": self._collect_solution_values(solver, row_vars, portfolio_vars),
                    }
                debug_filepath = save_execution_debug(
                    variables=self._debug["variables"],
                    constraints=self._debug["constraints"],
                    objective=objective_debug,
                    solver_status=status_name,
                    solver_result=solver_result,
                )

            if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
                error_msg = f"Solver status: {status_name}"
                save_error_context("execute_failed", error_msg)
                return {
                    "success": False,
                    "output": status_name,
                    "variable_values": {},
                    "objective_value": None,
                    "error": error_msg,
                    "debug_filepath": debug_filepath,
                }

            objective_value = float(solver.ObjectiveValue()) / float(objective_factor * SCALE)
            variables = self._collect_solution_values(solver, row_vars, portfolio_vars)

            return {
                "success": True,
                "output": status_name,
                "variable_values": variables,
                "objective_value": objective_value,
                "error": None,
                "debug_filepath": debug_filepath,
            }
        except Exception as e:
            error_msg = f"Execution error: {e}"
            logger.error(error_msg, exc_info=True)
            save_error_context("execute_failed", error_msg)
            # Still save debug file if possible
            if self.enable_debug_logging and self._debug["variables"] or self._debug["constraints"]:
                try:
                    debug_filepath = save_execution_debug(
                        variables=self._debug["variables"],
                        constraints=self._debug["constraints"],
                        objective={"direction": "unknown", "expression": "error before objective"},
                        solver_status="error",
                    )
                except Exception as debug_e:
                    logger.warning(f"Failed to save debug file after error: {debug_e}")
            return {
                "success": False,
                "output": "",
                "variable_values": {},
                "objective_value": None,
                "error": error_msg,
                "debug_filepath": debug_filepath,
            }

    def _scaled_int(self, val: Any) -> int:
        if isinstance(val, bool):
            return int(val) * SCALE
        if isinstance(val, (int, float)):
            return int(round(float(val) * SCALE))
        raise ValueError(f"Expected numeric value, got: {val}")

    def _to_fraction(self, value: Any) -> Fraction:
        if isinstance(value, Fraction):
            return value
        if isinstance(value, int):
            return Fraction(value, 1)
        if isinstance(value, float):
            return Fraction(str(value))
        if isinstance(value, str):
            return Fraction(value)
        raise ValueError(f"Cannot convert to Fraction: {value}")

    def _resolve_bound_value(self, bound: Any, row: Any, scenario_params: Dict[str, Any]) -> int:
        if isinstance(bound, str):
            if bound in row.index:
                return self._scaled_int(row[bound])
            if bound in scenario_params:
                return self._scaled_int(scenario_params[bound])
        return self._scaled_int(bound)

    def _apply_if_condition(self, df: pd.DataFrame, condition: Any) -> pd.DataFrame:
        if not condition or not getattr(condition, "enabled", False):
            return df
        if not condition.column or condition.column not in df.columns:
            return df
        col = df[condition.column]
        val = condition.value
        op = condition.operator
        if op == "==":
            return df[col == val]
        if op == "!=":
            return df[col != val]
        if op == ">":
            return df[col > val]
        if op == "<":
            return df[col < val]
        if op == ">=":
            return df[col >= val]
        if op == "<=":
            return df[col <= val]
        return df

    def _normalize_group_key(self, key: Any) -> str:
        if isinstance(key, tuple):
            return "|".join(str(part) for part in key)
        return str(key)

    def _empty_expr(self) -> _ExprParts:
        return {"coeffs": {}, "constant": Fraction(0, 1)}

    def _single_var_expr(self, var: Any) -> _ExprParts:
        return {"coeffs": {var: Fraction(1, 1)}, "constant": Fraction(0, 1)}

    def _add_expr(self, base: _ExprParts, delta: _ExprParts, sign: int = 1) -> None:
        for var, coeff in delta["coeffs"].items():
            base["coeffs"][var] = base["coeffs"].get(var, Fraction(0, 1)) + coeff * sign
            if base["coeffs"][var] == 0:
                del base["coeffs"][var]
        base["constant"] += delta["constant"] * sign

    def _build_expr_for_terms(
        self,
        terms: List[Term],
        row_index: Optional[int],
        row: Any,
        scenario_params: Dict[str, Any],
        row_vars: Dict[str, Dict[int, Any]],
        portfolio_vars: Dict[str, Dict[str, Any]],
        group_key: Optional[str],
    ) -> _ExprParts:
        result = self._empty_expr()
        for term in terms:
            one = self._resolve_term(
                term=term,
                row_index=row_index,
                row=row,
                scenario_params=scenario_params,
                row_vars=row_vars,
                portfolio_vars=portfolio_vars,
                group_key=group_key,
            )
            self._add_expr(result, one, sign=1)
        return result

    def _resolve_term(
        self,
        term: Term,
        row_index: Optional[int],
        row: Any,
        scenario_params: Dict[str, Any],
        row_vars: Dict[str, Dict[int, Any]],
        portfolio_vars: Dict[str, Dict[str, Any]],
        group_key: Optional[str],
    ) -> _ExprParts:
        # Resolve coefficient: can be numeric (float/int) or string (column/parameter name)
        coeff_value = term.coefficient
        if isinstance(coeff_value, str):
            # String coefficient is a column name or parameter name
            if row is not None and coeff_value in row.index:
                coeff_value = row[coeff_value]
            elif coeff_value in scenario_params:
                coeff_value = scenario_params[coeff_value]
            else:
                raise ValueError(f"Cannot resolve coefficient '{coeff_value}': not found in row columns or scenario parameters")
        coeff = self._to_fraction(coeff_value)
        term_type = term.term_type
        key = term.name_or_value
        out = self._empty_expr()

        if term_type == "constant":
            out["constant"] += coeff * self._scaled_int(float(key))
            return out

        if term_type == "parameter":
            if key not in scenario_params:
                raise ValueError(f"Parameter not found: {key}")
            out["constant"] += coeff * self._scaled_int(scenario_params[str(key)])
            return out

        if term_type == "column":
            if row is None:
                raise ValueError(f"Column term requires row context: {key}")
            out["constant"] += coeff * self._scaled_int(row[str(key)])
            return out

        if term_type in ("row_input", "row_intermediate"):
            if row_index is None:
                raise ValueError(f"{term_type} term requires row index: {key}")
            name = str(key)
            if name not in row_vars or row_index not in row_vars[name]:
                raise ValueError(f"Row variable not found: {name}[{row_index}]")
            out["coeffs"][row_vars[name][row_index]] = coeff
            return out

        if term_type == "portfolio_var":
            name = str(key)
            if name not in portfolio_vars:
                raise ValueError(f"Portfolio variable not found: {name}")
            if group_key is None:
                raise ValueError(f"Portfolio variable term requires group key: {name}")
            # Handle "All" group - if the requested group_key doesn't exist, try using "All"
            actual_group_key = group_key
            if group_key not in portfolio_vars[name] and "All" in portfolio_vars[name]:
                actual_group_key = "All"
            if actual_group_key not in portfolio_vars[name]:
                raise ValueError(f"Portfolio group not found: {name}[{actual_group_key}]")
            out["coeffs"][portfolio_vars[name][actual_group_key]] = coeff
            return out

        raise ValueError(f"Unsupported term type: {term_type}")

    def _materialize_expr(self, expr: _ExprParts) -> tuple[Any, int]:
        denominators = [f.denominator for f in expr["coeffs"].values()]
        denominators.append(expr["constant"].denominator)
        factor = 1
        for d in denominators:
            factor = math.lcm(factor, d)

        linear_terms = []
        for var, frac in expr["coeffs"].items():
            linear_terms.append(int(frac * factor) * var)
        constant = int(expr["constant"] * factor)
        if linear_terms:
            return sum(linear_terms) + constant, factor
        return constant, factor

    def _add_linear_constraint(
        self,
        model: cp_model.CpModel,
        left: _ExprParts,
        operator: str,
        right: _ExprParts,
        description: str = "linear_constraint",
        **log_kwargs: Any,
    ) -> None:
        delta = self._empty_expr()
        self._add_expr(delta, left, sign=1)
        self._add_expr(delta, right, sign=-1)
        materialized, _ = self._materialize_expr(delta)
        if operator == "==":
            model.Add(materialized == 0)
        elif operator == "<=":
            model.Add(materialized <= 0)
        elif operator == ">=":
            model.Add(materialized >= 0)
        else:
            raise ValueError(f"Unsupported operator: {operator}")

        if self.enable_debug_logging:
            left_str = self._format_expr_debug(left)
            right_str = self._format_expr_debug(right)
            self._log_constraint(
                "linear",
                description,
                f"{left_str} {operator} {right_str}",
                **log_kwargs,
            )

    def _constraint_scope(self, terms: List[Term]) -> str:
        types = {t.term_type for t in terms}
        has_portfolio = "portfolio_var" in types
        has_row = bool(types.intersection({"row_input", "row_intermediate", "column"}))
        if has_portfolio and has_row:
            return "mixed"
        if has_portfolio:
            return "portfolio"
        if has_row:
            return "row"
        return "global"

    def _add_config_constraint(
        self,
        model: cp_model.CpModel,
        constraint: Any,
        df: pd.DataFrame,
        scenario_params: Dict[str, Any],
        row_vars: Dict[str, Dict[int, Any]],
        portfolio_vars: Dict[str, Dict[str, Any]],
    ) -> None:
        all_terms = list(constraint.left_terms) + list(constraint.right_terms)
        scope = self._constraint_scope(all_terms)
        if scope == "mixed":
            raise ValueError(
                f"Constraint mixes row and portfolio terms, which is ambiguous: {constraint.description}"
            )

        if scope == "portfolio":
            # Collect all portfolio variables referenced in this constraint
            portfolio_vars_in_constraint = {}
            for term in all_terms:
                if term.term_type == "portfolio_var":
                    name = str(term.name_or_value)
                    if name not in portfolio_vars_in_constraint:
                        portfolio_vars_in_constraint[name] = portfolio_vars.get(name, {})

            # Check if all portfolio variables have the same group keys
            # If they differ, we cannot create a single constraint
            all_group_keys: set[str] = set()
            for name, groups in portfolio_vars_in_constraint.items():
                all_group_keys.update(groups.keys())

            # Special handling for mixed-grouping constraints (grouped + ungrouped "All")
            # Only check portfolio variables that are actually in the constraint
            has_grouped_var = any(len(portfolio_vars[name].keys()) > 1 for name in portfolio_vars_in_constraint)
            has_all_group = "All" in all_group_keys

            if has_grouped_var and has_all_group:
                # Create separate constraint for each group of grouped variables
                # Always use "All" group for ungrouped variables
                # Find all group keys from grouped portfolio variables
                grouped_var_keys: list[str] = []
                ungrouped_var_name = None
                for name, groups in portfolio_vars_in_constraint.items():
                    if len(groups.keys()) > 1:
                        grouped_var_keys.extend(groups.keys())
                    elif "All" in groups.keys():
                        ungrouped_var_name = name

                if not grouped_var_keys:
                    raise ValueError(f"Expected grouped portfolio variables in mixed constraint")

                # Create constraint for each group key
                for group_key in sorted(grouped_var_keys):
                    left = self._build_expr_for_terms(
                        terms=constraint.left_terms,
                        row_index=None,
                        row=None,
                        scenario_params=scenario_params,
                        row_vars=row_vars,
                        portfolio_vars=portfolio_vars,
                        group_key=group_key,
                    )
                    # For right side, always use ungrouped variable with "All" group
                    right = self._build_expr_for_terms(
                        terms=constraint.right_terms,
                        row_index=None,
                        row=None,
                        scenario_params=scenario_params,
                        row_vars=row_vars,
                        portfolio_vars=portfolio_vars,
                        group_key="All",
                    )
                    self._add_linear_constraint(
                        model,
                        left,
                        constraint.operator,
                        right,
                        description=f"portfolio_constraint_{constraint.description}",
                        group_key=f"left:{group_key}|right:All",
                    )
                return
            # Original validation: all portfolio vars must have same group keys
            # Only apply to portfolio-only constraints (not mixed with row/params)
            if scope == "portfolio" and len(portfolio_vars_in_constraint) > 1:
                first_groups = set(list(portfolio_vars_in_constraint.values())[0].keys())
                if not all(set(groups.keys()) == first_groups for groups in portfolio_vars_in_constraint.values()):
                    raise ValueError(
                            f"Constraint '{constraint.description}' mixes portfolio variables with incompatible groupings, which is not supported. "
                            f"All portfolio variables in a constraint must have the same group_by_columns."
                        )

                # Now create constraint for each group key (all portfolio vars should have same groups)
                for group_key in sorted(all_group_keys):
                    left = self._build_expr_for_terms(
                        terms=constraint.left_terms,
                        row_index=None,
                        row=None,
                        scenario_params=scenario_params,
                        row_vars=row_vars,
                        portfolio_vars=portfolio_vars,
                        group_key=group_key,
                    )
                    right = self._build_expr_for_terms(
                        terms=constraint.right_terms,
                        row_index=None,
                        row=None,
                        scenario_params=scenario_params,
                        row_vars=row_vars,
                        portfolio_vars=portfolio_vars,
                        group_key=group_key,
                    )
                    self._add_linear_constraint(
                        model,
                        left,
                        constraint.operator,
                        right,
                        description=f"portfolio_constraint_{constraint.description}",
                        group_key=group_key,
                    )
            elif scope == "portfolio" and len(portfolio_vars_in_constraint) == 1:
                # One distinct portfolio variable (e.g. total == constant); the >1 branch
                # above never runs, but we still must emit the linear constraint(s).
                sole_name = next(iter(portfolio_vars_in_constraint))
                group_keys_one = sorted(portfolio_vars[sole_name].keys())
                left_pf_names = {
                    str(t.name_or_value)
                    for t in constraint.left_terms
                    if t.term_type == "portfolio_var"
                }
                right_pf_names = {
                    str(t.name_or_value)
                    for t in constraint.right_terms
                    if t.term_type == "portfolio_var"
                }
                if (
                    len(group_keys_one) > 1
                    and sole_name in left_pf_names
                    and sole_name in right_pf_names
                ):
                    raise ValueError(
                        f"Constraint '{constraint.description}' references grouped portfolio "
                        f"'{sole_name}' on both sides. The executor applies one constraint per "
                        f"group key, so the same name on left and right becomes a self-relation "
                        f"(e.g. Senior <= k - Senior), which is not a valid cross-group ratio. "
                        f"Use two distinct portfolio_variables (e.g. aggregates for Senior vs Junior) "
                        f"and reference two different portfolio_var names in the constraint."
                    )
                for group_key in group_keys_one:
                    left = self._build_expr_for_terms(
                        terms=constraint.left_terms,
                        row_index=None,
                        row=None,
                        scenario_params=scenario_params,
                        row_vars=row_vars,
                        portfolio_vars=portfolio_vars,
                        group_key=group_key,
                    )
                    right = self._build_expr_for_terms(
                        terms=constraint.right_terms,
                        row_index=None,
                        row=None,
                        scenario_params=scenario_params,
                        row_vars=row_vars,
                        portfolio_vars=portfolio_vars,
                        group_key=group_key,
                    )
                    self._add_linear_constraint(
                        model,
                        left,
                        constraint.operator,
                        right,
                        description=f"portfolio_constraint_{constraint.description}",
                        group_key=group_key,
                    )
            return

        if scope == "row":
            for idx, row in df.iterrows():
                row_index = int(idx)
                left = self._build_expr_for_terms(
                    terms=constraint.left_terms,
                    row_index=row_index,
                    row=row,
                    scenario_params=scenario_params,
                    row_vars=row_vars,
                    portfolio_vars=portfolio_vars,
                    group_key=None,
                )
                right = self._build_expr_for_terms(
                    terms=constraint.right_terms,
                    row_index=row_index,
                    row=row,
                    scenario_params=scenario_params,
                    row_vars=row_vars,
                    portfolio_vars=portfolio_vars,
                    group_key=None,
                )
                self._add_linear_constraint(
                    model,
                    left,
                    constraint.operator,
                    right,
                    description=f"row_constraint_{constraint.description}",
                    row_index=row_index,
                )
            return

        left = self._build_expr_for_terms(
            terms=constraint.left_terms,
            row_index=None,
            row=None,
            scenario_params=scenario_params,
            row_vars=row_vars,
            portfolio_vars=portfolio_vars,
            group_key=None,
        )
        right = self._build_expr_for_terms(
            terms=constraint.right_terms,
            row_index=None,
            row=None,
            scenario_params=scenario_params,
            row_vars=row_vars,
            portfolio_vars=portfolio_vars,
            group_key=None,
        )
        self._add_linear_constraint(
            model,
            left,
            constraint.operator,
            right,
            description=f"global_constraint_{constraint.description}",
        )

    def _build_objective_expr(
        self,
        config: CPSatConfig,
        df: pd.DataFrame,
        scenario_params: Dict[str, Any],
        row_vars: Dict[str, Dict[int, Any]],
        portfolio_vars: Dict[str, Dict[str, Any]],
    ) -> tuple[Any, int]:
        terms = config.objective.terms
        row_terms = [t for t in terms if t.term_type in {"row_input", "row_intermediate", "column"}]
        portfolio_terms = [t for t in terms if t.term_type == "portfolio_var"]
        global_terms = [t for t in terms if t.term_type in {"parameter", "constant"}]

        total = self._empty_expr()

        if row_terms:
            for idx, row in df.iterrows():
                part = self._build_expr_for_terms(
                    terms=row_terms,
                    row_index=int(idx),
                    row=row,
                    scenario_params=scenario_params,
                    row_vars=row_vars,
                    portfolio_vars=portfolio_vars,
                    group_key=None,
                )
                self._add_expr(total, part, sign=1)

        if portfolio_terms:
            for term in portfolio_terms:
                p_name = str(term.name_or_value)
                for group_key in portfolio_vars.get(p_name, {}).keys():
                    part = self._build_expr_for_terms(
                        terms=[term],
                        row_index=None,
                        row=None,
                        scenario_params=scenario_params,
                        row_vars=row_vars,
                        portfolio_vars=portfolio_vars,
                        group_key=group_key,
                    )
                    self._add_expr(total, part, sign=1)

        if global_terms:
            part = self._build_expr_for_terms(
                terms=global_terms,
                row_index=None,
                row=None,
                scenario_params=scenario_params,
                row_vars=row_vars,
                portfolio_vars=portfolio_vars,
                group_key=None,
            )
            self._add_expr(total, part, sign=1)

        return self._materialize_expr(total)

    def _collect_solution_values(
        self,
        solver: cp_model.CpSolver,
        row_vars: Dict[str, Dict[int, Any]],
        portfolio_vars: Dict[str, Dict[str, Any]],
    ) -> Dict[str, float]:
        values: Dict[str, float] = {}
        for name, indexed in row_vars.items():
            for idx, var in indexed.items():
                values[f"{name}[{idx}]"] = solver.Value(var) / SCALE
        for name, grouped in portfolio_vars.items():
            for group_key, var in grouped.items():
                values[f"{name}[{group_key}]"] = solver.Value(var) / SCALE
        return values


def create_context_from_request(
    config: Any,
    scenario: Any,
    csv_data: Any,
) -> Dict[str, Any]:
    """
    Create context dictionary from request data for CP-SAT code generation.

    Args:
        config: ConfigState object
        scenario: ScenarioInput object
        csv_data: CSVData object

    Returns:
        Context dictionary for LLM prompt
    """
    return {
        'spreadsheet_columns': csv_data.columns,
        'spreadsheet_data': [row.data for row in csv_data.rows],
        'scenario_parameters': [
            {
                'id': p.id,
                'name': p.name,
                'description': p.description,
                'defaultValue': p.defaultValue,
            }
            for p in config.scenarioParameters
        ],
        'scenario_values': scenario.parameterValues,
        'row_level_input_vars': [
            {
                'id': v.id,
                'name': v.name,
                'description': v.description,
                'column': v.column,
                'dataType': v.dataType,
                'min': v.min,
                'max': v.max,
            }
            for v in config.rowLevelInputVariables
        ],
        'row_level_intermediate_vars': [
            {
                'id': v.id,
                'name': v.name,
                'description': v.description,
                'formula': v.formula,
            }
            for v in config.rowLevelIntermediateVariables
        ],
        'portfolio_level_vars': [
            {
                'id': v.id,
                'name': v.name,
                'description': v.description,
                'aggregateFunction': v.aggregateFunction,
                'sourceVariables': v.sourceVariables,
                'groupByColumn': v.groupByColumn,
                'ifCondition': {
                    'column': v.ifCondition.column,
                    'operator': v.ifCondition.operator,
                    'value': v.ifCondition.value,
                } if v.ifCondition else None,
            }
            for v in config.portfolioLevelIntermediateVariables
        ],
        'constraints': [
            {
                'id': c.id,
                'name': c.name,
                'description': c.description,
            }
            for c in config.constraints
        ],
        'objectives': [
            {
                'id': o.id,
                'name': o.name,
                'description': o.description,
            }
            for o in config.objectives
        ],
    }

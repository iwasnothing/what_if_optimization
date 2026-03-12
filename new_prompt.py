    def _build_prompt():
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
   - portfolio_name:   variable name
   - group_by_columns:   grouping columns (from groupByColumn, or [] for no grouping)
   - aggregate_function:   aggregation function (from aggregateFunction)
   - source_row_variable:   source row variable name (from sourceVariables)
   - if_condition:   optional filter condition

DO NOT create row_intermediates from portfolioLevelIntermediateVariables - they MUST go in portfolio_variables.

### CRITICAL RULES FOR PORTFOLIO VARIABLES IN CONSTRAINTS:
When you translate constraints and objectives, you MUST ensure ALL portfolio variables referenced are defined in "portfolio_variables":

1. Check all portfolio variables referenced in constraints/objectives
2. If any portfolio variable doesn't exist, CREATE IT
3. Example: If constraint says "staff per region <= 0.33 * total_staff_count", you MUST create total_staff_count as a portfolio variable

4. IMPORTANT: Constraints that mix grouped portfolio variables with ungrouped ("All") variables are NOT supported by the execution engine.
   - Such constraints (e.g., "staff_per_region <= 0.33 * total_staff_count") must be reformulated to use compatible variables.
   - CORRECT approach: "For each region R: staff_per_region[R] / total_staff_count <= 0.33" (division comparison, not multiplication)
   - ALTERNATIVE: "Each region R: staff_per_region[R] * 100 <= 0.33 * total_staff_count[R]" (percentage of total)
   - The constraint formula should be: staff_per_region[R] / total_staff_count * 100 <= type_ratio

5. Output only the schema-compliant structure via structured output.
"""
        user_prompt = """
Please convert the following requirements into the optimization schema:
{user_requirements}
"""
        return ChatPromptTemplate.from_messages(
            [("system", system_prompt), ("human", user_prompt)]
        )

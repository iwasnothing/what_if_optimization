import type { CSVData, DataType, AggregateFunction } from "../types";

export const parseCSV = (csvText: string): CSVData => {
  const lines = csvText.trim().split("\n");
  if (lines.length < 2) {
    return { columns: [], rows: [] };
  }

  const columns = parseCSVLine(lines[0]);
  const rows = lines.slice(1).map((line) => {
    const values = parseCSVLine(line);
    const row: Record<string, string | number> = {};
    columns.forEach((col, i) => {
      const value = values[i];
      const numValue = Number(value);
      row[col] = isNaN(numValue) ? value : numValue;
    });
    return row;
  });

  return { columns, rows };
};

export const parseCSVLine = (line: string): string[] => {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
};

/**
 * Evaluate a formula with variables enclosed in {} and columns in ()
 * Variables: {VariableName} (decision variables)
 * Columns: (ColumnName) (dataframe constants, treated as 0 in legacy mode)
 * Parameters: {ParameterName} (scenario parameters)
 */
export const evaluateFormula = (
  formula: string,
  variables: Record<string, number>,
  parameters: Record<string, number>
): number => {
  if (!formula.trim()) return 0;

  try {
    // Replace {VariableName} with actual values
    const evaluatedFormula = formula.replace(/\{([^}]+)\}/g, (_, varName) => {
      const trimmed = varName.trim();

      // Check parameters first
      if (parameters[trimmed] !== undefined) {
        return String(parameters[trimmed]);
      }

      // Check variables
      if (variables[trimmed] !== undefined) {
        return String(variables[trimmed]);
      }

      return "0";
    });

    // Replace (ColumnName) with 0 (columns are constants, not evaluated in legacy mode)
    const finalFormula = evaluatedFormula.replace(/\([^)]+\)/g, "0");

    // Evaluate the expression
    // Only allow basic math operations for security
    const sanitized = finalFormula.replace(/[^0-9+\-*/().\s]/g, "");
    return Function(`"use strict"; return (${sanitized})`)();
  } catch (error) {
    console.error("Formula evaluation error:", error);
    return 0;
  }
};

/**
 * Evaluate a constraint expression like {TotalRevenue} >= 100000
 * Variables: {VariableName}, Columns: (ColumnName)
 * Returns true if constraint is satisfied, false otherwise
 */
export const evaluateConstraint = (
  expression: string,
  variables: Record<string, number>,
  parameters: Record<string, number>
): boolean => {
  if (!expression.trim()) return true;

  try {
    // Replace {VariableName} with actual values
    const evaluatedExpression = expression.replace(/\{([^}]+)\}/g, (_, varName) => {
      const trimmed = varName.trim();

      // Check parameters first
      if (parameters[trimmed] !== undefined) {
        return String(parameters[trimmed]);
      }

      // Check variables
      if (variables[trimmed] !== undefined) {
        return String(variables[trimmed]);
      }

      return "0";
    });

    // Replace (ColumnName) with 0 (columns are constants, not evaluated in legacy mode)
    const finalExpression = evaluatedExpression.replace(/\([^)]+\)/g, "0");

    // Sanitize and evaluate
    const sanitized = finalExpression.replace(/[^0-9+\-*/().<>=!&|\s]/g, "");
    return Function(`"use strict"; return (${sanitized})`)();
  } catch (error) {
    console.error("Constraint evaluation error:", error);
    return false;
  }
};

/**
 * Convert a value based on data type
 */
export const convertValueByType = (value: number, dataType: DataType): number => {
  switch (dataType) {
    case "boolean":
      return value > 0 ? 1 : 0;
    case "integer":
      return Math.round(value);
    default:
      return value;
  }
};

/**
 * Check if a value is within range constraints
 */
export const isValueInRange = (
  value: number,
  min?: number,
  max?: number
): boolean => {
  if (min !== undefined && value < min) return false;
  if (max !== undefined && value > max) return false;
  return true;
};

/**
 * Apply aggregate function to an array of values
 */
export const applyAggregateFunction = (
  values: number[],
  aggregateFunction: AggregateFunction
): number => {
  if (values.length === 0) return 0;

  switch (aggregateFunction) {
    case "sum":
      return values.reduce((sum, v) => sum + v, 0);
    case "min":
      return Math.min(...values);
    case "max":
      return Math.max(...values);
    default:
      return 0;
  }
};

/**
 * Parse a formula and extract all variable references in {VariableName} format
 * Note: Does NOT extract (ColumnName) as these are column constants, not variables
 */
export const extractVariableNames = (formula: string): string[] => {
  const matches = formula.match(/\{([^}]+)\}/g);
  if (!matches) return [];

  return matches.map((match) => match.slice(1, -1).trim());
};

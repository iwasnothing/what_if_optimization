// Data types for variables
export type DataType = "integer" | "boolean";

// Aggregate function types for portfolio variables
export type AggregateFunction = "sum" | "min" | "max";

// Comparison operators for if-conditions
export type ComparisonOperator = "=" | "!=" | ">" | "<" | ">=" | "<=";

export interface LogEntry {
  id: number;
  time: string;
  message: string;
}

export interface TabConfig {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}

// CSV Data Structure
export interface CSVData {
  columns: string[];
  rows: Record<string, string | number>[];
}

// Scenario Parameter Definition
export interface ScenarioParameter {
  id: number;
  name: string;
  description: string;
  defaultValue?: number;
}

// Row Level Input Variable
export interface RowLevelInputVariable {
  id: number;
  name: string;
  description: string;
  column: string; // Column name from CSV
  dataType: DataType;
  min?: number; // For integer type
  max?: number; // For integer type
}

// Row Level Intermediate Variable
export interface RowLevelIntermediateVariable {
  id: number;
  name: string;
  description: string;
  formula: string; // Uses {VariableName} syntax for variables, (ColumnName) for dataframe columns
}

// Portfolio Level Intermediate Variable
export interface PortfolioLevelIntermediateVariable {
  id: number;
  name: string;
  description: string;
  aggregateFunction: AggregateFunction;
  sourceVariables: string[]; // Names of row level variables to aggregate
  groupByColumn?: string; // Optional: column from CSV to group by
  ifCondition?: IfCondition; // Optional: condition to filter rows
}

// If-condition for portfolio variables
export interface IfCondition {
  column: string; // Spreadsheet column
  operator: ComparisonOperator;
  value: string | number;
}

// Constraint
export interface Constraint {
  id: number;
  name: string;
  description: string;
}

// Objective
export interface Objective {
  id: number;
  name: string;
  description: string;
}

// Scenario with parameter values and input variable overrides
export interface Scenario {
  id: number;
  name: string;
  parameterValues: Record<string, number>; // parameterName -> value
  inputVariableOverrides: Record<string, number>; // variableName -> value
  optimizationResult?: OptimizationResult;
  isRunning?: boolean;
  isCompleted?: boolean;
}

// Calculated portfolio results
export interface PortfolioResult {
  variableName: string;
  value: number;
}

// Optimization results
export interface OptimizationResult {
  objectiveValue: number;
  portfolioResults: PortfolioResult[];
  constraintViolations: string[];
}

// Overall configuration state
export interface ConfigState {
  // Scenario parameters
  scenarioParameters: ScenarioParameter[];
  // Row level input variables
  rowLevelInputVariables: RowLevelInputVariable[];
  // Row level intermediate variables
  rowLevelIntermediateVariables: RowLevelIntermediateVariable[];
  // Portfolio level intermediate variables
  portfolioLevelIntermediateVariables: PortfolioLevelIntermediateVariable[];
  // Constraints
  constraints: Constraint[];
  // Objectives
  objectives: Objective[];
}

// Computed state (not stored in config)
export interface ComputedState {
  // Scenario values (for each scenario)
  scenarioResults: Record<number, {
    parameterValues: Record<string, number>;
    computedPortfolioValues: PortfolioResult[];
  }>;
}

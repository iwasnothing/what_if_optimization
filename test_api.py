import json
import requests

data = {
    'config': {
        'scenarioParameters': [
            {'id': 1773230980159, 'name': 'type_ratio', 'description': 'ratio of senior staff to junior staff', 'defaultValue': 0}
        ],
        'rowLevelInputVariables': [
            {'id': 1773231007290, 'name': 'staff_count', 'description': 'number of staff in the resource pool', 'column': 'number_of_resources_allocated', 'dataType': 'integer', 'min': 1, 'max': 100}
        ],
        'rowLevelIntermediateVariables': [
            {'id': 1773231099828, 'name': 'resource_pool_cost', 'description': 'total cost of resource pool', 'formula': '[staff_count] * [cost_rate_per_resource]'}
        ],
        'portfolioLevelIntermediateVariables': [
            {'id': 1773231401926, 'name': 'staff_per_region', 'description': 'number of staff per region', 'aggregateFunction': 'sum', 'sourceVariables': ['staff_count'], 'groupByColumn': 'country'},
            {'id': 1773236129255, 'name': 'staff_by_type', 'description': 'number of senior staff and junior staff', 'aggregateFunction': 'sum', 'sourceVariables': ['staff_count'], 'groupByColumn': 'resource_type'},
            {'id': 1773236220610, 'name': 'regional_cost', 'description': 'total cost per region', 'aggregateFunction': 'sum', 'sourceVariables': ['resource_pool_cost'], 'groupByColumn': 'country'}
        ],
        'constraints': [
            {'id': 1773236433634, 'name': 'staff count per region ratio', 'description': 'Percent of staff count per each region to total staff count <= 33%'},
            {'id': 1773236501592, 'name': 'senior to junior staff', 'description': 'ratio of number of senior staff to number of junior staff <= [type_ratio]'},
            {'id': 1773236689432, 'name': 'total staff', 'description': 'total number of staff is 100'}
        ],
        'objectives': [
            {'id': 1773236714915, 'name': 'total cost', 'description': 'minimize total cost of all staff count of all resource pool'}
        ]
    },
    'scenario': {
        'id': 1773236755607, 'name': 'Scenario 1', 'parameterValues': {'type_ratio': 0.33}, 'inputVariableOverrides': {}, 'isRunning': False}
    },
    'csvData': {
        'columns': ['resource_pool_id', 'number_of_resources_allocated', 'cost_rate_per_resource', 'country', 'resource_type'],
        'rows': [
            {'data': {'resource_pool_id': 'RP001', 'number_of_resources_allocated': 5, 'cost_rate_per_resource': 120, 'country': 'USA', 'resource_type': 'Senior'}},
            {'data': {'resource_pool_id': 'RP002', 'number_of_resources_allocated': 8, 'cost_rate_per_resource': 85, 'country': 'USA', 'resource_type': 'Junior'}},
            {'data': {'resource_pool_id': 'RP003', 'number_of_resources_allocated': 3, 'cost_rate_per_resource': 150, 'country': 'UK', 'resource_type': 'Senior'}},
            {'data': {'resource_pool_id': 'RP004', 'number_of_resources_allocated': 12, 'cost_rate_per_resource': 70, 'country': 'UK', 'resource_type': 'Junior'}},
            {'data': {'resource_pool_id': 'RP005', 'number_of_resources_allocated': 6, 'cost_rate_per_resource': 130, 'country': 'Germany', 'resource_type': 'Senior'}},
            {'data': {'resource_pool_id': 'RP006', 'number_of_resources_allocated': 10, 'cost_rate_per_resource': 75, 'country': 'Germany', 'resource_type': 'Junior'}},
            {'data': {'resource_pool_id': 'RP007', 'number_of_resources_allocated': 4, 'cost_rate_per_resource': 140, 'country': 'France', 'resource_type': 'Senior'}},
            {'data': {'resource_pool_id': 'RP008', 'number_of_resources_allocated': 15, 'cost_rate_per_resource': 65, 'country': 'France', 'resource_type': 'Junior'}},
            {'data': {'resource_pool_id': 'RP009', 'number_of_resources_allocated': 7, 'cost_rate_per_resource': 125, 'country': 'India', 'resource_type': 'Senior'}},
            {'data': {'resource_pool_id': 'RP010', 'number_of_resources_allocated': 20, 'cost_rate_per_resource': 55, 'country': 'India', 'resource_type': 'Junior'}}
        ]
    }
}

response = requests.post('http://localhost:8000/api/run_scenario', json=data, timeout=120)
print(f'Status: {response.status_code}')
print(f'Response: {response.text[:3000]}')

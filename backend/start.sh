#!/bin/bash

# Start the FastAPI backend server

echo "Starting What-If Analysis Backend..."
echo "Starting server..."
python3 -m uvicorn main:app --reload --host 0.0.0.0 --port 8000

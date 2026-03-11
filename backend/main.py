# FastAPI Backend for What-If Analysis Tool

import os
import sys
import logging

# Patch the langchain.verbose issue before importing langchain modules
class LangChainModule:
    def __getattr__(self, name):
        if name == 'verbose':
            return False  # Mock verbose attribute
        raise AttributeError(f"module 'langchain' has no attribute '{name}'")

sys.modules['langchain'] = LangChainModule()

# Disable LangSmith/LangChain tracing to avoid unauthorized upload attempts.
os.environ["LANGCHAIN_TRACING_V2"] = "false"
os.environ["LANGSMITH_TRACING"] = "false"

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import logging

# Load environment variables from .env file
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(
    title="What-If Analysis API",
    version="1.0.0",
    description="API for running what-if scenario optimizations"
)

# CORS middleware for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
from api.scenario import router as scenario_router
app.include_router(scenario_router)

@app.get("/")
def read_root():
    """Health check endpoint."""
    return {"status": "ok", "message": "What-If Analysis API is running"}

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)

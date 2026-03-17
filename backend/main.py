# FastAPI Backend for What-If Analysis Tool

import os
import logging

# Disable LangSmith/LangChain tracing to avoid unauthorized upload attempts.
os.environ["LANGCHAIN_TRACING_V2"] = "false"
os.environ["LANGSMITH_TRACING"] = "false"

# LangChain compatibility patch:
# Some langchain-core versions still read `langchain.verbose` / `langchain.debug`
# from the top-level `langchain` module. Ensure those attributes exist.
try:
    import langchain  # type: ignore

    if not hasattr(langchain, "verbose"):
        langchain.verbose = False  # type: ignore[attr-defined]
    if not hasattr(langchain, "debug"):
        langchain.debug = False  # type: ignore[attr-defined]
except Exception:
    # Keep startup resilient even if langchain package shape differs.
    pass

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
# Allow all origins for flexibility with different hostnames
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
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

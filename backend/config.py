"""Shared config — single place to load env + registry. Reused everywhere."""
import os
import yaml
from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env"))

REGISTRY_PATH = os.path.join(os.path.dirname(__file__), "..", "models", "model_registry.yaml")


def load_registry():
    with open(REGISTRY_PATH) as f:
        return yaml.safe_load(f)


def get_database_url():
    return os.getenv("DATABASE_URL", "")


def get_groq_key():
    return os.getenv("GROQ_API_KEY", "")

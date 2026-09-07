"""Groq implementation of Brain switch. Small reusable functions, easy to debug."""
import os
from groq import Groq
from .base import BrainProvider


def create_client():
    return Groq(api_key=os.getenv("GROQ_API_KEY"))


def get_model_id(registry, key):
    return registry[key]["model_id"]


def classify_task_text(text):
    """Pure function — no LLM call. Easy to unit test."""
    t = text.lower()
    if any(k in t for k in ["pid", "drawing", "scan", "image", "handwrit", "photo"]):
        return {"task_type": "vision", "complexity": "low", "modality": "vision"}
    if any(k in t for k in ["calculate", "compute", "simulate", "physics", "formula"]):
        return {"task_type": "calculation", "complexity": "high", "modality": "calc"}
    if any(k in t for k in ["draft", "approval", "recommend", "compare", "analyze", "analyse"]):
        return {"task_type": "drafting", "complexity": "high", "modality": "text"}
    if len(t.split()) < 20:
        return {"task_type": "extraction", "complexity": "low", "modality": "text"}
    return {"task_type": "reasoning", "complexity": "high", "modality": "text"}


def pick_model(router, task):
    """Pure function — decides SLM vs LLM vs VLM."""
    if task["modality"] == "vision":
        return router["vision_to"]
    if task["task_type"] in router.get("safety_override_tasks", []):
        return router["safety_override_to"]
    if task["complexity"] == "low":
        return router["simple_to"]
    return router["complex_to"]


class GroqBrain(BrainProvider):
    def __init__(self, registry):
        self.client = create_client()
        self.registry = {m["name"]: m for m in registry["models"]}
        self.router = registry["router"]

    def chat(self, model_key, messages, **kw):
        resp = self.client.chat.completions.create(
            model=get_model_id(self.registry, model_key),
            messages=messages,
        )
        return resp.choices[0].message.content

    def classify_task(self, text):
        return classify_task_text(text)

    def route(self, task):
        return pick_model(self.router, task)

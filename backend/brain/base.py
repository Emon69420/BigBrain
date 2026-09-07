"""Brain switch — harness talks only to this, never to groq/vllm directly."""
from abc import ABC, abstractmethod

class BrainProvider(ABC):
    @abstractmethod
    def chat(self, model_key: str, messages: list, **kw) -> str:
        ...

    @abstractmethod
    def classify_task(self, text: str) -> dict:
        """Return {task_type, complexity: low|high, modality: text|vision|calc}"""
        ...

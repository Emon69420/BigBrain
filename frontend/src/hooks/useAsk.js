// Reusable ask logic. Any component can use this hook.
import { useState } from "react";
import { askQuestion } from "../services/api.js";

export function useAsk() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  async function ask(text) {
    setLoading(true);
    try {
      const data = await askQuestion(text);
      setResult(data);
    } finally {
      setLoading(false);
    }
  }
  return { ask, loading, result };
}

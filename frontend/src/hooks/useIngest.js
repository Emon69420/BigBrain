// Reusable file upload — reads text files and ingests via backend.
import { useState } from "react";
import { ingestDoc } from "../services/api.js";

export function useIngest() {
  const [uploading, setUploading] = useState(false);
  const [last, setLast] = useState(null);
  const [error, setError] = useState(null);

  async function uploadFile(file) {
    setUploading(true);
    setError(null);
    try {
      const content = await file.text();
      const data = await ingestDoc({ title: file.name, content });
      setLast(data);
      return data;
    } catch (e) {
      setError(e.message);
      throw e;
    } finally {
      setUploading(false);
    }
  }

  async function uploadText(title, content) {
    setUploading(true);
    setError(null);
    try {
      const data = await ingestDoc({ title, content });
      setLast(data);
      return data;
    } catch (e) {
      setError(e.message);
      throw e;
    } finally {
      setUploading(false);
    }
  }

  return { uploadFile, uploadText, uploading, last, error };
}

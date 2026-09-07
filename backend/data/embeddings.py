"""Embeddings — local bge-m3, no API. Lazy singleton (first call downloads ~2GB).
If model not cached yet, we skip embedding (store null vectors) so ingest stays fast.
Run: python -c \"from data.embeddings import warmup; warmup()\" to pre-download."""
import os

_model = None


def is_cached():
    name = os.getenv("EMBED_MODEL", "BAAI/bge-m3")
    # huggingface cache dir uses -- for /
    safe = name.replace("/", "--")
    cache = os.path.join(os.path.expanduser("~"), ".cache", "huggingface", "hub", f"models--{safe}")
    return os.path.exists(cache)


def get_model():
    global _model
    if _model is None:
        from sentence_transformers import SentenceTransformer
        name = os.getenv("EMBED_MODEL", "BAAI/bge-m3")
        # Only download if explicitly allowed; otherwise use local cache only (fast fail)
        allow = os.getenv("EMBED_ALLOW_DOWNLOAD", "0") == "1"
        try:
            _model = SentenceTransformer(name, local_files_only=not allow)
        except Exception as e:
            # Not fully cached and download not allowed — propagate for null-vector fallback
            raise RuntimeError(f"embed model not ready: {e}")
    return _model


def embed_texts(texts):
    """Returns list of float vectors (1024-dim for bge-m3)."""
    return get_model().encode(texts, normalize_embeddings=True).tolist()


def embed_query(text):
    return embed_texts([text])[0]


def warmup():
    """Pre-download model. Call once: EMBED_ALLOW_DOWNLOAD=1 python -c 'from data.embeddings import warmup; warmup()'"""
    os.environ["EMBED_ALLOW_DOWNLOAD"] = "1"
    get_model()
    return True

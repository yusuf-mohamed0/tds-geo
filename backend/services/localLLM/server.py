# ──────────────────────────────────────────────
# AirLLM Local Inference Service
# FastAPI microservice wrapping AirLLM for
# running large LLMs on low-VRAM hardware.
# ──────────────────────────────────────────────

import os
import json
import time
from typing import Optional
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import uvicorn

app = FastAPI(title="AirLLM Local Inference", version="0.1.0")

MODEL_NAME = os.environ.get("AIRLLM_MODEL", "")
MODEL_CACHE = os.environ.get("AIRLLM_CACHE", "/tmp/airllm_models")
os.makedirs(MODEL_CACHE, exist_ok=True)

model = None  # Lazy-loaded model instance
model_loaded = False

# ─── Pydantic Models ──────────────────────────

class GenerateRequest(BaseModel):
    prompt: str
    max_new_tokens: int = 128
    temperature: float = 0.7
    top_p: float = 0.9
    top_k: int = 40
    repetition_penalty: float = 1.1


class GenerateResponse(BaseModel):
    text: str
    tokens_generated: int
    time_ms: float
    model: str


class LoadModelRequest(BaseModel):
    model_name: str
    compression: Optional[str] = None  # '4bit', '8bit', or None


# ─── Helpers ──────────────────────────────────

def _load_model(model_name: str, compression: str | None = None):
    """Load an AirLLM model (downloads shards on first use)."""
    global model, model_loaded
    try:
        from airllm import AutoModel
        kwargs = {"compression": compression} if compression else {}
        model = AutoModel.from_pretrained(model_name, **kwargs)
        model_loaded = True
        return True
    except Exception as e:
        model_loaded = False
        raise RuntimeError(f"Failed to load model '{model_name}': {e}")


# ─── Endpoints ─────────────────────────────────

@app.get("/health")
def health():
    return {
        "status": "healthy" if model_loaded else "no_model_loaded",
        "model": MODEL_NAME or "not_set",
        "model_loaded": model_loaded,
        "library": "airllm",
    }


@app.post("/model/load")
def load_model(req: LoadModelRequest):
    """Download and load a model. First call downloads shards (may take a while)."""
    try:
        _load_model(req.model_name, req.compression)
        return {
            "status": "loaded",
            "model": req.model_name,
            "compression": req.compression or "none",
        }
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/generate", response_model=GenerateResponse)
def generate(req: GenerateRequest):
    """Generate text using the loaded model."""
    global model, model_loaded
    if not model_loaded or model is None:
        if not MODEL_NAME:
            raise HTTPException(
                status_code=400,
                detail="No model loaded. Set AIRLLM_MODEL env var or POST /model/load first."
            )
        try:
            _load_model(MODEL_NAME)
        except RuntimeError as e:
            raise HTTPException(status_code=500, detail=str(e))

    try:
        import torch

        start = time.time()
        input_ids = model.tokenizer(
            req.prompt,
            return_tensors="pt",
            return_attention_mask=False,
            truncation=True,
            max_length=4096,
            padding=False,
        )

        generation = model.generate(
            input_ids["input_ids"].cuda() if torch.cuda.is_available() else input_ids["input_ids"],
            max_new_tokens=req.max_new_tokens,
            use_cache=True,
            return_dict_in_generate=True,
            temperature=req.temperature,
            top_p=req.top_p,
            top_k=req.top_k,
            repetition_penalty=req.repetition_penalty,
        )

        output = model.tokenizer.decode(generation.sequences[0], skip_special_tokens=True)
        elapsed = time.time() - start

        return GenerateResponse(
            text=output,
            tokens_generated=len(generation.sequences[0]),
            time_ms=round(elapsed * 1000, 2),
            model=MODEL_NAME,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Generation failed: {e}")


@app.get("/models/default")
def get_default_model():
    return {
        "model": MODEL_NAME or "not_set",
        "loaded": model_loaded,
        "cache_dir": MODEL_CACHE,
    }


# ─── Main ──────────────────────────────────────

if __name__ == "__main__":
    port = int(os.environ.get("AIRLLM_PORT", "8531"))
    host = os.environ.get("AIRLLM_HOST", "127.0.0.1")
    print(f"Starting AirLLM Inference Service on {host}:{port}")
    print(f"  Model: {MODEL_NAME or 'not set (load via API)'}")
    print(f"  Cache: {MODEL_CACHE}")

    # Pre-load model if specified
    if MODEL_NAME:
        try:
            compression = os.environ.get("AIRLLM_COMPRESSION")
            _load_model(MODEL_NAME, compression)
            print(f"  Pre-loaded model: {MODEL_NAME}")
        except Exception as e:
            print(f"  ⚠️  Failed to pre-load model: {e}")

    uvicorn.run(app, host=host, port=port, log_level="info")

# ──────────────────────────────────────────────
# turbovec Vector Store Service
# FastAPI microservice wrapping turbovec (TurboQuant)
# for fast, memory-efficient vector search.
# ──────────────────────────────────────────────

import os
import json
import numpy as np
from typing import Optional
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
import uvicorn

from turbovec import TurboQuantIndex, IdMapIndex

app = FastAPI(title="turbovec Vector Store", version="0.1.0")

# ─── In-memory index registry ─────────────────
# Each named index stores: { "index": TurboQuantIndex|IdMapIndex, "dim": int, "bit_width": int }
indices: dict[str, dict] = {}

DEFAULT_BIT_WIDTH = int(os.environ.get("TVEC_BIT_WIDTH", "4"))
DEFAULT_DIM = int(os.environ.get("TVEC_DIM", "1536"))
DATA_DIR = os.environ.get("TVEC_DATA_DIR", "/tmp/turbovec_indices")
os.makedirs(DATA_DIR, exist_ok=True)


# ─── Pydantic Models ──────────────────────────

class CreateIndexRequest(BaseModel):
    name: str
    dim: int = DEFAULT_DIM
    bit_width: int = DEFAULT_BIT_WIDTH
    use_id_map: bool = False


class AddVectorsRequest(BaseModel):
    name: str
    vectors: list[list[float]]
    ids: Optional[list[int]] = None  # required if use_id_map was True


class AddWithIdsRequest(BaseModel):
    name: str
    vectors: list[list[float]]
    ids: list[int]


class SearchRequest(BaseModel):
    name: str
    query: list[float]
    k: int = 10
    allowlist: Optional[list[int]] = None


class SearchResponse(BaseModel):
    scores: list[float]
    indices: list[int]


class RemoveRequest(BaseModel):
    name: str
    id: int


class SaveRequest(BaseModel):
    name: str
    path: Optional[str] = None


class LoadRequest(BaseModel):
    name: str
    path: str
    dim: int = DEFAULT_DIM
    bit_width: int = DEFAULT_BIT_WIDTH


# ─── Helpers ───────────────────────────────────

def _get_index(name: str):
    """Return the dict entry for a named index, or raise 404."""
    if name not in indices:
        raise HTTPException(status_code=404, detail=f"Index '{name}' not found. Create it first.")
    return indices[name]


def _get_save_path(name: str, path: str | None = None) -> str:
    if path:
        return path
    return os.path.join(DATA_DIR, f"{name}.tv")


# ─── Endpoints ─────────────────────────────────

@app.get("/health")
def health():
    return {
        "status": "healthy",
        "indices": list(indices.keys()),
        "library": "turbovec",
        "version": "0.7.0"
    }


@app.post("/index/create")
def create_index(req: CreateIndexRequest):
    if req.name in indices:
        raise HTTPException(status_code=409, detail=f"Index '{req.name}' already exists.")

    if req.use_id_map:
        idx = IdMapIndex(dim=req.dim, bit_width=req.bit_width)
    else:
        idx = TurboQuantIndex(dim=req.dim, bit_width=req.bit_width)

    indices[req.name] = {
        "index": idx,
        "dim": req.dim,
        "bit_width": req.bit_width,
        "use_id_map": req.use_id_map,
        "count": 0
    }
    return {"status": "created", "name": req.name, "type": "IdMapIndex" if req.use_id_map else "TurboQuantIndex"}


@app.post("/index/{name}/add")
def add_vectors(name: str, req: AddVectorsRequest):
    entry = _get_index(name)
    idx = entry["index"]
    vectors_np = np.array(req.vectors, dtype=np.float32)

    if isinstance(idx, IdMapIndex):
        if req.ids is None or len(req.ids) != len(req.vectors):
            raise HTTPException(status_code=400, detail="IdMapIndex requires ids matching vector count")
        ids_np = np.array(req.ids, dtype=np.uint64)
        idx.add_with_ids(vectors_np, ids_np)
    else:
        idx.add(vectors_np)

    indices[name]["count"] += len(req.vectors)
    return {"status": "ok", "added": len(req.vectors), "total": indices[name]["count"]}


@app.post("/index/{name}/search")
def search(name: str, req: SearchRequest) -> SearchResponse:
    idx = _get_index(name)["index"]
    # turbovec expects a 2D queries array (batch dimension), so reshape (dim,) → (1, dim)
    query_np = np.array(req.query, dtype=np.float32).reshape(1, -1)

    if req.allowlist is not None:
        allowed_np = np.array(req.allowlist, dtype=np.uint64)
        scores, results = idx.search(query_np, k=req.k, allowlist=allowed_np)
    else:
        scores, results = idx.search(query_np, k=req.k)

    # Unwrap batch dimension — results come back as (1, k) from a single query
    scores_batch = scores[0] if hasattr(scores, '__getitem__') and len(scores) == 1 else scores
    indices_batch = results[0] if hasattr(results, '__getitem__') and len(results) == 1 else results

    return SearchResponse(
        scores=scores_batch.tolist() if hasattr(scores_batch, 'tolist') else list(scores_batch),
        indices=indices_batch.tolist() if hasattr(indices_batch, 'tolist') else list(indices_batch)
    )


@app.post("/index/{name}/remove")
def remove_vector(name: str, req: RemoveRequest):
    idx = _get_index(name)["index"]
    if not isinstance(idx, IdMapIndex):
        raise HTTPException(status_code=400, detail="Remove only supported on IdMapIndex")
    idx.remove(req.id)
    indices[name]["count"] = max(0, indices[name]["count"] - 1)
    return {"status": "removed", "id": req.id}


@app.post("/index/{name}/save")
def save_index(name: str, req: SaveRequest):
    idx = _get_index(name)["index"]
    save_path = _get_save_path(name, req.path)
    idx.write(save_path)
    return {"status": "saved", "path": save_path, "vectors": indices[name]["count"]}


@app.post("/index/{name}/load")
def load_index(name: str, req: LoadRequest):
    # Try to find the file with any known extension
    full_path = req.path
    if not os.path.exists(full_path):
        for ext in [".tvim", ".tv"]:
            candidate = req.path if req.path.endswith(ext) else req.path + ext
            if os.path.exists(candidate):
                full_path = candidate
                break

    if not os.path.exists(full_path):
        raise HTTPException(status_code=404, detail=f"Index file not found: {full_path}")

    try:
        idx = IdMapIndex.load(full_path)
        use_id_map = True
    except Exception:
        idx = TurboQuantIndex.load(full_path)
        use_id_map = False

    indices[name] = {
        "index": idx,
        "dim": req.dim,
        "bit_width": req.bit_width,
        "use_id_map": use_id_map,
        "count": 0  # count not tracked on load
    }
    return {"status": "loaded", "name": name, "path": full_path, "type": "IdMapIndex" if use_id_map else "TurboQuantIndex"}


@app.delete("/index/{name}")
def delete_index(name: str):
    if name not in indices:
        raise HTTPException(status_code=404, detail=f"Index '{name}' not found.")
    del indices[name]
    return {"status": "deleted", "name": name}


@app.get("/indices")
def list_indices():
    return {
        "indices": [
            {
                "name": k,
                "dim": v["dim"],
                "bit_width": v["bit_width"],
                "use_id_map": v["use_id_map"],
                "count": v["count"]
            }
            for k, v in indices.items()
        ]
    }


# ─── Main ──────────────────────────────────────

if __name__ == "__main__":
    port = int(os.environ.get("TVEC_PORT", "8530"))
    host = os.environ.get("TVEC_HOST", "127.0.0.1")
    print(f"Starting turbovec Vector Store on {host}:{port}")
    uvicorn.run(app, host=host, port=port, log_level="info")

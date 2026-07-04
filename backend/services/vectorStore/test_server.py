# <YKS />  YUSUF KO STA  Code. Build. Ship.™
# © 2026 Yusuf Mohamed. All rights reserved.
# Licensed under the ISC License.

# ──────────────────────────────────────────────
# Tests: turbovec Vector Store Service
# Uses FastAPI TestClient to test all endpoints
# without needing a running server.
# ──────────────────────────────────────────────

import os
import sys
import importlib.util
import tempfile
import pytest
import numpy as np
from fastapi.testclient import TestClient

# Set temp data dir before importing the server module
os.environ["TVEC_DATA_DIR"] = tempfile.mkdtemp(prefix="turbovec_test_")
os.environ["TVEC_DIM"] = "64"
os.environ["TVEC_BIT_WIDTH"] = "4"

# Load server.py by absolute path to avoid module name collisions with
# other test files that also import from a module called `server`.
_server_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "server.py")
_spec = importlib.util.spec_from_file_location("turbovec_server", _server_path)
server = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(server)
app = server.app
indices = server.indices

client = TestClient(app)

# ─── Test Helpers ─────────────────────────────

def _random_vector(dim: int = 64) -> list[float]:
    """Generate a random unit vector of given dimension."""
    v = np.random.randn(dim).astype(np.float32)
    v /= np.linalg.norm(v)
    return v.tolist()


def _random_vectors(n: int, dim: int = 64) -> list[list[float]]:
    return [_random_vector(dim) for _ in range(n)]


# ─── Setup / Teardown ─────────────────────────

@pytest.fixture(autouse=True)
def _clear_indices():
    """Clear the indices dict before each test."""
    indices.clear()
    yield


# ══════════════════════════════════════════════
# Health
# ══════════════════════════════════════════════

class TestHealth:
    def test_health_returns_ok(self):
        resp = client.get("/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "healthy"
        assert data["library"] == "turbovec"
        assert data["version"] == "0.7.0"
        assert data["indices"] == []

    def test_health_lists_indices(self):
        client.post("/index/create", json={"name": "my_idx", "dim": 64})
        resp = client.get("/health")
        assert resp.status_code == 200
        assert "my_idx" in resp.json()["indices"]


# ══════════════════════════════════════════════
# Index Creation
# ══════════════════════════════════════════════

class TestCreateIndex:
    def test_create_turbo_quant_index(self):
        resp = client.post("/index/create", json={"name": "tq_idx", "dim": 64, "bit_width": 4})
        assert resp.status_code == 200
        assert resp.json()["status"] == "created"
        assert resp.json()["type"] == "TurboQuantIndex"

    def test_create_id_map_index(self):
        resp = client.post("/index/create", json={
            "name": "idmap_idx", "dim": 64, "bit_width": 4, "use_id_map": True
        })
        assert resp.status_code == 200
        assert resp.json()["type"] == "IdMapIndex"

    def test_create_duplicate_returns_409(self):
        client.post("/index/create", json={"name": "dup_idx", "dim": 64})
        resp = client.post("/index/create", json={"name": "dup_idx", "dim": 64})
        assert resp.status_code == 409
        assert "already exists" in resp.json()["detail"]

    def test_create_with_defaults(self):
        resp = client.post("/index/create", json={"name": "default_idx"})
        assert resp.status_code == 200
        # Should use env defaults: dim=64, bit_width=4
        data = indices["default_idx"]
        assert data["dim"] == 64
        assert data["bit_width"] == 4
        assert data["use_id_map"] is False


# ══════════════════════════════════════════════
# Add Vectors
# ══════════════════════════════════════════════

class TestAddVectors:
    def setup_method(self):
        client.post("/index/create", json={"name": "add_test", "dim": 64})

    def test_add_vectors_turbo_quant(self):
        vecs = _random_vectors(5)
        resp = client.post("/index/add_test/add", json={
            "name": "add_test", "vectors": vecs
        })
        assert resp.status_code == 200
        assert resp.json()["added"] == 5
        assert resp.json()["total"] == 5
        assert indices["add_test"]["count"] == 5

    def test_add_more_vectors(self):
        vecs = _random_vectors(3)
        resp = client.post("/index/add_test/add", json={
            "name": "add_test", "vectors": vecs
        })
        assert resp.json()["total"] == 3

    def test_add_to_nonexistent_index(self):
        resp = client.post("/index/nope/add", json={
            "name": "nope", "vectors": _random_vectors(1)
        })
        assert resp.status_code == 404


class TestAddVectorsIdMap:
    def setup_method(self):
        client.post("/index/create", json={
            "name": "id_add", "dim": 64, "use_id_map": True
        })

    def test_add_with_ids(self):
        vecs = _random_vectors(3)
        resp = client.post("/index/id_add/add", json={
            "name": "id_add", "vectors": vecs, "ids": [100, 200, 300]
        })
        assert resp.status_code == 200
        assert resp.json()["added"] == 3

    def test_add_without_ids_returns_400(self):
        vecs = _random_vectors(2)
        resp = client.post("/index/id_add/add", json={
            "name": "id_add", "vectors": vecs
        })
        assert resp.status_code == 400
        assert "ids" in resp.json()["detail"].lower()

    def test_add_mismatched_ids_returns_400(self):
        vecs = _random_vectors(2)
        resp = client.post("/index/id_add/add", json={
            "name": "id_add", "vectors": vecs, "ids": [1]  # only 1 id for 2 vectors
        })
        assert resp.status_code == 400


# ══════════════════════════════════════════════
# Search
# ══════════════════════════════════════════════

class TestSearch:
    def setup_method(self):
        client.post("/index/create", json={"name": "search_test", "dim": 64})
        vecs = _random_vectors(50)
        client.post("/index/search_test/add", json={
            "name": "search_test", "vectors": vecs
        })

    def test_search_returns_results(self):
        query = _random_vector()
        resp = client.post("/index/search_test/search", json={
            "name": "search_test", "query": query, "k": 5
        })
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["scores"]) == 5
        assert len(data["indices"]) == 5
        # Scores should be in descending order (best match first)
        for i in range(len(data["scores"]) - 1):
            assert data["scores"][i] >= data["scores"][i + 1]

    def test_search_k_larger_than_n(self):
        query = _random_vector()
        resp = client.post("/index/search_test/search", json={
            "name": "search_test", "query": query, "k": 100
        })
        assert resp.status_code == 200
        # Should return all available vectors
        assert len(resp.json()["scores"]) == 50

    def test_search_on_nonexistent_index(self):
        resp = client.post("/index/nope/search", json={
            "name": "nope", "query": _random_vector()
        })
        assert resp.status_code == 404


class TestSearchWithAllowlist:
    def setup_method(self):
        client.post("/index/create", json={
            "name": "filter_test", "dim": 64, "use_id_map": True
        })
        vecs = _random_vectors(10)
        client.post("/index/filter_test/add", json={
            "name": "filter_test", "vectors": vecs,
            "ids": [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]
        })

    def test_search_with_allowlist(self):
        query = _random_vector()
        resp = client.post("/index/filter_test/search", json={
            "name": "filter_test", "query": query, "k": 5,
            "allowlist": [10, 30, 50, 70]
        })
        assert resp.status_code == 200
        # Results should only include IDs from the allowlist
        for idx in resp.json()["indices"]:
            assert idx in [10, 30, 50, 70]

    def test_search_allowlist_returns_fewer_results(self):
        query = _random_vector()
        resp = client.post("/index/filter_test/search", json={
            "name": "filter_test", "query": query, "k": 10,
            "allowlist": [10, 30]
        })
        assert resp.status_code == 200
        # Only 2 items in allowlist, so at most 2 results
        assert len(resp.json()["indices"]) <= 2


# ══════════════════════════════════════════════
# Remove Vectors
# ══════════════════════════════════════════════

class TestRemoveVector:
    def setup_method(self):
        client.post("/index/create", json={
            "name": "remove_test", "dim": 64, "use_id_map": True
        })
        vecs = _random_vectors(5)
        client.post("/index/remove_test/add", json={
            "name": "remove_test", "vectors": vecs, "ids": [1, 2, 3, 4, 5]
        })

    def test_remove_existing(self):
        resp = client.post("/index/remove_test/remove", json={
            "name": "remove_test", "id": 3
        })
        assert resp.status_code == 200
        assert resp.json()["status"] == "removed"
        assert resp.json()["id"] == 3
        assert indices["remove_test"]["count"] == 4

    def test_remove_on_non_id_map_returns_400(self):
        client.post("/index/create", json={"name": "plain_idx", "dim": 64})
        resp = client.post("/index/plain_idx/remove", json={
            "name": "plain_idx", "id": 1
        })
        assert resp.status_code == 400
        assert "only supported" in resp.json()["detail"].lower()

    def test_remove_from_nonexistent_index(self):
        resp = client.post("/index/nope/remove", json={"name": "nope", "id": 1})
        assert resp.status_code == 404


# ══════════════════════════════════════════════
# Save / Load
# ══════════════════════════════════════════════

class TestSaveLoad:
    def setup_method(self):
        self.tmpdir = tempfile.mkdtemp(prefix="tvec_saveload_")
        client.post("/index/create", json={
            "name": "save_idx", "dim": 64, "use_id_map": True
        })
        vecs = _random_vectors(10)
        client.post("/index/save_idx/add", json={
            "name": "save_idx", "vectors": vecs,
            "ids": list(range(10))
        })

    def test_save_and_load(self):
        save_path = os.path.join(self.tmpdir, "my_index.tvim")
        save_resp = client.post("/index/save_idx/save", json={
            "name": "save_idx", "path": save_path
        })
        assert save_resp.status_code == 200
        assert save_resp.json()["status"] == "saved"
        assert os.path.exists(save_path)

        # Delete the in-memory index, then load from disk
        client.delete("/index/save_idx")
        assert "save_idx" not in indices

        load_resp = client.post("/index/save_idx/load", json={
            "name": "save_idx", "path": save_path,
            "dim": 64, "bit_width": 4
        })
        assert load_resp.status_code == 200
        assert load_resp.json()["status"] == "loaded"
        assert load_resp.json()["type"] == "IdMapIndex"

        # Search should work on the loaded index
        query = _random_vector()
        search_resp = client.post("/index/save_idx/search", json={
            "name": "save_idx", "query": query, "k": 5
        })
        assert search_resp.status_code == 200
        assert len(search_resp.json()["scores"]) == 5

    def test_load_nonexistent_file(self):
        resp = client.post("/index/nope/load", json={
            "name": "nope", "path": "/nonexistent/path.tvim",
            "dim": 64
        })
        assert resp.status_code == 404


# ══════════════════════════════════════════════
# Delete Index
# ══════════════════════════════════════════════

class TestDeleteIndex:
    def setup_method(self):
        client.post("/index/create", json={"name": "del_idx", "dim": 64})

    def test_delete_existing(self):
        assert "del_idx" in indices
        resp = client.delete("/index/del_idx")
        assert resp.status_code == 200
        assert resp.json()["status"] == "deleted"
        assert "del_idx" not in indices

    def test_delete_nonexistent(self):
        resp = client.delete("/index/nope")
        assert resp.status_code == 404


# ══════════════════════════════════════════════
# List Indices
# ══════════════════════════════════════════════

class TestListIndices:
    def test_empty_when_no_indices(self):
        resp = client.get("/indices")
        assert resp.json()["indices"] == []

    def test_lists_all_indices(self):
        client.post("/index/create", json={"name": "a", "dim": 64})
        client.post("/index/create", json={"name": "b", "dim": 128, "bit_width": 2, "use_id_map": True})
        resp = client.get("/indices")
        names = {i["name"] for i in resp.json()["indices"]}
        assert names == {"a", "b"}

    def test_index_metadata(self):
        client.post("/index/create", json={
            "name": "meta_idx", "dim": 128, "bit_width": 2, "use_id_map": True
        })
        resp = client.get("/indices")
        meta = [i for i in resp.json()["indices"] if i["name"] == "meta_idx"][0]
        assert meta["dim"] == 128
        assert meta["bit_width"] == 2
        assert meta["use_id_map"] is True
        assert meta["count"] == 0

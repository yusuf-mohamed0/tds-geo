# ──────────────────────────────────────────────
# Tests: AirLLM Local Inference Service
# Tests health, error paths, and model loading
# without downloading actual model weights.
# ──────────────────────────────────────────────

import os
import sys
import importlib.util
import tempfile
import pytest
from fastapi.testclient import TestClient

# Set env before importing the server module
os.environ["AIRLLM_CACHE"] = tempfile.mkdtemp(prefix="airllm_test_")

# Load server.py by absolute path to avoid module name collisions with
# other test files that also import from a module called `server`.
_server_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "server.py")
_spec = importlib.util.spec_from_file_location("airllm_server", _server_path)
server_module = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(server_module)
app = server_module.app

client = TestClient(app)


# ─── Setup / Teardown ─────────────────────────

@pytest.fixture(autouse=True)
def _reset_model():
    """Reset model state and env before each test."""
    server_module.model = None
    server_module.model_loaded = False
    if "AIRLLM_MODEL" in os.environ:
        del os.environ["AIRLLM_MODEL"]
    server_module.MODEL_NAME = ""
    yield


# ══════════════════════════════════════════════
# Health
# ══════════════════════════════════════════════

class TestHealth:
    def test_health_returns_no_model_by_default(self):
        """Without AIRLLM_MODEL set, health should report no_model_loaded."""
        resp = client.get("/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "no_model_loaded"
        assert data["model_loaded"] is False
        assert data["library"] == "airllm"
        assert data["model"] == "not_set"

    def test_health_shows_configured_model(self):
        os.environ["AIRLLM_MODEL"] = "test/model"
        server_module.MODEL_NAME = "test/model"
        resp = client.get("/health")
        assert resp.json()["model"] == "test/model"


# ══════════════════════════════════════════════
# Default Model Info
# ══════════════════════════════════════════════

class TestDefaultModel:
    def test_returns_not_set_when_no_env(self):
        resp = client.get("/models/default")
        assert resp.status_code == 200
        data = resp.json()
        assert data["model"] == "not_set"
        assert data["loaded"] is False

    def test_returns_configured_model(self):
        os.environ["AIRLLM_MODEL"] = "my-org/my-model"
        server_module.MODEL_NAME = "my-org/my-model"
        resp = client.get("/models/default")
        assert resp.json()["model"] == "my-org/my-model"


# ══════════════════════════════════════════════
# Load Model (Error Paths Only — no real weights)
# ══════════════════════════════════════════════

class TestLoadModel:
    def test_load_nonexistent_model_returns_500(self):
        """Loading a fake model should fail gracefully with 500."""
        resp = client.post("/model/load", json={
            "model_name": "this-model-does-not-exist-12345",
        })
        assert resp.status_code == 500
        assert "Failed to load model" in resp.json()["detail"]

    def test_load_model_with_invalid_compression(self):
        """Invalid compression value should still be accepted by pydantic
        (it's string-typed) but will fail at load time."""
        resp = client.post("/model/load", json={
            "model_name": "this-model-does-not-exist-12345",
            "compression": "16bit",  # not a real option
        })
        assert resp.status_code == 500


# ══════════════════════════════════════════════
# Generate (Error Paths — no model loaded)
# ══════════════════════════════════════════════

class TestGenerate:
    def test_generate_without_model_returns_400(self):
        """Without AIRLLM_MODEL or a loaded model, generate should 400."""
        resp = client.post("/generate", json={
            "prompt": "Hello, world!",
            "max_new_tokens": 10,
        })
        assert resp.status_code == 400
        data = resp.json()
        assert "No model loaded" in data["detail"]

    def test_generate_with_nonexistent_model_env_returns_500(self):
        """With AIRLLM_MODEL set to a fake model, generate will try to
        auto-load and fail with 500."""
        os.environ["AIRLLM_MODEL"] = "this-model-does-not-exist-12345"
        server_module.MODEL_NAME = "this-model-does-not-exist-12345"

        resp = client.post("/generate", json={
            "prompt": "Hello",
            "max_new_tokens": 5,
        })
        assert resp.status_code == 500
        assert "Generation failed" in resp.json()["detail"] or \
               "Failed to load model" in resp.json()["detail"]

    def test_generate_request_validation(self):
        """Pydantic should reject missing prompt."""
        resp = client.post("/generate", json={
            "max_new_tokens": 10,
        })
        assert resp.status_code == 422  # Validation error


# ══════════════════════════════════════════════
# Request Validation
# ══════════════════════════════════════════════

class TestValidation:
    def test_generate_invalid_temperature_type(self):
        """Temperature must be a float."""
        resp = client.post("/generate", json={
            "prompt": "test", "temperature": "hot"
        })
        assert resp.status_code == 422

    def test_generate_invalid_token_type(self):
        """max_new_tokens must be an integer."""
        resp = client.post("/generate", json={
            "prompt": "test", "max_new_tokens": "many"
        })
        assert resp.status_code == 422

    def test_load_model_missing_name(self):
        """model_name is required for /model/load."""
        resp = client.post("/model/load", json={})
        assert resp.status_code == 422

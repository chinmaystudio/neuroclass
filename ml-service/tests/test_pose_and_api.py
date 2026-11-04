"""Head-pose / gaze rules and authenticated API behaviour."""
import os
from datetime import datetime, timedelta, timezone

os.environ.setdefault("ML_SERVICE_API_KEY", "test-key-0123456789")

from fastapi.testclient import TestClient  # noqa: E402

from app.core.config import get_settings  # noqa: E402
from app.main import app  # noqa: E402
from app.models.risk_engine import calculate_risk  # noqa: E402
from app.schemas.proctoring import FeatureVector, ProctoringPolicy, TemporalState  # noqa: E402

T0 = datetime(2026, 1, 1, tzinfo=timezone.utc)


def _run(features: FeatureVector, policy: ProctoringPolicy, seconds: int):
    state, events = TemporalState(), []
    for second in range(seconds + 1):
        new_events, state, _, _ = calculate_risk(features, None, 0, 0, state, policy, T0 + timedelta(seconds=second))
        events.extend(new_events)
    return events


def test_looking_down_is_detected_through_pitch():
    policy = ProctoringPolicy(minimum_event_seconds=3, head_pitch_degrees=25)
    events = _run(FeatureVector(face_count=1, head_pose_yaw=2, head_pose_pitch=38), policy, 4)
    assert [e.event_type for e in events] == ["head_away"]


def test_small_natural_head_movement_is_ignored():
    policy = ProctoringPolicy(minimum_event_seconds=3)
    assert _run(FeatureVector(face_count=1, head_pose_yaw=12, head_pose_pitch=8, gaze_horizontal=0.2), policy, 10) == []


def test_brief_glance_away_does_not_emit_event():
    policy = ProctoringPolicy(minimum_event_seconds=4)
    state = TemporalState()
    for second, yaw in enumerate([0, 50, 50, 0, 0, 50, 0]):
        events, state, _, _ = calculate_risk(FeatureVector(face_count=1, head_pose_yaw=yaw), None, 0, 0, state, policy, T0 + timedelta(seconds=second))
        assert events == []


def test_pose_is_not_evaluated_when_several_faces_are_visible():
    policy = ProctoringPolicy(minimum_event_seconds=2)
    events = _run(FeatureVector(face_count=2, head_pose_yaw=70), policy, 3)
    assert {e.event_type for e in events} == {"multiple_faces"}


def test_cooldown_prevents_repeated_warnings():
    policy = ProctoringPolicy(minimum_event_seconds=1, event_cooldown_seconds=30)
    events = _run(FeatureVector(face_count=1, gaze_horizontal=0.95), policy, 20)
    assert len(events) == 1


client = TestClient(app)


def test_endpoints_require_service_key():
    payload = {"attempt_id": "attempt-1"}
    assert client.post("/v1/proctoring/baseline/start", json=payload).status_code == 401
    assert client.post("/v1/proctoring/baseline/start", json=payload, headers={"X-Proctoring-Service-Key": "wrong"}).status_code == 401
    ok = client.post("/v1/proctoring/baseline/start", json=payload, headers={"X-Proctoring-Service-Key": get_settings().service_api_key})
    assert ok.status_code == 200


def test_raw_image_fields_are_rejected():
    headers = {"X-Proctoring-Service-Key": get_settings().service_api_key}
    body = {"attempt_id": "attempt-1", "baseline": {}, "features": {"face_count": 1, "image": "data:image/png;base64,AAAA"}}
    assert client.post("/v1/proctoring/baseline/update", json=body, headers=headers).status_code == 422


def test_oversized_payload_is_rejected():
    headers = {"X-Proctoring-Service-Key": get_settings().service_api_key, "content-type": "application/json"}
    response = client.post("/v1/proctoring/baseline/start", content=b"{" + b" " * 70_000 + b"}", headers=headers)
    assert response.status_code == 413


def test_health_and_ready_are_public_but_minimal():
    assert client.get("/health").json()["status"] == "ok"
    ready = client.get("/ready").json()
    assert set(ready) == {"ready", "model_version"}

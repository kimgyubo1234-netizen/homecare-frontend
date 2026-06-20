"""
어르신 안전 돌봄 서비스 — 로컬 Mock 백엔드
사용법: uvicorn main:app --reload --port 8000
"""
from __future__ import annotations

import asyncio
import json
import os
import random
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, Header, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse

# mock_server/.env 로드 (python-dotenv 없어도 동작하는 간단 파서)
_env_path = Path(__file__).parent / ".env"
if _env_path.exists():
    for _line in _env_path.read_text(encoding="utf-8").splitlines():
        _line = _line.strip()
        if _line and not _line.startswith("#") and "=" in _line:
            _k, _, _v = _line.partition("=")
            os.environ.setdefault(_k.strip(), _v.strip())

ADMIN_EMAIL    = os.environ.get("ADMIN_EMAIL", "admin@test.com")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "admin1234")

app = FastAPI(title="Mock Backend — 어르신 안전 돌봄 서비스")

# Vite 개발 서버(5173~5175) 허용
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:5175",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── 오류 응답을 프론트엔드 형식 { "error": "..." } 으로 통일 ─────────────────
@app.exception_handler(HTTPException)
async def _http_exc(request: Request, exc: HTTPException):
    if isinstance(exc.detail, dict):
        return JSONResponse(status_code=exc.status_code, content=exc.detail)
    return JSONResponse(status_code=exc.status_code, content={"error": str(exc.detail)})


# ── 시간 헬퍼 ─────────────────────────────────────────────────────────────────

def minutes_ago(n: int) -> str:
    return (
        datetime.now(timezone.utc) - timedelta(minutes=n)
    ).strftime("%Y-%m-%dT%H:%M:%S") + "Z"


# ── 모의 데이터 ────────────────────────────────────────────────────────────────

PATIENTS = [
    {
        "patient_id": "P001",
        "name": "김영순",
        "gender": "여",
        "birth_date": "1946-03-15",
        "status": "active",
        "household_code": "HC001",
        "latest_risk_score": {
            "id": 1, "score": 4.2, "risk_level": "high",
            "created_at_utc": minutes_ago(5),
        },
    },
    {
        "patient_id": "P002",
        "name": "박정호",
        "gender": "남",
        "birth_date": "1942-07-22",
        "status": "active",
        "household_code": "HC002",
        "latest_risk_score": {
            "id": 2, "score": 3.2, "risk_level": "medium",
            "created_at_utc": minutes_ago(12),
        },
    },
    {
        "patient_id": "P003",
        "name": "이순자",
        "gender": "여",
        "birth_date": "1949-11-08",
        "status": "active",
        "household_code": "HC003",
        "latest_risk_score": {
            "id": 3, "score": 1.4, "risk_level": "low",
            "created_at_utc": minutes_ago(3),
        },
    },
]

ALERTS = [
    {
        "id": 1, "source": "immediate", "device_key": "DEV001",
        "patient_id": "P001", "alert_type": "낙상 감지", "level": "critical",
        "message": "거실 카메라에서 낙상이 감지되었습니다. 즉시 확인이 필요합니다.",
        "ref_event_id": 10, "ts_utc": minutes_ago(8), "payload": None, "is_read": False,
    },
    {
        "id": 2, "source": "trend", "device_key": "DEV001",
        "patient_id": "P001", "alert_type": "위험점수 상승", "level": "high",
        "message": "최근 6시간 동안 위험점수가 지속 상승하고 있습니다.",
        "ref_event_id": None, "ts_utc": minutes_ago(45), "payload": None, "is_read": False,
    },
    {
        "id": 3, "source": "immediate", "device_key": "DEV002",
        "patient_id": "P002", "alert_type": "비정상 행동", "level": "medium",
        "message": "비정상적인 움직임 패턴이 2시간째 지속되고 있습니다.",
        "ref_event_id": 11, "ts_utc": minutes_ago(120), "payload": None, "is_read": True,
    },
    {
        "id": 4, "source": "trend", "device_key": "DEV002",
        "patient_id": "P002", "alert_type": "장시간 비활동", "level": "medium",
        "message": "4시간 이상 활동이 감지되지 않았습니다.",
        "ref_event_id": None, "ts_utc": minutes_ago(240), "payload": None, "is_read": True,
    },
    {
        "id": 5, "source": "immediate", "device_key": "DEV003",
        "patient_id": "P003", "alert_type": "정상 복귀", "level": "low",
        "message": "활동이 정상 범위로 돌아왔습니다.",
        "ref_event_id": 12, "ts_utc": minutes_ago(200), "payload": None, "is_read": True,
    },
]

# SSE 연결된 클라이언트 큐 목록
_sse_queues: list[asyncio.Queue] = []

EVENTS = {
    "P001": [
        {
            "id": 10, "device_key": "DEV001", "patient_id": "P001",
            "event_type": "fall_detected", "confidence": 0.94, "severity": 9,
            "event_status": "open", "ts_utc": minutes_ago(8), "clip_url": None, "payload": None,
        },
        {
            "id": 13, "device_key": "DEV001", "patient_id": "P001",
            "event_type": "abnormal_posture", "confidence": 0.78, "severity": 6,
            "event_status": "closed", "ts_utc": minutes_ago(60), "clip_url": None, "payload": None,
        },
    ],
    "P002": [
        {
            "id": 11, "device_key": "DEV002", "patient_id": "P002",
            "event_type": "abnormal_motion", "confidence": 0.71, "severity": 5,
            "event_status": "closed", "ts_utc": minutes_ago(120), "clip_url": None, "payload": None,
        },
    ],
    "P003": [
        {
            "id": 12, "device_key": "DEV003", "patient_id": "P003",
            "event_type": "normal_activity", "confidence": 0.88, "severity": 1,
            "event_status": "closed", "ts_utc": minutes_ago(200), "clip_url": None, "payload": None,
        },
    ],
}


def require_auth(authorization: Optional[str]) -> None:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail={"error": "unauthorized"})


# ── 인증 ──────────────────────────────────────────────────────────────────────

@app.post("/api/v1/auth/login")
async def login(request: Request):
    body = await request.json()
    email = (body.get("email") or "").strip()
    password = body.get("password") or ""
    if not email or not password:
        raise HTTPException(status_code=400, detail={"error": "email_and_password_required"})
    if email != ADMIN_EMAIL or password != ADMIN_PASSWORD:
        raise HTTPException(status_code=401, detail={"error": "invalid_credentials"})
    return {
        "access_token": f"mock_token_{email}",
        "user_id": 1,
        "email": email,
        "role": "admin",
    }


# ── 환자 목록 ─────────────────────────────────────────────────────────────────

@app.get("/api/v1/patients")
async def get_patients(authorization: Optional[str] = Header(default=None)):
    require_auth(authorization)
    result = []
    for p in PATIENTS:
        entry = dict(p)
        if entry["latest_risk_score"]:
            rs = dict(entry["latest_risk_score"])
            # 매 요청마다 최신 시간으로 갱신 (카드의 "n분 전" 표시 확인용)
            rs["created_at_utc"] = minutes_ago(random.randint(2, 15))
            entry["latest_risk_score"] = rs
        result.append(entry)
    return {"patients": result}


# ── 알림 목록 ─────────────────────────────────────────────────────────────────

@app.get("/api/v1/alerts")
async def get_alerts(
    patient_id: Optional[str] = Query(default=None),
    days: int = Query(default=7),
    authorization: Optional[str] = Header(default=None),
):
    require_auth(authorization)
    items = list(ALERTS)
    if patient_id:
        items = [a for a in items if a["patient_id"] == patient_id]
    return {"items": items}


# ── SSE 알림 스트림 ───────────────────────────────────────────────────────────

@app.get("/api/v1/alerts/stream")
async def alerts_stream(authorization: Optional[str] = Header(default=None)):
    require_auth(authorization)

    queue: asyncio.Queue = asyncio.Queue()
    _sse_queues.append(queue)

    async def event_stream():
        try:
            yield "data: " + json.dumps({"type": "CONNECTED"}) + "\n\n"
            while True:
                try:
                    msg = await asyncio.wait_for(queue.get(), timeout=30.0)
                    yield msg
                except asyncio.TimeoutError:
                    yield "data: " + json.dumps({"type": "PING"}) + "\n\n"
        finally:
            _sse_queues.remove(queue)

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# ── 테스트용: SSE ALERT 트리거 ────────────────────────────────────────────────

_LEVEL_CONTENT = {
    "critical": ("낙상 감지",    "거실 카메라에서 낙상이 감지되었습니다. 즉시 확인이 필요합니다."),
    "high":     ("위험점수 상승", "최근 위험점수가 급격히 상승하고 있습니다."),
    "medium":   ("비정상 행동",  "비정상적인 움직임 패턴이 감지되었습니다."),
    "low":      ("정상 복귀",    "활동이 정상 범위로 돌아왔습니다."),
}

@app.post("/api/v1/test/alert")
async def trigger_test_alert(
    level: str = Query(default="critical"),
    patient_id: str = Query(default="P001"),
    authorization: Optional[str] = Header(default=None),
):
    require_auth(authorization)
    alert_type, message = _LEVEL_CONTENT.get(level, _LEVEL_CONTENT["critical"])
    new_id = max((a["id"] for a in ALERTS), default=0) + 1
    new_alert = {
        "id": new_id, "source": "immediate", "device_key": "DEV001",
        "patient_id": patient_id, "alert_type": alert_type, "level": level,
        "message": message, "ref_event_id": None,
        "ts_utc": minutes_ago(0), "payload": None, "is_read": False,
    }
    ALERTS.insert(0, new_alert)
    event_str = f"event: ALERT\ndata: {json.dumps(new_alert)}\n\n"
    for q in list(_sse_queues):
        await q.put(event_str)
    return {"ok": True, "alert_id": new_id}


# ── 환자별 대시보드 ───────────────────────────────────────────────────────────

@app.get("/api/v1/dashboard")
async def get_dashboard(
    patient_id: str = Query(),
    authorization: Optional[str] = Header(default=None),
):
    require_auth(authorization)
    raw = next((p for p in PATIENTS if p["patient_id"] == patient_id), None)
    if not raw:
        raise HTTPException(status_code=404, detail={"error": "patient_not_found"})

    patient = {
        "id": PATIENTS.index(raw) + 1,
        "patient_code": raw["patient_id"],
        "name": raw["name"],
        "gender": raw["gender"],
        "birth_date": raw["birth_date"],
        "status": raw["status"],
    }

    latest_risk = None
    if raw["latest_risk_score"]:
        rs = dict(raw["latest_risk_score"])
        latest_risk = {
            **rs,
            "patient_id": patient_id,
            "reason": "모의 분석 데이터",
            "analyzed_from_utc": minutes_ago(60),
            "analyzed_to_utc": minutes_ago(0),
        }

    return {
        "patient": patient,
        "latest_risk": latest_risk,
        "recent_events": EVENTS.get(patient_id, []),
    }


# ── 영상 분석 오버레이 (모의 서버에선 영상 없음 → 404) ────────────────────────

@app.get("/api/v1/analysis/latest")
async def get_latest_analysis(
    patient_id: str = Query(),
    authorization: Optional[str] = Header(default=None),
):
    require_auth(authorization)
    raise HTTPException(status_code=404, detail={"error": "not_found"})

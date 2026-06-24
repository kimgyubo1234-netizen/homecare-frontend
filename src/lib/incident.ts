import type { Incident, IncidentEvent } from '@/types/api';

// 사건(incident) → UI 호환 형태로 변환.
// incident_type을 event_type으로, started_at_utc를 ts_utc로 매핑하여
// 기존 이벤트 분류(event-labels)·표시 컴포넌트를 그대로 재사용한다.
export function toIncidentEvent(i: Incident): IncidentEvent {
  return {
    incident_id: i.incident_id,
    patient_id: i.patient_id,
    incident_type: i.incident_type,
    started_at_utc: i.started_at_utc,
    ended_at_utc: i.ended_at_utc ?? null,
    duration_sec: i.duration_sec ?? null,
    raw_event_count: i.raw_event_count ?? null,
    status: i.status ?? null,
    // 별칭
    id: i.incident_id,
    event_type: i.incident_type,
    ts_utc: i.started_at_utc,
    severity: 0,
  };
}

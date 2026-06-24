export type UserRole = 'admin' | 'guardian';

export interface User {
  id: number;
  email: string;
  role: UserRole;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  user_id: number;
  email: string;
  role: UserRole;
}

export interface ApiErrorResponse {
  error: string;
}

export interface Patient {
  id: number;
  patient_code: string;
  name: string;
  gender: string;
  birth_date: string;
  status: string;
}

export type RiskLevel = 'low' | 'medium' | 'high';

export interface RiskScore {
  id: number;
  patient_id: string;
  score: number;
  risk_level: RiskLevel;
  reason: string;
  analyzed_from_utc: string | null;
  analyzed_to_utc: string | null;
  created_at_utc: string;
}

export interface EventItem {
  id: number;
  device_key: string;
  patient_id: string;
  event_type: string;
  confidence: number | null;
  severity: number;
  event_status: string;
  ts_utc: string;
  clip_url: string | null;
  payload: Record<string, unknown> | null;
}

export interface DashboardResponse {
  patient: Patient;
  latest_risk: RiskScore | null;
  recent_events: EventItem[];
}

export interface EventListResponse {
  items: EventItem[];
}

export type AlertSource = 'immediate' | 'trend';
export type AlertLevel = 'low' | 'medium' | 'high' | 'critical';

export interface AlertItem {
  id: number;
  source: AlertSource;
  device_key: string;
  patient_id: string;
  alert_type: string;
  level: AlertLevel;
  message: string;
  ref_event_id: number | null;
  ts_utc: string;
  payload: Record<string, unknown> | null;
  is_read: boolean;
}

export interface AlertListResponse {
  items: AlertItem[];
}

export interface PatientRiskSummary {
  id: number;
  score: number;
  risk_level: RiskLevel;
  created_at_utc: string;
}

export interface PatientListItem {
  patient_id: string;
  name: string;
  gender: string | null;
  birth_date: string | null;
  status: string;
  household_code: string;
  latest_risk_score: PatientRiskSummary | null;
}

export interface PatientListResponse {
  patients: PatientListItem[];
}

// Admin: 환자 등록
export interface AdminRegisterPatientRequest {
  name: string;
  birth_date?: string;
  gender?: string;
  notes?: string;
}

export interface AdminRegisterPatientResponse {
  patient_id: string;
  message?: string;
}

// Admin: 디바이스 등록
export interface AdminRegisterDeviceRequest {
  device_key: string;
  type: string;
  stream_path?: string;
  patient_id?: string;
}

// Admin: 보호자 관리
export interface GuardianListItem {
  user_id: number;
  email: string;
  patient_ids: string[];
  created_at_utc: string;
}

export interface GuardianListResponse {
  items: GuardianListItem[];
}

export interface AdminRegisterGuardianRequest {
  email: string;
  password: string;
  patient_ids?: string[];
}

export interface AdminRegisterGuardianResponse {
  user_id: number;
  email: string;
  message?: string;
}

export interface ActionEvent {
  id: number;
  patient_id: string;
  device_key: string;
  event_type: string;
  activity_label: string;
  risk_label: 'normal' | 'suspicious' | 'danger';
  risk_score: number;
  raw_score: number;
  confidence: number;
  severity: number;
  event_status: string;
  ts_utc: string;
  clip_url: string | null;
}

export interface ActionEventListResponse {
  items: ActionEvent[];
}

// 사건(incident) 단위 알림 소스 — GET /api/v1/incidents (JWT 인증)
// 파라미터: patient_id / incident_type / status / limit
export interface Incident {
  incident_id: number;
  patient_id: string;
  incident_type: string;
  started_at_utc: string;
  ended_at_utc: string | null;
  duration_sec: number | null;
  raw_event_count: number | null;
  status?: string | null;
}

export interface IncidentListResponse {
  items: Incident[];
}

// UI 호환 형태 — 기존 이벤트 컴포넌트/분류(event-labels)를 그대로 재사용하기 위해
// incident 필드에 id/event_type/ts_utc/severity 별칭을 추가한 형태.
export interface IncidentEvent {
  incident_id: number;
  patient_id: string;
  incident_type: string;
  started_at_utc: string;
  ended_at_utc: string | null;
  duration_sec: number | null;
  raw_event_count: number | null;
  status: string | null;
  // 별칭 (event-labels.EventLike 호환)
  id: number;
  event_type: string;
  ts_utc: string;
  severity: number;
  risk_score?: number | null;
}

import { ApiError } from '@/lib/api';

const codeMessages: Record<string, string> = {
  invalid_credentials: '이메일 또는 비밀번호가 올바르지 않습니다',
  access_denied: '이 데이터에 대한 권한이 없습니다',
  patient_not_found: '환자를 찾을 수 없습니다',
  email_and_password_required: '이메일과 비밀번호를 입력해주세요',
  patient_id_required: '환자를 선택해주세요',
  admin_only: '관리자만 접근 가능합니다',
};

export function getKoreanMessage(error: Error): string {
  if (error instanceof ApiError) {
    return codeMessages[error.code] ?? '요청 처리 중 오류가 발생했습니다';
  }
  return '요청 처리 중 오류가 발생했습니다';
}

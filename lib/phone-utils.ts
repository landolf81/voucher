/**
 * 전화번호 변환 유틸리티 함수들
 */

// 한국 전화번호 입력 형식 검증 (01012345678)
export function validateKoreanPhoneInput(phone: string): boolean {
  const cleaned = phone.replace(/[^0-9]/g, '');
  return /^010[0-9]{8}$/.test(cleaned);
}

// 입력 형식 (01012345678) → DB 저장 형식 (+821012345678)
export function formatPhoneForDB(phone: string): string {
  const cleaned = phone.replace(/[^0-9]/g, '');
  
  if (!validateKoreanPhoneInput(cleaned)) {
    throw new Error('올바른 전화번호 형식이 아닙니다. (예: 01012345678)');
  }
  
  // 010 → +8210 변환
  return `+82${cleaned.substring(1)}`;
}

// DB 형식 (+821012345678) → 표시 형식 (010-1234-5678)
export function formatPhoneForDisplay(phone: string | null | undefined): string {
  if (!phone) return '';
  
  let phoneNumber = phone;
  
  // +821012345678 → 01012345678
  if (phone.startsWith('+821')) {
    phoneNumber = `0${phone.substring(3)}`;
  }
  // 821012345678 → 01012345678 (missing + prefix case)
  else if (phone.startsWith('821') && phone.length === 12) {
    phoneNumber = `0${phone.substring(2)}`;
  }
  // 이미 010으로 시작하면 그대로 사용
  else if (phone.startsWith('010')) {
    phoneNumber = phone;
  }
  
  // 하이픈 추가: 01012345678 → 010-1234-5678
  if (phoneNumber.length === 11 && phoneNumber.startsWith('010')) {
    return `${phoneNumber.slice(0, 3)}-${phoneNumber.slice(3, 7)}-${phoneNumber.slice(7)}`;
  }
  
  return phoneNumber; // 예외적인 경우 원본 반환
}

// 전화번호 입력 필드에서 사용할 포맷팅 (실시간 입력 시)
export function formatPhoneInput(value: string): string {
  const numbers = value.replace(/[^0-9]/g, '');
  
  if (numbers.length <= 3) {
    return numbers;
  } else if (numbers.length <= 7) {
    return `${numbers.slice(0, 3)}-${numbers.slice(3)}`;
  } else if (numbers.length <= 11) {
    return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7)}`;
  }
  
  return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7, 11)}`;
}

// 하이픈 제거 (실제 값 저장 시)
export function cleanPhoneInput(value: string): string {
  return value.replace(/[^0-9]/g, '');
}

// 전화번호 유효성 검사 오류 메시지
export function getPhoneValidationMessage(phone: string): string | null {
  const cleaned = cleanPhoneInput(phone);
  
  if (cleaned.length === 0) {
    return '전화번호를 입력해주세요.';
  }
  
  if (!cleaned.startsWith('010')) {
    return '010으로 시작하는 휴대폰 번호를 입력해주세요.';
  }
  
  if (cleaned.length < 11) {
    return '전화번호가 너무 짧습니다. (11자리 필요)';
  }
  
  if (cleaned.length > 11) {
    return '전화번호가 너무 깁니다. (11자리까지 가능)';
  }
  
  if (!validateKoreanPhoneInput(cleaned)) {
    return '올바른 전화번호 형식이 아닙니다. (예: 01012345678)';
  }
  
  return null;
}
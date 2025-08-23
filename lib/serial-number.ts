/**
 * 교환권 일련번호 생성 및 검증 유틸리티
 * 형식: YYYYMM + 6자리 순서번호 + 2자리 검증번호
 * 예: 20241201234512 (2024년 12월 + 순서번호 012345 + 검증번호 12)
 */

/**
 * 검증번호 계산 (체크섬 알고리즘)
 */
function calculateChecksum(baseNumber: string): string {
  const weights = [3, 7, 1, 3, 7, 1, 3, 7, 1, 3, 7, 1]; // 가중치
  let sum = 0;
  
  for (let i = 0; i < baseNumber.length; i++) {
    sum += parseInt(baseNumber[i]) * weights[i % weights.length];
  }
  
  // 체크섬을 2자리로 만들기 (00-99)
  const checksum = (sum % 100).toString().padStart(2, '0');
  return checksum;
}

/**
 * 교환권 일련번호 생성
 * @param sequenceNumber 순서번호 (1부터 시작)
 * @param issueDate 발행일자 (선택사항, 기본값: 현재 날짜)
 * @returns 생성된 일련번호
 */
export function generateSerialNumber(sequenceNumber: number, issueDate?: Date): string {
  const date = issueDate || new Date();
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  
  // YYYYMM 형식
  const datePrefix = `${year}${month}`;
  
  // 6자리 순서번호 (000001-999999)
  const sequence = sequenceNumber.toString().padStart(6, '0');
  
  // 기본 번호 (년월 + 순서번호)
  const baseNumber = datePrefix + sequence;
  
  // 검증번호 계산
  const checksum = calculateChecksum(baseNumber);
  
  // 최종 일련번호
  return baseNumber + checksum;
}

/**
 * 일련번호 유효성 검증
 * @param serialNumber 검증할 일련번호
 * @returns 유효 여부
 */
export function validateSerialNumber(serialNumber: string): boolean {
  // 길이 체크 (14자리)
  if (serialNumber.length !== 14) {
    return false;
  }
  
  // 숫자만 포함되어 있는지 체크
  if (!/^\d{14}$/.test(serialNumber)) {
    return false;
  }
  
  // 년월 체크 (202001-209912 범위)
  const yearMonth = serialNumber.substring(0, 6);
  const year = parseInt(yearMonth.substring(0, 4));
  const month = parseInt(yearMonth.substring(4, 6));
  
  if (year < 2020 || year > 2099 || month < 1 || month > 12) {
    return false;
  }
  
  // 검증번호 체크
  const baseNumber = serialNumber.substring(0, 12);
  const providedChecksum = serialNumber.substring(12, 14);
  const calculatedChecksum = calculateChecksum(baseNumber);
  
  return providedChecksum === calculatedChecksum;
}

/**
 * 일련번호에서 정보 추출
 * @param serialNumber 일련번호
 * @returns 추출된 정보
 */
export function parseSerialNumber(serialNumber: string) {
  if (!validateSerialNumber(serialNumber)) {
    throw new Error('유효하지 않은 일련번호입니다.');
  }
  
  const year = parseInt(serialNumber.substring(0, 4));
  const month = parseInt(serialNumber.substring(4, 6));
  const sequence = parseInt(serialNumber.substring(6, 12));
  const checksum = serialNumber.substring(12, 14);
  
  return {
    year,
    month,
    sequence,
    checksum,
    issueDate: new Date(year, month - 1, 1),
    isValid: true
  };
}

/**
 * 다음 순서번호 생성 (Mock DB용)
 * @param existingSerials 기존 일련번호 목록
 * @param issueDate 발행일자
 * @returns 다음 순서번호
 */
export function getNextSequenceNumber(existingSerials: string[], issueDate?: Date): number {
  const date = issueDate || new Date();
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const targetPrefix = `${year}${month}`;
  
  // 해당 년월의 기존 일련번호들 필터링
  const sameMonthSerials = existingSerials.filter(serial => 
    serial.startsWith(targetPrefix) && validateSerialNumber(serial)
  );
  
  if (sameMonthSerials.length === 0) {
    return 1; // 첫 번째 일련번호
  }
  
  // 가장 높은 순서번호 찾기
  const maxSequence = Math.max(...sameMonthSerials.map(serial => {
    try {
      return parseSerialNumber(serial).sequence;
    } catch {
      return 0;
    }
  }));
  
  return maxSequence + 1;
}

/**
 * 일련번호 형식 표시용 함수
 * @param serialNumber 일련번호
 * @returns 포맷된 문자열
 */
export function formatSerialNumber(serialNumber: string): string {
  if (!validateSerialNumber(serialNumber)) {
    return serialNumber; // 유효하지 않으면 그대로 반환
  }
  
  // YYYY-MM-XXXXXX-CC 형식으로 표시
  return `${serialNumber.substring(0, 4)}-${serialNumber.substring(4, 6)}-${serialNumber.substring(6, 12)}-${serialNumber.substring(12, 14)}`;
}

/**
 * 교환권 배치 일련번호 생성
 * @param count 생성할 개수
 * @param startSequence 시작 순서번호
 * @param issueDate 발행일자
 * @returns 생성된 일련번호 배열
 */
export function generateBatchSerialNumbers(count: number, startSequence: number, issueDate?: Date): string[] {
  const serialNumbers: string[] = [];
  
  for (let i = 0; i < count; i++) {
    const sequenceNumber = startSequence + i;
    const serialNumber = generateSerialNumber(sequenceNumber, issueDate);
    serialNumbers.push(serialNumber);
  }
  
  return serialNumbers;
}
/**
 * SMS 서비스 인터페이스 및 Mock 구현
 */

export interface SMSVerification {
  phone: string;
  code: string;
  expiresAt: Date;
  attempts: number;
  createdAt: Date;
}

export interface SMSService {
  sendVerificationCode(phone: string): Promise<{ success: boolean; message?: string; devCode?: string }>;
  verifyCode(phone: string, code: string): Promise<{ success: boolean; message?: string }>;
  sendMessage(phone: string, message: string): Promise<{ success: boolean; message?: string }>;
}

/**
 * Mock SMS 서비스 - 개발 환경용
 * 실제 SMS를 발송하지 않고 콘솔에 출력
 */
export class MockSMSService implements SMSService {
  private verifications = new Map<string, SMSVerification>();
  private readonly CODE_LENGTH = 6;
  private readonly EXPIRY_MINUTES = 5;
  private readonly MAX_ATTEMPTS = 3;
  private readonly RESEND_INTERVAL_SECONDS = 60;

  constructor() {
    // 1분마다 만료된 인증 정보 정리
    setInterval(() => this.cleanup(), 60 * 1000);
  }

  /**
   * 인증번호 발송
   */
  async sendVerificationCode(phone: string): Promise<{ success: boolean; message?: string }> {
    try {
      // 전화번호 정규화
      const normalizedPhone = this.normalizePhone(phone);
      if (!this.isValidPhone(normalizedPhone)) {
        return { success: false, message: '유효하지 않은 전화번호 형식입니다.' };
      }

      // 기존 인증 확인 (재발송 제한)
      const existing = this.verifications.get(normalizedPhone);
      if (existing) {
        const timeSinceCreated = Date.now() - existing.createdAt.getTime();
        const resendIntervalMs = this.RESEND_INTERVAL_SECONDS * 1000;
        
        if (timeSinceCreated < resendIntervalMs) {
          const remainingSeconds = Math.ceil((resendIntervalMs - timeSinceCreated) / 1000);
          return { 
            success: false, 
            message: `${remainingSeconds}초 후에 재발송이 가능합니다.` 
          };
        }
      }

      // 6자리 인증번호 생성
      const code = this.generateCode();
      
      // 인증 정보 저장
      const verification: SMSVerification = {
        phone: normalizedPhone,
        code,
        expiresAt: new Date(Date.now() + this.EXPIRY_MINUTES * 60 * 1000),
        attempts: 0,
        createdAt: new Date()
      };
      
      this.verifications.set(normalizedPhone, verification);

      // Mock: 콘솔에 인증번호 출력
      console.log('=====================================');
      console.log('🔔 [Mock SMS] 인증번호 발송');
      console.log(`📱 전화번호: ${normalizedPhone}`);
      console.log(`🔑 인증번호: ${code}`);
      console.log(`⏰ 유효시간: ${this.EXPIRY_MINUTES}분`);
      console.log('=====================================');

      return { 
        success: true, 
        message: '인증번호가 발송되었습니다. (개발 모드: 터미널 콘솔 확인)',
        devCode: process.env.NODE_ENV === 'development' ? code : undefined // 개발 모드에서만 코드 포함
      } as { success: boolean; message?: string; devCode?: string };
    } catch (error) {
      console.error('SMS 발송 오류:', error);
      return { success: false, message: '인증번호 발송에 실패했습니다.' };
    }
  }

  /**
   * 인증번호 검증
   */
  async verifyCode(phone: string, code: string): Promise<{ success: boolean; message?: string }> {
    try {
      const normalizedPhone = this.normalizePhone(phone);
      console.log('SMS 서비스 - 검증 요청:', { phone, normalizedPhone, code });
      console.log('SMS 서비스 - 저장된 인증정보:', Array.from(this.verifications.keys()));
      const verification = this.verifications.get(normalizedPhone);

      // 인증 정보 없음
      if (!verification) {
        return { success: false, message: '인증 정보를 찾을 수 없습니다.' };
      }

      // 만료 확인
      if (new Date() > verification.expiresAt) {
        this.verifications.delete(normalizedPhone);
        return { success: false, message: '인증번호가 만료되었습니다.' };
      }

      // 시도 횟수 확인
      if (verification.attempts >= this.MAX_ATTEMPTS) {
        this.verifications.delete(normalizedPhone);
        return { success: false, message: '인증 시도 횟수를 초과했습니다.' };
      }

      // 인증번호 비교
      verification.attempts++;
      
      if (verification.code !== code) {
        const remainingAttempts = this.MAX_ATTEMPTS - verification.attempts;
        
        if (remainingAttempts === 0) {
          this.verifications.delete(normalizedPhone);
          return { success: false, message: '인증 시도 횟수를 초과했습니다.' };
        }
        
        return { 
          success: false, 
          message: `인증번호가 일치하지 않습니다. (남은 시도: ${remainingAttempts}회)` 
        };
      }

      // 인증 성공 - 정보 삭제
      this.verifications.delete(normalizedPhone);
      
      console.log(`✅ [Mock SMS] 인증 성공: ${normalizedPhone}`);
      
      return { success: true, message: '인증이 완료되었습니다.' };
    } catch (error) {
      console.error('인증 검증 오류:', error);
      return { success: false, message: '인증 처리 중 오류가 발생했습니다.' };
    }
  }

  /**
   * 6자리 숫자 인증번호 생성
   */
  private generateCode(): string {
    let code = '';
    for (let i = 0; i < this.CODE_LENGTH; i++) {
      code += Math.floor(Math.random() * 10).toString();
    }
    return code;
  }

  /**
   * 전화번호 정규화 (하이픈 제거, 국가코드 처리)
   */
  private normalizePhone(phone: string): string {
    // 모든 특수문자 제거
    let normalized = phone.replace(/[^0-9]/g, '');
    
    // 국가코드 처리 (+82, 82로 시작하는 경우)
    if (normalized.startsWith('82')) {
      normalized = '0' + normalized.substring(2);
    }
    
    return normalized;
  }

  /**
   * 전화번호 유효성 검사
   */
  private isValidPhone(phone: string): boolean {
    // 한국 휴대폰 번호 패턴 (010, 011, 016, 017, 018, 019)
    const mobilePattern = /^01[0-9]{8,9}$/;
    return mobilePattern.test(phone);
  }

  /**
   * 만료된 인증 정보 정리
   */
  private cleanup(): void {
    const now = new Date();
    const expiredPhones: string[] = [];
    
    this.verifications.forEach((verification, phone) => {
      if (now > verification.expiresAt) {
        expiredPhones.push(phone);
      }
    });
    
    expiredPhones.forEach(phone => {
      this.verifications.delete(phone);
    });
    
    if (expiredPhones.length > 0) {
      console.log(`🧹 [Mock SMS] ${expiredPhones.length}개의 만료된 인증 정보 정리`);
    }
  }

  /**
   * 일반 SMS 메시지 발송
   */
  async sendMessage(phone: string, message: string): Promise<{ success: boolean; message?: string }> {
    try {
      const normalizedPhone = this.normalizePhone(phone);
      if (!this.isValidPhone(normalizedPhone)) {
        return { success: false, message: '유효하지 않은 전화번호 형식입니다.' };
      }

      // Mock: 콘솔에 메시지 출력
      console.log('=====================================');
      console.log('🔔 [Mock SMS] 메시지 발송');
      console.log(`📱 전화번호: ${normalizedPhone}`);
      console.log(`💬 메시지: ${message}`);
      console.log('=====================================');

      return { 
        success: true, 
        message: 'SMS가 발송되었습니다. (개발 모드: 터미널 콘솔 확인)'
      };
    } catch (error) {
      console.error('SMS 발송 오류:', error);
      return { success: false, message: 'SMS 발송에 실패했습니다.' };
    }
  }

  /**
   * 테스트용: 현재 대기 중인 인증 정보 조회
   */
  getActiveVerifications(): Map<string, SMSVerification> {
    return new Map(this.verifications);
  }
}

/**
 * 네이버 클라우드 SENS 서비스 - 운영 환경용
 * TODO: 실제 구현 필요
 */
export class NCPSensService implements SMSService {
  private serviceId: string;
  private accessKey: string;
  private secretKey: string;
  private fromNumber: string;

  constructor(config: {
    serviceId: string;
    accessKey: string;
    secretKey: string;
    fromNumber: string;
  }) {
    this.serviceId = config.serviceId;
    this.accessKey = config.accessKey;
    this.secretKey = config.secretKey;
    this.fromNumber = config.fromNumber;
  }

  async sendVerificationCode(phone: string): Promise<{ success: boolean; message?: string; devCode?: string }> {
    // TODO: NCP SENS API 연동
    console.warn('NCP SENS 서비스는 아직 구현되지 않았습니다.');
    return { success: false, message: 'SMS 서비스가 준비 중입니다.' };
  }

  async verifyCode(phone: string, code: string): Promise<{ success: boolean; message?: string }> {
    // TODO: 데이터베이스 기반 검증
    console.warn('NCP SENS 서비스는 아직 구현되지 않았습니다.');
    return { success: false, message: 'SMS 서비스가 준비 중입니다.' };
  }

  async sendMessage(phone: string, message: string): Promise<{ success: boolean; message?: string }> {
    // TODO: NCP SENS API 연동
    console.warn('NCP SENS 서비스는 아직 구현되지 않았습니다.');
    return { success: false, message: 'SMS 서비스가 준비 중입니다.' };
  }
}

/**
 * SMS 서비스 팩토리
 */
export function createSMSService(): SMSService {
  const env = process.env.NODE_ENV || 'development';
  const smsProvider = process.env.SMS_PROVIDER || 'mock';

  if (env === 'production' && smsProvider === 'ncp') {
    return new NCPSensService({
      serviceId: process.env.NCP_SENS_SERVICE_ID!,
      accessKey: process.env.NCP_SENS_ACCESS_KEY!,
      secretKey: process.env.NCP_SENS_SECRET_KEY!,
      fromNumber: process.env.SMS_FROM_NUMBER!
    });
  }

  // 개발 환경 또는 Mock 모드
  return new MockSMSService();
}

// Next.js Hot Reload에서도 인스턴스 유지를 위한 전역 객체 사용
const globalForSMS = globalThis as unknown as {
  smsServiceInstance: SMSService | undefined;
};

export function getSMSService(): SMSService {
  if (!globalForSMS.smsServiceInstance) {
    console.log('🔄 SMS 서비스 인스턴스 새로 생성');
    globalForSMS.smsServiceInstance = createSMSService();
  } else {
    console.log('✅ SMS 서비스 인스턴스 재사용');
  }
  return globalForSMS.smsServiceInstance;
}
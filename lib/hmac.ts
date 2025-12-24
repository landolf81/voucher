import crypto from "crypto";
const SECRET = process.env.VOUCHER_HMAC_SECRET || "changeme";

// 발행일자를 포함한 서명 생성
export function sign(serial: string, issuedDate: string, ts: string){
  const h = crypto.createHmac("sha256", SECRET);
  h.update(`${serial}|${issuedDate}|${ts}`);
  return h.digest("hex");
}

// 발행일자를 포함한 서명 검증
export function verify(serial: string, issuedDate: string, ts: string, sig: string){
  const good = sign(serial, issuedDate, ts);
  return crypto.timingSafeEqual(Buffer.from(good), Buffer.from(sig));
}

// 발행일자를 포함한 QR코드 페이로드 생성
export function makePayload(serial: string, issuedAt?: string | Date){
  const ts = new Date().toISOString().replace(/[-:T.Z]/g,"").slice(0,12); // yyyymmddHHMM
  
  // 발행일자를 YYYYMMDD 형식으로 변환
  let issuedDate: string;
  if (issuedAt) {
    const date = typeof issuedAt === 'string' ? new Date(issuedAt) : issuedAt;
    issuedDate = date.toISOString().slice(0,10).replace(/-/g,""); // YYYYMMDD
  } else {
    issuedDate = new Date().toISOString().slice(0,10).replace(/-/g,""); // 오늘 날짜
  }
  
  const sig = sign(serial, issuedDate, ts);
  return `VCH:${serial}|ISSUED:${issuedDate}|TS:${ts}|SIG:${sig}`;
}

// 이전 버전과의 호환성을 위한 레거시 함수들 (deprecated)
export function signLegacy(serial: string, ts: string){
  const h = crypto.createHmac("sha256", SECRET);
  h.update(`${serial}|${ts}`);
  return h.digest("hex");
}

export function verifyLegacy(serial: string, ts: string, sig: string){
  const good = signLegacy(serial, ts);
  return crypto.timingSafeEqual(Buffer.from(good), Buffer.from(sig));
}

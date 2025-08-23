"use client";
import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";

export default function ScanPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [result, setResult] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const [manualInput, setManualInput] = useState<string>("");
  const [isScanning, setIsScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string>("");

  useEffect(() => {
    const codeReader = new BrowserMultiFormatReader();
    let isMounted = true;

    const startScanning = async () => {
      try {
        setIsScanning(true);
        setCameraError("");
        
        const devices = await BrowserMultiFormatReader.listVideoInputDevices();
        if (!devices || devices.length === 0) {
          setCameraError("카메라를 찾을 수 없습니다. PC에서는 수동 입력을 사용하세요.");
          return;
        }

        const deviceId = devices[0]?.deviceId;
        if (!deviceId) {
          setCameraError("카메라 장치 ID를 찾을 수 없습니다.");
          return;
        }

        await codeReader.decodeFromVideoDevice(deviceId, videoRef.current!, (res) => {
          if (!isMounted) return;
          if (res) {
            setResult(res.getText());
            setIsScanning(false);
            // 스캔 성공 시 자동으로 검증
            setTimeout(() => verify(res.getText()), 500);
          }
        });
      } catch (e: any) {
        console.error("카메라 오류:", e);
        setCameraError(`카메라 오류: ${e.message || "알 수 없는 오류"}`);
        setIsScanning(false);
      }
    };

    startScanning();

    return () => { 
      isMounted = false; 
      try {
        // 카메라 리소스 정리
        console.log("카메라 리소스 정리 완료");
      } catch (e) {
        console.log("카메라 정리 중 오류:", e);
      }
    };
  }, []);

  const verify = async (serialToVerify?: string) => {
    const serial = serialToVerify || result || manualInput;
    if (!serial) {
      setStatus("검증할 일련번호를 입력하거나 스캔하세요.");
      return;
    }

    setStatus("검증 중...");
    try {
      const r = await fetch("/api/v1/vouchers/verify", { 
        method: "POST", 
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload: serial }) 
      });
      const data = await r.json();
      setStatus(JSON.stringify(data, null, 2));
    } catch (e: any) {
      setStatus(`검증 오류: ${e.message}`);
    }
  };

  const useVoucher = async () => {
    const serial = result || manualInput;
    if (!serial) {
      setStatus("사용처리할 일련번호를 입력하거나 스캔하세요.");
      return;
    }

    setStatus("사용처리 중...");
    try {
      const r = await fetch("/api/v1/vouchers/use", { 
        method: "POST", 
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serial_no: serial }) 
      });
      const data = await r.json();
      setStatus(JSON.stringify(data, null, 2));
      
      // 사용처리 성공 시 결과 초기화
      if (data.ok) {
        setResult("");
        setManualInput("");
      }
    } catch (e: any) {
      setStatus(`사용처리 오류: ${e.message}`);
    }
  };

  const openPdfA4 = () => {
    const serial = result || manualInput;
    if (!serial) {
      setStatus("PDF를 생성할 일련번호를 입력하거나 스캔하세요.");
      return;
    }
    window.open(`/api/v1/pdf/voucher-a4/${encodeURIComponent(serial)}`, "_blank");
  };

  const handleManualInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setManualInput(e.target.value);
    setResult(""); // 수동 입력 시 스캔 결과 초기화
  };

  const handleManualInputKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      verify();
    }
  };

  return (
    <main style={{padding: 16, maxWidth: 800, margin: "0 auto"}}>
      <h1>교환권 스캔</h1>
      
      {/* 수동 입력 섹션 */}
      <div style={{marginBottom: 24, padding: 16, border: "1px solid #ddd", borderRadius: 8}}>
        <h3>수동 입력 (PC 테스트용)</h3>
        <div style={{display: "flex", gap: 8, marginBottom: 8}}>
          <input 
            placeholder="일련번호를 입력하세요 (예: VCH:12345|TS:202412131200|SIG:abc123...)"
            value={manualInput}
            onChange={handleManualInputChange}
            onKeyPress={handleManualInputKeyPress}
            style={{flex: 1, padding: 8, border: "1px solid #ccc", borderRadius: 4}}
          />
          <button onClick={() => verify()} style={{padding: "8px 16px", backgroundColor: "#007bff", color: "white", border: "none", borderRadius: 4}}>
            검증
          </button>
        </div>
        <small style={{color: "#666"}}>
          PC에서 테스트할 때는 위 입력창에 일련번호를 입력하고 Enter를 누르거나 검증 버튼을 클릭하세요.
        </small>
      </div>

      {/* 카메라 스캔 섹션 */}
      <div style={{marginBottom: 24}}>
        <h3>카메라 스캔</h3>
        {cameraError ? (
          <div style={{padding: 16, backgroundColor: "#fff3cd", border: "1px solid #ffeaa7", borderRadius: 8, color: "#856404"}}>
            {cameraError}
          </div>
        ) : (
          <>
            <video 
              ref={videoRef} 
              style={{
                width: "100%", 
                maxWidth: 480, 
                background: "#000", 
                borderRadius: 8,
                border: isScanning ? "3px solid #28a745" : "3px solid #ddd"
              }} 
            />
            {isScanning && (
              <div style={{textAlign: "center", marginTop: 8, color: "#28a745"}}>
                스캔 중... QR 코드를 카메라에 비춰주세요
              </div>
            )}
          </>
        )}
      </div>

      {/* 결과 및 액션 섹션 */}
      <div style={{marginBottom: 24, padding: 16, backgroundColor: "#f8f9fa", borderRadius: 8}}>
        <h3>결과 및 액션</h3>
        <div style={{marginBottom: 16}}>
          <strong>현재 일련번호:</strong> 
          <span style={{marginLeft: 8, fontFamily: "monospace", backgroundColor: "#e9ecef", padding: "4px 8px", borderRadius: 4}}>
            {result || manualInput || "없음"}
          </span>
        </div>
        
        <div style={{display: "flex", gap: 8, flexWrap: "wrap"}}>
          <button 
            onClick={() => verify()} 
            disabled={!result && !manualInput}
            style={{
              padding: "10px 20px", 
              backgroundColor: "#007bff", 
              color: "white", 
              border: "none", 
              borderRadius: 4,
              cursor: (!result && !manualInput) ? "not-allowed" : "pointer",
              opacity: (!result && !manualInput) ? 0.6 : 1
            }}
          >
            검증
          </button>
          <button 
            onClick={useVoucher} 
            disabled={!result && !manualInput}
            style={{
              padding: "10px 20px", 
              backgroundColor: "#28a745", 
              color: "white", 
              border: "none", 
              borderRadius: 4,
              cursor: (!result && !manualInput) ? "not-allowed" : "pointer",
              opacity: (!result && !manualInput) ? 0.6 : 1
            }}
          >
            사용처리
          </button>
          <button 
            onClick={openPdfA4} 
            disabled={!result && !manualInput}
            style={{
              padding: "10px 20px", 
              backgroundColor: "#6c757d", 
              color: "white", 
              border: "none", 
              borderRadius: 4,
              cursor: (!result && !manualInput) ? "not-allowed" : "pointer",
              opacity: (!result && !manualInput) ? 0.6 : 1
            }}
          >
            A4 PDF
          </button>
        </div>
      </div>

      {/* 상태 표시 */}
      {status && (
        <div style={{padding: 16, backgroundColor: "#f8f9fa", border: "1px solid #dee2e6", borderRadius: 8}}>
          <h3>상태</h3>
          <pre style={{whiteSpace: "pre-wrap", backgroundColor: "#fff", padding: 12, borderRadius: 4, border: "1px solid #dee2e6"}}>
            {status}
          </pre>
        </div>
      )}
    </main>
  );
}

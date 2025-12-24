// CSV 업로드 테스트 스크립트 (간단한 curl 명령어 생성)
const fs = require('fs');

// 테스트용 CSV 데이터 생성 (error.md의 원본 데이터)
const csvContent = `serial_no,amount,association,member_id,name,dob,phone,notes
2410110001,50000,유서1리,006126,강옥희,1952-07-25,,
2410110002,50000,유서1리,002900,김경숙,1952-09-12,,
2410110003,100000,유서1리,008641,김근옥,1962-09-27,,`;

// 임시 CSV 파일 생성 (다른 일련번호로 중복 방지)
const csvFile = 'test-vouchers.csv';
fs.writeFileSync(csvFile, csvContent, 'utf8');

console.log('테스트 CSV 파일 생성됨:', csvFile);
console.log('다음 curl 명령어로 테스트해주세요:');
console.log('');
console.log(`curl -X POST http://localhost:3001/api/vouchers/bulk-issue \\`);
console.log(`  -F "file=@test-vouchers.csv" \\`);
console.log(`  -F "template_id=58c631bf-888c-44e9-b03b-2c0da0896ad0"`);
console.log('');
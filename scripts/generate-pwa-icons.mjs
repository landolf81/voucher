// PWA 아이콘 생성기 — SVG를 sharp로 PNG 변환. `node scripts/generate-pwa-icons.mjs` 로 재생성.
// 브랜드: 교환권(바우처+QR) 모티프, 인디고 배경.
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'public', 'icons');

const BG = '#4f46e5'; // indigo-600

// 티켓(바우처) + QR 모티프. 가운데 ~62% 영역 안에 핵심 그래픽을 둬 maskable safe-zone 충족.
function svg({ bg = BG, bleed = true } = {}) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  ${bleed
    ? `<rect width="512" height="512" fill="${bg}"/>`
    : `<rect x="24" y="24" width="464" height="464" rx="96" fill="${bg}"/>`}
  <!-- 티켓 본체 (가로 노치 2개) -->
  <path fill="#ffffff" d="M150 196
    h212 a18 18 0 0 1 18 18 v34
    a26 26 0 0 0 0 52 v34 a18 18 0 0 1 -18 18
    H150 a18 18 0 0 1 -18 -18 v-34
    a26 26 0 0 0 0 -52 v-34 a18 18 0 0 1 18 -18 Z"/>
  <!-- 점선 천공 -->
  <line x1="300" y1="206" x2="300" y2="306" stroke="${bg}" stroke-width="8" stroke-dasharray="4 14" stroke-linecap="round"/>
  <!-- 좌측: QR 모티프 -->
  <g fill="${bg}">
    <rect x="166" y="224" width="20" height="20" rx="3"/>
    <rect x="196" y="224" width="20" height="20" rx="3"/>
    <rect x="166" y="254" width="20" height="20" rx="3"/>
    <rect x="226" y="254" width="14" height="14" rx="2"/>
    <rect x="196" y="278" width="20" height="20" rx="3"/>
    <rect x="166" y="284" width="14" height="14" rx="2"/>
  </g>
  <!-- 우측: 금액 라인 -->
  <g fill="${bg}">
    <rect x="320" y="232" width="46" height="12" rx="6"/>
    <rect x="320" y="252" width="34" height="10" rx="5"/>
    <rect x="320" y="276" width="46" height="12" rx="6"/>
  </g>
</svg>`;
}

const targets = [
  { name: 'icon-192.png', size: 192, svg: svg({ bleed: true }) },
  { name: 'icon-512.png', size: 512, svg: svg({ bleed: true }) },
  { name: 'icon-maskable-512.png', size: 512, svg: svg({ bleed: true }) },
  { name: 'apple-touch-icon.png', size: 180, svg: svg({ bleed: false }) },
];

await mkdir(outDir, { recursive: true });
for (const t of targets) {
  await sharp(Buffer.from(t.svg))
    .resize(t.size, t.size)
    .png()
    .toFile(join(outDir, t.name));
  console.log(`✓ ${t.name} (${t.size}x${t.size})`);
}
console.log('done →', outDir);

import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// next-intl 요청 설정(src/i18n/request.ts)을 빌드에 연결
const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  // SOC-R20 ■5: Statory 카드 묶음(파일 운반)을 요청 때 다시 그리는 쪽(ISR)에도 싣는다 — 이 폴더의 json 만
  outputFileTracingIncludes: {
    "/*": ["./data/statory/*.json"],
  },
};

export default withNextIntl(nextConfig);

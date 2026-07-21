import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// next-intl 요청 설정(src/i18n/request.ts)을 빌드에 연결
const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {};

export default withNextIntl(nextConfig);

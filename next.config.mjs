/** @type {import('next').NextConfig} */
const nextConfig = {
  // 이미지는 next/image로 최적화(=서버가 원본을 다운로드·재전송)하지 않고
  // 평범한 <img> 태그로 TCGdex CDN을 그대로 핫링크한다. (§2-1 "바이너리 미러링 금지" 원칙과 일치)
  // 만약 next/image를 쓰려면 아래 remotePatterns 주석을 해제할 것.
  // images: {
  //   remotePatterns: [{ protocol: "https", hostname: "assets.tcgdex.net" }],
  // },
};

export default nextConfig;

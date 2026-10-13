import type { NextConfig } from "next";

// The embed may be framed by the desks site; everything else may not be framed at all.
const FRAME_HOSTS = process.env.OBSERVATORY_FRAME_ANCESTORS || "https://lachlanbuilds.com https://*.lachlanbuilds.com";

const nextConfig: NextConfig = {
  async headers() {
    return [
      { source: "/embed", headers: [{ key: "Content-Security-Policy", value: `frame-ancestors 'self' ${FRAME_HOSTS}` }] },
      { source: "/((?!embed).*)", headers: [{ key: "X-Frame-Options", value: "SAMEORIGIN" }] },
    ];
  },
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // The design-asset SVGs under /public/images are our own hand-authored,
    // version-controlled files (never user-uploaded or remote), so allowing
    // next/image to serve them is safe — Next disables SVG by default only
    // because an arbitrary/untrusted SVG can embed a <script>. Locked down
    // with a strict CSP on image responses per Next's own guidance for this
    // flag, as defence in depth even though these files are trusted.
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
};

export default nextConfig;

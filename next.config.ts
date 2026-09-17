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
    // Provider profile photos live in the "avatars" Supabase Storage
    // bucket (public read, owner-scoped write — see SECURITY.md) and are
    // served from the project's own storage host, not arbitrary remote
    // URLs.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "famdxoardiibonghxepl.supabase.co",
        pathname: "/storage/v1/object/public/avatars/**",
      },
      {
        protocol: "https",
        hostname: "famdxoardiibonghxepl.supabase.co",
        pathname: "/storage/v1/object/public/provider-portfolio/**",
      },
      // transaction-evidence is a private bucket — every URL is a
      // short-lived signed URL (see evidence-gallery.tsx), not a public
      // object path. Still worth optimizing: next/image resizes to the
      // requested display size on every fetch even without cross-request
      // caching, so a full-resolution evidence photo is never sent to
      // shrink into a 112px-tall card.
      {
        protocol: "https",
        hostname: "famdxoardiibonghxepl.supabase.co",
        pathname: "/storage/v1/object/sign/transaction-evidence/**",
      },
    ],
  },
};

export default nextConfig;

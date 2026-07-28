import type { NextConfig } from "next";

// Compatibility-first CSP. Next.js App Router injects inline bootstrap scripts
// and the app is styled with inline style attributes, so script-src/style-src
// must allow 'unsafe-inline' (a nonce-based CSP would need middleware changes).
// The value here is clickjacking protection (frame-ancestors 'none') and tight
// resource-origin restrictions; the actual XSS sink was fixed at source.
// Allowed third parties: Google Identity Services (sign-in), Google Fonts,
// Cloudinary images. Persona verification is a hosted redirect (no embed).
const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://accounts.google.com https://apis.google.com https://*.gstatic.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob: https://res.cloudinary.com https://*.gstatic.com",
  "connect-src 'self' https://accounts.google.com",
  "frame-src 'self' https://accounts.google.com",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
];

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
  async redirects() {
    return [
      // The tiered sponsorship page was retired; the Community Partner
      // directory replaces it. 301 so bookmarks, in-store QR codes, and any
      // external links land on the new canonical route. `statusCode: 301`
      // (not `permanent: true`, which Next emits as 308) to match spec.
      {
        source: "/partners",
        destination: "/community-partners",
        statusCode: 301,
      },
    ];
  },
};

export default nextConfig;

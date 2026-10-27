/** @type {import('next').NextConfig} */

const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

// Razorpay Checkout loads its script, opens its payment form in an iframe, and reports
// telemetry; these are the origins it needs.
const razorpay = {
  script: "https://checkout.razorpay.com",
  frame: "https://api.razorpay.com https://checkout.razorpay.com",
  connect: "https://api.razorpay.com https://lumberjack.razorpay.com",
  img: "https://cdn.razorpay.com",
}

const securityHeaders = [
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      `script-src 'self' 'unsafe-eval' 'unsafe-inline' https://cdnjs.cloudflare.com ${razorpay.script}`,
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      `img-src 'self' data: blob: ${razorpay.img}`,
      `connect-src 'self' ${apiUrl} https://api.anthropic.com https://*.run.app ${razorpay.connect}`,
      `frame-src ${razorpay.frame}`,
      "worker-src blob:",
    ].join("; "),
  },
]

const nextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_API_URL: apiUrl,
  },
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }]
  },
  output: "standalone",
}

module.exports = nextConfig

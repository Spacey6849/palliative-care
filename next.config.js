/** @type {import('next').NextConfig} */
const nextConfig = {
  // Removed `output: 'export'` to allow dynamic API routes (streaming Gemini chat)
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: { unoptimized: true },
  experimental: {
    // ensure streaming responses from app routes work smoothly
  }
};

module.exports = nextConfig;

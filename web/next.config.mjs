/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:8000/api/:path*',
      },
    ];
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'earthengine.googleapis.com' },
    ],
  },
};

export default nextConfig;

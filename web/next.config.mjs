/** @type {import('next').NextConfig} */
const nextConfig = {
  // Fully static export — no Node server, no backend at request time.
  // The Python pipeline bakes real data into public/data/*; Vercel serves out/.
  output: "export",
  images: {
    unoptimized: true,
  },
  trailingSlash: true,
};

export default nextConfig;

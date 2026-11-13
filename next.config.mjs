/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: [],
  experimental: { serverActions: { bodySizeLimit: "2mb" } },
};
export default nextConfig;

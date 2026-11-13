/** @type {import('next').NextConfig} */
const nextConfig = {
  // Modules natifs / binaires : ne pas les empaqueter.
  serverExternalPackages: ["ffmpeg-static", "@electric-sql/pglite", "pg"],
  // Embarque le binaire ffmpeg et les polices dans les fonctions Vercel.
  outputFileTracingIncludes: {
    "/**": ["./node_modules/ffmpeg-static/ffmpeg", "./fonts/**"],
  },
  experimental: { serverActions: { bodySizeLimit: "2mb" } },
};
export default nextConfig;

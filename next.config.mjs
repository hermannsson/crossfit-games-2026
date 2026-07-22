/** @type {import('next').NextConfig} */
const nextConfig = {
  // Bundle the /data JSON into the serverless function — it's read at request
  // time via fs with a dynamic path, which Next's tracing can't detect on its own.
  outputFileTracingIncludes: {
    "/": ["./data/**/*"],
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "profilepicsbucket.crossfit.com" },
      { protocol: "https", hostname: "assets.crossfit.com" },
    ],
  },
};

export default nextConfig;

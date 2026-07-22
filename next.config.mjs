/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "profilepicsbucket.crossfit.com" },
      { protocol: "https", hostname: "assets.crossfit.com" },
    ],
  },
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["imapflow", "mailparser", "nodemailer"],
  experimental: {
    serverActions: {
      bodySizeLimit: "52mb",
    },
  },
};

export default nextConfig;

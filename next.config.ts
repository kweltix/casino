import type { NextConfig } from "next";
const config: NextConfig = {
  distDir: process.env.AI_AGENT_TEST_MODE === "1" ? ".next-e2e" : ".next",
  devIndicators: false,
};
export default config;

import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";

const nextConfig = (phase: string): NextConfig => ({
	// Keep dev and prod artifacts in separate directories to avoid cache/chunk conflicts.
	distDir: phase === PHASE_DEVELOPMENT_SERVER ? ".next-dev" : ".next",
	// Emit a traced production server so the runtime image only needs deployed files.
	output: "standalone",
});

export default nextConfig;

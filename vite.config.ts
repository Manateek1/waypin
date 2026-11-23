import { defineConfig } from "vite";

export default defineConfig({ base: process.env.WAYPIN_BASE || "/" });

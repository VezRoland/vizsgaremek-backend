import { defineConfig } from "vitest/config"

export default defineConfig({
	test: {
		globals: true,
		environment: "node",
		setupFiles: [
			"./tests/loadEnv.ts",
			"./tests/setup.ts"
		],
		include: ["tests/**/*.test.ts"],
		fileParallelism: false
	}
})
import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";

export default defineWorkersConfig({
	test: {
		globals: true,
		poolOptions: {
			workers: {
				wrangler: {
					configPath: "./wrangler.json",
				},
				miniflare: {
					d1Databases: {
						DB: "test-db",
					},
					r2Buckets: {
						B_BUCKET_SPEEDKIDS: "test-bucket",
					},
				},
			},
		},
	},
});

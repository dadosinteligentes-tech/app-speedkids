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
					bindings: {
						STRIPE_SECRET_KEY: "sk_test_fake",
						STRIPE_WEBHOOK_SECRET: "whsec_fake",
						STRIPE_PUBLISHABLE_KEY: "pk_test_fake",
						APP_DOMAIN: "test.local",
						PLATFORM_ADMIN_EMAILS: "admin@test.com",
						RESEND_API_KEY: "",
					},
				},
			},
		},
	},
});

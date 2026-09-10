import adapter from '@sveltejs/adapter-auto';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		adapter: adapter(),
		env: {
			public: ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY']
		}
	}
};

export default config;

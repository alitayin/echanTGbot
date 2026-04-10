import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'node',
        pool: 'forks',
        fileParallelism: false,
        server: {
            deps: {
                // Process these through Vite's transform pipeline so vi.mock
                // can intercept require() calls inside CJS modules.
                inline: [
                    /src\//,
                    /config\//,
                ],
            },
        },
        setupFiles: ['./tests/setup.js'],
    },
});

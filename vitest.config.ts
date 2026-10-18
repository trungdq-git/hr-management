import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:net';
export default defineConfig(async () => {
  const port = await new Promise<number>((resolve, reject) => {
    const server = createServer(); server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') { server.close(); reject(new Error('Không cấp được port test')); return; }
      server.close(error => error ? reject(error) : resolve(address.port));
    });
  });
  return { resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } }, test: { environment: 'node', include: ['tests/**/*.test.ts'], fileParallelism: false, testTimeout: 30000, hookTimeout: 120000, env: { DATABASE_URL: `postgresql://itrms_test:test_local_only@127.0.0.1:${port}/itrms_test`, SESSION_SECRET: 'integration-test-secret-for-itrms-32-characters' } } };
});

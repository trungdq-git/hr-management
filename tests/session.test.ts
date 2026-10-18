import { it, expect } from 'vitest';
import { signSession, verifySession } from '../src/lib/session';
it('signs a bounded session and rejects forged tokens',async()=>{const token=await signSession('demo-user');expect(await verifySession(token)).toBe('demo-user');await expect(verifySession(token+'tampered')).rejects.toThrow();});

import { it, expect } from 'vitest';
import { isSameOrigin } from '../src/lib/origin';
it('uses the requested Host when Next normalizes URL, while denying foreign and missing origins',()=>{
  expect(isSameOrigin(new Request('http://localhost:3000',{headers:{origin:'http://127.0.0.1:3000',host:'127.0.0.1:3000'}}))).toBe(true);
  expect(isSameOrigin(new Request('http://localhost:3000',{headers:{origin:'https://evil.test',host:'127.0.0.1:3000'}}))).toBe(false);
  expect(isSameOrigin(new Request('http://localhost:3000'))).toBe(false);
});

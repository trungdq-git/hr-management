/** Next may normalize request.url to localhost; the Host header retains the requested host. */
export function isSameOrigin(request: Request) {
  const origin=request.headers.get('origin');
  if(!origin || origin==='null')return false;
  try {
    const actual=new URL(origin);
    const expected=new URL(request.url);
    return actual.origin===`${expected.protocol}//${request.headers.get('host')??expected.host}`;
  } catch { return false; }
}

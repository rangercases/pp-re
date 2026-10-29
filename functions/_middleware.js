const CANONICAL_ORIGIN = 'https://fasrep.com';

// pages.dev là zone của Cloudflare nên không gắn được Worker route; chuyển hướng ngay trong Functions.
export async function onRequest(context) {
  const url = new URL(context.request.url);
  if (url.hostname.endsWith('.pages.dev')) {
    return Response.redirect(CANONICAL_ORIGIN + url.pathname + url.search, 301);
  }
  return context.next();
}

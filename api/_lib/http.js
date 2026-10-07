export function json(data, { status = 200, cache = "no-store", headers = {} } = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": cache, ...headers }
  });
}

export const siteOrigin = (request) =>
  (process.env.SITE_URL || new URL(request.url).origin).replace(/\/+$/, "");

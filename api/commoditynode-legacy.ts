const SECURITY_HEADERS = {
  'Cache-Control': 'public, max-age=300, s-maxage=3600',
  'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  'Content-Type': 'text/html; charset=utf-8',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-Robots-Tag': 'noindex, nofollow, noarchive, nosnippet',
};

const BODY = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, nofollow, noarchive, nosnippet">
  <title>Route retired · CommodityNode</title>
  <style>
    :root { color-scheme:dark; font-family:"Source Sans 3","Segoe UI",sans-serif; background:#071017; color:#edf3f5; }
    * { box-sizing:border-box; }
    body { margin:0; min-height:100vh; display:grid; place-items:center; padding:1.5rem; }
    main { width:min(100%,720px); border-top:3px solid #44c7bd; padding:2rem 0; }
    p { max-width:62ch; color:#a9bac3; font-size:1.05rem; line-height:1.65; }
    a { color:#79d8d0; text-underline-offset:.2em; }
    a:focus-visible { outline:3px solid #44c7bd; outline-offset:4px; }
    .code { color:#79d8d0; font-size:.78rem; font-weight:800; letter-spacing:.12em; text-transform:uppercase; }
    h1 { margin:.65rem 0 1rem; font-size:clamp(2.3rem,7vw,5rem); line-height:.98; letter-spacing:-.055em; }
  </style>
</head>
<body>
  <main>
    <div class="code">410 · Retired route</div>
    <h1>This page has no verified successor.</h1>
    <p>CommodityNode does not redirect retired reports or unfinished product pages to unrelated destinations. This URL has been removed because no substantively equivalent, evidence-backed page is available.</p>
    <p>Use the <a href="/commodities/">commodity directory</a> or browse <a href="/events/">published events</a>. Their inclusion rules and evidence limits are explicit.</p>
  </main>
</body>
</html>`;

export default function handler(request: Request): Response {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response(null, {
      status: 405,
      headers: { ...SECURITY_HEADERS, Allow: 'GET, HEAD' },
    });
  }
  return new Response(request.method === 'HEAD' ? null : BODY, {
    status: 410,
    headers: SECURITY_HEADERS,
  });
}

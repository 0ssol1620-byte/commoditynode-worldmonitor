import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';

const root = resolve(import.meta.dirname, '..');
const dist = resolve(root, 'dist');
const assets = resolve(dist, 'assets');

const LIMITS = {
  precacheBytes: 3 * 1024 * 1024,
  mainRawBytes: 800 * 1024,
  mainGzipBytes: 240 * 1024,
  mainCssGzipBytes: 90 * 1024,
};

function fail(message) {
  console.error(`[commoditynode-performance] ${message}`);
  process.exitCode = 1;
}

function singleAsset(pattern, label) {
  const matches = readdirSync(assets).filter((name) => pattern.test(name));
  if (matches.length !== 1) {
    fail(`Expected one ${label}; found ${matches.length}: ${matches.join(', ') || 'none'}`);
    return null;
  }
  return resolve(assets, matches[0]);
}

function formatKiB(bytes) {
  return `${(bytes / 1024).toFixed(1)} KiB`;
}

if (!existsSync(resolve(dist, 'sw.js'))) {
  fail('dist/sw.js is missing; run the CommodityNode production build first.');
} else {
  const swSource = readFileSync(resolve(dist, 'sw.js'), 'utf8');
  const urls = [
    ...new Set(
      [...swSource.matchAll(/\burl:"([^"]+)"/g)].map((match) => match[1]),
    ),
  ];
  const missing = [];
  let precacheBytes = 0;
  for (const url of urls) {
    const path = resolve(dist, url.replaceAll('/', '\\'));
    if (!existsSync(path)) {
      missing.push(url);
      continue;
    }
    precacheBytes += statSync(path).size;
  }

  if (missing.length > 0) {
    fail(`Precache references missing build files: ${missing.join(', ')}`);
  }
  if (precacheBytes > LIMITS.precacheBytes) {
    fail(
      `Precache ${formatKiB(precacheBytes)} exceeds ${formatKiB(LIMITS.precacheBytes)}.`,
    );
  }

  const forbidden = urls.filter((url) =>
    /(?:commoditynode-site\/|assets\/(?:maplibre|deck-stack|GlobeMap|panels-(?:markets|energy|defense|news|economy|intel|risk)-|rpc-client-|hls-|sentry-|conflict-zone-|gdelt-intel-|UnifiedSettings-|Map-|MapContainer-|search-manager-|RouteExplorer-)|mapbox-gl-rtl-text)/i.test(
      url,
    ),
  );
  if (forbidden.length > 0) {
    fail(`Lazy feature assets leaked into precache: ${forbidden.join(', ')}`);
  }
  if (!swSource.includes('feature-chunks')) {
    fail('Runtime feature-chunk cache is missing from the generated service worker.');
  }

  const mainPath = singleAsset(/^main-[A-Za-z0-9_-]+\.js$/, 'main JavaScript asset');
  const mainCssPath = singleAsset(/^main-[A-Za-z0-9_-]+\.css$/, 'main CSS asset');
  const measurements = {
    precacheEntries: urls.length,
    precacheBytes,
    mainRawBytes: mainPath ? statSync(mainPath).size : null,
    mainGzipBytes: mainPath ? gzipSync(readFileSync(mainPath)).length : null,
    mainCssGzipBytes: mainCssPath ? gzipSync(readFileSync(mainCssPath)).length : null,
  };

  if (measurements.mainRawBytes > LIMITS.mainRawBytes) {
    fail(
      `Main JavaScript ${formatKiB(measurements.mainRawBytes)} exceeds ${formatKiB(LIMITS.mainRawBytes)}.`,
    );
  }
  if (measurements.mainGzipBytes > LIMITS.mainGzipBytes) {
    fail(
      `Main JavaScript gzip ${formatKiB(measurements.mainGzipBytes)} exceeds ${formatKiB(LIMITS.mainGzipBytes)}.`,
    );
  }
  if (measurements.mainCssGzipBytes > LIMITS.mainCssGzipBytes) {
    fail(
      `Main CSS gzip ${formatKiB(measurements.mainCssGzipBytes)} exceeds ${formatKiB(LIMITS.mainCssGzipBytes)}.`,
    );
  }

  for (const htmlName of ['dashboard.html', 'dashboard-commoditynode.html']) {
    const htmlPath = resolve(dist, htmlName);
    if (!existsSync(htmlPath)) continue;
    const html = readFileSync(htmlPath, 'utf8');
    if (
      /rel="modulepreload"[^>]+href="[^"]*(?:maplibre|deck-stack|GlobeMap|panels-(?:markets|energy|defense|news|economy|intel|risk)-|rpc-client-)/i.test(
        html,
      )
    ) {
      fail(`${htmlName} eagerly modulepreloads a lazy feature chunk.`);
    }
  }

  if (!process.exitCode) {
    console.log(
      JSON.stringify(
        {
          status: 'pass',
          limits: Object.fromEntries(
            Object.entries(LIMITS).map(([key, bytes]) => [key, formatKiB(bytes)]),
          ),
          measured: {
            precacheEntries: measurements.precacheEntries,
            precache: formatKiB(measurements.precacheBytes),
            mainRaw: formatKiB(measurements.mainRawBytes),
            mainGzip: formatKiB(measurements.mainGzipBytes),
            mainCssGzip: formatKiB(measurements.mainCssGzipBytes),
          },
          assets: {
            main: mainPath ? basename(mainPath) : null,
            mainCss: mainCssPath ? basename(mainCssPath) : null,
          },
        },
        null,
        2,
      ),
    );
  }
}

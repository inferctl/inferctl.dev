import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

const siteUrl = 'https://inferctl.dev';
const outputDir = 'dist';
const htmlFiles = [];
const findings = [];

function walk(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) walk(path);
    else if (entry.name.endsWith('.html')) htmlFiles.push(path);
  }
}

function routeFor(file) {
  const path = relative(outputDir, file).replaceAll('\\', '/');
  if (path === 'index.html') return '/';
  if (path.endsWith('/index.html')) return `/${path.slice(0, -'index.html'.length)}`;
  return `/${path}`;
}

function attribute(html, expression) {
  return html.match(expression)?.[1]?.trim() ?? '';
}

function sitemapUrls() {
  const sitemapIndex = readFileSync(join(outputDir, 'sitemap-index.xml'), 'utf8');
  const sitemapFiles = [...sitemapIndex.matchAll(/<loc>([^<]+)<\/loc>/g)]
    .map((match) => new URL(match[1]).pathname.replace(/^\//, ''));

  return sitemapFiles.flatMap((file) => {
    const sitemap = readFileSync(join(outputDir, file), 'utf8');
    return [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
  });
}

function routeExists(pathname, routes) {
  if (routes.has(pathname)) return true;
  if (existsSync(join(outputDir, pathname))) return true;
  return existsSync(join(outputDir, pathname, 'index.html'));
}

walk(outputDir);

const routes = new Set(htmlFiles.map(routeFor));
const titles = new Map();
const descriptions = new Map();
const internalLinks = new Set();

for (const file of htmlFiles) {
  const route = routeFor(file);
  if (route === '/404.html') continue;

  const html = readFileSync(file, 'utf8');
  const title = attribute(html, /<title>([^<]*)<\/title>/i);
  const description = attribute(html, /<meta name="description" content="([^"]*)"/i);
  const canonical = attribute(html, /<link rel="canonical" href="([^"]*)"/i);
  const headingCount = (html.match(/<h1(?:\s|>)/gi) ?? []).length;
  const expectedCanonical = `${siteUrl}${route}`;

  if (!title) findings.push(`${route}: missing title`);
  if (!description) findings.push(`${route}: missing meta description`);
  if (canonical !== expectedCanonical) {
    findings.push(`${route}: canonical is ${canonical || 'missing'}, expected ${expectedCanonical}`);
  }
  if (headingCount !== 1) findings.push(`${route}: has ${headingCount} H1 elements`);

  titles.set(title, [...(titles.get(title) ?? []), route]);
  descriptions.set(description, [...(descriptions.get(description) ?? []), route]);

  for (const match of html.matchAll(/\shref="([^"]+)"/g)) {
    const href = match[1];
    if (href.startsWith('#') || /^(?:mailto:|tel:|javascript:)/i.test(href)) continue;

    const target = new URL(href, `${siteUrl}${route}`);
    if (target.origin === siteUrl) internalLinks.add(target.pathname);
  }
}

for (const [title, pages] of titles) {
  if (title && pages.length > 1) findings.push(`duplicate title: ${title} (${pages.join(', ')})`);
}

for (const [description, pages] of descriptions) {
  if (description && pages.length > 1) {
    findings.push(`duplicate meta description: ${description} (${pages.join(', ')})`);
  }
}

const sitemap = sitemapUrls();
for (const url of sitemap) {
  const parsed = new URL(url);
  if (parsed.origin !== siteUrl) findings.push(`sitemap URL uses a different origin: ${url}`);
  else if (!routeExists(parsed.pathname, routes)) findings.push(`sitemap URL has no generated page: ${url}`);
}

for (const pathname of internalLinks) {
  if (!routeExists(pathname, routes)) findings.push(`internal link has no generated target: ${pathname}`);
}

if (findings.length > 0) {
  console.error(findings.join('\n'));
  process.exit(1);
}

console.log(
  `SEO static audit passed: ${sitemap.length} sitemap URLs, ${routes.size - 1} indexable HTML pages, ${internalLinks.size} internal paths.`,
);

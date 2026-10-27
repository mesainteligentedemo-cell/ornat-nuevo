// Verificación estática del sitio (equivale a "build + lint" en un sitio sin compilación).
// - Sintaxis de cada .js/.mjs (como módulo o como script clásico).
// - JSON y manifiestos válidos.
// - Enlaces y recursos internos (href, src, srcset, poster) que existan en el repo.
// - HTML: <html lang>, un <title>, meta description e ids duplicados.
// Uso: node scripts/check.mjs   (sale con código 1 si encuentra errores)
import { readFile, readdir, stat } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { extname, join, relative, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const SKIP_DIRS = new Set(['.git', 'node_modules', 'scripts']);
const errors = [];
const warnings = [];

async function walk(dir, out = []) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) await walk(full, out); else out.push(full);
  }
  return out;
}

const exists = async path => { try { await stat(path); return true; } catch { return false; } };

function checkJs(file, source) {
  const asModule = spawnSync(process.execPath, ['--input-type=module', '--check'], { input: source, encoding: 'utf8' });
  if (asModule.status === 0) return;
  const asScript = spawnSync(process.execPath, ['--input-type=commonjs', '--check'], { input: source, encoding: 'utf8' });
  if (asScript.status === 0) return;
  errors.push(`${relative(ROOT, file)}: error de sintaxis\n${(asScript.stderr || '').split('\n').slice(0, 5).map(line => line.slice(0, 200)).join('\n')}`);
}

async function resolveRef(ref, htmlFile) {
  const clean = ref.split('#')[0].split('?')[0];
  if (!clean) return true;
  const base = clean.startsWith('/') ? ROOT : dirname(htmlFile);
  const target = join(base, decodeURIComponent(clean));
  if (await exists(target)) return (await stat(target)).isFile() || exists(join(target, 'index.html'));
  return exists(`${target}.html`);
}

async function checkHtml(file, source) {
  const rel = relative(ROOT, file);
  const isTemplate = rel.startsWith('templates/');
  const baseHref = source.match(/<base\s+href="([^"]+)"/i)?.[1];
  if (!/<html[^>]*\slang="[^"]+"/i.test(source)) errors.push(`${rel}: falta <html lang>`);
  const titles = source.match(/<title[\s>]/gi) || [];
  if (titles.length !== 1) errors.push(`${rel}: debe tener exactamente un <title> (tiene ${titles.length})`);
  if (!isTemplate && !/<meta\s+name="description"\s+content="[^"]+"/i.test(source)) errors.push(`${rel}: falta meta description`);
  const markup = source.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<!--[\s\S]*?-->/g, '');
  const ids = new Map();
  for (const [, id] of markup.matchAll(/\sid="([^"]+)"/g)) ids.set(id, (ids.get(id) || 0) + 1);
  for (const [id, n] of ids) if (n > 1) errors.push(`${rel}: id duplicado "${id}" (${n} veces)`);
  const refs = new Set();
  for (const [, attr, value] of markup.matchAll(/\s(href|src|poster|srcset)="([^"]*)"/g)) {
    if (attr === 'srcset') { for (const part of value.split(',')) refs.add(part.trim().split(/\s+/)[0]); continue; }
    refs.add(value);
  }
  for (const [value] of markup.matchAll(/<a\b(?![^>]*\shref=)[^>]*>/g)) if (!/\sname=|role="button"/.test(value)) warnings.push(`${rel}: <a> sin href`);
  for (const ref of refs) {
    if (!ref || /^(https?:|mailto:|tel:|data:|blob:|javascript:|about:|#|\/\/)/i.test(ref) || ref.includes('${')) {
      if (ref === '#') errors.push(`${rel}: enlace con href="#" sin destino`);
      continue;
    }
    if (ref.startsWith('/api/')) continue;
    const from = baseHref ? join(ROOT, baseHref, 'x') : file;
    if (!(await resolveRef(ref, from))) errors.push(`${rel}: recurso o enlace roto "${ref}"`);
  }
}

const files = await walk(ROOT);
for (const file of files) {
  const ext = extname(file).toLowerCase();
  if (!['.js', '.mjs', '.json', '.webmanifest', '.html'].includes(ext)) continue;
  const source = await readFile(file, 'utf8');
  if (ext === '.js' || ext === '.mjs') checkJs(file, source);
  else if (ext === '.html') await checkHtml(file, source);
  else { try { JSON.parse(source); } catch (error) { errors.push(`${relative(ROOT, file)}: JSON inválido (${error.message})`); } }
}

for (const w of warnings) console.warn(`aviso: ${w}`);
for (const e of errors) console.error(`error: ${e}`);
console.log(`\n${files.length} archivos revisados · ${errors.length} errores · ${warnings.length} avisos`);
process.exit(errors.length || warnings.length ? 1 : 0);

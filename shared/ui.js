// ORNAT · utilidades puras compartidas por Capacitación y RRHH (sin DOM al importar, aptas para pruebas en Node).

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const text = (value, max = 500) => String(value ?? '').trim().slice(0, max);
export const isObject = v => v && typeof v === 'object' && !Array.isArray(v);
export const rid = () => globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

// Rechaza claves peligrosas en cualquier nivel (datos importados o guardados).
export function checkKeys(value, depth = 0) {
  if (depth > 12) throw new Error('Datos con demasiados niveles.');
  if (!isObject(value) && !Array.isArray(value)) return;
  for (const [key, item] of Object.entries(value)) {
    if (['__proto__', 'prototype', 'constructor'].includes(key)) throw new Error('Clave no permitida.');
    checkKeys(item, depth + 1);
  }
}

export const clampInt = (value, { min = 0, max = 1e9, fallback = 0 } = {}) => {
  const n = Number(value);
  if (value === '' || value === null || value === undefined || !Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
};

// ---------- fechas (cadenas AAAA-MM-DD, calculadas en UTC para evitar saltos por huso horario) ----------
const pad = n => String(n).padStart(2, '0');
export const isISODate = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s;
export const toUTC = s => new Date(`${s}T00:00:00Z`);
export const fmtISO = d => d.toISOString().slice(0, 10);
export const addDays = (s, n) => fmtISO(new Date(toUTC(s).getTime() + n * 86400000));
export const diffDays = (a, b) => Math.round((toUTC(b) - toUTC(a)) / 86400000);
export const todayISO = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
export const MESES_LARGO = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export const fmtDate = s => (isISODate(s) ? `${Number(s.slice(8))} ${MESES[Number(s.slice(5, 7)) - 1]} ${s.slice(0, 4)}` : '');
export const fmtDateLong = s => (isISODate(s) ? `${Number(s.slice(8))} de ${MESES_LARGO[Number(s.slice(5, 7)) - 1]} de ${s.slice(0, 4)}` : '');
export const fmtMinutes = sec => { const m = Math.round((Number(sec) || 0) / 60); return m < 1 ? '< 1 min' : m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`; };

// ---------- CSV seguro (neutraliza fórmulas =,+,-,@ para Excel/Sheets) ----------
export function csvCell(value) {
  let v = String(value ?? '');
  if (/^[=+\-@\t\r]/.test(v)) v = `'${v}`;
  return /[",\n\r;]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}
export const toCSV = rows => `﻿${rows.map(r => r.map(csvCell).join(',')).join('\r\n')}\r\n`;

export function downloadText(filename, content, mime = 'text/csv;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// ---------- hash determinista (cyrb53) para folios; NO es criptográfico: en producción firma el backend ----------
export function hash53(str, seed = 0) {
  let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < str.length; i++) { const ch = str.charCodeAt(i); h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677); }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

export function memoryStorage() { const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) }; }

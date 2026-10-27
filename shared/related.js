// ORNAT · propiedades relacionadas. Lógica pura (sin DOM) que usan la ficha pública y el alta con IA.
//
//   relatedProperties(target, all, { limit: 6, min: 30 }) -> [{ property, score, reasons[] }]
//
// Puntaje 0-100. Pesos: operación 15 · tipo 20 · ciudad 20 (+6 si además comparten zona, +4 desarrollo)
// · precio 20 (completo dentro de ±10 %, decrece hasta 0 en ±30 %; solo si hay misma moneda) · recámaras 10 · m² 10 (±30 %).
// Si a una de las dos propiedades le falta un dato, ese criterio no suma ni resta (no se castiga lo que no se sabe),
// y el puntaje se normaliza contra los criterios que sí se pudieron comparar.
// Se excluyen la propia propiedad, los borradores y lo ya vendido o rentado. Las apartadas bajan 10 puntos.
const WEIGHTS = { operation: 15, type: 20, city: 20, price: 20, bedrooms: 10, area: 10 };
const norm = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const known = v => v !== null && v !== undefined && v !== '';

export function similarity(a, b) {
  let got = 0, max = 0; const reasons = [];
  const add = (key, ratio, reason) => { max += WEIGHTS[key]; got += WEIGHTS[key] * ratio; if (ratio > 0 && reason) reasons.push(reason); };

  add('operation', a.operation === b.operation ? 1 : 0, a.operation === b.operation ? `Misma operación (${a.operation})` : '');
  add('type', a.type === b.type ? 1 : 0, a.type === b.type ? 'Mismo tipo de propiedad' : '');

  if (known(a.city) && known(b.city)) {
    const sameCity = norm(a.city) === norm(b.city);
    add('city', sameCity ? 1 : 0, sameCity ? `Misma ciudad (${b.city})` : '');
    if (sameCity) {
      const extra = (known(a.zone) && norm(a.zone) === norm(b.zone) ? 6 : 0) + (known(a.development) && norm(a.development) === norm(b.development) ? 4 : 0);
      if (extra) { got += extra; max += extra; reasons.push(norm(a.zone) === norm(b.zone) ? `Misma zona (${b.zone})` : `Mismo desarrollo (${b.development})`); }
    }
  }

  if (known(a.price) && known(b.price) && a.price > 0 && a.currency === b.currency) {
    const diff = Math.abs(b.price - a.price) / a.price;
    const ratio = diff <= 0.1 ? 1 : diff >= 0.3 ? 0 : 1 - (diff - 0.1) / 0.2;
    add('price', ratio, ratio > 0 ? (diff <= 0.1 ? 'Precio casi igual (±10 %)' : `Precio dentro de ±30 % (${diff > 0 ? (b.price > a.price ? '+' : '−') : ''}${Math.round(diff * 100)} %)`) : '');
  }

  if (known(a.bedrooms) && known(b.bedrooms)) {
    const d = Math.abs(a.bedrooms - b.bedrooms);
    add('bedrooms', d === 0 ? 1 : d === 1 ? 0.5 : 0, d === 0 ? `Mismas recámaras (${b.bedrooms})` : d === 1 ? `Recámaras muy cercanas (${b.bedrooms})` : '');
  }

  if (known(a.areaM2) && known(b.areaM2) && a.areaM2 > 0) {
    const diff = Math.abs(b.areaM2 - a.areaM2) / a.areaM2;
    add('area', diff <= 0.1 ? 1 : diff >= 0.3 ? 0 : 1 - (diff - 0.1) / 0.2, diff < 0.3 ? `Superficie parecida (±${Math.max(10, Math.round(diff * 100))} %)` : '');
  }

  const score = max ? Math.round((got / max) * 100) : 0;
  return { score, reasons };
}

export function relatedProperties(target, all, { limit = 6, min = 30 } = {}) {
  if (!target) return [];
  return all
    .filter(p => p.id !== target.id && !p.draft && !['vendido', 'rentado'].includes(p.status))
    .map(p => { const s = similarity(target, p); return { property: p, score: Math.max(0, s.score - (p.status === 'apartado' ? 10 : 0)), reasons: s.reasons }; })
    .filter(r => r.score >= min)
    .sort((x, y) => y.score - x.score || Date.parse(y.property.createdAt) - Date.parse(x.property.createdAt))
    .slice(0, Math.max(1, Math.min(12, limit)));
}

/** Texto del tooltip: por qué se parece. */
export const explain = r => `${r.score} % de afinidad · ${r.reasons.length ? r.reasons.join(' · ') : 'comparte pocos datos'}`;

/* ORNAT · Territorio — Playa del Carmen como póster de mapa.
   Se inserta sola antes del footer de cada página. Póster A4 dibujado en canvas 2D con
   las calles reales de OpenStreetMap; temas Tinta, Noche, Papel y Lima; horizontal en escritorio, vertical en tableta y celular; descarga a 300 ppp.
   Geografía y calles: © colaboradores de OpenStreetMap (ODbL), en data/pdc-geo.json.
   Fotos: Wikimedia Commons (licencias CC), con crédito en cada foto. */

const HERE = new URL('./', import.meta.url);
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const COARSE = matchMedia('(pointer: coarse)').matches;

/* ---------------------------------------------------------------- geografía */
// Proyección local en km con origen en Parque Fundadores. x = este, z = sur. (Igual que build.py.)
const LAT0 = 20.6225, LON0 = -87.0735;
const KX = 111.32 * Math.cos(LAT0 * Math.PI / 180), KZ = 110.57;
const proj = (lat, lon) => [(lon - LON0) * KX, -(lat - LAT0) * KZ];

// Categorías con su ícono (trazo de 16 px, currentColor)
const CATS = {
  playa: { n: 'Playas', g: '<path d="M1 10.5c2 0 2-2 4-2s2 2 4 2 2-2 4-2 2 2 2 2M1 14c2 0 2-2 4-2s2 2 4 2 2-2 4-2 2 2 2 2"/><circle cx="11.5" cy="4" r="2"/>' },
  ciudad: { n: 'Ciudad y noche', g: '<path d="M12.8 10.4A5.6 5.6 0 0 1 5.6 3.2a5.6 5.6 0 1 0 7.2 7.2z"/><path d="M12 2.5v2M11 3.5h2"/>' },
  cultura: { n: 'Cultura', g: '<path d="M2 14h12M3 6.2h10M8 2 2.5 5.4h11zM4.6 7.5v5M8 7.5v5M11.4 7.5v5"/>' },
  cenote: { n: 'Cenotes', g: '<path d="M8 1.8S3.2 7.2 3.2 10.1a4.8 4.8 0 0 0 9.6 0C12.8 7.2 8 1.8 8 1.8z"/><path d="M5.8 10.6a2.3 2.3 0 0 0 2.2 2"/>' },
  natura: { n: 'Naturaleza', g: '<path d="M3 13.5C3 6.5 7 3 13.5 2.5 13 9.5 10 13.5 3 13.5zM3 13.5 9.5 7"/>' },
  ferry: { n: 'Ferris y transporte', g: '<path d="M1.8 10h12.4l-2.2 3.8H4zM4 10V6.2h8V10M8 6.2V2.4M8 2.4l3 2"/>' },
  cozumel: { n: 'Cozumel', g: '<path d="M1.5 13.8h13M5.4 13.8c0-4.2 1.4-7.2 2.6-8.6M8 5.2C6.6 3.4 4 3.2 2.6 4.4M8 5.2c1.4-1.8 4-2 5.4-.8M8 5.2c0-1.8-1-3.2-2.6-3.6"/>' }
};
const glyph = c => `<svg class="pdc__g" viewBox="0 0 16 16" aria-hidden="true">${CATS[c].g}</svg>`;

// 27 lugares reales; coordenadas de OpenStreetMap. star = parte del recorrido guiado.
// z = zona · d = descripción · ok = ideal para · tips = consejos prácticos.
const POIS = [
  { id: 'mamitas', c: 'playa', n: 'Playa Mamitas', lat: 20.63109, lon: -87.0652, r: 2.1, star: 1, z: 'Centro norte · calle 28',
    d: 'Una de las playas más animadas del centro, a la altura de la calle 28. Clubes de playa con camastros, música y restaurantes junto al mar; la arena es de acceso público.',
    ok: ['Club de playa', 'Ambiente con música', 'Nadar'],
    tips: ['Llega antes de las 11 h si quieres camastro.', 'Algunos clubes piden consumo mínimo por el camastro: pregunta antes de sentarte.', 'Desde la Quinta Avenida se llega caminando por la calle 28.'] },
  { id: 'coco-beach', c: 'playa', n: 'Coco Beach', lat: 20.63651, lon: -87.06008, r: 2.1, z: 'Norte del centro',
    d: 'Playa al norte del centro, frente a la colonia del mismo nombre. Más tranquila que Mamitas, con arena clara y agua baja, cómoda para ir con niños.',
    ok: ['Familias', 'Nadar', 'Caminar por la orilla'],
    tips: ['Entre los hoteles hay callejones de acceso público hacia el mar.', 'Camina por la orilla hacia el sur: Mamitas está a unos 10 minutos.'] },
  { id: 'punta-esmeralda', c: 'cenote', n: 'Punta Esmeralda', lat: 20.64832, lon: -87.05075, r: 2.3, star: 1, z: 'Norte de la ciudad',
    d: 'Playa pública muy querida por las familias locales. Un cenote desemboca en la orilla y forma pozas de agua dulce y fría justo al lado del mar.',
    ok: ['Familias', 'Agua dulce y salada', 'Plan local'],
    tips: ['La entrada es libre; las palapas se llenan en fin de semana.', 'Mete los pies en la poza del cenote: el agua dulce es mucho más fría que el mar.'] },
  { id: 'xcalacoco', c: 'playa', n: 'Playa Xcalacoco', lat: 20.66267, lon: -87.03244, r: 2.5, z: 'Norte · Xcalacoco',
    d: 'Playa tranquila al norte de la ciudad, entre hoteles pequeños y casas de playa, lejos del movimiento del centro.',
    ok: ['Calma', 'Caminar', 'Desconectar'],
    tips: ['Llega en taxi o auto: está a unos 6 km de Parque Fundadores.', 'Lleva agua y lo que necesites: hay menos servicios que en el centro.'] },
  { id: 'maroma', c: 'playa', n: 'Playa Maroma', lat: 20.73768, lon: -86.96568, r: 2.6, z: 'Riviera Maya · rumbo a Puerto Morelos',
    d: 'Playa de arena blanca y agua turquesa al norte, rumbo a Puerto Morelos, entre hoteles y selva. Suele aparecer entre las playas más bonitas del Caribe mexicano.',
    ok: ['Arena blanca', 'Snorkel', 'Excursión de un día'],
    tips: ['Ve en auto por la carretera federal 307.', 'Buena parte del frente de playa es de hoteles: el acceso suele ser por tour o club de playa.'] },
  { id: 'quinta', c: 'ciudad', n: 'Quinta Avenida', lat: 20.6313, lon: -87.06909, r: 2.2, star: 1, z: 'Centro',
    d: 'El corredor peatonal paralelo al mar, a una cuadra de la playa. Arranca en Parque Fundadores y sube hacia el norte entre tiendas, restaurantes, galerías y música en vivo.',
    ok: ['Pasear', 'Comer y cenar', 'Compras'],
    tips: ['Al atardecer y de noche es cuando más ambiente tiene.', 'Las calles que la cruzan llevan directo al mar.'] },
  { id: 'avenida-10', c: 'ciudad', n: 'Avenida 10', lat: 20.62666, lon: -87.07377, r: 1.6, z: 'Centro',
    d: 'La avenida paralela a la Quinta, a dos cuadras del mar. Más tranquila y local: hoteles pequeños, cafés, panaderías y comercio de barrio.',
    ok: ['Desayunar', 'Café', 'Hospedaje'],
    tips: ['Suele tener precios más locales que la Quinta Avenida.', 'Úsala para moverte de sur a norte sin la multitud de la Quinta.'] },
  { id: 'calle-12', c: 'ciudad', n: 'Calle 12', lat: 20.62767, lon: -87.07182, r: 1.6, z: 'Centro',
    d: 'El tramo con más vida nocturna del centro: bares, antros, música y terrazas entre la Quinta Avenida y la playa.',
    ok: ['Vida nocturna', 'Bares', 'Música'],
    tips: ['El ambiente arranca tarde, después de las 22 h.', 'Ve en grupo y regresa en taxi de sitio.'] },
  { id: 'faro', c: 'cultura', n: 'El Faro', lat: 20.62607, lon: -87.07125, r: 1.5, z: 'Centro · calle 10',
    d: 'El faro frente al mar a la altura de la calle 10, junto a la playa del centro. Es uno de los puntos más fotografiados de la ciudad.',
    ok: ['Fotos', 'Amanecer', 'Caminar por la playa'],
    tips: ['Al amanecer la luz es la mejor para fotos: el sol sale sobre el mar.', 'Desde aquí puedes caminar por la orilla hasta Parque Fundadores.'] },
  { id: 'paseo-del-carmen', c: 'ciudad', n: 'Paseo del Carmen', lat: 20.62182, lon: -87.07665, r: 1.7, z: 'Centro sur',
    d: 'Centro comercial al aire libre, con andadores entre jardines, tiendas, cafés y restaurantes, a unos pasos de Parque Fundadores y del muelle.',
    ok: ['Compras', 'Comer', 'Aire libre'],
    tips: ['Buen punto para esperar el ferry a Cozumel.', 'Conecta caminando con la Quinta Avenida y con la entrada a Playacar.'] },
  { id: 'playacar', c: 'ciudad', n: 'Playacar', lat: 20.61652, lon: -87.07962, r: 2.8, z: 'Sur · Playacar',
    d: "Zona residencial y hotelera al sur del centro, con calles entre selva y jardines, villas, hoteles todo incluido y campo de golf. Dentro están las ruinas de Xaman Ha'.",
    ok: ['Caminar o pedalear', 'Golf', 'Hospedaje'],
    tips: ['Es una zona tranquila para caminar temprano, con sombra de árboles.', "Busca entre los jardines las ruinas de Xaman Ha' (están en este mapa)."] },
  { id: 'fundadores', c: 'cultura', n: 'Parque Fundadores', lat: 20.62203, lon: -87.07497, r: 1.8, star: 1, z: 'Centro · inicio de la Quinta',
    d: 'La plaza frente al mar donde arranca la Quinta Avenida. Aquí están la escultura monumental del Portal Maya y el poste de los Voladores de Papantla.',
    ok: ['Fotos', 'Voladores de Papantla', 'Punto de encuentro'],
    tips: ['Los voladores se presentan varias veces al día; se agradece una cooperación.', 'Es el punto de partida ideal para recorrer la Quinta Avenida.'] },
  { id: 'plaza-28-julio', c: 'cultura', n: 'Plaza 28 de Julio', lat: 20.6278, lon: -87.0751, r: 1.5, z: 'Centro',
    d: "La plaza cívica junto al Palacio Municipal, con foro al aire libre y un mural sobre la historia de Xaman Ha'. Su nombre recuerda el 28 de julio de 1993, cuando se creó el municipio de Solidaridad.",
    ok: ['Vida local', 'Eventos', 'Historia'],
    tips: ['Revisa la agenda municipal: aquí hay conciertos, ferias y festejos.', 'Queda a pocas cuadras de la Quinta Avenida.'] },
  { id: 'parroquia', c: 'cultura', n: 'Parroquia del Carmen', lat: 20.62903, lon: -87.07348, r: 1.5, z: 'Centro',
    d: 'Parroquia dedicada a Nuestra Señora del Carmen, la virgen que da nombre a la ciudad. Un templo sencillo a unos pasos de la Quinta Avenida.',
    ok: ['Historia', 'Calma', 'Tradición'],
    tips: ['La fiesta patronal es el 16 de julio, día de la Virgen del Carmen.', 'Entra con ropa adecuada y en silencio durante las misas.'] },
  { id: 'parque-leona-vicario', c: 'ciudad', n: 'Parque Leona Vicario', lat: 20.6241, lon: -87.0771, r: 1.5, z: 'Centro',
    d: 'Parque de barrio a unas cuadras de la Quinta, con árboles grandes, juegos infantiles y la estatua de Leona Vicario, heroína de la Independencia de México.',
    ok: ['Vida local', 'Niños', 'Sombra'],
    tips: ['Buen lugar para ver el Playa de todos los días, lejos del flujo turístico.', 'Está a unos 5 minutos caminando de Parque Fundadores.'] },
  { id: 'xaman-ha', c: 'cultura', n: "Ruinas de Xaman Ha'", lat: 20.6150, lon: -87.0831, r: 1.8, star: 1, z: 'Playacar',
    d: "Vestigios mayas entre los jardines de Playacar. Xaman Ha' («agua del norte») fue el asentamiento maya donde hoy está Playa del Carmen y, según la tradición, punto de salida de los peregrinos hacia el santuario de Ixchel en Cozumel.",
    ok: ['Historia maya', 'Fotos', 'Paseo corto'],
    tips: ['Son estructuras pequeñas repartidas en la zona: combínalas con un paseo por Playacar.', 'Lleva agua y repelente.'] },
  { id: 'rio-secreto', c: 'cenote', n: 'Río Secreto', lat: 20.58823, lon: -87.13398, r: 2.4, star: 1, z: 'Sur · carretera 307',
    d: 'Río subterráneo que se recorre por dentro, caminando y nadando entre estalactitas y estalagmitas, con guía y equipo. Cavernas inundadas formadas durante miles de años.',
    ok: ['Aventura', 'Cuevas', 'Naturaleza'],
    tips: ['Solo se visita en recorridos guiados: reserva con anticipación.', 'Normalmente no se permiten cámaras propias dentro; confírmalo al reservar.'] },
  { id: 'xcaret', c: 'natura', n: 'Xcaret', lat: 20.58131, lon: -87.11956, r: 2.8, star: 1, z: 'Sur · carretera 307',
    d: 'Parque ecoarqueológico sobre la costa: ríos subterráneos, playa, vestigios mayas, fauna y, por la noche, el espectáculo «Xcaret México Espectacular».',
    ok: ['Familias', 'Día completo', 'Cultura mexicana'],
    tips: ['Planea el día completo y compra los boletos en línea.', 'Usa bloqueador biodegradable: es requisito para nadar en ríos y cenotes.'] },
  { id: 'xplor', c: 'natura', n: 'Xplor', lat: 20.5928, lon: -87.12429, r: 2.4, z: 'Sur · carretera 307',
    d: 'Parque de aventura junto a Xcaret: tirolesas sobre la selva, vehículos anfibios, nado y balsas en ríos subterráneos entre estalactitas.',
    ok: ['Aventura', 'Tirolesas', 'Grupos y amigos'],
    tips: ['Algunas actividades tienen límite de estatura: revísalo si vas con niños.', 'Existe también Xplor Fuego, la versión nocturna del parque.'] },
  { id: 'mayakoba', c: 'natura', n: 'Mayakoba', lat: 20.686, lon: -87.0282, r: 2.6, z: 'Norte · carretera 307',
    d: 'Complejo de hoteles de lujo entre canales, lagunas y manglar, al norte de la ciudad. Ahí está El Camaleón, campo de golf que ha recibido torneos del PGA Tour.',
    ok: ['Lujo', 'Golf', 'Naturaleza'],
    tips: ['El acceso es para huéspedes o con reservación en restaurantes, spa o golf.', 'Los paseos en lancha por los canales muestran el manglar y su fauna.'] },
  { id: 'muelle', c: 'ferry', n: 'Muelle a Cozumel', lat: 20.61915, lon: -87.07271, r: 2, star: 1, z: 'Centro · calle 1 Sur',
    d: 'De aquí salen los ferris que cruzan el canal hacia Cozumel. El cruce dura entre 35 y 45 minutos y hay salidas a lo largo del día.',
    ok: ['Ir a Cozumel', 'Vista al mar', 'Fotos del canal'],
    tips: ['Compra el boleto en las taquillas del muelle o en línea.', 'Si el mar está picado, siéntate en la parte baja y al centro del barco.'] },
  { id: 'ado', c: 'ferry', n: 'Terminal ADO Turística', lat: 20.62281, lon: -87.0752, r: 1.5, z: 'Centro · Quinta Avenida y Juárez',
    d: 'Terminal de autobuses junto a Parque Fundadores, al inicio de la Quinta Avenida. Desde aquí salen camiones al aeropuerto de Cancún, a Tulum y a otras ciudades.',
    ok: ['Aeropuerto de Cancún', 'Viajar por la Riviera', 'Llegar al centro'],
    tips: ['El trayecto al aeropuerto de Cancún toma alrededor de una hora.', 'Hay otra terminal ADO, más grande, sobre la Avenida 20.'] },
  { id: 'cozumel', c: 'cozumel', n: 'Cozumel', lat: 20.51255, lon: -86.95142, r: 5.5, star: 1, z: 'Isla de Cozumel',
    d: 'La isla al otro lado del canal. Es la isla más grande del Caribe mexicano y sus arrecifes, parte del Sistema Arrecifal Mesoamericano, la hicieron famosa entre buzos de todo el mundo.',
    ok: ['Buceo y snorkel', 'Excursión de un día', 'Playas'],
    tips: ['Llega en ferry desde el Muelle de Playa del Carmen.', 'En la isla se renta auto, moto o bici para recorrer la costa este, más agreste.'] },
  { id: 'parque-benito-juarez', c: 'cozumel', n: 'Parque Benito Juárez', lat: 20.51033, lon: -86.94958, r: 1.3, z: 'Cozumel · San Miguel',
    d: 'La plaza principal de San Miguel de Cozumel, frente al malecón y al muelle donde llega el ferry. Punto de reunión con kiosco, bancas y eventos.',
    ok: ['Vida local', 'Punto de encuentro', 'Paseo nocturno'],
    tips: ['Es lo primero que ves al bajar del ferry: buen punto de partida para la isla.', 'Las calles que salen de la plaza concentran tiendas y restaurantes.'] },
  { id: 'malecon-cozumel', c: 'cozumel', n: 'Malecón de Cozumel', lat: 20.5113, lon: -86.9503, r: 1.6, z: 'Cozumel · San Miguel',
    d: 'El paseo frente al mar de San Miguel, sobre la avenida Rafael E. Melgar, con esculturas, vista al canal y los ferris yendo y viniendo.',
    ok: ['Atardecer', 'Pasear', 'Fotos'],
    tips: ['Mira al poniente: es el mejor lugar de la zona para ver el sol ponerse sobre el mar.', 'Recórrelo a pie o en bici al caer la tarde.'] },
  { id: 'punta-langosta', c: 'cozumel', n: 'Muelle Punta Langosta', lat: 20.50983, lon: -86.95624, r: 1.5, z: 'Cozumel · San Miguel',
    d: 'Muelle de cruceros en el centro de San Miguel, con una zona comercial al lado. Cuando hay barcos atracados, el centro se llena de visitantes.',
    ok: ['Cruceros', 'Compras', 'Vista al canal'],
    tips: ['Revisa el calendario de cruceros si buscas una isla más tranquila.', 'Está a unos 10 minutos caminando del Parque Benito Juárez.'] },
  { id: 'cruceros', c: 'cozumel', n: 'Terminal de cruceros', lat: 20.4793, lon: -86.97312, r: 2, z: 'Cozumel · costa oeste',
    d: 'Muelle internacional de cruceros al sur de San Miguel, sobre la costa oeste de la isla, uno de los puertos de cruceros con más tráfico del mundo.',
    ok: ['Cruceros', 'Compras', 'Costa oeste'],
    tips: ['Al sur siguen clubes de playa y arrecifes de la costa oeste.', 'Toma taxi para ir al centro de San Miguel: son unos 4 km.'] }
];
const POI_IX = Object.fromEntries(POIS.map((p, i) => [p.id, i]));

// Datos calculados para la ficha: distancias en línea recta y lugares cercanos.
const PXZ = POIS.map(p => proj(p.lat, p.lon));
const kmTxt = d => (d < 1 ? `${Math.max(10, Math.round(d * 100) * 10)} m` : `${d.toFixed(1)} km`);
const dist = (i, j) => Math.hypot(PXZ[i][0] - PXZ[j][0], PXZ[i][1] - PXZ[j][1]);
const walk = d => `≈ ${Math.max(2, Math.round(d * 1.3 / 4.8 * 60))} min a pie`;   // 1.3 = rodeo de las calles
function poiFacts(i) {
  const p = POIS[i], out = [['Zona', p.z]];
  if (p.c === 'cozumel') {
    out.push(['Cómo llegar', 'Ferry desde el Muelle de Playa, 35 a 45 min']);
    const bj = POI_IX['parque-benito-juarez'];
    if (p.id !== 'cozumel' && i !== bj) { const d = dist(i, bj); out.push(['Desde el ferry', `${kmTxt(d)} · ${d <= 2.5 ? walk(d) : 'en taxi'}`]); }
  } else if (p.id !== 'fundadores') {
    const d = dist(i, POI_IX.fundadores);
    out.push(['Desde Parque Fundadores', `${kmTxt(d)} en línea recta`]);
    out.push(['Cómo llegar', d <= 2.5 ? walk(d) : 'En auto o taxi']);
  }
  out.push(['Coordenadas', `${p.lat.toFixed(4)}, ${p.lon.toFixed(4)}`]);
  return out;
}
function poiNear(i, n = 3) {
  const isle = POIS[i].c === 'cozumel';
  return POIS.map((p, j) => j).filter(j => j !== i && (POIS[j].c === 'cozumel') === isle && POIS[j].id !== 'cozumel')
    .sort((a, b) => dist(i, a) - dist(i, b)).slice(0, n);
}
function poiMeta(i) {
  const p = POIS[i];
  if (p.c === 'cozumel') return `${p.z} · ferry desde Playa`;
  return p.id === 'fundadores' ? p.z : `${p.z} · ${kmTxt(dist(i, POI_IX.fundadores))} de Parque Fundadores`;
}

// Tipos para filtrar y buscar (un lugar puede tener varios). kw = otras palabras con las que también se encuentra.
const TIPOS = {
  turistico: { n: 'Sitios turísticos', kw: 'turismo turista atracciones imperdible que ver visitar conocer' },
  playa: { n: 'Playas', kw: 'playa mar arena beach' },
  cenote: { n: 'Cenotes y ríos', kw: 'cenote rio subterraneo caverna cueva agua dulce' },
  parque: { n: 'Parques de diversiones', kw: 'parque tematico diversion atracciones aventura tirolesa ninos familia' },
  arqueo: { n: 'Zonas arqueológicas', kw: 'ruinas maya arqueologia arqueologico piramide vestigios prehispanico' },
  historia: { n: 'Cultura e historia', kw: 'cultura historia historico iglesia templo tradicion' },
  plaza: { n: 'Parques y plazas', kw: 'parque plaza jardin explanada' },
  noche: { n: 'Vida nocturna', kw: 'bar antro fiesta noche club musica' },
  compras: { n: 'Compras', kw: 'tienda shopping centro comercial mall souvenir' },
  natura: { n: 'Naturaleza', kw: 'naturaleza selva manglar ecologico ecoturismo animales' },
  hotel: { n: 'Hoteles y resorts', kw: 'hotel resort hospedaje lujo' },
  transporte: { n: 'Transporte', kw: 'transporte terminal' },
  cozumel: { n: 'Cozumel', kw: 'isla cozumel san miguel' }
};
const TIPO_DE = {
  mamitas: 'playa turistico', 'coco-beach': 'playa', 'punta-esmeralda': 'playa cenote natura', xcalacoco: 'playa', maroma: 'playa natura',
  quinta: 'turistico compras noche', 'avenida-10': 'compras', 'calle-12': 'noche', faro: 'turistico', 'paseo-del-carmen': 'compras',
  playacar: 'hotel natura', fundadores: 'turistico plaza historia', 'plaza-28-julio': 'plaza historia', parroquia: 'historia turistico',
  'parque-leona-vicario': 'plaza', 'xaman-ha': 'arqueo historia turistico', 'rio-secreto': 'cenote natura turistico',
  xcaret: 'parque cenote arqueo natura turistico', xplor: 'parque cenote natura', mayakoba: 'hotel natura',
  muelle: 'transporte turistico', ado: 'transporte', cozumel: 'cozumel playa natura turistico', 'parque-benito-juarez': 'cozumel plaza',
  'malecon-cozumel': 'cozumel turistico', 'punta-langosta': 'cozumel transporte compras', cruceros: 'cozumel transporte'
};
// Palabras propias de cada lugar (pesan igual que su nombre)
const KW_DE = {
  muelle: 'ferry ferri barco lancha', ado: 'autobus camion bus aeropuerto', 'punta-langosta': 'crucero barco', cruceros: 'crucero barco',
  cozumel: 'buceo snorkel arrecife', fundadores: 'voladores papantla portal maya', mayakoba: 'golf', playacar: 'golf',
  xcaret: 'espectaculo show', 'rio-secreto': 'estalactitas', 'calle-12': 'antro bar', mamitas: 'club de playa'
};
POIS.forEach(p => { p.t = TIPO_DE[p.id].split(' '); });

// Búsqueda sin acentos ni mayúsculas, tolerante a plurales ("cenotes", "parques de diversiones", "ruinas").
// Primero en nombre, tipos y palabras clave; si nada coincide, también en descripción, zona y "ideal para".
const norm = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const STOP = new Set(['de', 'del', 'la', 'las', 'el', 'los', 'y', 'en', 'para', 'con', 'un', 'una', 'al', 'por', 'que', 'mas', 'cerca']);
const qTokens = q => norm(q).split(/[^a-z0-9]+/).filter(w => w.length > 1 && !STOP.has(w)).map(w => (w.length > 4 ? w.replace(/(es|s)$/, '') : w));
const SEARCH_A = POIS.map(p => norm([p.n, KW_DE[p.id] || '', ...p.t.map(k => `${TIPOS[k].n} ${TIPOS[k].kw}`)].join(' ')));
const SEARCH_B = POIS.map((p, i) => norm([SEARCH_A[i], CATS[p.c].n, p.z, p.d, p.ok.join(' '), p.tips.join(' ')].join(' ')));
const TIPO_TXT = Object.fromEntries(Object.entries(TIPOS).map(([k, t]) => [k, norm(`${t.n} ${t.kw}`)]));
const TIPO_N = Object.fromEntries(Object.keys(TIPOS).map(k => [k, POIS.filter(p => p.t.includes(k)).length]));
// Índices que coinciden con la búsqueda (null si no hay búsqueda)
function searchIdx(q) {
  const t = qTokens(q);
  if (!t.length) return null;
  const hit = arr => POIS.map((p, i) => i).filter(i => t.every(w => arr[i].includes(w)));
  const a = hit(SEARCH_A);
  return new Set(a.length ? a : hit(SEARCH_B));
}

/* ---------------------------------------------------------------- utilidades */
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const ease = t => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
// Decodifica [n, x0, z0, dx, dz, ...] (enteros en `unit` metros) a puntos en km.
function dec(a, unit, off = 0) {
  const n = a[off], s = unit / 1000; let x = a[off + 1], z = a[off + 2];
  const p = [[x * s, z * s]];
  for (let k = 1, i = off + 3; k < n; k++, i += 2) { x += a[i]; z += a[i + 1]; p.push([x * s, z * s]); }
  return p;
}

/* ---------------------------------------------------------------- temas del póster (marca ORNAT) */
const THEMES = {
  tinta: { n: 'Tinta', d: 'Negro ORNAT con todas las calles en lima, de la avenida al callejón.',
    sea: '#050506', land: '#0f0f10', park: '#121a0a', lake: '#050506', bld: 'rgba(152,255,3,.09)',
    major: 'rgba(152,255,3,.88)', ter: 'rgba(152,255,3,.66)', res: 'rgba(152,255,3,.36)', ped: 'rgba(152,255,3,.55)', svc: 'rgba(152,255,3,.13)',
    pier: 'rgba(152,255,3,.5)', coast: 'rgba(152,255,3,.26)', ferry: 'rgba(152,255,3,.6)',
    text: '#f4f1ea', rule: '#98ff03', sub: '#98ff03', faint: 'rgba(244,241,234,.5)', mk: '#98ff03', mkRing: '#0a0a0b', sw: ['#0f0f10', '#98ff03', '#5b9902', '#050506'] },
  noche: { n: 'Noche', d: 'Negro con calles crema: sobrio, para una pared elegante.',
    sea: '#050506', land: '#111112', park: '#16170f', lake: '#050506', bld: 'rgba(244,241,234,.07)',
    major: 'rgba(244,241,234,.92)', ter: 'rgba(244,241,234,.62)', res: 'rgba(244,241,234,.32)', ped: 'rgba(244,241,234,.5)', svc: 'rgba(244,241,234,.11)',
    pier: 'rgba(244,241,234,.5)', coast: 'rgba(244,241,234,.22)', ferry: 'rgba(152,255,3,.7)',
    text: '#f4f1ea', rule: '#98ff03', sub: '#f4f1ea', faint: 'rgba(244,241,234,.5)', mk: '#98ff03', mkRing: '#0a0a0b', sw: ['#111112', '#f4f1ea', '#8a887f', '#050506'] },
  papel: { n: 'Papel', d: 'Crema ORNAT con trazo de tinta, como lámina impresa.',
    sea: '#e2dccd', land: '#f4f1ea', park: '#e3e8d0', lake: '#e2dccd', bld: 'rgba(10,10,11,.07)',
    major: 'rgba(10,10,11,.9)', ter: 'rgba(10,10,11,.62)', res: 'rgba(10,10,11,.26)', ped: 'rgba(10,10,11,.5)', svc: 'rgba(10,10,11,.11)',
    pier: 'rgba(10,10,11,.5)', coast: 'rgba(10,10,11,.26)', ferry: 'rgba(10,10,11,.55)',
    text: '#0a0a0b', rule: '#0a0a0b', sub: '#456e00', faint: 'rgba(10,10,11,.55)', mk: '#98ff03', mkRing: '#0a0a0b', sw: ['#f4f1ea', '#0a0a0b', '#98ff03', '#e2dccd'] },
  lima: { n: 'Lima', d: 'El lima de la marca a todo color, con trazo negro.',
    sea: '#78cb00', land: '#98ff03', park: '#8bee00', lake: '#78cb00', bld: 'rgba(10,10,11,.08)',
    major: 'rgba(10,10,11,.9)', ter: 'rgba(10,10,11,.64)', res: 'rgba(10,10,11,.28)', ped: 'rgba(10,10,11,.52)', svc: 'rgba(10,10,11,.12)',
    pier: 'rgba(10,10,11,.55)', coast: 'rgba(10,10,11,.3)', ferry: 'rgba(10,10,11,.6)',
    text: '#0a0a0b', rule: '#0a0a0b', sub: '#0a0a0b', faint: 'rgba(10,10,11,.6)', mk: '#0a0a0b', mkRing: '#98ff03', sw: ['#98ff03', '#0a0a0b', '#f4f1ea', '#78cb00'] }
};
const CITY = 'Playa del Carmen', REGION = 'Quintana Roo, México';
const unproj = (x, z) => [LAT0 - z / KZ, LON0 + x / KX];
const fmtCoord = (x, z) => { const [la, lo] = unproj(x, z); return `${Math.abs(la).toFixed(4)}° ${la >= 0 ? 'N' : 'S'} / ${Math.abs(lo).toFixed(4)}° ${lo >= 0 ? 'E' : 'O'}`; };

/* ---------------------------------------------------------------- arranque */
function boot() {
  if (document.querySelector('.pdc')) return;
  const css = document.createElement('link');
  css.rel = 'stylesheet'; css.href = new URL('mapa-pdc.css', HERE).href;
  css.onload = css.onerror = mount;
  document.head.appendChild(css);
}

function mount() {
  const sec = buildDom();
  const main = document.querySelector('main');
  // Home de ornat-nuevo: el footer se revela fijo detrás de <main>, así que el mapa cierra <main>.
  if (main && document.querySelector('#footer.foot-reveal')) main.append(sec);
  else {
    const anchor = document.querySelector('footer.foot') || document.querySelector('.legal__links') || document.querySelector('body > footer');
    if (anchor) anchor.before(sec); else (main || document.body).append(sec);
  }
  const setVw = () => sec.style.setProperty('--pdc-vw', document.documentElement.clientWidth + 'px');
  setVw(); addEventListener('resize', setVw);
  requestAnimationFrame(() => dispatchEvent(new Event('resize')));
  if (document.fonts) document.fonts.ready.then(() => dispatchEvent(new Event('resize')));

  wireUi(sec);
  const m = location.hash.match(/^#pdc-([\w-]+)$/);
  if (m && m[1] in POI_IX) {
    sec.pdc.select(POI_IX[m[1]], { silent: true });
    const go = () => sec.scrollIntoView({ block: 'start' });
    if (document.readyState === 'complete') requestAnimationFrame(go); else addEventListener('load', () => setTimeout(go, 60), { once: true });
  }
  new IntersectionObserver((es, io) => { if (es[0].isIntersecting) { sec.classList.add('is-in'); io.disconnect(); } }, { rootMargin: '0px 0px -12% 0px' }).observe(sec.querySelector('.pdc__head'));
  new IntersectionObserver((es, io) => {
    if (!es[0].isIntersecting) return;
    io.disconnect();
    start(sec).catch(err => { console.warn('[mapa-pdc]', err); fail(sec); });
  }, { rootMargin: '600px 0px' }).observe(sec);
}

const pad2 = n => String(n).padStart(2, '0');
const ROOM = 'M0-78H78V0M0-78V-50M0-30V-24';
const markSvg = () => `<svg class="pdc-poster__mk" viewBox="-100 -100 200 200" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="9">${[270, 0, 90, 180].map(a => `<path transform="rotate(${a})" d="${ROOM}"/>`).join('')}</g><rect x="-24" y="-24" width="48" height="48"/></svg>`;

function buildDom() {
  const s = document.createElement('section');
  s.className = 'pdc'; s.id = 'playa-del-carmen';
  s.setAttribute('aria-labelledby', 'pdc-h');
  s.dataset.sheet = 'Territorio'; s.dataset.theme = 'paper';
  const items = POIS.map((p, i) => `<li data-i="${i}"><button type="button" data-poi="${i}" aria-pressed="false">${glyph(p.c)}<span class="pdc__n">${pad2(i + 1)}</span><span class="pdc__nm">${p.n}</span><span class="pdc__cam" aria-hidden="true" hidden></span><i class="pdc__seen" aria-hidden="true"></i></button></li>`).join('');
  const tipos = `<button type="button" data-tipo="all" aria-pressed="true">Todo<em>${POIS.length}</em></button>` + Object.entries(TIPOS).map(([k, t]) => `<button type="button" data-tipo="${k}" aria-pressed="false">${t.n}<em>${TIPO_N[k]}</em></button>`).join('');
  const themes = Object.entries(THEMES).map(([k, t]) => `<button type="button" class="pdc-theme" data-theme-k="${k}" aria-pressed="false"><span class="pdc-theme__sw">${t.sw.map(c => `<i style="background:${c}"></i>`).join('')}</span><span class="pdc-theme__n">${t.n}</span></button>`).join('');
  s.innerHTML = `
<div class="pdc__head">
  <div>
    <p class="pdc__label pdc__label--lime">( Territorio )</p>
    <h2 class="pdc__h" id="pdc-h"><span><span>Dibujamos</span></span><span><span>desde <em>aquí.</em></span></span></h2>
  </div>
  <div class="pdc__side">
    <p class="pdc__lede">Playa del Carmen como póster: cada calle, el mar y ${POIS.length} lugares. <b>Busca</b> cenotes, playas o ruinas y toca un punto para ver sus fotos.</p>
    <div class="pdc__coords"><span class="pdc__label pdc__label--faint">20°37′ N · 87°04′ O</span><span class="pdc__label pdc__label--faint">Quintana Roo, México</span></div>
  </div>
</div>
<div class="pdc-stage">
  <div class="pdc-find" role="search" aria-label="Buscar en el mapa">
    <div class="pdc-find__box">
      <svg class="pdc-find__i" viewBox="0 0 16 16" aria-hidden="true"><circle cx="7" cy="7" r="4.6"/><path d="m10.4 10.4 3.6 3.6"/></svg>
      <input type="search" data-q placeholder="Busca cenotes, playas, ruinas, parques…" autocomplete="off" spellcheck="false" enterkeyhint="search" role="combobox" aria-expanded="false" aria-controls="pdc-sug" aria-autocomplete="list" aria-label="Buscar lugares: cenotes, playas, parques de diversiones, sitios turísticos">
      <button type="button" class="pdc-find__x" data-q-clear aria-label="Borrar búsqueda" hidden>×</button>
      <div class="pdc-sug" id="pdc-sug" data-sug role="listbox" aria-label="Sugerencias" data-lenis-prevent hidden></div>
    </div>
    <p class="pdc__label pdc__label--lime pdc-find__n" data-found aria-live="polite">${POIS.length} lugares</p>
    <div class="pdc-find__chips" role="group" aria-label="Filtrar por tipo de lugar">${tipos}</div>
  </div>
  <div class="pdc-col">
    <figure class="pdc-poster" data-pt="tinta" aria-label="Póster del mapa de Playa del Carmen">
      <canvas class="pdc-poster__cv" aria-hidden="true"></canvas>
      <div class="pdc-poster__fade" aria-hidden="true"></div>
      <div class="pdc-mks" aria-label="Lugares en el mapa"></div>
      <div class="pdc-pv" aria-hidden="true" hidden></div>
      <figcaption class="pdc-poster__t">
        <p class="pdc-poster__city" aria-label="${CITY}">${CITY}</p>
        <i class="pdc-poster__rule" aria-hidden="true"></i>
        <p class="pdc-poster__sub" data-sub>${REGION}</p>
        <p class="pdc-poster__co" data-coord>20.6225° N / 87.0735° O</p>
      </figcaption>
      <p class="pdc-poster__cr pdc-poster__cr--l">${markSvg()}© ORNAT</p>
      <p class="pdc-poster__cr pdc-poster__cr--r">© colaboradores de OpenStreetMap</p>
      <div class="pdc__veil"><span>Trazando el póster</span></div>
      <div class="pdc__toast" role="status" aria-live="polite"></div>
      <div class="pdc__done pdc__panel" role="dialog" aria-labelledby="pdc-done-h" hidden>
        <p class="pdc__label pdc__label--lime">( Póster completo )</p>
        <h3 id="pdc-done-h">Descubriste los <em>${POIS.length} lugares.</em></h3>
        <p class="pdc__done-p">Tu Playa del Carmen ya tiene todos sus puntos. Llévate el póster con la marca de ORNAT.</p>
        <div class="pdc__done-a">
          <button type="button" class="pdc__mini pdc__mini--wide pdc__mini--lime" data-done-share>Descargar mi póster</button>
          <button type="button" class="pdc__mini pdc__mini--wide" data-done-close>Seguir explorando</button>
        </div>
        <button type="button" class="pdc__done-reset" data-done-reset>Empezar de nuevo</button>
      </div>
    </figure>
    <div class="pdc-ctl">
      <button type="button" class="pdc-btn" data-recenter><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 5V2h3M11 2h3v3M14 11v3h-3M5 14H2v-3"/><circle cx="8" cy="8" r="2"/></svg>Recentrar</button>
      <button type="button" class="pdc-btn" data-edit aria-pressed="false"><svg viewBox="0 0 16 16" aria-hidden="true"><rect x="3" y="7" width="10" height="7" rx="1.5"/><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0V7" data-lock/></svg><span data-edit-t>Editar mapa</span></button>
      <span class="pdc-zoom"><button type="button" class="pdc-btn pdc-btn--i" data-zoom="-1" aria-label="Acercar">+</button><button type="button" class="pdc-btn pdc-btn--i" data-zoom="1" aria-label="Alejar">−</button></span>
      <button type="button" class="pdc-btn pdc__tour" data-tour aria-pressed="false"><span class="pdc__tour-i" aria-hidden="true"></span><span data-tour-t>Recorrido</span></button>
      <button type="button" class="pdc-btn pdc-btn--lime" data-download><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2v8M4.5 6.5 8 10l3.5-3.5M2.5 13.5h11"/></svg>Descargar póster</button>
      <p class="pdc__label pdc__label--faint pdc-ctl__hint" data-hint></p>
    </div>
  </div>
  <aside class="pdc-side" aria-label="Tema, ficha y lugares del mapa">
    <section class="pdc__panel pdc-themes">
      <div class="pdc-themes__top"><p class="pdc-set__h">( Tema )</p><label class="pdc-sw"><input type="checkbox" data-bld><span></span>Edificios</label></div>
      <p class="pdc-themes__d" data-theme-d></p>
      <div class="pdc-themes__row">${themes}</div>
    </section>
    <aside class="pdc__card pdc__panel" aria-live="polite" hidden>
      <button class="pdc__card-x" type="button" aria-label="Cerrar ficha">×</button>
      <p class="pdc__card-k"><span class="pdc__label pdc__label--lime" data-c-n></span><span class="pdc__label pdc__label--faint pdc__card-cat" data-c-cat></span></p>
      <h3 class="pdc__card-h" data-c-h></h3>
      <div class="pdc__strip" data-strip hidden></div>
      <p class="pdc__card-d" data-c-d></p>
      <div class="pdc__sub"><p class="pdc__label pdc__label--faint">( Ideal para )</p><div class="pdc__ok" data-c-ok></div></div>
      <dl class="pdc__facts" data-c-facts></dl>
      <div class="pdc__sub"><p class="pdc__label pdc__label--faint">( Tips )</p><ul class="pdc__tips" data-c-tips></ul></div>
      <div class="pdc__sub"><p class="pdc__label pdc__label--faint">( Cerca de aquí )</p><div class="pdc__near" data-c-near></div></div>
      <div class="pdc__card-a">
        <button type="button" class="pdc__mini" data-prev aria-label="Lugar anterior">←</button>
        <button type="button" class="pdc__mini" data-next aria-label="Lugar siguiente">→</button>
        <a class="pdc__mini pdc__mini--wide" data-go target="_blank" rel="noopener">Cómo llegar ↗</a>
        <button type="button" class="pdc__mini pdc__mini--wide" data-share>Compartir</button>
      </div>
    </aside>
    <nav class="pdc__index pdc__panel" aria-label="Lugares del mapa" data-lenis-prevent>
      <div class="pdc__prog"><span class="pdc__label pdc__label--faint">( Descubiertos )</span><span class="pdc__label pdc__label--lime" data-prog>00 / ${pad2(POIS.length)}</span><i><b data-prog-bar></b></i></div>
      <ol>${items}</ol>
      <p class="pdc__empty" data-empty hidden>Ningún lugar coincide con tu búsqueda. <button type="button" data-empty-reset>Ver todos</button></p>
    </nav>
  </aside>
</div>
<div class="pdc__foot"><span class="pdc__label pdc__label--faint">ORNAT© · Territorio</span><span class="pdc__label pdc__label--faint">Póster vectorial · descarga en alta resolución (A4 a 300 ppp)</span><span class="pdc__label pdc__label--faint">Datos <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© colaboradores de OpenStreetMap</a> · Fotos de sus autores en <a href="https://commons.wikimedia.org" target="_blank" rel="noopener">Wikimedia Commons</a> (licencias CC)</span></div>`;
  return s;
}

/* UI: lista, ficha, galerías, progreso, recorrido. El motor del póster se engancha por `sec.pdc.gl`. */
function wireUi(sec) {
  const $ = q => sec.querySelector(q);
  const card = $('.pdc__card');
  const api = sec.pdc = { gl: null, sel: -1, cat: 'all', touring: false };
  const toastEl = $('.pdc__toast'); let toastT = 0;
  api.toast = msg => { toastEl.textContent = msg; toastEl.classList.add('is-on'); clearTimeout(toastT); toastT = setTimeout(() => toastEl.classList.remove('is-on'), 1700); };

  // Lugares descubiertos (comodidad por visitante; si el navegador bloquea el almacenamiento, solo dura la visita)
  const KEY = 'ornat-pdc-descubiertos';
  let seen = new Set();
  try { seen = new Set(JSON.parse(localStorage.getItem(KEY) || '[]').filter(id => id in POI_IX)); } catch (e) { /* sin almacenamiento */ }
  const progT = $('[data-prog]'), progB = $('[data-prog-bar]'), progBox = $('.pdc__prog'), done = $('.pdc__done');
  const drawSeen = () => {
    const full = seen.size === POIS.length;
    progT.textContent = `${pad2(seen.size)} / ${pad2(POIS.length)}${full ? ' ✓' : ''}`;
    progB.style.transform = `scaleX(${seen.size / POIS.length})`;
    progBox.classList.toggle('is-done', full);
    if (full) { progBox.setAttribute('role', 'button'); progBox.tabIndex = 0; progBox.setAttribute('aria-label', 'Póster completo: abrir'); }
    else { progBox.removeAttribute('role'); progBox.removeAttribute('tabindex'); progBox.removeAttribute('aria-label'); }
    sec.querySelectorAll('.pdc__index [data-poi]').forEach(b => b.classList.toggle('is-seen', seen.has(POIS[+b.dataset.poi].id)));
    api.gl && api.gl.redraw();
  };
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify([...seen])); } catch (e) { /* sin almacenamiento */ } };
  const markSeen = id => {
    if (seen.has(id)) return;
    seen.add(id); drawSeen(); save();
    if (seen.size === POIS.length) { if (api.touring) api.tour(false); setTimeout(() => api.complete(), 1800); }
    else if (seen.size % 5 === 0) api.toast(`${seen.size} lugares descubiertos`);
  };
  api.seen = seen;
  api.complete = () => { done.hidden = false; sec.classList.add('has-done'); void done.offsetWidth; done.classList.add('is-on'); };
  const closeDone = () => { done.classList.remove('is-on'); sec.classList.remove('has-done'); setTimeout(() => { done.hidden = true; }, 400); };
  progBox.addEventListener('click', () => { if (seen.size === POIS.length) api.complete(); });
  progBox.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && seen.size === POIS.length) { e.preventDefault(); api.complete(); } });
  $('[data-done-close]').addEventListener('click', closeDone);
  $('[data-done-reset]').addEventListener('click', () => { seen.clear(); save(); drawSeen(); closeDone(); api.toast('Póster reiniciado'); });
  $('[data-done-share]').addEventListener('click', () => api.gl && api.gl.download());

  // Buscador y filtro por tipo: la lista, los puntos del póster y la descarga muestran lo mismo
  api.type = 'all'; api.q = '';
  let qset = null;
  api.match = i => (api.type === 'all' || POIS[i].t.includes(api.type)) && (!qset || qset.has(i));
  const visibleList = () => POIS.map((p, i) => i).filter(api.match);
  const input = $('[data-q]'), clearQ = $('[data-q-clear]'), sug = $('[data-sug]'), found = $('[data-found]'), empty = $('[data-empty]');
  const fitNow = () => { const l = visibleList(); if (l.length && api.gl) api.gl.fit(l); };
  const applyFilter = fit => {
    const n = visibleList().length, on = api.type !== 'all' || !!qset;
    sec.querySelectorAll('.pdc-find__chips [data-tipo]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.tipo === api.type)));
    sec.querySelectorAll('.pdc__index li').forEach(li => { li.hidden = !api.match(+li.dataset.i); });
    found.textContent = on ? `${n} de ${POIS.length} lugares` : `${POIS.length} lugares`;
    found.classList.toggle('is-zero', !n);
    empty.hidden = n > 0;
    clearQ.hidden = !input.value;
    if (fit) fitNow(); else if (api.gl) api.gl.redraw();
  };
  api.setFilter = (type, q, fit = true) => {
    api.type = type; api.q = q; qset = searchIdx(q);
    if (input.value !== q) input.value = q;
    applyFilter(fit);
  };
  sec.querySelectorAll('.pdc-find__chips [data-tipo]').forEach(b => b.addEventListener('click', () => {
    const k = b.dataset.tipo;
    api.setFilter(k === api.type ? 'all' : k, api.q, k !== 'all' || !!api.q);
  }));
  $('[data-empty-reset]').addEventListener('click', () => api.setFilter('all', ''));

  // Sugerencias mientras escribes: tipos de lugar y lugares (buscan en todo, sin importar el filtro activo)
  const esc = t => t.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let opts = [], act = -1, fitT = 0;
  const closeSug = () => { sug.hidden = true; input.setAttribute('aria-expanded', 'false'); input.removeAttribute('aria-activedescendant'); act = -1; };
  const renderSug = () => {
    const q = input.value.trim(), t = qTokens(q);
    if (!t.length) { closeSug(); return; }
    const types = Object.keys(TIPOS).filter(k => t.every(w => TIPO_TXT[k].includes(w)));
    const hits = [...(searchIdx(q) || [])].slice(0, 7);
    let h = '';
    if (types.length) h += '<p class="pdc-sug__h">( Tipos de lugar )</p>' + types.map(k => `<button type="button" role="option" data-sug-t="${k}"><span>Ver ${TIPOS[k].n.toLowerCase()}</span><em>${TIPO_N[k]} ${TIPO_N[k] === 1 ? 'lugar' : 'lugares'}</em></button>`).join('');
    if (hits.length) h += '<p class="pdc-sug__h">( Lugares )</p>' + hits.map(i => `<button type="button" role="option" data-sug-p="${i}">${glyph(POIS[i].c)}<span>${POIS[i].n}</span><em>${POIS[i].z}</em></button>`).join('');
    if (!h) h = `<p class="pdc-sug__none">Sin resultados para «${esc(q)}». Prueba con:</p><div class="pdc-sug__try">${['cenotes', 'playas', 'ruinas', 'parques de diversiones', 'vida nocturna'].map(w => `<button type="button" data-sug-q="${w}">${w}</button>`).join('')}</div>`;
    sug.innerHTML = h;
    opts = [...sug.querySelectorAll('[role="option"]')];
    opts.forEach((o, k) => { o.id = `pdc-sug-${k}`; o.setAttribute('aria-selected', 'false'); });
    act = -1; sug.hidden = false; input.setAttribute('aria-expanded', 'true');
  };
  const setAct = k => {
    act = k;
    opts.forEach((o, j) => o.setAttribute('aria-selected', String(j === k)));
    input.setAttribute('aria-activedescendant', opts[k].id);
    opts[k].scrollIntoView({ block: 'nearest' });
  };
  const onInput = () => {
    api.q = input.value; qset = searchIdx(api.q);
    applyFilter(false); renderSug();
    clearTimeout(fitT); fitT = setTimeout(fitNow, 700);
  };
  const pick = o => {
    if (!o) return;
    clearTimeout(fitT);
    if (o.dataset.sugT) { closeSug(); api.setFilter(o.dataset.sugT, ''); }
    else if (o.dataset.sugP) { closeSug(); api.openPlace(+o.dataset.sugP); }
    else if (o.dataset.sugQ) { input.value = o.dataset.sugQ; onInput(); clearTimeout(fitT); fitNow(); }
  };
  input.addEventListener('input', onInput);
  input.addEventListener('focus', () => { if (input.value.trim()) renderSug(); });
  input.addEventListener('keydown', e => {
    const open = !sug.hidden && opts.length;
    if (e.key === 'ArrowDown' && open) { e.preventDefault(); setAct((act + 1) % opts.length); }
    else if (e.key === 'ArrowUp' && open) { e.preventDefault(); setAct((act - 1 + opts.length) % opts.length); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      if (act >= 0 && !sug.hidden) pick(opts[act]);
      else { closeSug(); clearTimeout(fitT); fitNow(); if (COARSE) input.blur(); }
    } else if (e.key === 'Escape') { if (!sug.hidden) closeSug(); else if (input.value) api.setFilter(api.type, '', false); }
  });
  sug.addEventListener('mousedown', e => e.preventDefault());   // elegir una sugerencia no le quita el foco al campo
  sug.addEventListener('click', e => pick(e.target.closest('[data-sug-t], [data-sug-p], [data-sug-q]')));
  clearQ.addEventListener('click', () => { closeSug(); api.setFilter(api.type, '', api.type !== 'all'); input.focus(); });
  document.addEventListener('pointerdown', e => { if (!e.target.closest('.pdc-find__box')) closeSug(); });

  // Galerías de fotos (Wikimedia Commons, licencias CC; créditos en cada foto)
  api.gal = {};
  api.ix = POI_IX;
  const strip = $('[data-strip]');
  const drawStrip = i => {
    const list = (i >= 0 && api.gal[POIS[i].id]) || [];
    strip.hidden = !list.length;
    if (!list.length) { strip.innerHTML = ''; return; }
    const show = list.slice(0, 4), more = list.length - show.length;
    strip.innerHTML = show.map((it, k) => `<button type="button" data-ph="${k}" aria-label="Ver foto ${k + 1} de ${list.length} de ${POIS[i].n}"><img src="${fotoURL(it.f + '-t.webp')}" alt="" loading="lazy" decoding="async">${k === show.length - 1 && more > 0 ? `<span>+${more}</span>` : ''}</button>`).join('')
      + `<p class="pdc__label pdc__label--faint">${list.length} ${list.length === 1 ? 'foto' : 'fotos'} · toca para ${list.some(it => Math.max(it.w, it.h) >= 3800) ? 'ver en 4K' : 'ampliar'}</p>`;
  };
  strip.addEventListener('click', e => { const b = e.target.closest('[data-ph]'); if (b && api.sel >= 0) api.openGallery(api.sel, +b.dataset.ph); });
  api.openGallery = (i, k = 0) => openLightbox(api, i, k);
  // Clic en el nombre de un lugar (póster o lista): centra el punto y abre su galería de fotos
  api.openPlace = i => {
    if (api.sel !== i) api.select(i);
    if ((api.gal[POIS[i].id] || []).length) api.openGallery(i, 0);
    else api.toast(`Aún no hay fotos de ${POIS[i].n}`);
  };
  fetch(fotoURL('galeria.json')).then(r => (r.ok ? r.json() : {})).then(g => {
    api.gal = g || {};
    sec.querySelectorAll('.pdc__index [data-poi]').forEach(b => {
      const n = (api.gal[POIS[+b.dataset.poi].id] || []).length, c = b.querySelector('.pdc__cam');
      if (n) { c.hidden = false; c.title = `${n} fotos`; b.setAttribute('aria-label', `${POIS[+b.dataset.poi].n}: ver ${n} fotos`); }
    });
    api.gl && api.gl.redraw();
    drawStrip(api.sel);
    if (api.sel >= 0) fillFacts(api.sel);
  }).catch(() => {});

  // Ficha: datos, tips y lugares cercanos
  const fillFacts = i => {
    const n = (api.gal[POIS[i].id] || []).length;
    $('[data-c-facts]').innerHTML = poiFacts(i).concat(n ? [['Fotos', `${n} · Wikimedia Commons`]] : []).map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');
  };
  $('[data-c-near]').addEventListener('click', e => { const b = e.target.closest('[data-near]'); if (b) api.select(+b.dataset.near); });

  // Selección
  const goLink = $('[data-go]'), cardH = $('[data-c-h]');
  api.select = (i, opts = {}) => {
    if (!opts.tour && api.touring) api.tour(false);
    api.sel = i;
    sec.classList.toggle('has-card', i >= 0);
    sec.querySelectorAll('.pdc__index [data-poi]').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.poi === i)));
    if (i < 0) {
      card.hidden = true; api.gl && api.gl.select(-1, opts);
      if (/^#pdc-/.test(location.hash)) history.replaceState(null, '', location.pathname + location.search);
      return;
    }
    const p = POIS[i];
    $('[data-c-n]').textContent = `( ${pad2(i + 1)} / ${pad2(POIS.length)} )`;
    $('[data-c-cat]').innerHTML = `${glyph(p.c)}${CATS[p.c].n}`;
    cardH.textContent = p.n;
    $('[data-c-d]').textContent = p.d;
    $('[data-c-ok]').innerHTML = p.ok.map(t => `<span>${t}</span>`).join('');
    $('[data-c-tips]').innerHTML = p.tips.map(t => `<li>${t}</li>`).join('');
    $('[data-c-near]').innerHTML = poiNear(i).map(j => `<button type="button" data-near="${j}">${glyph(POIS[j].c)}<span>${POIS[j].n}</span><em>${kmTxt(dist(i, j))}</em></button>`).join('');
    fillFacts(i);
    goLink.href = `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lon}`;
    drawStrip(i);
    cardH.classList.toggle('is-link', !!(api.gal[p.id] || []).length);
    card.hidden = false;
    const btn = sec.querySelector(`.pdc__index [data-poi="${i}"]`), ol = btn && btn.closest('ol');
    if (btn && ol) {
      if (ol.scrollWidth > ol.clientWidth + 4) ol.scrollTo({ left: btn.offsetLeft - ol.offsetLeft - 12, behavior: REDUCED ? 'auto' : 'smooth' });
      else if (ol.scrollHeight > ol.clientHeight + 4) ol.scrollTo({ top: btn.offsetTop - ol.offsetTop - ol.clientHeight / 2, behavior: REDUCED ? 'auto' : 'smooth' });
    }
    if (!opts.silent) history.replaceState(null, '', '#pdc-' + p.id);
    markSeen(p.id);
    api.gl && api.gl.select(i, opts);
  };
  const step = d => {
    const list = visibleList(); if (!list.length) return;
    const k = list.indexOf(api.sel);
    api.select(list[(k + d + list.length) % list.length]);
  };
  sec.querySelectorAll('.pdc__index [data-poi]').forEach(b => b.addEventListener('click', () => api.openPlace(+b.dataset.poi)));
  cardH.addEventListener('click', () => { if (api.sel >= 0) api.openPlace(api.sel); });
  $('.pdc__card-x').addEventListener('click', () => api.select(-1));
  $('[data-prev]').addEventListener('click', () => step(-1));
  $('[data-next]').addEventListener('click', () => step(1));
  $('[data-share]').addEventListener('click', () => {
    if (api.sel < 0) return;
    const p = POIS[api.sel], url = location.origin + location.pathname + '#pdc-' + p.id;
    if (navigator.share) navigator.share({ title: `${p.n} · ORNAT`, text: p.d, url }).catch(() => {});
    else if (navigator.clipboard) navigator.clipboard.writeText(url).then(() => api.toast('Enlace copiado'), () => api.toast(url));
    else api.toast(url);
  });

  // Recorrido guiado por los imprescindibles
  const TOUR = POIS.map((p, i) => (p.star ? i : -1)).filter(i => i >= 0);
  const tourBtn = $('[data-tour]'), tourT = $('[data-tour-t]');
  let tourTimer = 0, tourK = 0;
  const tourStep = () => {
    if (!api.touring) return;
    api.select(TOUR[tourK % TOUR.length], { tour: true });
    tourK++;
    tourTimer = setTimeout(tourStep, REDUCED ? 5000 : 5600);
  };
  api.tour = on => {
    clearTimeout(tourTimer);
    api.touring = on;
    tourBtn.setAttribute('aria-pressed', String(on));
    tourT.textContent = on ? 'Detener' : 'Recorrido';
    if (on) { tourK = Math.max(0, TOUR.indexOf(api.sel) + 1); tourStep(); }
  };
  tourBtn.addEventListener('click', () => api.tour(!api.touring));
  drawSeen();
}

function fail(sec) {
  sec.classList.add('pdc--nogl', 'is-ready', 'is-in');
  const v = sec.querySelector('.pdc__veil span');
  if (v) v.textContent = 'No se pudo dibujar el póster. Elige un lugar de la lista para ver sus fotos.';
}

/* ---------------------------------------------------------------- visor de fotos (pantalla completa, hasta 4K) */
const fotoURL = f => new URL('fotos/' + f, HERE).href;
let LB = null;
function openLightbox(api, pi, start) {
  const list = (api.gal || {})[POIS[pi].id] || [];
  if (!list.length) return;
  if (!LB) LB = buildLightbox();
  api.lbOpen = true;
  LB.open(pi, list, start, () => { api.lbOpen = false; });
}
function buildLightbox() {
  const el = document.createElement('div');
  el.className = 'pdc-lb'; el.hidden = true;
  el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'Galería de fotos');
  el.setAttribute('data-lenis-prevent', '');
  el.innerHTML = `
<div class="pdc-lb__top">
  <div><p class="pdc-lb__k"><span data-lb-cat></span><b data-lb-n></b></p><h3 class="pdc-lb__h" data-lb-h></h3><p class="pdc-lb__m" data-lb-m></p></div>
  <button type="button" class="pdc-lb__x" data-lb-x aria-label="Cerrar galería">×</button>
</div>
<figure class="pdc-lb__fig" data-lb-fig><img data-lb-img alt="" decoding="async"><span class="pdc-lb__q" data-lb-q></span></figure>
<button type="button" class="pdc-lb__nav pdc-lb__nav--p" data-lb-p aria-label="Foto anterior">←</button>
<button type="button" class="pdc-lb__nav pdc-lb__nav--n" data-lb-nx aria-label="Foto siguiente">→</button>
<div class="pdc-lb__bot">
  <p class="pdc-lb__by">Foto: <a data-lb-by target="_blank" rel="noopener"></a> · <span data-lb-lic></span> · Wikimedia Commons</p>
  <div class="pdc-lb__thumbs" data-lb-thumbs></div>
</div>`;
  document.body.appendChild(el);
  const $ = q => el.querySelector(q);
  const img = $('[data-lb-img]'), thumbs = $('[data-lb-thumbs]'), q4k = $('[data-lb-q]');
  let list = [], k = 0, pi = -1, lastFocus = null, x0 = null;
  // Escritorio: siempre 4K. Teléfono: solo si la pantalla lo aprovecha (cuida los datos móviles).
  const want4k = () => !COARSE || (innerWidth * (devicePixelRatio || 1)) > 1700;
  const show = n => {
    k = (n + list.length) % list.length;
    const it = list[k], P = POIS[pi];
    $('[data-lb-cat]').innerHTML = `${glyph(P.c)}${CATS[P.c].n}`;
    $('[data-lb-n]').textContent = `${pad2(k + 1)} / ${pad2(list.length)}`;
    $('[data-lb-h]').textContent = P.n;
    $('[data-lb-m]').textContent = poiMeta(pi);
    const by = $('[data-lb-by]'); by.textContent = it.by; by.href = it.src;
    $('[data-lb-lic]').textContent = it.lic;
    img.alt = `${P.n}, foto ${k + 1} de ${list.length}`;
    img.classList.remove('is-in'); q4k.textContent = '';
    img.src = fotoURL(it.f + '.webp');
    const shown = k;
    (img.decode ? img.decode() : Promise.resolve()).catch(() => {}).then(() => { if (shown === k) img.classList.add('is-in'); });
    if (want4k()) {
      const hi = new Image(); hi.src = fotoURL(it.f + '-4k.webp');
      hi.decode().then(() => { if (shown === k && !el.hidden) { img.src = hi.src; q4k.textContent = `${it.w >= 3800 || it.h >= 3800 ? '4K · ' : ''}${it.w} × ${it.h}`; } }).catch(() => {});
    }
    [k + 1, k - 1].forEach(j => { const pre = new Image(); pre.src = fotoURL(list[(j + list.length) % list.length].f + '.webp'); });
    thumbs.querySelectorAll('button').forEach((b, j) => b.setAttribute('aria-current', String(j === k)));
  };
  let onClose = null;
  const close = () => {
    if (el.hidden) return;
    if (onClose) { onClose(); onClose = null; }
    el.classList.remove('is-on');
    document.documentElement.classList.remove('pdc-lb-open');
    setTimeout(() => { el.hidden = true; img.removeAttribute('src'); }, 320);
    if (lastFocus) lastFocus.focus({ preventScroll: true });
  };
  $('[data-lb-x]').addEventListener('click', close);
  $('[data-lb-p]').addEventListener('click', () => show(k - 1));
  $('[data-lb-nx]').addEventListener('click', () => show(k + 1));
  thumbs.addEventListener('click', e => { const b = e.target.closest('[data-j]'); if (b) show(+b.dataset.j); });
  // En táctil, el click sintético del mismo toque que abrió el visor no debe cerrarlo
  let openedAt = 0;
  el.addEventListener('click', e => { if (performance.now() - openedAt > 450 && (e.target === el || e.target === $('[data-lb-fig]'))) close(); });
  document.addEventListener('keydown', e => {
    if (el.hidden || !el.classList.contains('is-on')) return;
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); show(k + 1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); show(k - 1); }
    else if (e.key === 'Tab') {   // foco atrapado dentro del visor
      const f = [...el.querySelectorAll('button, a[href]')].filter(n => n.offsetParent);
      if (!f.length) return;
      if (!el.contains(document.activeElement)) { e.preventDefault(); f[0].focus(); }
      else if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    }
  });
  el.addEventListener('wheel', e => e.preventDefault(), { passive: false });
  const fig = $('[data-lb-fig]');
  fig.addEventListener('pointerdown', e => { x0 = e.clientX; });
  fig.addEventListener('pointerup', e => { if (x0 == null) return; const dx = e.clientX - x0; x0 = null; if (Math.abs(dx) > 50) show(k + (dx < 0 ? 1 : -1)); });
  return {
    open(p, l, start, cb) {
      pi = p; list = l; lastFocus = document.activeElement; openedAt = performance.now(); onClose = cb || null;
      thumbs.innerHTML = list.map((it, j) => `<button type="button" data-j="${j}" aria-label="Foto ${j + 1}"><img src="${fotoURL(it.f + '-t.webp')}" alt="" loading="lazy"></button>`).join('');
      el.hidden = false;
      document.documentElement.classList.add('pdc-lb-open');
      void el.offsetWidth;            // aplica el estado inicial y anima sin esperar al siguiente cuadro
      el.classList.add('is-on');
      show(start || 0);
      $('[data-lb-x]').focus({ preventScroll: true });
    }
  };
}

// Isotipo ORNAT (4 habitaciones con puerta + núcleo) dibujado en un canvas 2D.
function drawMark(g, cx, cy, size, ink = '#fff', core = '#98ff03') {
  const s = size / 200;
  g.save(); g.translate(cx, cy); g.scale(s, s);
  g.strokeStyle = ink; g.lineWidth = 7; g.lineCap = 'butt'; g.lineJoin = 'miter';
  [270, 0, 90, 180].forEach(a => {
    g.save(); g.rotate(a * Math.PI / 180);
    g.stroke(new Path2D(ROOM));
    g.lineWidth = 3; g.stroke(new Path2D('M0-50H20A20 20 0 0 1 0-30')); g.lineWidth = 7;
    g.restore();
  });
  g.fillStyle = core; g.fillRect(-24, -24, 48, 48);
  g.restore();
}

/* ---------------------------------------------------------------- motor del póster (canvas 2D vectorial) */
const idle = () => new Promise(r => (window.requestIdleCallback ? requestIdleCallback(() => r(), { timeout: 60 }) : setTimeout(r, 0)));
// `span` = km que caben en el lado corto del póster, así la escala no cambia entre vertical y horizontal.
const DEF_P = { cx: -.4, cz: -1, span: 6.8 };           // vertical: la ciudad completa, de Playacar al norte
const DEF_L = { cx: .4, cz: -.3, span: 6.6 };           // horizontal: más costa a los lados
const SPAN_REF = 6.8, SPAN_MIN = 1.2, SPAN_MAX = 30;
const EXT = [-23, -23, 27, 27];                         // extensión de los datos (km)
// Grosor de cada capa en px sobre un póster de 400 px de lado corto; crece al acercarse.
const WIDTH = { major: 1.3, ter: .85, res: .45, ped: .75, svc: .3, pier: .8, coast: .7, ferry: 1.1 };
const ROAD_K = ['major', 'ter', 'res', 'ped', 'svc'];
const ROAD_ORDER = [4, 2, 3, 1, 0];                     // de menor a mayor jerarquía
const ROAD_DELAY = [0, .1, .25, .15, .35];              // entrada escalonada al revelar el póster
const TITLE_Q = 31;                                     // alto del bloque tipográfico del pie, en unidades q
const rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${n >> 8 & 255},${n & 255},${a})`; };

function makeGeo(data) {
  const path = (list, unit, close, off = 0) => {
    const p = new Path2D();
    list.forEach(a => { dec(a, unit, off).forEach(([x, z], i) => (i ? p.lineTo(x, z) : p.moveTo(x, z))); if (close) p.closePath(); });
    return p;
  };
  const piers = new Path2D();
  data.piers.forEach(a => { dec(a, .5, 1).forEach(([x, z], i) => (i ? piers.lineTo(x, z) : piers.moveTo(x, z))); if (a[0]) piers.closePath(); });
  return {
    land: path(data.land, 4, true), green: path(data.green, 1, true), water: path(data.water, 1, true),
    roads: data.roads.map(c => path(c, 1, false)), piers,
    ferry: path(data.ferries.map(f => f.pts), 1, false),
    cenotes: data.cenotes.map(([x, z]) => [x / 1000, z / 1000]),
    bldRaw: data.bld, bld: null
  };
}
// 25 mil huellas de edificios: solo se arman si alguien enciende la capa.
function makeBld(B) {
  const p = new Path2D();
  for (let i = 0; i < B.length;) {
    const n = B[i]; let x = B[i + 3], z = B[i + 4];
    p.moveTo(x / 2000, z / 2000);
    for (let k = 1, j = i + 5; k < n; k++, j += 2) { x += B[j]; z += B[j + 1]; p.lineTo(x / 2000, z / 2000); }
    p.closePath();
    i += 3 + 2 * n;
  }
  return p;
}

// Dibuja la vista `v` en un canvas de Wp × Hp px. Sirve para pantalla y para la descarga a 300 ppp.
function paint(g, Wp, Hp, v, T, geo, opt = {}) {
  const sh = Math.min(Wp, Hp), s = sh / v.span, u = sh / 400, m = clamp(Math.pow(SPAN_REF / v.span, .55), .45, 2.4);
  const px = w => w * u * m / s;
  const rv = opt.reveal == null ? 1 : opt.reveal;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalAlpha = 1;
  g.fillStyle = T.sea; g.fillRect(0, 0, Wp, Hp);
  g.setTransform(s, 0, 0, s, Wp / 2 - v.cx * s, Hp / 2 - v.cz * s);
  g.fillStyle = T.land; g.fill(geo.land, 'evenodd');
  g.fillStyle = T.park; g.fill(geo.green, 'evenodd');
  g.fillStyle = T.lake; g.fill(geo.water, 'evenodd');
  g.lineJoin = 'round'; g.lineCap = 'round';
  g.strokeStyle = T.coast; g.lineWidth = px(WIDTH.coast); g.stroke(geo.land);
  const R = ease(rv) * Math.hypot(Wp, Hp) / 2 / s;
  if (rv < 1) { g.save(); g.beginPath(); g.arc(v.cx, v.cz, Math.max(R, 1e-3), 0, 6.2832); g.clip(); }
  if (opt.bld && geo.bld) { g.globalAlpha = smooth(.3, .9, rv); g.fillStyle = T.bld; g.fill(geo.bld); }
  for (const k of ROAD_ORDER) {
    g.globalAlpha = rv < 1 ? smooth(ROAD_DELAY[k], ROAD_DELAY[k] + .45, rv) : 1;
    g.strokeStyle = T[ROAD_K[k]]; g.lineWidth = px(WIDTH[ROAD_K[k]]);
    g.stroke(geo.roads[k]);
  }
  g.globalAlpha = rv < 1 ? smooth(.4, .9, rv) : 1;
  g.strokeStyle = T.pier; g.lineWidth = px(WIDTH.pier); g.stroke(geo.piers);
  g.strokeStyle = T.coast; g.lineWidth = px(.7);
  geo.cenotes.forEach(([x, z]) => { g.beginPath(); g.arc(x, z, px(1.7), 0, 6.2832); g.stroke(); });
  g.strokeStyle = T.ferry; g.lineWidth = px(WIDTH.ferry); g.setLineDash([px(6), px(5)]);
  g.stroke(geo.ferry); g.setLineDash([]);
  g.globalAlpha = 1;
  if (rv < 1) {
    g.restore();
    g.strokeStyle = T.rule; g.globalAlpha = 1 - smooth(.6, 1, rv); g.lineWidth = px(1.2);
    g.beginPath(); g.arc(v.cx, v.cz, Math.max(R, 1e-3), 0, 6.2832); g.stroke(); g.globalAlpha = 1;
  }
  g.setTransform(1, 0, 0, 1, 0, 0);
}

async function start(sec) {
  const api = sec.pdc, $ = q => sec.querySelector(q);
  const poster = $('.pdc-poster'), cv = $('.pdc-poster__cv'), g = cv.getContext('2d');
  const mks = $('.pdc-mks'), pv = $('.pdc-pv'), coordEl = $('[data-coord]'), subEl = $('[data-sub]');
  const data = await fetch(new URL('data/pdc-geo.json', HERE)).then(r => { if (!r.ok) throw new Error('geo ' + r.status); return r.json(); });
  await idle();
  const geo = makeGeo(data);
  await idle();

  // --- estado
  let W = 0, H = 0, dpr = 1, T = THEMES.tinta, themeK = 'tinta', showBld = false, edit = false, touched = false;
  const def = () => (W > H ? DEF_L : DEF_P);
  const view = { ...DEF_P };
  let anim = null, glide = null, reveal = REDUCED ? 1 : 0, revealT0 = 0, raf = 0;
  const short = () => Math.min(W, H) || 1;

  const clampView = v => {
    v.span = clamp(v.span, SPAN_MIN, SPAN_MAX);
    const k = v.span / short(), hw = W * k / 2, hh = H * k / 2, pad = .3;
    v.cx = clamp(v.cx, EXT[0] + hw + pad, EXT[2] - hw - pad);
    v.cz = clamp(v.cz, EXT[1] + hh + pad, EXT[3] - hh - pad);
    return v;
  };
  // El lugar elegido queda en la parte alta del póster, lejos del bloque tipográfico del pie.
  const viewFor = i => { const [x, z] = PXZ[i], span = clamp(POIS[i].r * 1.5, 2, 9); return clampView({ cx: x, cz: z + .12 * span * H / short(), span }); };

  // --- marcadores
  mks.innerHTML = POIS.map((p, i) => `<button type="button" class="pdc-mk" data-mk="${i}" aria-label="${p.n}: ver fotos"><i aria-hidden="true"></i><span>${glyph(p.c)}${p.n}</span></button>`).join('');
  const mkEls = [...mks.children];
  let dragged = false;
  mks.addEventListener('click', e => {
    const b = e.target.closest('[data-mk]');
    if (!b || dragged) return;
    e.stopPropagation();
    hidePv();
    api.openPlace(+b.dataset.mk);
  });
  const toScreen = i => { const s = short() / view.span; return [(PXZ[i][0] - view.cx) * s + W / 2, (PXZ[i][1] - view.cz) * s + H / 2]; };
  const placeMarks = () => {
    const low = H - TITLE_Q * short() / 100;
    mkEls.forEach((el, i) => {
      const [x, y] = toScreen(i);
      const out = x < -12 || x > W + 12 || y < -12 || y > low;
      const off = !api.match(i) && i !== api.sel;
      el.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px)`;
      el.classList.toggle('is-out', out || off);
      el.classList.toggle('is-l', x > W * .58);
      el.classList.toggle('is-sel', i === api.sel);
      el.classList.toggle('is-seen', api.seen.has(POIS[i].id));
      el.classList.toggle('has-ph', !!(api.gal[POIS[i].id] || []).length);
      el.tabIndex = out || off ? -1 : 0;
    });
    if (pvI >= 0) placePv();
  };

  // --- vista previa al pasar el cursor: foto, zona, distancia y descripción
  let pvI = -1;
  const placePv = () => {
    const [x, y] = toScreen(pvI), w = pv.offsetWidth, h = pv.offsetHeight, gap = 18;
    const left = x > W * .55 ? x - gap - w : x + gap;
    pv.style.transform = `translate(${clamp(left, 8, W - w - 8).toFixed(1)}px,${clamp(y - h / 2, 8, H - h - 8).toFixed(1)}px)`;
  };
  const showPv = i => {
    if (dragged || COARSE) return;
    const p = POIS[i], ph = (api.gal[p.id] || [])[0], n = (api.gal[p.id] || []).length;
    pv.innerHTML = `${ph ? `<img src="${fotoURL(ph.f + '-t.webp')}" alt="" decoding="async">` : ''}
      <div class="pdc-pv__b"><p class="pdc-pv__k">${glyph(p.c)}${CATS[p.c].n}</p><p class="pdc-pv__h">${p.n}</p>
      <p class="pdc-pv__z">${poiMeta(i)}</p><p class="pdc-pv__d">${p.d.split('. ')[0].replace(/\.$/, '')}.</p>
      ${n ? `<p class="pdc-pv__go">Clic para ver ${n} ${n === 1 ? 'foto' : 'fotos'}</p>` : ''}</div>`;
    pvI = i; pv.hidden = false; mkEls[i].classList.add('is-pv');
    placePv(); pv.classList.add('is-on');
  };
  const hidePv = () => { if (pvI >= 0) mkEls[pvI].classList.remove('is-pv'); pvI = -1; pv.classList.remove('is-on'); pv.hidden = true; };
  mks.addEventListener('pointerover', e => { const b = e.target.closest('[data-mk]'); if (b && e.pointerType === 'mouse' && +b.dataset.mk !== pvI) showPv(+b.dataset.mk); });
  mks.addEventListener('pointerout', e => { const b = e.target.closest('[data-mk]'); if (b && !b.contains(e.relatedTarget)) hidePv(); });
  mks.addEventListener('focusin', e => { const b = e.target.closest('[data-mk]'); if (b && !COARSE) showPv(+b.dataset.mk); });
  mks.addEventListener('focusout', hidePv);

  // --- coordenadas del centro de la vista
  let lastCo = '';
  const writeCoords = () => {
    const [la, lo] = unproj(view.cx, view.cz), key = la.toFixed(4) + lo.toFixed(4);
    if (key === lastCo) return; lastCo = key;
    coordEl.textContent = fmtCoord(view.cx, view.cz);
  };

  const draw = () => {
    if (!W) return;
    paint(g, cv.width, cv.height, view, T, geo, { reveal, bld: showBld });
    placeMarks(); writeCoords();
  };
  const frame = now => {
    raf = 0;
    let more = false;
    if (reveal < 1 && revealT0) { reveal = clamp((now - revealT0) / 2600); more = reveal < 1; }
    if (anim) {
      const t = clamp((now - anim.t0) / anim.dur), e = ease(t), a = anim.a, b = anim.b;
      view.span = Math.exp(lerp(Math.log(a.span), Math.log(b.span), e)) * (1 + anim.bump * Math.sin(Math.PI * t));
      view.cx = lerp(a.cx, b.cx, e); view.cz = lerp(a.cz, b.cz, e);
      if (t >= 1) { Object.assign(view, b); anim = null; } else more = true;
    }
    if (glide) {
      view.cx -= glide.vx * 16; view.cz -= glide.vz * 16; clampView(view);
      glide.vx *= .9; glide.vz *= .9;
      if (Math.hypot(glide.vx, glide.vz) * 16 < view.span * 4e-4) glide = null; else more = true;
    }
    draw();
    if (more) raf = requestAnimationFrame(frame);
  };
  const kick = () => { if (!raf) raf = requestAnimationFrame(frame); };
  const flyTo = (b, dur) => {
    glide = null;
    b = clampView({ ...b });
    if (REDUCED) { anim = null; Object.assign(view, b); kick(); return; }
    const a = { ...view }, d = Math.hypot(b.cx - a.cx, b.cz - a.cz);
    anim = { a, b, t0: performance.now(), dur: dur || clamp(700 + d * 90, 700, 1900), bump: clamp(d / (a.span + b.span), 0, 1.4) * .55 };
    kick();
  };
  const zoomAt = (sx, sy, f, animate) => {
    touched = true;
    const k = view.span / short(), wx = view.cx + (sx - W / 2) * k, wz = view.cz + (sy - H / 2) * k;
    const span = clamp(view.span * f, SPAN_MIN, SPAN_MAX), k2 = span / short();
    const b = { span, cx: wx - (sx - W / 2) * k2, cz: wz - (sy - H / 2) * k2 };
    if (animate) flyTo(b, 420); else { anim = null; Object.assign(view, clampView(b)); kick(); }
  };

  // --- tamaño y orientación
  let wasWide = null;
  const size = () => {
    const r = poster.getBoundingClientRect();
    if (!r.width) return;
    W = r.width; H = r.height; dpr = Math.min(2, devicePixelRatio || 1);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    poster.style.setProperty('--q', (short() / 100).toFixed(3) + 'px');
    const wide = W > H;
    poster.classList.toggle('is-wide', wide);
    if (wide !== wasWide) {
      wasWide = wide;
      if (api.sel >= 0) Object.assign(view, viewFor(api.sel));
      else if (!touched) Object.assign(view, def());
      clampView(view);
    }
    draw();
  };
  new ResizeObserver(size).observe(poster);

  // --- temas
  const themeBtns = sec.querySelectorAll('[data-theme-k]');
  const setTheme = k => {
    if (!THEMES[k]) k = 'tinta';
    themeK = k; T = THEMES[k]; poster.dataset.pt = k;
    const st = poster.style;
    st.setProperty('--pt-bg', T.land); st.setProperty('--pt-text', T.text); st.setProperty('--pt-rule', T.rule);
    st.setProperty('--pt-sub', T.sub); st.setProperty('--pt-faint', T.faint); st.setProperty('--pt-mk', T.mk); st.setProperty('--pt-ring', T.mkRing);
    st.setProperty('--pt-fade', rgba(T.land, 0)); st.setProperty('--pt-top', rgba(T.land, .55)); st.setProperty('--pt-core', k === 'lima' ? '#0a0a0b' : '#98ff03');
    themeBtns.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.themeK === k)));
    $('[data-theme-d]').textContent = T.d;
    try { localStorage.setItem('ornat-pdc-tema', k); } catch (e) { /* sin almacenamiento */ }
    draw();
  };
  themeBtns.forEach(b => b.addEventListener('click', () => setTheme(b.dataset.themeK)));
  let saved = 'tinta';
  try { saved = localStorage.getItem('ornat-pdc-tema') || 'tinta'; } catch (e) { /* sin almacenamiento */ }
  setTheme(saved);
  $('[data-bld]').addEventListener('change', async e => {
    showBld = e.target.checked;
    if (showBld && !geo.bld) { poster.classList.add('is-busy'); await idle(); geo.bld = makeBld(geo.bldRaw); poster.classList.remove('is-busy'); }
    draw();
  });

  // --- arrastre, pellizco, rueda y teclado
  const pts = new Map();
  let last = null, pinch = null, moved = 0, track = [];
  const setEdit = on => {
    edit = on;
    poster.classList.toggle('is-edit', on);
    if (on) poster.setAttribute('data-lenis-prevent', ''); else poster.removeAttribute('data-lenis-prevent');
    const b = $('[data-edit]');
    b.setAttribute('aria-pressed', String(on));
    $('[data-edit-t]').textContent = on ? 'Listo' : 'Editar mapa';
    b.querySelector('[data-lock]').setAttribute('d', on ? 'M5.5 7V5a2.5 2.5 0 0 1 4.6-1.4' : 'M5.5 7V5a2.5 2.5 0 0 1 5 0V7');
    if (on) api.toast(COARSE ? 'Arrastra y pellizca el mapa' : 'Arrastra y usa la rueda');
  };
  $('[data-edit]').addEventListener('click', () => setEdit(!edit));
  const onMove = e => {
    if (!pts.has(e.pointerId)) return;
    pts.set(e.pointerId, [e.clientX, e.clientY]);
    const r = poster.getBoundingClientRect();
    if (pts.size >= 2) {
      const [a, b] = [...pts.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]), mx = (a[0] + b[0]) / 2 - r.left, my = (a[1] + b[1]) / 2 - r.top;
      if (pinch) {
        const k = view.span / short();
        view.cx -= (mx - pinch.mx) * k; view.cz -= (my - pinch.my) * k;
        zoomAt(mx, my, pinch.d / d, false);
      }
      pinch = { d, mx, my }; moved += 10; return;
    }
    if (!last) return;
    const dx = e.clientX - last[0], dy = e.clientY - last[1];
    last = [e.clientX, e.clientY]; moved += Math.abs(dx) + Math.abs(dy);
    if (moved > 5) { dragged = true; touched = true; poster.classList.add('is-drag'); hidePv(); }
    const k = view.span / short();
    view.cx -= dx * k; view.cz -= dy * k; anim = null; clampView(view);
    const now = performance.now(); track.push([now, dx * k, dy * k]); track = track.filter(t => now - t[0] < 90);
    kick();
  };
  const onUp = e => {
    pts.delete(e.pointerId);
    if (pts.size === 1) { last = [...pts.values()][0]; pinch = null; return; }
    if (pts.size) return;
    removeEventListener('pointermove', onMove); removeEventListener('pointerup', onUp); removeEventListener('pointercancel', onUp);
    poster.classList.remove('is-drag');
    const now = performance.now(), rec = track.filter(t => now - t[0] < 90);
    if (!pinch && rec.length > 1 && !REDUCED) {
      const dt = Math.max(16, now - rec[0][0]), vx = rec.reduce((s, t) => s + t[1], 0) / dt, vz = rec.reduce((s, t) => s + t[2], 0) / dt;
      if (Math.hypot(vx, vz) * 16 > view.span * 2e-3) { glide = { vx, vz }; kick(); }
    }
    last = null; pinch = null; track = [];
    setTimeout(() => { dragged = false; }, 0);
  };
  poster.addEventListener('pointerdown', e => {
    if (e.pointerType !== 'mouse' && !edit) return;   // en táctil la página sigue haciendo scroll hasta activar "Editar mapa"
    if (e.button) return;
    if (e.target.closest('.pdc__done, .pdc__toast')) return;
    pts.set(e.pointerId, [e.clientX, e.clientY]);
    if (pts.size === 1) {
      last = [e.clientX, e.clientY]; moved = 0; track = []; glide = null; dragged = false;
      addEventListener('pointermove', onMove); addEventListener('pointerup', onUp); addEventListener('pointercancel', onUp);
    } else { last = null; pinch = null; }
    if (e.pointerType === 'mouse') e.preventDefault();
  });
  poster.addEventListener('wheel', e => {
    if (!edit && !e.ctrlKey) return;
    e.preventDefault();
    const r = poster.getBoundingClientRect();
    zoomAt(e.clientX - r.left, e.clientY - r.top, Math.exp(clamp(e.deltaY, -120, 120) * (e.ctrlKey ? .01 : .0018)), false);
  }, { passive: false });
  poster.addEventListener('dblclick', e => {
    if (e.target.closest('[data-mk], .pdc__done')) return;
    const r = poster.getBoundingClientRect();
    zoomAt(e.clientX - r.left, e.clientY - r.top, e.shiftKey ? 1.8 : 1 / 1.8, true);
  });
  poster.tabIndex = 0;
  poster.addEventListener('keydown', e => {
    if (e.target !== poster) return;
    const k = view.span * .12, keys = { ArrowLeft: [-k, 0], ArrowRight: [k, 0], ArrowUp: [0, -k], ArrowDown: [0, k] };
    if (keys[e.key]) { e.preventDefault(); touched = true; flyTo({ span: view.span, cx: view.cx + keys[e.key][0], cz: view.cz + keys[e.key][1] }, 260); }
    else if (e.key === '+' || e.key === '=') { e.preventDefault(); zoomAt(W / 2, H / 2, 1 / 1.5, true); }
    else if (e.key === '-' || e.key === '_') { e.preventDefault(); zoomAt(W / 2, H / 2, 1.5, true); }
    else if (e.key === '0') { e.preventDefault(); touched = false; flyTo(def()); }
  });
  sec.querySelectorAll('[data-zoom]').forEach(b => b.addEventListener('click', () => zoomAt(W / 2, H / 2, +b.dataset.zoom > 0 ? 1.6 : 1 / 1.6, true)));
  $('[data-recenter]').addEventListener('click', () => { if (api.sel >= 0) api.select(-1); touched = false; flyTo(def()); });
  $('[data-download]').addEventListener('click', () => download());

  // --- descarga en alta resolución: A4 a 300 ppp, en la orientación que se ve
  let busy = false;
  const spaced = (c, text, cx, y, ls) => {
    const ch = [...text], w = ch.map(t => c.measureText(t).width), tot = w.reduce((a, b) => a + b, 0) + ls * (ch.length - 1);
    let x = cx - tot / 2; c.textAlign = 'left';
    ch.forEach((t, i) => { c.fillText(t, x, y); x += w[i] + ls; });
  };
  async function download() {
    if (busy) return; busy = true;
    api.toast('Preparando póster…');
    try {
      const wide = W > H, Wp = wide ? 3508 : 2480, Hp = wide ? 2480 : 3508, q = 2480 / 100, out = document.createElement('canvas');
      out.width = Wp; out.height = Hp;
      const c = out.getContext('2d');
      try { await Promise.all(['700 100px "Barlow Condensed"', 'italic 400 100px "Instrument Serif"', '500 100px Inter'].map(f => document.fonts.load(f))); } catch (e) { /* fuentes del sistema */ }
      if (showBld && !geo.bld) geo.bld = makeBld(geo.bldRaw);
      paint(c, Wp, Hp, view, T, geo, { bld: showBld });
      // puntos
      const s = 2480 / view.span, low = Hp - TITLE_Q * q;
      POIS.forEach((p, i) => {
        if (!api.match(i) && i !== api.sel) return;
        const x = (PXZ[i][0] - view.cx) * s + Wp / 2, y = (PXZ[i][1] - view.cz) * s + Hp / 2;
        if (x < 0 || x > Wp || y < 0 || y > low) return;
        c.beginPath(); c.arc(x, y, (i === api.sel ? 1.05 : .72) * q, 0, 6.2832);
        c.fillStyle = T.mk; c.fill(); c.lineWidth = .32 * q; c.strokeStyle = T.mkRing; c.stroke();
      });
      // degradados como en pantalla
      let gr = c.createLinearGradient(0, Hp, 0, Hp * (1 - .4));
      gr.addColorStop(0, T.land); gr.addColorStop(.36, T.land); gr.addColorStop(1, rgba(T.land, 0));
      c.fillStyle = gr; c.fillRect(0, Hp * .6, Wp, Hp * .4);
      gr = c.createLinearGradient(0, 0, 0, Hp * .09);
      gr.addColorStop(0, rgba(T.land, .55)); gr.addColorStop(1, rgba(T.land, 0));
      c.fillStyle = gr; c.fillRect(0, 0, Wp, Hp * .09);
      // bloque tipográfico (mismas medidas en q que el CSS)
      c.textBaseline = 'middle';
      const yCo = Hp - 9 * q - .95 * q, ySub = yCo - .95 * q - 2.4 * q - 2.2 * q, yRule = ySub - 2.2 * q - 3 * q - .28 * q, yCity = yRule - 3.2 * q - 3.1 * q;
      c.fillStyle = T.text; c.font = `700 ${6.2 * q}px "Barlow Condensed", "Arial Narrow", sans-serif`;
      spaced(c, CITY.toUpperCase(), Wp / 2, yCity, 6.2 * q * .3);
      c.fillStyle = T.rule; c.fillRect(Wp / 2 - 6 * q, yRule, 12 * q, .28 * q);
      c.fillStyle = T.sub; c.font = `italic 400 ${4.4 * q}px "Instrument Serif", Georgia, serif`; c.textAlign = 'center';
      c.fillText(subEl.textContent, Wp / 2, ySub);
      c.fillStyle = T.faint; c.font = `500 ${1.9 * q}px Inter, system-ui, sans-serif`;
      spaced(c, coordEl.textContent, Wp / 2, yCo, 1.9 * q * .16);
      // créditos
      const yCr = Hp - 3 * q - .62 * q;
      c.font = `500 ${1.25 * q}px Inter, system-ui, sans-serif`; c.fillStyle = T.faint; c.textAlign = 'left';
      drawMark(c, 4 * q + 1.1 * q, yCr, 2.2 * q, T.text, themeK === 'lima' ? '#0a0a0b' : '#98ff03');
      c.fillText('© ORNAT', 4 * q + 2.8 * q, yCr);
      c.textAlign = 'right'; c.fillText('© colaboradores de OpenStreetMap', Wp - 4 * q, yCr);
      const blob = await new Promise(r => out.toBlob(r, 'image/png'));
      const name = `ornat-poster-${api.sel >= 0 ? POIS[api.sel].id : 'playa-del-carmen'}-${themeK}-${wide ? 'horizontal' : 'vertical'}.png`;
      const file = new File([blob], name, { type: 'image/png' });
      if (COARSE && navigator.canShare && navigator.canShare({ files: [file] })) {
        try { await navigator.share({ files: [file], title: 'Mi póster de Playa del Carmen · ORNAT' }); return; }
        catch (e) { if (e && e.name === 'AbortError') return; }
      }
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = name;
      document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      api.toast('Póster descargado');
    } catch (err) {
      console.warn('[mapa-pdc] descarga', err);
      api.toast('No se pudo generar el póster');
    } finally { busy = false; }
  }

  // --- puente con la interfaz
  api.gl = {
    redraw: kick,
    download,
    // Encuadra un grupo de lugares (resultado de búsqueda o filtro) arriba del bloque tipográfico
    fit(list) {
      if (list.length === 1) { touched = true; flyTo(viewFor(list[0])); return; }
      let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9;
      list.forEach(i => { const [x, z] = PXZ[i]; x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); });
      const sh = short(), title = TITLE_Q / 100, aw = W / sh, ah = H / sh - title;
      const span = clamp(Math.max((x1 - x0) / aw, (z1 - z0) / ah) * 1.35, 2.4, SPAN_MAX);
      touched = true;
      flyTo({ cx: (x0 + x1) / 2, cz: (z0 + z1) / 2 + title / 2 * span, span });
    },
    select(i, opts = {}) {
      subEl.textContent = i >= 0 ? POIS[i].n : REGION;
      if (i >= 0) { touched = true; flyTo(viewFor(i), opts.tour ? 2000 : 0); } else kick();
    }
  };
  $('[data-hint]').textContent = COARSE ? 'Toca un punto para ver sus fotos · Editar mapa para moverlo' : 'Pasa el cursor por un punto para ver su ficha · arrastra para mover · Ctrl + rueda para acercar';

  if (api.sel >= 0) subEl.textContent = POIS[api.sel].n;
  size();
  sec.classList.add('is-ready', 'is-in');
  if (reveal < 1) {
    new IntersectionObserver((es, io) => {
      if (!es[0].isIntersecting) return;
      io.disconnect(); revealT0 = performance.now(); kick();
    }, { threshold: .3 }).observe(poster);
  }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();

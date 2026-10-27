// ORNAT · Plano a render — catálogo de estilos de interior (datos puros, sin DOM; probado con node --test).
//
// Cada estilo describe materiales PBR por superficie (el renderer genera la textura en canvas a partir de
// `textura` + color/color2 y la repite cada `escala` metros), lenguaje de mobiliario, iluminación,
// un prompt en inglés para render con IA y el estilo equivalente de HomeDesigns.

export const TEXTURAS = Object.freeze([
  'madera', 'piedra', 'concreto', 'terrazo', 'marmol', 'barro', 'mosaico', 'porcelanato', 'pintura',
  'aplanado', 'ladrillo', 'textil', 'lino', 'boucle', 'terciopelo', 'laca', 'rattan', 'alfombra',
]);

export const TEMPERATURAS = Object.freeze({ calido: 'Cálido', neutro: 'Neutro', frio: 'Frío' });

export const REGIONES = Object.freeze({
  mexico: 'México',
  mediterraneo: 'Mediterráneo',
  nordico: 'Nórdico',
  asia: 'Asia',
  europa: 'Europa',
  norteamerica: 'Norteamérica',
  tropical: 'Tropical',
  'africa-medio-oriente': 'África y Medio Oriente',
  global: 'Global',
});

export const PRESUPUESTOS = Object.freeze({
  contenido: 'Presupuesto contenido',
  medio: 'Presupuesto medio',
  alto: 'Presupuesto alto',
});

export const HD_ESTILOS = Object.freeze([
  'No Style', 'Eclectic', 'Modern', 'Contemporary', 'Transitional', 'Scandinavian', 'Mediterranean', 'Industrial',
  'Coastal', 'Bauhaus', 'Bohemian', 'Traditional', 'Rustic', 'Minimalism', 'Japandi', 'Japanese Design', 'Tropical',
  'Zen', 'Hollywood Regency', 'Hollywood Glam', 'Minimalist', 'Luxurious', 'Midcentury Modern', 'Biophilic',
  'French Country', 'Art Deco', 'Art Nouveau', 'Modern Farm House', 'Moroccan', 'Urban Modern', 'Desert Modernism',
  'Colonial', 'Brutalist', 'Nordic Noir', 'Mexican Hacienda', 'Coastal Modern', 'Maximalist', 'Tuscan',
  'Neoclassical', 'Quiet Luxury', 'Organic Modern', 'Memphis', 'Parisian Chic', 'Scandi Boho', 'Contemporary Rustic',
  'Meditative Minimalism', 'Hygge',
]);

export const FORMAS = Object.freeze(['recta', 'redondeada', 'organica', 'clasica']);
export const PATAS = Object.freeze(['madera', 'metal', 'ocultas', 'torneadas']);
export const ALTURAS = Object.freeze(['baja', 'media']);

export const ESTILO_POR_DEFECTO = 'contemporaneo';

// Atajos de construcción (los objetos resultantes son datos planos).
const m = (textura, color, color2, rugosidad, metalicidad, escala) => ({ textura, color, color2, rugosidad, metalicidad, escala });
const mt = (color, rugosidad, metalicidad) => ({ color, rugosidad, metalicidad });
const mob = (forma, patas, altura, densidad, plantas) => ({ forma, patas, altura, densidad, plantas });
const luz = (temperaturaK, intensidad, sol, exposicion) => ({ temperaturaK, intensidad, sol, exposicion });

const CATALOGO = [
  {
    id: 'contemporaneo', nombre: 'Contemporáneo',
    descripcion: 'Base neutra con lambrín de madera y acento azul petróleo; funciona para casi cualquier comprador.',
    temperatura: 'neutro', region: 'global', presupuesto: 'medio',
    etiquetas: ['neutro', 'lambrín de madera', 'porcelanato', 'versátil'],
    paleta: ['#e9e4dc', '#9a948a', '#8a6a4a', '#cfc6b8', '#2f3a40'],
    piso: m('porcelanato', '#d8d2c8', '#c9c2b6', 0.35, 0, 1.2),
    pisoHumedo: m('porcelanato', '#bdb7ad', '#aaa398', 0.4, 0, 0.9),
    muro: m('pintura', '#ece8e1', '#e2ddd5', 0.9, 0, 2),
    muroAcento: m('madera', '#8a6a4a', '#6e5238', 0.6, 0, 1.5),
    carpinteria: m('madera', '#a07c58', '#7f5f42', 0.5, 0, 1),
    cubierta: m('marmol', '#efece6', '#c9c4bb', 0.25, 0, 1.5),
    metal: mt('#2b2b2b', 0.4, 0.9),
    textil: m('lino', '#cfc6b8', '#bdb3a4', 0.9, 0, 0.4),
    textil2: m('terciopelo', '#2f3a40', '#25303a', 0.8, 0, 0.3),
    mobiliario: mob('recta', 'metal', 'baja', 1.0, 1),
    iluminacion: luz(3500, 1.0, 1.0, 1.0),
    prompt: 'Contemporary living space, large-format light gray porcelain floor, warm white walls, walnut slat feature wall, white quartz counters, low linear sofa in oat linen, petrol blue velvet cushions, matte black metal details, soft daylight with warm 3500K accents, calm and balanced mood.',
    homedesigns: 'Contemporary',
  },
  {
    id: 'minimalista', nombre: 'Minimalista',
    descripcion: 'Microcemento, muros lisos y roble claro; pocos objetos para que el espacio y la luz sean el argumento.',
    temperatura: 'neutro', region: 'global', presupuesto: 'medio',
    etiquetas: ['microcemento', 'roble claro', 'sin ornamento', 'monocromático'],
    paleta: ['#f2f1ee', '#d9d7d2', '#c8b49a', '#e6e3dd', '#1c1c1c'],
    piso: m('concreto', '#cfccc6', '#c2bfb8', 0.6, 0, 2),
    pisoHumedo: m('concreto', '#b9b6b0', '#adaaa3', 0.6, 0, 2),
    muro: m('aplanado', '#f2f1ee', '#e9e8e4', 0.95, 0, 2),
    muroAcento: m('aplanado', '#d9d7d2', '#cfccc6', 0.95, 0, 2),
    carpinteria: m('madera', '#c8b49a', '#b39b7e', 0.55, 0, 1),
    cubierta: m('porcelanato', '#ebe9e5', '#dedcd7', 0.3, 0, 1.2),
    metal: mt('#1c1c1c', 0.5, 0.8),
    textil: m('lino', '#e6e3dd', '#d7d3cb', 0.9, 0, 0.4),
    textil2: m('lino', '#3a3a38', '#2e2e2c', 0.9, 0, 0.4),
    mobiliario: mob('recta', 'ocultas', 'baja', 0.6, 1),
    iluminacion: luz(4500, 1.1, 1.1, 1.05),
    prompt: 'Minimalist interior, seamless pale gray microcement floor, smooth off-white plaster walls, flush handleless light oak cabinetry, very few pieces of low furniture, one charcoal accent, hidden storage, generous negative space, soft even daylight, quiet and orderly atmosphere.',
    homedesigns: 'Minimalist',
  },
  {
    id: 'japandi', nombre: 'Japandi',
    descripcion: 'Calma japonesa con funcionalidad nórdica: madera clara, listones oscuros y textiles de lino salvia.',
    temperatura: 'calido', region: 'asia', presupuesto: 'medio',
    etiquetas: ['madera clara', 'japonés', 'nórdico', 'listones', 'lino'],
    paleta: ['#ede6da', '#b8ab98', '#a8865f', '#d9cfc0', '#3d3a35'],
    piso: m('madera', '#c4a47e', '#a8865f', 0.6, 0, 1.2),
    pisoHumedo: m('porcelanato', '#a69c8e', '#958b7d', 0.6, 0, 0.9),
    muro: m('aplanado', '#ede6da', '#e3dbcd', 0.95, 0, 2),
    muroAcento: m('madera', '#6b5440', '#584331', 0.7, 0, 0.8),
    carpinteria: m('madera', '#b8956c', '#9c7a54', 0.6, 0, 1),
    cubierta: m('piedra', '#8c867c', '#77716a', 0.6, 0, 1),
    metal: mt('#3d3a35', 0.6, 0.7),
    textil: m('lino', '#d9cfc0', '#c9bead', 0.9, 0, 0.4),
    textil2: m('lino', '#6f7561', '#5e6452', 0.9, 0, 0.4),
    mobiliario: mob('recta', 'madera', 'baja', 0.75, 2),
    iluminacion: luz(3000, 0.95, 1.0, 1.0),
    prompt: 'Japandi interior, light ash wood floor, warm limewash walls, dark wood slat accent wall, low solid wood furniture with clean joinery, sage and oat linen textiles, gray stone counters, paper pendant lamp, a few sculptural plants, soft warm diffused light, serene mood.',
    homedesigns: 'Japandi',
  },
  {
    id: 'wabi-sabi', nombre: 'Wabi-sabi',
    descripcion: 'Aplanados irregulares, madera envejecida y piedra mate; la imperfección se vuelve el valor del espacio.',
    temperatura: 'calido', region: 'asia', presupuesto: 'medio',
    etiquetas: ['aplanado irregular', 'madera envejecida', 'tonos tierra', 'artesanal'],
    paleta: ['#d8cdbd', '#a8987f', '#5c4a38', '#c2b49e', '#6d5a46'],
    piso: m('concreto', '#9e9282', '#8a7f70', 0.85, 0, 2),
    pisoHumedo: m('piedra', '#7f766a', '#6e665b', 0.9, 0, 1),
    muro: m('aplanado', '#d8cdbd', '#c7baa6', 1, 0, 1.5),
    muroAcento: m('aplanado', '#a8987f', '#968670', 1, 0, 1.5),
    carpinteria: m('madera', '#5c4a38', '#46372a', 0.8, 0, 1),
    cubierta: m('piedra', '#6f6a62', '#5d5952', 0.85, 0, 1),
    metal: mt('#4a3f35', 0.8, 0.5),
    textil: m('lino', '#c2b49e', '#b0a28b', 1, 0, 0.4),
    textil2: m('lino', '#6d5a46', '#5d4c3a', 1, 0, 0.4),
    mobiliario: mob('organica', 'madera', 'baja', 0.65, 1),
    iluminacion: luz(2700, 0.85, 0.9, 0.95),
    prompt: 'Wabi-sabi interior, textured earthen plaster walls with irregular trowel marks, warm gray troweled concrete floor, aged dark timber furniture, rough stone counters, crumpled natural linen in clay and umber, handmade ceramics, oxidized iron, low warm side light, quiet contemplative mood.',
    homedesigns: 'Japanese Design',
  },
  {
    id: 'mediterraneo', nombre: 'Mediterráneo',
    descripcion: 'Barro cocido, cal blanca y azul profundo; lectura inmediata de casa de playa con luz intensa.',
    temperatura: 'calido', region: 'mediterraneo', presupuesto: 'medio',
    etiquetas: ['barro cocido', 'cal', 'azul', 'luz natural'],
    paleta: ['#f5f1e8', '#2f5d8a', '#b08b5e', '#e8dfcf', '#c66b3d'],
    piso: m('barro', '#c98a62', '#b5764f', 0.8, 0, 0.6),
    pisoHumedo: m('mosaico', '#2f5d8a', '#f5f1e8', 0.4, 0, 0.5),
    muro: m('aplanado', '#f5f1e8', '#ece6da', 0.95, 0, 1.5),
    muroAcento: m('aplanado', '#2f5d8a', '#284f76', 0.95, 0, 1.5),
    carpinteria: m('madera', '#b08b5e', '#93724a', 0.7, 0, 1),
    cubierta: m('piedra', '#e3dccd', '#cfc6b4', 0.5, 0, 1),
    metal: mt('#2a2a2a', 0.6, 0.8),
    textil: m('lino', '#e8dfcf', '#d9ceba', 0.9, 0, 0.4),
    textil2: m('textil', '#2f5d8a', '#f5f1e8', 0.85, 0, 0.3),
    mobiliario: mob('redondeada', 'madera', 'media', 0.9, 2),
    iluminacion: luz(4000, 1.15, 1.35, 1.05),
    prompt: 'Mediterranean interior, terracotta tile floor, rounded whitewashed lime plaster walls, deep blue accent wall, rustic honey wood furniture, blue and white striped textiles, wrought iron details, limestone counters, olive trees in clay pots, bright sunlight with crisp shadows, relaxed seaside mood.',
    homedesigns: 'Mediterranean',
  },
  {
    id: 'tulum-bohemio', nombre: 'Tulum bohemio',
    descripcion: 'Chukum color arena, madera tzalam, rattan y lino crudo: el lenguaje que hoy vende en la Riviera Maya.',
    temperatura: 'calido', region: 'mexico', presupuesto: 'medio',
    etiquetas: ['chukum', 'tzalam', 'rattan', 'lino crudo', 'riviera maya'],
    paleta: ['#e3d5bf', '#c7b08c', '#7a5a3c', '#efe6d6', '#4f6b4a'],
    piso: m('concreto', '#d2c1a3', '#c3b190', 0.8, 0, 2),
    pisoHumedo: m('piedra', '#cdbb9b', '#baa785', 0.85, 0, 1),
    muro: m('aplanado', '#e3d5bf', '#d6c6ac', 1, 0, 1.5),
    muroAcento: m('aplanado', '#c7b08c', '#b89f79', 1, 0, 1.5),
    carpinteria: m('madera', '#7a5a3c', '#5f452e', 0.7, 0, 1),
    cubierta: m('concreto', '#cbb99a', '#bba886', 0.7, 0, 1.5),
    metal: mt('#8a6a3a', 0.5, 0.7),
    textil: m('lino', '#efe6d6', '#e2d6c2', 1, 0, 0.4),
    textil2: m('rattan', '#b88e5a', '#9a7444', 0.8, 0, 0.3),
    mobiliario: mob('organica', 'madera', 'baja', 0.85, 3),
    iluminacion: luz(3200, 1.1, 1.3, 1.05),
    prompt: 'Tulum bohemian interior, sand colored chukum plaster walls and floor with soft organic curves, tropical tzalam hardwood furniture, woven rattan and palm fiber lamps, raw linen sofa, coral stone in wet areas, aged brass, lush tropical plants, warm filtered jungle light, barefoot luxury mood.',
    homedesigns: 'Bohemian',
  },
  {
    id: 'mexicano-contemporaneo', nombre: 'Mexicano contemporáneo',
    descripcion: 'Parota, recinto negro y muro terracota; identidad mexicana actual sin caer en el folclor.',
    temperatura: 'calido', region: 'mexico', presupuesto: 'medio',
    etiquetas: ['parota', 'recinto', 'terracota', 'artesanía'],
    paleta: ['#efe7dc', '#b5532f', '#6a4a32', '#d8c7ad', '#1f5f5b'],
    piso: m('madera', '#8a5f3d', '#6e4a2e', 0.6, 0, 1.4),
    pisoHumedo: m('barro', '#b5683f', '#9f5733', 0.75, 0, 0.6),
    muro: m('aplanado', '#efe7dc', '#e5dbcc', 0.95, 0, 1.5),
    muroAcento: m('aplanado', '#b5532f', '#a0472a', 0.95, 0, 1.5),
    carpinteria: m('madera', '#6a4a32', '#543826', 0.6, 0, 1),
    cubierta: m('piedra', '#3b3a38', '#2e2d2b', 0.7, 0, 1),
    metal: mt('#1f1f1f', 0.6, 0.8),
    textil: m('textil', '#d8c7ad', '#c7b495', 0.9, 0, 0.4),
    textil2: m('textil', '#1f5f5b', '#b5532f', 0.85, 0, 0.3),
    mobiliario: mob('recta', 'madera', 'media', 0.9, 2),
    iluminacion: luz(3200, 1.05, 1.25, 1.0),
    prompt: 'Contemporary Mexican interior, wide parota wood floor, warm white plaster walls, terracotta accent wall, solid wood furniture with clean lines, black volcanic stone counters, handwoven cotton textiles in teal and rust, black iron details, clay pottery, agaves, warm afternoon sun, grounded mood.',
    homedesigns: 'Contemporary Rustic',
  },
  {
    id: 'hacienda', nombre: 'Hacienda',
    descripcion: 'Barro rojo, muros de cal, vigas oscuras y cantera; ideal para casonas y proyectos de patio central.',
    temperatura: 'calido', region: 'mexico', presupuesto: 'alto',
    etiquetas: ['barro rojo', 'cal', 'vigas', 'cantera', 'talavera'],
    paleta: ['#f1e9dc', '#a8432b', '#3e2a1e', '#d9c3a0', '#7b2d26'],
    piso: m('barro', '#a8532f', '#8f4426', 0.85, 0, 0.6),
    pisoHumedo: m('barro', '#9a4a2a', '#82402a', 0.8, 0, 0.6),
    muro: m('aplanado', '#f1e9dc', '#e6dccb', 1, 0, 1.5),
    muroAcento: m('piedra', '#c9b393', '#b39c7a', 0.85, 0, 1.2),
    carpinteria: m('madera', '#3e2a1e', '#2b1d14', 0.7, 0, 1),
    cubierta: m('mosaico', '#f0ead9', '#2d4f8a', 0.35, 0, 0.4),
    metal: mt('#2a2420', 0.7, 0.7),
    textil: m('textil', '#d9c3a0', '#c8b08a', 0.9, 0, 0.4),
    textil2: m('terciopelo', '#7b2d26', '#65241f', 0.8, 0, 0.3),
    mobiliario: mob('clasica', 'torneadas', 'media', 1.1, 3),
    iluminacion: luz(2800, 1.0, 1.2, 1.0),
    prompt: 'Mexican hacienda interior, red clay tile floor, thick whitewashed lime walls, dark exposed timber beams, carved pink quarry stone accents, heavy dark wood furniture with turned legs, talavera tile counters, wrought iron lanterns, wine red upholstery, potted bougainvillea, warm golden light.',
    homedesigns: 'Mexican Hacienda',
  },
  {
    id: 'industrial', nombre: 'Industrial',
    descripcion: 'Concreto aparente, ladrillo y acero negro; útil para lofts y reconversiones con presupuesto ajustado.',
    temperatura: 'neutro', region: 'norteamerica', presupuesto: 'contenido',
    etiquetas: ['concreto', 'ladrillo', 'acero negro', 'loft'],
    paleta: ['#8f8c87', '#9b4a32', '#5a4030', '#7a5136', '#1a1a1a'],
    piso: m('concreto', '#8f8c87', '#7f7c77', 0.6, 0.05, 2.5),
    pisoHumedo: m('concreto', '#76736e', '#68655f', 0.55, 0.05, 2),
    muro: m('concreto', '#a9a59e', '#9a968f', 0.85, 0, 2),
    muroAcento: m('ladrillo', '#9b4a32', '#7d3a27', 0.9, 0, 1.2),
    carpinteria: m('madera', '#5a4030', '#45301f', 0.7, 0, 1),
    cubierta: m('concreto', '#5e5c58', '#53514d', 0.55, 0, 1.5),
    metal: mt('#1a1a1a', 0.55, 0.9),
    textil: m('textil', '#7a5136', '#62402a', 0.55, 0, 0.5),
    textil2: m('lino', '#6b6258', '#5c544b', 0.9, 0, 0.4),
    mobiliario: mob('recta', 'metal', 'media', 0.9, 1),
    iluminacion: luz(3300, 0.9, 0.8, 0.95),
    prompt: 'Industrial loft interior, polished gray concrete floor, exposed concrete walls, red brick accent wall, black steel frames and shelving, reclaimed dark wood furniture, cognac leather sofa, charcoal concrete counters, exposed ducts, metal pendant lamps, moody warm light from tall windows.',
    homedesigns: 'Industrial',
  },
  {
    id: 'escandinavo', nombre: 'Escandinavo',
    descripcion: 'Madera blanqueada, blancos fríos y azul grisáceo; espacios luminosos y fáciles de amueblar.',
    temperatura: 'frio', region: 'nordico', presupuesto: 'contenido',
    etiquetas: ['madera blanqueada', 'blanco', 'luminoso', 'funcional'],
    paleta: ['#f4f4f1', '#d6d9d8', '#d9bf98', '#bfc6c4', '#6f8f9b'],
    piso: m('madera', '#dcc6a2', '#c8ae86', 0.55, 0, 1.2),
    pisoHumedo: m('porcelanato', '#e1e2df', '#d3d4d1', 0.35, 0, 0.6),
    muro: m('pintura', '#f4f4f1', '#ececea', 0.9, 0, 2),
    muroAcento: m('pintura', '#bfc6c4', '#b3bab8', 0.9, 0, 2),
    carpinteria: m('madera', '#d9bf98', '#c4a77f', 0.55, 0, 1),
    cubierta: m('marmol', '#f0f0ee', '#cfd2d2', 0.3, 0, 1.5),
    metal: mt('#2e2e2e', 0.5, 0.85),
    textil: m('lino', '#d6d9d8', '#c8cccb', 0.9, 0, 0.4),
    textil2: m('lino', '#6f8f9b', '#5f7e8a', 0.9, 0, 0.4),
    mobiliario: mob('redondeada', 'madera', 'media', 0.85, 2),
    iluminacion: luz(5200, 1.15, 0.8, 1.1),
    prompt: 'Scandinavian interior, pale whitewashed oak floor, crisp white walls, soft gray-green accent wall, birch furniture with rounded edges, light gray sofa, dusty blue linen cushions, white marble counters, wool throws, simple pendant lights, cool bright northern daylight, airy functional mood.',
    homedesigns: 'Scandinavian',
  },
  {
    id: 'mid-century', nombre: 'Mid-century',
    descripcion: 'Teca, nogal y mostaza con patas cónicas; atrae a compradores jóvenes con gusto por el diseño.',
    temperatura: 'calido', region: 'norteamerica', presupuesto: 'medio',
    etiquetas: ['teca', 'nogal', 'mostaza', 'años cincuenta'],
    paleta: ['#efe6d4', '#d38b2c', '#9b5f30', '#3f6b5c', '#b5442c'],
    piso: m('madera', '#8a5a35', '#70482a', 0.55, 0, 1),
    pisoHumedo: m('terrazo', '#e8e0cf', '#7d6f5c', 0.35, 0, 1),
    muro: m('pintura', '#efe6d4', '#e5dbc6', 0.9, 0, 2),
    muroAcento: m('pintura', '#d38b2c', '#c27d24', 0.9, 0, 2),
    carpinteria: m('madera', '#9b5f30', '#7d4b25', 0.45, 0, 1),
    cubierta: m('laca', '#e9e1cf', '#ddd3bf', 0.35, 0, 1),
    metal: mt('#b08a4a', 0.35, 0.9),
    textil: m('textil', '#3f6b5c', '#355a4d', 0.85, 0, 0.4),
    textil2: m('terciopelo', '#b5442c', '#963622', 0.8, 0, 0.3),
    mobiliario: mob('redondeada', 'madera', 'baja', 1.0, 2),
    iluminacion: luz(3000, 1.0, 1.1, 1.0),
    prompt: 'Mid-century modern interior, walnut parquet floor, cream walls, mustard yellow accent wall, teak furniture with tapered legs, forest green sofa, rust velvet cushions, brass globe lamps, terrazzo bathroom, low sideboard, rubber plant, warm late afternoon light, optimistic retro mood.',
    homedesigns: 'Midcentury Modern',
  },
  {
    id: 'art-deco', nombre: 'Art déco',
    descripcion: 'Mármol, latón pulido, laca verde y madera barnizada; geometría y brillo para penthouses y lobbies.',
    temperatura: 'calido', region: 'europa', presupuesto: 'alto',
    etiquetas: ['mármol', 'latón', 'laca verde', 'geométrico'],
    paleta: ['#efe9df', '#1f3d36', '#5b3a26', '#2c4a5a', '#c9a24a'],
    piso: m('marmol', '#eeebe5', '#b6aea2', 0.15, 0, 1.5),
    pisoHumedo: m('marmol', '#1f3d36', '#e6e2d8', 0.15, 0, 1.2),
    muro: m('pintura', '#efe9df', '#e4ddd0', 0.85, 0, 2),
    muroAcento: m('laca', '#1f3d36', '#183029', 0.2, 0, 1),
    carpinteria: m('madera', '#5b3a26', '#3e2618', 0.2, 0, 1),
    cubierta: m('marmol', '#2a2a2a', '#d8d2c6', 0.15, 0, 1.2),
    metal: mt('#c9a24a', 0.2, 1),
    textil: m('terciopelo', '#2c4a5a', '#233c49', 0.8, 0, 0.3),
    textil2: m('terciopelo', '#8a2f3a', '#742630', 0.8, 0, 0.3),
    mobiliario: mob('redondeada', 'metal', 'media', 1.0, 1),
    iluminacion: luz(2700, 1.05, 0.8, 0.95),
    prompt: 'Art Deco interior, polished cream marble floor, emerald green lacquered accent wall, glossy rosewood furniture, black marble counters with white veining, polished brass trims and fluted details, curved teal velvet sofa, burgundy cushions, geometric fan motifs, glamorous warm evening light.',
    homedesigns: 'Art Deco',
  },
  {
    id: 'clasico-frances', nombre: 'Clásico francés',
    descripcion: 'Piedra clara, boiserie, laca envejecida y gris verdoso; formalidad sobria para residencias de alto valor.',
    temperatura: 'neutro', region: 'europa', presupuesto: 'alto',
    etiquetas: ['boiserie', 'piedra clara', 'laca envejecida', 'molduras'],
    paleta: ['#efeae2', '#c8c3b8', '#d6cbb5', '#a9b4ae', '#b89a5b'],
    piso: m('piedra', '#e2d8c6', '#cfc3ad', 0.5, 0, 1.2),
    pisoHumedo: m('marmol', '#ece8e1', '#bdb6aa', 0.2, 0, 1.2),
    muro: m('pintura', '#efeae2', '#e6e0d6', 0.85, 0, 2),
    muroAcento: m('pintura', '#a9b4ae', '#9ea9a3', 0.85, 0, 2),
    carpinteria: m('laca', '#d6cbb5', '#cabea6', 0.35, 0, 1),
    cubierta: m('marmol', '#f1eee8', '#c4bcae', 0.2, 0, 1.5),
    metal: mt('#b89a5b', 0.3, 0.95),
    textil: m('lino', '#c8c3b8', '#b9b4a8', 0.85, 0, 0.4),
    textil2: m('terciopelo', '#7c8f8a', '#6c7f7a', 0.8, 0, 0.3),
    mobiliario: mob('clasica', 'torneadas', 'media', 1.05, 1),
    iluminacion: luz(3200, 1.1, 1.1, 1.05),
    prompt: 'Classic French interior, pale limestone floor, ivory walls with boiserie wall panels, sage gray accent wall, distressed cream lacquered cabinetry, Louis style chairs with carved legs, linen upholstery, gray green velvet, white marble counters, antique gilded mirror, soft refined daylight.',
    homedesigns: 'Traditional',
  },
  {
    id: 'costero', nombre: 'Costero',
    descripcion: 'Madera blanqueada, azul claro y rayas marineras; vende la vida frente al mar sin exagerar el tema.',
    temperatura: 'frio', region: 'norteamerica', presupuesto: 'medio',
    etiquetas: ['madera blanqueada', 'azul claro', 'playa', 'fresco'],
    paleta: ['#f5f3ee', '#a9c2cc', '#cdb796', '#e4ddd0', '#2f4e6b'],
    piso: m('madera', '#d2bf9f', '#bfa985', 0.65, 0, 1.2),
    pisoHumedo: m('porcelanato', '#e3ddd1', '#d5cec0', 0.5, 0, 0.9),
    muro: m('pintura', '#f5f3ee', '#ecebe5', 0.9, 0, 2),
    muroAcento: m('madera', '#eceae4', '#dedbd3', 0.7, 0, 0.6),
    carpinteria: m('laca', '#a9c2cc', '#9bb5bf', 0.4, 0, 1),
    cubierta: m('marmol', '#f0efea', '#c8ccce', 0.25, 0, 1.5),
    metal: mt('#b9b9b6', 0.35, 0.9),
    textil: m('lino', '#e4ddd0', '#d6cebf', 0.9, 0, 0.4),
    textil2: m('textil', '#2f4e6b', '#f5f3ee', 0.85, 0, 0.3),
    mobiliario: mob('redondeada', 'madera', 'media', 0.85, 2),
    iluminacion: luz(5500, 1.2, 1.3, 1.1),
    prompt: 'Coastal interior, bleached oak floor, white walls with white shiplap accent, pale sky blue cabinetry, white marble counters, slipcovered linen sofa, navy striped cushions, brushed nickel fixtures, woven jute rug, driftwood accents, bright cool ocean daylight, breezy fresh mood.',
    homedesigns: 'Coastal',
  },
  {
    id: 'tropical-moderno', nombre: 'Tropical moderno',
    descripcion: 'Teca, verde selva y terrazo con piedra; interior abierto a terraza para clima cálido y húmedo.',
    temperatura: 'calido', region: 'tropical', presupuesto: 'medio',
    etiquetas: ['teca', 'verde selva', 'terrazo', 'indoor-outdoor'],
    paleta: ['#ece6da', '#3f5a3a', '#6e4b2f', '#d8cdb7', '#d9733b'],
    piso: m('porcelanato', '#cbbfa9', '#bcae96', 0.6, 0, 1.2),
    pisoHumedo: m('piedra', '#8e8b7f', '#7d7a6f', 0.85, 0, 1),
    muro: m('aplanado', '#ece6da', '#e2dbcd', 0.95, 0, 1.5),
    muroAcento: m('pintura', '#3f5a3a', '#354d31', 0.9, 0, 2),
    carpinteria: m('madera', '#6e4b2f', '#573a23', 0.6, 0, 1),
    cubierta: m('terrazo', '#e3dccd', '#7f8a6d', 0.35, 0, 1),
    metal: mt('#2b2b2b', 0.5, 0.8),
    textil: m('lino', '#d8cdb7', '#c9bda5', 0.9, 0, 0.4),
    textil2: m('textil', '#d9733b', '#c4632e', 0.85, 0, 0.3),
    mobiliario: mob('recta', 'madera', 'baja', 0.9, 3),
    iluminacion: luz(4000, 1.2, 1.45, 1.1),
    prompt: 'Tropical modern interior, large stone-look porcelain floor, warm white walls, deep jungle green accent wall, teak furniture with clean lines, terrazzo counters with green chips, sand linen sofa, burnt orange cushions, sliding glass to a terrace, big palms and monstera, strong tropical sunlight.',
    homedesigns: 'Tropical',
  },
  {
    id: 'brutalista-calido', nombre: 'Brutalista cálido',
    descripcion: 'Concreto aparente templado con travertino, nogal y camel; masa y textura con calidez habitable.',
    temperatura: 'calido', region: 'global', presupuesto: 'alto',
    etiquetas: ['concreto aparente', 'travertino', 'nogal', 'camel'],
    paleta: ['#a69b8c', '#c9b79c', '#4a3426', '#b88a64', '#8c3b22'],
    piso: m('concreto', '#a69b8c', '#958a7b', 0.7, 0, 2.5),
    pisoHumedo: m('concreto', '#8f8577', '#7f7569', 0.65, 0, 2),
    muro: m('concreto', '#b3a898', '#a29787', 0.9, 0, 1.5),
    muroAcento: m('piedra', '#c9b79c', '#b8a486', 0.7, 0, 1.5),
    carpinteria: m('madera', '#4a3426', '#37261b', 0.6, 0, 1),
    cubierta: m('concreto', '#7a7166', '#6b6359', 0.6, 0, 1.5),
    metal: mt('#3a2e26', 0.6, 0.7),
    textil: m('boucle', '#b88a64', '#a77a55', 0.95, 0, 0.3),
    textil2: m('lino', '#8c3b22', '#77311c', 0.9, 0, 0.4),
    mobiliario: mob('recta', 'ocultas', 'baja', 1.0, 2),
    iluminacion: luz(3000, 0.95, 1.1, 1.0),
    prompt: 'Warm brutalist interior, board-formed warm gray concrete walls and floor, travertine accent wall, monolithic dark walnut furniture, chunky camel boucle sofa, rust linen cushions, dark bronze fixtures, concrete counters, sculptural objects, dramatic warm sunlight raking across textured surfaces.',
    homedesigns: 'Brutalist',
  },
  {
    id: 'lujo-contemporaneo', nombre: 'Lujo contemporáneo',
    descripcion: 'Mármol en piso y muro, nogal oscuro y bronce champaña; acabados de departamento de alto valor.',
    temperatura: 'neutro', region: 'global', presupuesto: 'alto',
    etiquetas: ['mármol', 'nogal oscuro', 'bronce', 'penthouse'],
    paleta: ['#e8e3dc', '#5b5650', '#3a2c24', '#cbbfb0', '#b08d57'],
    piso: m('marmol', '#e9e5de', '#b9b0a3', 0.15, 0, 1.8),
    pisoHumedo: m('marmol', '#d9d4cc', '#9c9387', 0.2, 0, 1.5),
    muro: m('pintura', '#e8e3dc', '#ded8cf', 0.85, 0, 2),
    muroAcento: m('marmol', '#5b5650', '#2f2c29', 0.15, 0, 1.5),
    carpinteria: m('madera', '#3a2c24', '#2a1f19', 0.3, 0, 1),
    cubierta: m('marmol', '#f1eee9', '#a49a8c', 0.12, 0, 1.5),
    metal: mt('#b08d57', 0.2, 1),
    textil: m('boucle', '#cbbfb0', '#bdb0a0', 0.95, 0, 0.3),
    textil2: m('terciopelo', '#4a4f57', '#3e424a', 0.8, 0, 0.3),
    mobiliario: mob('recta', 'metal', 'baja', 1.0, 1),
    iluminacion: luz(3000, 1.05, 1.0, 1.0),
    prompt: 'Luxury contemporary penthouse interior, large polished marble floor, dark gray bookmatched marble feature wall, glossy dark walnut cabinetry, champagne bronze trims, low ivory boucle sofa, slate velvet cushions, white marble island, linear cove lighting, warm controlled light, refined upscale mood.',
    homedesigns: 'Luxurious',
  },
  {
    id: 'rustico-moderno', nombre: 'Rústico moderno',
    descripcion: 'Tablón ancho, piedra de río y granito cepillado; casa de campo o montaña con líneas actuales.',
    temperatura: 'calido', region: 'norteamerica', presupuesto: 'medio',
    etiquetas: ['tablón ancho', 'piedra de río', 'campo', 'lana'],
    paleta: ['#e6ddcf', '#8f8679', '#7b5a3e', '#c8b9a3', '#5a6b4e'],
    piso: m('madera', '#8f6a48', '#74543a', 0.75, 0, 1.5),
    pisoHumedo: m('piedra', '#9c948a', '#888076', 0.85, 0, 1),
    muro: m('aplanado', '#e6ddcf', '#dcd2c2', 0.95, 0, 1.5),
    muroAcento: m('piedra', '#8f8679', '#7b7266', 0.95, 0, 1),
    carpinteria: m('madera', '#7b5a3e', '#5f452f', 0.8, 0, 1),
    cubierta: m('piedra', '#4a4744', '#3c3a37', 0.6, 0, 1),
    metal: mt('#2a2a28', 0.75, 0.75),
    textil: m('lino', '#c8b9a3', '#b9a990', 0.9, 0, 0.4),
    textil2: m('textil', '#5a6b4e', '#4b5a41', 0.9, 0, 0.3),
    mobiliario: mob('recta', 'madera', 'media', 1.0, 2),
    iluminacion: luz(2900, 1.0, 1.1, 1.0),
    prompt: 'Modern rustic interior, wide plank knotty oak floor, stacked river stone accent wall, warm plaster walls, chunky reclaimed wood furniture, brushed black granite counters, oatmeal linen sofa, moss green wool throws, blackened iron hardware, exposed beams, warm cozy firelight and soft daylight.',
    homedesigns: 'Rustic',
  },
  {
    id: 'boho', nombre: 'Boho',
    descripcion: 'Terracota, kilim, madera y pasta de colores; ambiente relajado para rentas vacacionales con presupuesto.',
    temperatura: 'calido', region: 'global', presupuesto: 'contenido',
    etiquetas: ['terracota', 'kilim', 'macramé', 'plantas'],
    paleta: ['#f0e6d6', '#c97b4a', '#8a6440', '#e2c9a6', '#7a3e48'],
    piso: m('madera', '#b48a5e', '#9a734a', 0.65, 0, 1.2),
    pisoHumedo: m('mosaico', '#e9dcc7', '#c97b4a', 0.5, 0, 0.5),
    muro: m('pintura', '#f0e6d6', '#e6dac7', 0.9, 0, 2),
    muroAcento: m('aplanado', '#c97b4a', '#b76c3e', 0.95, 0, 1.5),
    carpinteria: m('madera', '#8a6440', '#6f4f31', 0.7, 0, 1),
    cubierta: m('porcelanato', '#e8dcc8', '#dccfb8', 0.4, 0, 0.6),
    metal: mt('#a07a3c', 0.4, 0.85),
    textil: m('lino', '#e2c9a6', '#d3b893', 0.9, 0, 0.4),
    textil2: m('textil', '#7a3e48', '#c97b4a', 0.9, 0, 0.3),
    mobiliario: mob('organica', 'madera', 'baja', 1.2, 3),
    iluminacion: luz(2900, 1.0, 1.1, 1.0),
    prompt: 'Bohemian interior, warm honey wood floor, cream walls, terracotta plaster accent wall, layered kilim rugs in plum and rust, low sofa with many patterned cushions, rattan chair, macrame wall hanging, patterned cement tiles in the bath, brass lamps, abundant trailing plants, warm cozy light.',
    homedesigns: 'Bohemian',
  },
  {
    id: 'farmhouse-moderno', nombre: 'Farmhouse moderno',
    descripcion: 'Blanco cálido, roble, negro mate y muro carbón; cocina protagonista para familias.',
    temperatura: 'neutro', region: 'norteamerica', presupuesto: 'medio',
    etiquetas: ['roble', 'negro mate', 'cocina familiar', 'shaker'],
    paleta: ['#f3f1ec', '#2b2d2f', '#b38d63', '#d9d4ca', '#5f7363'],
    piso: m('madera', '#b8946a', '#9c7a52', 0.65, 0, 1.4),
    pisoHumedo: m('mosaico', '#f1f0ec', '#c9c6bf', 0.4, 0, 0.3),
    muro: m('pintura', '#f3f1ec', '#eae7e0', 0.9, 0, 2),
    muroAcento: m('pintura', '#2b2d2f', '#232527', 0.9, 0, 2),
    carpinteria: m('madera', '#b38d63', '#987450', 0.6, 0, 1),
    cubierta: m('marmol', '#efede8', '#d6d3cc', 0.3, 0, 1.5),
    metal: mt('#1d1d1d', 0.6, 0.8),
    textil: m('lino', '#d9d4ca', '#cbc5ba', 0.9, 0, 0.4),
    textil2: m('textil', '#5f7363', '#506252', 0.9, 0, 0.3),
    mobiliario: mob('recta', 'madera', 'media', 1.0, 2),
    iluminacion: luz(4000, 1.1, 1.15, 1.05),
    prompt: 'Modern farmhouse interior, natural oak plank floor, warm white walls, charcoal board accent wall, shaker style oak cabinetry, white quartz counters, matte black hardware and pendant lights, oversized linen sofa, sage plaid cushions, white hexagon tiles in the bath, bright friendly daylight.',
    homedesigns: 'Modern Farm House',
  },
  {
    id: 'maximalista', nombre: 'Maximalista',
    descripcion: 'Verde bosque, rosa frambuesa, mostaza y azul cobalto; color y patrón para proyectos de autor.',
    temperatura: 'calido', region: 'global', presupuesto: 'alto',
    etiquetas: ['color saturado', 'patrones', 'terciopelo', 'colección'],
    paleta: ['#2f4a3f', '#c2456b', '#5a2f22', '#d9a441', '#1e3a6e'],
    piso: m('madera', '#6e4126', '#56321c', 0.45, 0, 0.8),
    pisoHumedo: m('mosaico', '#1e3a6e', '#d9a441', 0.35, 0, 0.4),
    muro: m('pintura', '#2f4a3f', '#283f35', 0.85, 0, 2),
    muroAcento: m('textil', '#c2456b', '#d9a441', 0.8, 0, 0.5),
    carpinteria: m('laca', '#5a2f22', '#47251a', 0.25, 0, 1),
    cubierta: m('marmol', '#e6d5c3', '#8a3b2e', 0.2, 0, 1.2),
    metal: mt('#c9a24a', 0.25, 1),
    textil: m('terciopelo', '#d9a441', '#c48f30', 0.8, 0, 0.3),
    textil2: m('terciopelo', '#1e3a6e', '#18305b', 0.8, 0, 0.3),
    mobiliario: mob('redondeada', 'metal', 'media', 1.3, 3),
    iluminacion: luz(2800, 1.0, 0.9, 1.0),
    prompt: 'Maximalist interior, dark herringbone parquet floor, deep forest green walls, raspberry and gold patterned wallpaper accent, oxblood lacquered cabinetry, red veined marble, mustard velvet sofa, cobalt cushions, gallery wall of framed art, brass lamps, layered rugs, many plants, rich warm light.',
    homedesigns: 'Maximalist',
  },
  {
    id: 'neoclasico', nombre: 'Neoclásico',
    descripcion: 'Mármol blanco y gris, molduras y azul acero; simetría para residencias de corte institucional.',
    temperatura: 'neutro', region: 'europa', presupuesto: 'alto',
    etiquetas: ['mármol', 'molduras', 'simetría', 'azul acero'],
    paleta: ['#efede8', '#cfc9bf', '#e3ddd2', '#8a9aa6', '#a88b4a'],
    piso: m('marmol', '#ecebe7', '#9c9a96', 0.2, 0, 1.2),
    pisoHumedo: m('marmol', '#e3dfd7', '#a59f94', 0.2, 0, 1),
    muro: m('pintura', '#efede8', '#e6e3dd', 0.85, 0, 2),
    muroAcento: m('pintura', '#cfc9bf', '#c3bcb1', 0.85, 0, 2),
    carpinteria: m('laca', '#e3ddd2', '#d8d1c4', 0.3, 0, 1),
    cubierta: m('marmol', '#f0eeea', '#9e9a94', 0.18, 0, 1.5),
    metal: mt('#a88b4a', 0.3, 0.95),
    textil: m('terciopelo', '#8a9aa6', '#7a8a96', 0.8, 0, 0.3),
    textil2: m('lino', '#cfc9bf', '#c1bab0', 0.85, 0, 0.4),
    mobiliario: mob('clasica', 'torneadas', 'media', 0.95, 1),
    iluminacion: luz(4200, 1.15, 1.1, 1.05),
    prompt: 'Neoclassical interior, white and gray veined marble floor, pale walls with classical moldings and pilasters, symmetrical layout, ivory lacquered cabinetry, steel blue velvet upholstery, furniture with fluted turned legs, antique gold accents, crystal chandelier, tall windows, cool even daylight, stately mood.',
    homedesigns: 'Neoclassical',
  },
  {
    id: 'zen', nombre: 'Zen',
    descripcion: 'Piso de piedra gris, celosía de madera y verde musgo; espacios de pausa para spa, estudio o recámara.',
    temperatura: 'neutro', region: 'asia', presupuesto: 'medio',
    etiquetas: ['piedra gris', 'celosía', 'musgo', 'spa'],
    paleta: ['#e4e1d8', '#7d8574', '#a88c66', '#cfcabe', '#2e2f2c'],
    piso: m('piedra', '#8b8a84', '#7a7973', 0.75, 0, 1.2),
    pisoHumedo: m('piedra', '#6e6d68', '#5f5e5a', 0.85, 0, 1),
    muro: m('aplanado', '#e4e1d8', '#dad7cd', 0.95, 0, 2),
    muroAcento: m('madera', '#9a7e5c', '#836946', 0.7, 0, 0.6),
    carpinteria: m('madera', '#a88c66', '#8f7552', 0.65, 0, 1),
    cubierta: m('piedra', '#3e3f3c', '#333431', 0.75, 0, 1),
    metal: mt('#2e2f2c', 0.7, 0.6),
    textil: m('lino', '#cfcabe', '#c0baac', 0.9, 0, 0.4),
    textil2: m('lino', '#7d8574', '#6e7666', 0.9, 0, 0.4),
    mobiliario: mob('recta', 'ocultas', 'baja', 0.6, 3),
    iluminacion: luz(3800, 0.9, 1.0, 0.95),
    prompt: 'Zen interior, honed gray stone floor, soft putty plaster walls, wooden lattice screen accent wall, floor-level furniture, cedar cabinetry, dark basalt counters, moss green and stone linen cushions, bonsai and bamboo, pebble details, indirect soft light, deeply calm meditative mood.',
    homedesigns: 'Zen',
  },
  {
    id: 'bauhaus', nombre: 'Bauhaus',
    descripcion: 'Laca negra, cromo tubular y planos de rojo y azul primario; función y geometría a la vista.',
    temperatura: 'neutro', region: 'europa', presupuesto: 'medio',
    etiquetas: ['colores primarios', 'cromo', 'geometría', 'funcional'],
    paleta: ['#f0eee9', '#2d4fa1', '#c8a77e', '#262626', '#d63a2a'],
    piso: m('madera', '#c8a77e', '#b0906a', 0.5, 0, 0.8),
    pisoHumedo: m('mosaico', '#ecebe6', '#1f1f1f', 0.35, 0, 0.3),
    muro: m('pintura', '#f0eee9', '#e7e5df', 0.9, 0, 2),
    muroAcento: m('pintura', '#2d4fa1', '#27458d', 0.9, 0, 2),
    carpinteria: m('laca', '#1f1f1f', '#151515', 0.25, 0, 1),
    cubierta: m('porcelanato', '#e8e6e1', '#dad8d2', 0.35, 0, 1),
    metal: mt('#c8c8c8', 0.15, 1),
    textil: m('textil', '#262626', '#1b1b1b', 0.5, 0, 0.5),
    textil2: m('lino', '#d63a2a', '#bf3022', 0.85, 0, 0.4),
    mobiliario: mob('recta', 'metal', 'media', 0.8, 0),
    iluminacion: luz(4800, 1.15, 1.0, 1.05),
    prompt: 'Bauhaus interior, light oak parquet floor, white walls with a primary blue accent wall, black lacquered cabinetry, tubular chrome steel chairs, black leather seating, red cushions, black and white mosaic bath tiles, geometric rectangular forms, globe lights, clear neutral daylight, rational functional mood.',
    homedesigns: 'Bauhaus',
  },
  {
    id: 'hollywood-regency', nombre: 'Hollywood regency',
    descripcion: 'Rosa empolvado, laca negra brillante, oro y terciopelo esmeralda; glamour para suites y lounges.',
    temperatura: 'calido', region: 'norteamerica', presupuesto: 'alto',
    etiquetas: ['rosa empolvado', 'laca negra', 'oro', 'glamour'],
    paleta: ['#f2ece6', '#e7b8b0', '#151515', '#0f5c55', '#d4af37'],
    piso: m('marmol', '#eeeae3', '#b3aa9c', 0.15, 0, 1.5),
    pisoHumedo: m('marmol', '#1c1c1c', '#d8d2c4', 0.15, 0, 1.2),
    muro: m('pintura', '#f2ece6', '#e9e2da', 0.85, 0, 2),
    muroAcento: m('pintura', '#e7b8b0', '#dba99f', 0.85, 0, 2),
    carpinteria: m('laca', '#151515', '#0d0d0d', 0.12, 0, 1),
    cubierta: m('marmol', '#f1eeea', '#c9bfae', 0.12, 0, 1.5),
    metal: mt('#d4af37', 0.12, 1),
    textil: m('terciopelo', '#0f5c55', '#0b4a44', 0.75, 0, 0.3),
    textil2: m('terciopelo', '#efd3cb', '#e2c3ba', 0.75, 0, 0.3),
    mobiliario: mob('redondeada', 'metal', 'media', 1.1, 1),
    iluminacion: luz(2900, 1.1, 0.9, 1.0),
    prompt: 'Hollywood Regency interior, polished white marble floor, powder pink accent wall, high gloss black lacquered furniture, polished gold metal frames, curved emerald velvet sofa, blush cushions, mirrored surfaces, black marble bathroom, sunburst mirror, crystal sconces, warm flattering glamorous light.',
    homedesigns: 'Hollywood Regency',
  },
  {
    id: 'biofilico', nombre: 'Biofílico',
    descripcion: 'Arcilla, madera, piedra y verde vivo con muchas plantas; bienestar medible para oficinas y vivienda.',
    temperatura: 'calido', region: 'global', presupuesto: 'medio',
    etiquetas: ['plantas', 'arcilla', 'madera', 'bienestar'],
    paleta: ['#eae6da', '#5f7a4d', '#8d6b47', '#d6cdb8', '#a65a2e'],
    piso: m('madera', '#a88458', '#8e6d45', 0.6, 0, 1.2),
    pisoHumedo: m('piedra', '#a39c8c', '#918a7a', 0.85, 0, 1),
    muro: m('aplanado', '#eae6da', '#e0dbcd', 0.95, 0, 1.5),
    muroAcento: m('aplanado', '#5f7a4d', '#546d43', 0.95, 0, 1.5),
    carpinteria: m('madera', '#8d6b47', '#735537', 0.65, 0, 1),
    cubierta: m('piedra', '#c6bca7', '#b3a891', 0.6, 0, 1),
    metal: mt('#6b5a3e', 0.5, 0.75),
    textil: m('lino', '#d6cdb8', '#c7bda6', 0.9, 0, 0.4),
    textil2: m('lino', '#a65a2e', '#914d26', 0.9, 0, 0.4),
    mobiliario: mob('organica', 'madera', 'media', 1.0, 3),
    iluminacion: luz(4200, 1.15, 1.4, 1.05),
    prompt: 'Biophilic interior, warm oak floor, natural clay plaster walls, leafy green accent wall, organic wood furniture, natural stone counters, oat linen sofa with rust cushions, bronze details, abundant indoor plants and hanging greenery, skylight, strong natural daylight, healthy restorative mood.',
    homedesigns: 'Biophilic',
  },
  {
    id: 'yucateco-colonial', nombre: 'Yucateco colonial',
    descripcion: 'Pasta de colores, muros altos de cal, ocre de Mérida y madera oscura; casonas restauradas del centro.',
    temperatura: 'calido', region: 'mexico', presupuesto: 'alto',
    etiquetas: ['pasta de colores', 'cal', 'mérida', 'madera oscura', 'techos altos'],
    paleta: ['#f2ebdd', '#d8a23c', '#3b281c', '#e6d9c2', '#2f6f8f'],
    piso: m('mosaico', '#d8a23c', '#2f6f8f', 0.45, 0, 0.6),
    pisoHumedo: m('mosaico', '#e6d9c2', '#2f6f8f', 0.45, 0, 0.4),
    muro: m('aplanado', '#f2ebdd', '#e7ddca', 1, 0, 2),
    muroAcento: m('aplanado', '#d8a23c', '#c78f2c', 1, 0, 2),
    carpinteria: m('madera', '#3b281c', '#2a1b12', 0.6, 0, 1),
    cubierta: m('piedra', '#e1d6c0', '#cdbfa4', 0.7, 0, 1),
    metal: mt('#232020', 0.7, 0.7),
    textil: m('lino', '#e6d9c2', '#d6c6aa', 0.9, 0, 0.4),
    textil2: m('textil', '#2f6f8f', '#25607d', 0.85, 0, 0.3),
    mobiliario: mob('clasica', 'torneadas', 'media', 1.0, 3),
    iluminacion: luz(3200, 1.1, 1.4, 1.05),
    prompt: 'Yucatan colonial interior, patterned cement tile floor in ochre and teal, very high lime plastered walls, ochre accent wall, tall dark cedar doors and furniture with turned legs, wrought iron window grilles, limestone counters, woven henequen textiles, potted palms, bright sun through tall doorways.',
    homedesigns: 'Colonial',
  },
  {
    id: 'modernismo-mexicano', nombre: 'Modernismo mexicano',
    descripcion: 'Planos de color saturado (rosa mexicano, amarillo), madera de pino y barro; arquitectura emocional.',
    temperatura: 'calido', region: 'mexico', presupuesto: 'alto',
    etiquetas: ['barragán', 'color plano', 'rosa mexicano', 'pino'],
    paleta: ['#e2577a', '#f2b33d', '#7a4a2c', '#d9c7a8', '#6c3f8f'],
    piso: m('madera', '#7a4a2c', '#62391f', 0.6, 0, 1.5),
    pisoHumedo: m('barro', '#b0623b', '#9a5331', 0.8, 0, 0.6),
    muro: m('aplanado', '#efe4d2', '#e6d9c4', 0.95, 0, 2),
    muroAcento: m('pintura', '#e2577a', '#d74e70', 0.95, 0, 3),
    carpinteria: m('madera', '#7a4a2c', '#62391f', 0.65, 0, 1),
    cubierta: m('piedra', '#c9b8a0', '#b8a68c', 0.7, 0, 1),
    metal: mt('#2a2420', 0.7, 0.6),
    textil: m('lino', '#d9c7a8', '#cab695', 0.9, 0, 0.4),
    textil2: m('lino', '#f2b33d', '#e0a02f', 0.9, 0, 0.4),
    mobiliario: mob('recta', 'madera', 'baja', 0.7, 1),
    iluminacion: luz(3600, 1.15, 1.5, 1.05),
    prompt: 'Mexican modernist interior inspired by emotional architecture, flat saturated Mexican pink wall plane, warm white plaster walls, dark pine plank floor, clay tiles in wet areas, sparse solid pine furniture, yellow linen accents, a purple plane seen through an opening, strong sunlight casting geometric shadows.',
    homedesigns: 'Modern',
  },
  {
    id: 'nordico-oscuro', nombre: 'Nórdico oscuro',
    descripcion: 'Carbón, roble ahumado y coñac; interiores sobrios y envolventes para recámaras y estudios.',
    temperatura: 'frio', region: 'nordico', presupuesto: 'medio',
    etiquetas: ['carbón', 'roble ahumado', 'oscuro', 'coñac'],
    paleta: ['#55585a', '#6e6f6c', '#5a4636', '#8d8a84', '#b07a4f'],
    piso: m('madera', '#5a4636', '#46372a', 0.6, 0, 1.2),
    pisoHumedo: m('porcelanato', '#3e3f40', '#353637', 0.5, 0, 1),
    muro: m('pintura', '#55585a', '#4d5052', 0.9, 0, 2),
    muroAcento: m('pintura', '#2c2e30', '#25272a', 0.9, 0, 2),
    carpinteria: m('madera', '#3b2e24', '#2c221a', 0.55, 0, 1),
    cubierta: m('piedra', '#2a2a2a', '#3a3a3a', 0.5, 0, 1),
    metal: mt('#1a1a1a', 0.6, 0.8),
    textil: m('boucle', '#8d8a84', '#7e7b75', 0.95, 0, 0.3),
    textil2: m('lino', '#b07a4f', '#9a693f', 0.9, 0, 0.4),
    mobiliario: mob('recta', 'madera', 'baja', 0.8, 2),
    iluminacion: luz(2800, 0.95, 0.7, 1.15),
    prompt: 'Nordic noir interior, smoked oak floor, charcoal gray walls with near black accent wall, dark stained oak cabinetry, soapstone counters, light gray boucle sofa, cognac leather and linen accents, matte black fixtures, candles, sheepskin throw, low warm lamplight against cool dusk light.',
    homedesigns: 'Nordic Noir',
  },
  {
    id: 'lujo-silencioso', nombre: 'Lujo silencioso',
    descripcion: 'Roble europeo, travertino, estuco y bronce cepillado; lujo que se nota en el material, no en el logo.',
    temperatura: 'neutro', region: 'global', presupuesto: 'alto',
    etiquetas: ['travertino', 'estuco', 'roble europeo', 'tonos piedra'],
    paleta: ['#e7e0d6', '#c4b8a7', '#7d6550', '#d8cdbd', '#5c5249'],
    piso: m('madera', '#b59d80', '#a28a6d', 0.5, 0, 1.6),
    pisoHumedo: m('piedra', '#d7ccbb', '#c6b9a6', 0.6, 0, 1.5),
    muro: m('aplanado', '#e7e0d6', '#dfd7cb', 0.95, 0, 2),
    muroAcento: m('piedra', '#c4b8a7', '#b3a693', 0.6, 0, 1.5),
    carpinteria: m('madera', '#7d6550', '#665240', 0.45, 0, 1),
    cubierta: m('marmol', '#e9e3d9', '#cbbfae', 0.25, 0, 1.5),
    metal: mt('#8a7a64', 0.4, 0.85),
    textil: m('boucle', '#d8cdbd', '#cbbfac', 0.95, 0, 0.3),
    textil2: m('textil', '#5c5249', '#4f463e', 0.85, 0, 0.4),
    mobiliario: mob('redondeada', 'ocultas', 'baja', 0.75, 1),
    iluminacion: luz(3000, 1.0, 1.0, 1.0),
    prompt: 'Quiet luxury interior, wide plank natural European oak floor, warm greige Venetian plaster walls, honed travertine accent wall, tailored walnut cabinetry, soft cream boucle sofa, taupe cashmere throws, brushed bronze hardware, understated stone counters, minimal decor, soft diffused warm light, discreet refined mood.',
    homedesigns: 'Quiet Luxury',
  },
  {
    id: 'organico-moderno', nombre: 'Orgánico moderno',
    descripcion: 'Curvas suaves, arcilla, madera miel y bouclé; tendencia vigente para vivienda nueva de gama media-alta.',
    temperatura: 'calido', region: 'global', presupuesto: 'medio',
    etiquetas: ['curvas', 'arcilla', 'bouclé', 'madera miel'],
    paleta: ['#efe8dd', '#cdb89c', '#b08d6a', '#e3d8c6', '#8a5a3c'],
    piso: m('madera', '#c2a07a', '#a9875f', 0.6, 0, 1.3),
    pisoHumedo: m('porcelanato', '#c9bba3', '#baab91', 0.6, 0, 1),
    muro: m('aplanado', '#efe8dd', '#e6ddcf', 0.95, 0, 2),
    muroAcento: m('aplanado', '#cdb89c', '#c0a98b', 1, 0, 1.5),
    carpinteria: m('madera', '#b08d6a', '#977554', 0.6, 0, 1),
    cubierta: m('marmol', '#ece4d8', '#c9b9a2', 0.3, 0, 1.5),
    metal: mt('#8c6f4a', 0.5, 0.75),
    textil: m('boucle', '#e3d8c6', '#d6c9b4', 0.95, 0, 0.3),
    textil2: m('lino', '#8a5a3c', '#774b31', 0.9, 0, 0.4),
    mobiliario: mob('organica', 'ocultas', 'baja', 0.85, 2),
    iluminacion: luz(3300, 1.05, 1.2, 1.05),
    prompt: 'Organic modern interior, honey oak floor, soft clay plaster walls with rounded arches, curved cream boucle sofa, rounded solid wood tables, warm beige stone counters, rust linen accents, aged brass details, sculptural ceramics, olive tree, soft warm natural light, gentle tactile mood.',
    homedesigns: 'Organic Modern',
  },
  {
    id: 'marroqui', nombre: 'Marroquí',
    descripcion: 'Tadelakt, zellige verde y azul, cedro tallado y latón martillado; ideal para riads y hoteles boutique.',
    temperatura: 'calido', region: 'africa-medio-oriente', presupuesto: 'medio',
    etiquetas: ['zellige', 'tadelakt', 'latón', 'kilim'],
    paleta: ['#efe2c9', '#1f5e7a', '#6b3a22', '#c9853f', '#a8322a'],
    piso: m('concreto', '#c99a68', '#b8895a', 0.5, 0, 2),
    pisoHumedo: m('mosaico', '#1f5e7a', '#2a7a96', 0.2, 0, 0.3),
    muro: m('aplanado', '#efe2c9', '#e4d4b6', 0.8, 0, 1.5),
    muroAcento: m('mosaico', '#2a6f5f', '#e9dcc0', 0.25, 0, 0.3),
    carpinteria: m('madera', '#6b3a22', '#542c19', 0.6, 0, 1),
    cubierta: m('piedra', '#e6d8bd', '#d2c19f', 0.6, 0, 1),
    metal: mt('#b0843a', 0.35, 0.9),
    textil: m('textil', '#c9853f', '#b5742f', 0.85, 0, 0.4),
    textil2: m('terciopelo', '#a8322a', '#8f2a23', 0.8, 0, 0.3),
    mobiliario: mob('clasica', 'ocultas', 'baja', 1.15, 2),
    iluminacion: luz(2700, 0.95, 1.2, 1.0),
    prompt: 'Moroccan riad interior, polished amber tadelakt floor and walls, green zellige tile accent wall, deep blue glazed tiles in the bath, carved cedar doors and low furniture, saffron kilim sofa, red velvet cushions, hammered brass lanterns casting patterned shadows, horseshoe arches, warm golden light.',
    homedesigns: 'Moroccan',
  },
  {
    id: 'toscano', nombre: 'Toscano',
    descripcion: 'Cotto, travertino, muros ocre y vigas de castaño; casa de campo europea para desarrollos de golf o viñedo.',
    temperatura: 'calido', region: 'mediterraneo', presupuesto: 'medio',
    etiquetas: ['cotto', 'travertino', 'ocre', 'oliva'],
    paleta: ['#e9d9bd', '#b8743f', '#5e3d26', '#d6c29e', '#6b7a3a'],
    piso: m('barro', '#b8743f', '#a1622f', 0.85, 0, 0.6),
    pisoHumedo: m('piedra', '#d8c6a4', '#c6b28d', 0.7, 0, 1.2),
    muro: m('aplanado', '#e9d9bd', '#ddc9a7', 0.95, 0, 1.5),
    muroAcento: m('piedra', '#c9b08a', '#b39a74', 0.95, 0, 1),
    carpinteria: m('madera', '#5e3d26', '#472d1b', 0.7, 0, 1),
    cubierta: m('marmol', '#e2d3b6', '#c7b48f', 0.4, 0, 1.5),
    metal: mt('#2e2a26', 0.7, 0.7),
    textil: m('lino', '#d6c29e', '#c7b28c', 0.9, 0, 0.4),
    textil2: m('textil', '#6b7a3a', '#5c6a30', 0.85, 0, 0.3),
    mobiliario: mob('clasica', 'madera', 'media', 1.0, 2),
    iluminacion: luz(3000, 1.05, 1.3, 1.0),
    prompt: 'Tuscan interior, worn cotto terracotta floor, warm ochre plaster walls, rough fieldstone accent wall, dark chestnut beams and furniture, travertine counters, wrought iron fixtures, wheat linen sofa, olive green textiles, ceramic urns with olive branches, golden late afternoon countryside light.',
    homedesigns: 'Tuscan',
  },
  {
    id: 'memphis', nombre: 'Memphis',
    descripcion: 'Terrazo, amarillo, turquesa y rosa con formas geométricas; para espacios jóvenes, cafés o coworking.',
    temperatura: 'neutro', region: 'europa', presupuesto: 'contenido',
    etiquetas: ['terrazo', 'geométrico', 'colores pop', 'ochentas'],
    paleta: ['#f4efe6', '#f5c33b', '#e9e4da', '#2fa3b5', '#e8467c'],
    piso: m('terrazo', '#f1ece3', '#2b2b2b', 0.35, 0, 0.8),
    pisoHumedo: m('terrazo', '#f3e6e0', '#e8467c', 0.35, 0, 0.8),
    muro: m('pintura', '#f4efe6', '#ebe5da', 0.9, 0, 2),
    muroAcento: m('pintura', '#2fa3b5', '#2894a5', 0.9, 0, 2),
    carpinteria: m('laca', '#f5c33b', '#e8b42e', 0.25, 0, 1),
    cubierta: m('laca', '#e8467c', '#d93c70', 0.25, 0, 1),
    metal: mt('#1a1a1a', 0.4, 0.7),
    textil: m('textil', '#2b2b2b', '#f4efe6', 0.8, 0, 0.3),
    textil2: m('terciopelo', '#7a5cc9', '#6a4db8', 0.8, 0, 0.3),
    mobiliario: mob('redondeada', 'metal', 'media', 1.1, 0),
    iluminacion: luz(5000, 1.2, 1.0, 1.1),
    prompt: 'Memphis design interior, white terrazzo floor with black chips, turquoise accent wall, glossy yellow lacquered cabinets, pink laminate counters, black and white squiggle patterned sofa, purple velvet cushions, geometric furniture with cylinders and triangles, black metal accents, bright even playful light.',
    homedesigns: 'Memphis',
  },
  {
    id: 'desierto-moderno', nombre: 'Desierto moderno',
    descripcion: 'Arenisca, adobe, terracota quemada y salvia; casas horizontales con mucha luz y vista abierta.',
    temperatura: 'calido', region: 'norteamerica', presupuesto: 'medio',
    etiquetas: ['arenisca', 'adobe', 'salvia', 'cactáceas'],
    paleta: ['#e8d6bf', '#c98f62', '#6d4a32', '#d9c3a2', '#7f8c6b'],
    piso: m('porcelanato', '#d4b998', '#c5a987', 0.55, 0, 1.2),
    pisoHumedo: m('concreto', '#b99c7b', '#a88b6b', 0.55, 0, 2),
    muro: m('aplanado', '#e8d6bf', '#ddc8ad', 0.95, 0, 1.5),
    muroAcento: m('aplanado', '#c98f62', '#b97f53', 0.95, 0, 1.5),
    carpinteria: m('madera', '#6d4a32', '#553825', 0.6, 0, 1),
    cubierta: m('concreto', '#a99780', '#988670', 0.6, 0, 1.5),
    metal: mt('#2b2b2b', 0.6, 0.8),
    textil: m('lino', '#d9c3a2', '#cab291', 0.9, 0, 0.4),
    textil2: m('lino', '#7f8c6b', '#6f7c5c', 0.9, 0, 0.4),
    mobiliario: mob('recta', 'madera', 'baja', 0.75, 2),
    iluminacion: luz(3600, 1.2, 1.5, 1.1),
    prompt: 'Desert modern interior, sandstone-look porcelain floor, adobe colored plaster walls, burnt terracotta accent wall, low horizontal walnut furniture, warm concrete counters, sand linen sofa, sage green cushions, black steel window frames, cacti and agaves, intense dry sunlight with long shadows, open calm mood.',
    homedesigns: 'Desert Modernism',
  },
  {
    id: 'parisino', nombre: 'Parisino',
    descripcion: 'Espiga de roble, boiserie blanca, mármol Carrara y azul noche; departamento urbano con historia.',
    temperatura: 'neutro', region: 'europa', presupuesto: 'alto',
    etiquetas: ['espiga', 'boiserie', 'carrara', 'azul noche'],
    paleta: ['#f3f0ea', '#d9d2c6', '#9a7650', '#e6dccb', '#1d2f45'],
    piso: m('madera', '#9a7650', '#7e5f3e', 0.45, 0, 0.7),
    pisoHumedo: m('marmol', '#e8e5e0', '#a8a39b', 0.2, 0, 1),
    muro: m('pintura', '#f3f0ea', '#eae6de', 0.85, 0, 2),
    muroAcento: m('pintura', '#1d2f45', '#18283b', 0.85, 0, 2),
    carpinteria: m('laca', '#e9e4dc', '#ded8ce', 0.3, 0, 1),
    cubierta: m('marmol', '#ebe8e3', '#9b958c', 0.2, 0, 1.2),
    metal: mt('#b5985e', 0.35, 0.95),
    textil: m('lino', '#e6dccb', '#d8cdb9', 0.85, 0, 0.4),
    textil2: m('terciopelo', '#8c3b3b', '#773131', 0.8, 0, 0.3),
    mobiliario: mob('redondeada', 'metal', 'media', 0.85, 1),
    iluminacion: luz(4000, 1.1, 1.0, 1.05),
    prompt: 'Parisian apartment interior, oak chevron parquet floor, white walls with ornate boiserie molding, midnight blue accent wall, carrara marble fireplace and counters, cream lacquered cabinetry, curved linen sofa, cherry red velvet cushions, slim brass floor lamp, tall French windows, soft silvery daylight.',
    homedesigns: 'Parisian Chic',
  },
];

// ---------------------------------------------------------------------------------------------------------------
// Validación

const HEX = /^#[0-9a-f]{6}$/;
const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SUPERFICIES = ['piso', 'pisoHumedo', 'muro', 'muroAcento', 'carpinteria', 'cubierta', 'textil', 'textil2'];
const CAMPOS = ['id', 'nombre', 'descripcion', 'temperatura', 'region', 'presupuesto', 'etiquetas', 'paleta',
  ...SUPERFICIES, 'metal', 'mobiliario', 'iluminacion', 'prompt', 'homedesigns'];

const esNum = (v) => typeof v === 'number' && Number.isFinite(v);
const enRango = (v, a, b) => esNum(v) && v >= a && v <= b;
const esTexto = (v) => typeof v === 'string' && v.trim().length > 0;

export function validarEstilo(e) {
  const p = [];
  if (!e || typeof e !== 'object' || Array.isArray(e)) return ['el estilo no es un objeto'];
  const id = typeof e.id === 'string' ? e.id : '?';
  const err = (msg) => p.push(`${id}: ${msg}`);

  for (const c of CAMPOS) if (e[c] === undefined || e[c] === null) err(`falta ${c}`);

  if (!(typeof e.id === 'string' && KEBAB.test(e.id))) err('id debe ser kebab-case');
  if (!esTexto(e.nombre)) err('nombre vacío');
  if (!esTexto(e.descripcion)) err('descripcion vacía');
  else if (e.descripcion.length > 140) err(`descripcion de ${e.descripcion.length} caracteres (máx. 140)`);
  if (!Object.hasOwn(TEMPERATURAS, e.temperatura)) err(`temperatura inválida: ${e.temperatura}`);
  if (!Object.hasOwn(REGIONES, e.region)) err(`region inválida: ${e.region}`);
  if (!Object.hasOwn(PRESUPUESTOS, e.presupuesto)) err(`presupuesto inválido: ${e.presupuesto}`);

  if (!Array.isArray(e.etiquetas) || e.etiquetas.length < 2 || e.etiquetas.length > 5 || !e.etiquetas.every(esTexto)) {
    err('etiquetas debe tener 2-5 textos');
  }
  if (!Array.isArray(e.paleta) || e.paleta.length !== 5 || !e.paleta.every((c) => typeof c === 'string' && HEX.test(c))) {
    err('paleta debe tener exactamente 5 colores #rrggbb en minúsculas');
  }

  for (const s of SUPERFICIES) {
    const mat = e[s];
    if (!mat || typeof mat !== 'object') continue;
    if (!TEXTURAS.includes(mat.textura)) err(`${s}.textura inválida: ${mat.textura}`);
    if (!(typeof mat.color === 'string' && HEX.test(mat.color))) err(`${s}.color inválido: ${mat.color}`);
    if (!(typeof mat.color2 === 'string' && HEX.test(mat.color2))) err(`${s}.color2 inválido: ${mat.color2}`);
    if (!enRango(mat.rugosidad, 0, 1)) err(`${s}.rugosidad fuera de [0,1]`);
    if (!enRango(mat.metalicidad, 0, 1)) err(`${s}.metalicidad fuera de [0,1]`);
    if (!enRango(mat.escala, 0.3, 3)) err(`${s}.escala fuera de [0.3,3]`);
  }

  if (e.metal && typeof e.metal === 'object') {
    if (!(typeof e.metal.color === 'string' && HEX.test(e.metal.color))) err(`metal.color inválido: ${e.metal.color}`);
    if (!enRango(e.metal.rugosidad, 0, 1)) err('metal.rugosidad fuera de [0,1]');
    if (!enRango(e.metal.metalicidad, 0, 1)) err('metal.metalicidad fuera de [0,1]');
  }

  const mb = e.mobiliario;
  if (mb && typeof mb === 'object') {
    if (!FORMAS.includes(mb.forma)) err(`mobiliario.forma inválida: ${mb.forma}`);
    if (!PATAS.includes(mb.patas)) err(`mobiliario.patas inválidas: ${mb.patas}`);
    if (!ALTURAS.includes(mb.altura)) err(`mobiliario.altura inválida: ${mb.altura}`);
    if (!enRango(mb.densidad, 0.6, 1.3)) err('mobiliario.densidad fuera de [0.6,1.3]');
    if (!(Number.isInteger(mb.plantas) && mb.plantas >= 0 && mb.plantas <= 3)) err('mobiliario.plantas debe ser 0-3');
  }

  const il = e.iluminacion;
  if (il && typeof il === 'object') {
    if (!enRango(il.temperaturaK, 2400, 6000)) err('iluminacion.temperaturaK fuera de [2400,6000]');
    if (!enRango(il.intensidad, 0.5, 1.5)) err('iluminacion.intensidad fuera de [0.5,1.5]');
    if (!enRango(il.sol, 0, 1.5)) err('iluminacion.sol fuera de [0,1.5]');
    if (!enRango(il.exposicion, 0.6, 1.6)) err('iluminacion.exposicion fuera de [0.6,1.6]');
  }

  if (!esTexto(e.prompt)) err('prompt vacío');
  else {
    const palabras = e.prompt.trim().split(/\s+/).length;
    if (palabras < 25 || palabras > 60) err(`prompt de ${palabras} palabras (25-60)`);
  }
  if (!HD_ESTILOS.includes(e.homedesigns)) err(`homedesigns no documentado: ${e.homedesigns}`);
  return p;
}

// ---------------------------------------------------------------------------------------------------------------
// Catálogo congelado y consultas

function congelar(o) {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const v of Object.values(o)) congelar(v);
  }
  return o;
}

export const ESTILOS = congelar(CATALOGO);

const INDICE = new Map(ESTILOS.map((e) => [e.id, e]));

export function estiloPorId(id) {
  return INDICE.get(id);
}

const normalizar = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

export function buscarEstilos({ texto, temperatura, region, presupuesto } = {}) {
  const q = normalizar(texto);
  const terminos = q ? q.split(/\s+/) : [];
  return ESTILOS.filter((e) => {
    if (temperatura && e.temperatura !== temperatura) return false;
    if (region && e.region !== region) return false;
    if (presupuesto && e.presupuesto !== presupuesto) return false;
    if (!terminos.length) return true;
    const pajar = normalizar([e.nombre, e.descripcion, ...e.etiquetas].join(' '));
    return terminos.every((t) => pajar.includes(t));
  });
}

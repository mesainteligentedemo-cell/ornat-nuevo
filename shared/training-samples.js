// ORNAT · cursos de ejemplo (contenido propio, sin videos inventados: los campos de video quedan vacíos para que subas los tuyos).
const Q = (id, text, options, correct, feedback) => ({ id, type: 'opcion', text, options: options.map((t, i) => ({ id: `o${i + 1}`, text: t })), correct: `o${correct + 1}`, feedback });
const VF = (id, text, correct, feedback) => ({ id, type: 'vf', text, correct: correct ? 'v' : 'f', feedback, options: [] });
const VIDEO_NOTE = 'Aquí va el video de la lección. Pega la URL de YouTube o Vimeo en el editor de cursos (campo «URL del video») cuando lo tengas grabado.\n\n';

export function sampleCourses() {
  return [
    {
      id: 'demo-induccion-ornat', title: 'Inducción ORNAT', area: 'Cumplimiento', level: 'basico', required: true,
      summary: 'Quiénes somos, cómo trabajamos y qué se espera de ti en tu primera semana. Obligatorio para todo el equipo nuevo.',
      modules: [
        { id: 'ind-m1', title: 'Bienvenida a ORNAT', lessons: [
          { id: 'ind-1', type: 'texto', title: 'Qué hacemos y para quién', minutes: 6, body: '# Qué hace ORNAT\n\nORNAT es un estudio de **diseño visual y software para arquitectura e inmobiliarias** en México. Ayudamos a que un proyecto se vea, se entienda y se venda mejor.\n\n## Lo que entregamos\n- **Sitios y landings** para desarrollos, despachos y agencias.\n- **Editor (CMS)** para que el cliente actualice su contenido sin depender de nadie.\n- **CRM** para dar seguimiento a cada prospecto desde que llega hasta que cierra.\n- **Visualización** y material de venta: renders, videos y presentaciones.\n\n## Cómo se ve un buen resultado\n1. El cliente entiende su sitio y lo puede editar.\n2. Cada contacto que llega queda registrado y con responsable.\n3. Nadie tiene que preguntar «¿en qué quedamos?»: todo está en la plataforma.' },
          { id: 'ind-2', type: 'video', title: 'Mensaje de bienvenida (video)', minutes: 4, url: '', body: `${VIDEO_NOTE}Guion sugerido: quién eres, por qué existe ORNAT y qué esperas del equipo en el primer mes.` },
          { id: 'ind-3', type: 'texto', title: 'Roles y permisos en la plataforma', minutes: 5, body: '# Quién puede hacer qué\n\nLa plataforma tiene cuatro roles. Conócelos para saber a quién pedirle cada cosa.\n\n- **Dueño:** acceso total, incluido el equipo, la auditoría y los datos sensibles.\n- **Editor:** edita y publica el contenido del sitio y las propiedades.\n- **Vendedor:** trabaja el CRM, cambia el estado de las propiedades y comenta en el Editor.\n- **Cliente:** revisa y aprueba lo que le toca en el Editor.\n\n> Regla de oro: si necesitas un permiso que no tienes, pídelo al Dueño. No compartas tu sesión con nadie.' },
        ] },
        { id: 'ind-m2', title: 'Cómo trabajamos', lessons: [
          { id: 'ind-4', type: 'texto', title: 'Tu primera semana', minutes: 7, body: '# Plan de primera semana\n\n## Día 1\n- Entra a la plataforma y revisa tu perfil en **Cuenta**.\n- Conoce al equipo y a tu jefe directo.\n\n## Días 2 y 3\n- Completa este curso y los que tengas asignados en **Capacitación**.\n- Revisa el **Editor** y el **CRM** con un proyecto de ejemplo.\n\n## Días 4 y 5\n- Acompaña una llamada o reunión con un cliente.\n- Resuelve dudas con tu jefe directo.\n\n**Al terminar la semana** deberías poder explicar en dos minutos qué hace ORNAT y cómo se atiende un prospecto.' },
          { id: 'ind-5', type: 'texto', title: 'Confidencialidad y datos de clientes', minutes: 6, body: '# Cuidamos los datos\n\nTrabajamos con información de clientes, prospectos y compradores. Por eso:\n\n1. **No compartas** contraseñas ni uses la sesión de otra persona.\n2. **No envíes** datos personales (INE, CURP, RFC) por WhatsApp o correo abierto; usa los canales que defina Dirección.\n3. **Respeta el aviso de privacidad:** solo usamos los datos para el fin con el que se entregaron.\n4. Si sospechas que se filtró información, **avisa de inmediato** a tu jefe directo.\n\n> Este curso es una guía interna, no asesoría legal. Las políticas oficiales las define Dirección.' },
        ] },
        { id: 'ind-m3', title: 'Evaluación', lessons: [
          { id: 'ind-6', type: 'evaluacion', title: 'Evaluación de inducción', minutes: 5, body: 'Necesitas 80 % o más para aprobar. Tienes 3 intentos.', quiz: { minScore: 80, maxAttempts: 3, questions: [
            Q('ind-q1', '¿Qué rol puede ver los datos sensibles de RRHH (salario, CURP, RFC)?', ['Cualquier colaborador', 'Solo el Dueño', 'Los vendedores', 'El cliente'], 1, 'Los datos sensibles son visibles únicamente para el Dueño.'),
            VF('ind-q2', 'Es correcto compartir tu sesión con un compañero si tiene prisa.', false, 'Nunca compartas tu sesión: cada acción queda registrada a tu nombre.'),
            Q('ind-q3', '¿Dónde se da seguimiento a cada prospecto?', ['En un chat personal', 'En el CRM', 'En una libreta', 'En el sitio público'], 1, 'Todo prospecto debe vivir en el CRM con un responsable.'),
            Q('ind-q4', 'Si sospechas que se filtró información de un cliente, ¿qué haces?', ['Espero a ver si pasa algo', 'Aviso de inmediato a mi jefe directo', 'Lo comento en redes', 'Lo borro'], 1, 'Avisar rápido permite contener el problema.'),
          ] } },
        ] },
      ],
    },
    {
      id: 'demo-presentar-crm-editor', title: 'Cómo presentar el CRM y el Editor a un cliente inmobiliario', area: 'Producto ORNAT', level: 'intermedio', required: false,
      summary: 'Una demo de 20 minutos que muestra valor desde el primer clic: del formulario del sitio al seguimiento en el CRM, sin tecnicismos.',
      modules: [
        { id: 'pre-m1', title: 'Antes de la demo', lessons: [
          { id: 'pre-1', type: 'texto', title: 'Entiende su operación', minutes: 8, body: '# Antes de abrir la plataforma\n\nUna inmobiliaria no compra «software»: compra **vender más y perder menos prospectos**. Llega a la demo sabiendo:\n\n- ¿Cuántos contactos reciben al mes y por qué canales (web, WhatsApp, portales)?\n- ¿Quién les da seguimiento hoy y dónde lo anotan?\n- ¿Cuánto tardan en contestar al primer mensaje?\n- ¿Quién actualiza la disponibilidad de sus propiedades?\n\n## Prepara el ambiente\n1. Carga las **propiedades de ejemplo** y ajusta nombres a su zona.\n2. Ten un formulario de prueba listo para enviar en vivo.\n3. Define quién de su equipo será el Editor y quién el Vendedor.' },
          { id: 'pre-2', type: 'video', title: 'Demostración completa (video)', minutes: 10, url: '', body: `${VIDEO_NOTE}Sugerencia: graba la demo de 20 minutos de principio a fin con un cliente ficticio.` },
        ] },
        { id: 'pre-m2', title: 'La demo paso a paso', lessons: [
          { id: 'pre-3', type: 'texto', title: 'Guion de 20 minutos', minutes: 9, body: '# Guion recomendado\n\n## Minutos 0–3 · El problema\nPregunta por su proceso actual. Anota palabras textuales; las usarás después.\n\n## Minutos 3–8 · Del sitio al CRM\n1. Abre el sitio público y llena el formulario como si fueras un prospecto.\n2. Cambia a **CRM**: el contacto ya está ahí, con origen y fecha.\n3. Asigna responsable y programa el siguiente paso.\n\n## Minutos 8–14 · El Editor\n- Cambia un precio o una foto y **publica**: el cliente ve cómo no depende de nadie.\n- Muestra comentarios y aprobación para que su equipo revise antes de publicar.\n\n## Minutos 14–18 · Propiedades y disponibilidad\n- Cambia una propiedad a **Apartado** y muestra que se refleja en el sitio.\n\n## Minutos 18–20 · Cierre\nResume con **sus** palabras del inicio y propón el siguiente paso con fecha.' },
          { id: 'pre-4', type: 'texto', title: 'Objeciones frecuentes', minutes: 7, body: '# Responder sin discutir\n\n**«Ya usamos Excel y funciona.»**\nReconoce lo que sí funciona y pregunta: ¿qué pasa cuando alguien está de vacaciones? El CRM deja historial para que cualquiera retome.\n\n**«Mi equipo no es técnico.»**\nMuestra que el Editor se parece a llenar un formulario. Ofrece una sesión de capacitación incluida.\n\n**«¿Y mis datos?»**\nExplica roles y permisos: cada persona ve solo lo que le toca. Aclara el alcance real de tu entorno antes de prometer nada.\n\n**«Es caro.»**\nVuelve a su número: ¿cuánto vale un solo cierre perdido por responder tarde?\n\n> Regla: nunca prometas una función que no hayas visto funcionar en la plataforma.' },
          { id: 'pre-5', type: 'texto', title: 'Material de apoyo', minutes: 3, body: '# Material de apoyo\n\nAgrega aquí el enlace a tu presentación o carpeta compartida con el material de venta. Puedes crear lecciones de tipo «Enlace o archivo» desde el editor de cursos.' },
        ] },
        { id: 'pre-m3', title: 'Evaluación', lessons: [
          { id: 'pre-6', type: 'evaluacion', title: 'Evaluación de demo', minutes: 5, body: 'Necesitas 75 % o más.', quiz: { minScore: 75, maxAttempts: 0, questions: [
            Q('pre-q1', '¿Qué conviene hacer antes de la demo?', ['Mostrar todas las funciones', 'Entender su operación y prospectos mensuales', 'Mandar un PDF y esperar', 'Hablar de precios al inicio'], 1, 'La demo funciona cuando parte de su problema, no de tus funciones.'),
            Q('pre-q2', 'En el paso «del sitio al CRM», ¿qué demuestras?', ['Que el diseño es bonito', 'Que cada contacto queda registrado con origen y responsable', 'Que el sitio carga rápido', 'Que hay modo oscuro'], 1, 'El valor es no perder ningún contacto.'),
            VF('pre-q3', 'Si el cliente pregunta por una función que no has visto funcionar, conviene prometerla igualmente.', false, 'Nunca prometas lo que no hayas visto funcionar.'),
            Q('pre-q4', 'Ante «ya usamos Excel», lo mejor es…', ['Decirle que está mal', 'Reconocer lo que funciona y preguntar qué pasa cuando alguien falta', 'Cambiar de tema', 'Bajar el precio'], 1, 'Reconoce, pregunta y muestra el historial compartido.'),
          ] } },
        ] },
      ],
    },
    {
      id: 'demo-whatsapp-prospectos', title: 'Atención por WhatsApp sin perder prospectos', area: 'Atención a clientes', level: 'basico', required: false,
      summary: 'Responde rápido, califica con tres preguntas y registra todo en el CRM para que ningún prospecto se enfríe.',
      modules: [
        { id: 'wa-m1', title: 'Los primeros minutos', lessons: [
          { id: 'wa-1', type: 'texto', title: 'Por qué importa la velocidad', minutes: 5, body: '# El primer mensaje decide\n\nUn prospecto escribe a varios desarrollos a la vez. Quien contesta primero y con claridad suele quedarse con la conversación.\n\n## Metas simples\n- Primera respuesta **en menos de 10 minutos** en horario de atención.\n- Fuera de horario, un mensaje automático que diga cuándo les responderás.\n- Un solo responsable por prospecto, nunca «alguien del equipo».' },
          { id: 'wa-2', type: 'texto', title: 'Plantillas de primera respuesta', minutes: 6, body: '# Mensajes que funcionan\n\n**Primera respuesta**\n> Hola, soy [nombre] de [empresa]. Gracias por escribir. Para ayudarte mejor, ¿buscas comprar, rentar o invertir?\n\n**Si no hay respuesta en 24 h**\n> Hola [nombre], te comparto la ficha que te mencioné. ¿Te late agendar una visita esta semana?\n\n**Fuera de horario**\n> Gracias por escribirnos. Te respondemos mañana a primera hora, desde las 9:00.\n\nAdapta el tono, no el fondo: saluda, sé breve y haz **una** pregunta a la vez.' },
        ] },
        { id: 'wa-m2', title: 'Califica y registra', lessons: [
          { id: 'wa-3', type: 'texto', title: 'Tres preguntas para calificar', minutes: 6, body: '# Califica sin interrogar\n\n1. **Qué busca:** tipo de propiedad y zona.\n2. **Cuándo:** ¿para este año o explorando?\n3. **Cómo lo pagaría:** contado, crédito o aún no sabe.\n\nCon eso decides si el prospecto es **caliente** (cita esta semana), **tibio** (seguimiento en 3 días) o **frío** (información mensual).\n\n- Pregunta con calidez, no como formulario.\n- Si no quiere responder algo, déjalo y sigue.' },
          { id: 'wa-4', type: 'texto', title: 'Registra en el CRM', minutes: 5, body: '# Si no está en el CRM, no existe\n\nDespués de cada conversación relevante:\n\n1. Crea o actualiza el **contacto** con nombre y teléfono.\n2. Anota qué busca, su urgencia y el **siguiente paso con fecha**.\n3. Vincula la **propiedad** de interés.\n4. Marca tu responsabilidad: tú das seguimiento.\n\n**Privacidad:** guarda solo los datos necesarios y no pidas documentos de identidad por chat.' },
          { id: 'wa-5', type: 'video', title: 'Ejemplo de conversación real (video)', minutes: 5, url: '', body: `${VIDEO_NOTE}Sugerencia: simula una conversación completa, de la primera respuesta al registro en el CRM.` },
        ] },
        { id: 'wa-m3', title: 'Evaluación', lessons: [
          { id: 'wa-6', type: 'evaluacion', title: 'Evaluación de WhatsApp', minutes: 4, body: 'Necesitas 80 % o más.', quiz: { minScore: 80, maxAttempts: 3, questions: [
            Q('wa-q1', '¿En cuánto tiempo conviene dar la primera respuesta en horario de atención?', ['En 2 días', 'En menos de 10 minutos', 'Al final del día', 'Cuando haya tiempo'], 1, 'La velocidad suele decidir quién se queda con la conversación.'),
            Q('wa-q2', '¿Cuáles son las tres preguntas para calificar?', ['Nombre, edad y estado civil', 'Qué busca, cuándo y cómo lo pagaría', 'Presupuesto, INE y RFC', 'Color, tamaño y precio'], 1, 'Qué, cuándo y cómo: sin pedir documentos por chat.'),
            VF('wa-q3', 'Es buena práctica pedir la INE del prospecto por WhatsApp en el primer contacto.', false, 'No pidas documentos de identidad por chat.'),
            VF('wa-q4', 'Después de una conversación relevante debes anotar el siguiente paso con fecha en el CRM.', true, 'Sin siguiente paso con fecha, el prospecto se enfría.'),
          ] } },
        ] },
      ],
    },
  ];
}

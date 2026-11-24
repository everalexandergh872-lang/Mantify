/* =========================================================================
   CONFIGURACIÓN POR DEFECTO Y PLANTILLAS (todas editables desde la app)
   Los valores de cantidades y frecuencias son REFERENCIALES. Ajústelos
   según los manuales del fabricante de cada equipo.
   ========================================================================= */
window.EQ = window.EQ || {};

// Punto de plantilla: [codigo, componente, ubicacion, tipoComponente, gramos, frecHoras, frecDias]
function P(c, comp, ubi, tipo, g, h, d) { return { codigo: c, componente: comp, ubicacion: ubi, tipoComponente: tipo, gramos: g, frecHoras: h, frecDias: d }; }

EQ.DEFAULT_CONFIG = {
  id: 'main',
  version: 3,
  moneda: 'S/',
  monedaUSD: 'US$',
  tipoCambio: 3.75,            // S/ por 1 US$ (editable en Configuración → General)
  monedaNeum: 'S/',            // moneda en la que se muestran los costos de neumáticos
  metodoCostoEngrase: 'kg',    // costo oficial de engrase: 'kg' (grasa usada) o 'puntos' (puntos engrasados)
  formato: { empresa: 'SISTEMA INTEGRADO DE GESTIÓN', codigo: 'F-MT-18-TM', version: '01' },
  familias: ['Excavadora', 'Tractor de orugas', 'Retroexcavadora', 'Volquete', 'Cargador frontal', 'Motoniveladora', 'Rodillo', 'Cisterna', 'Tracto camión', 'Zaranda', 'Grúa', 'Camioneta 4x4', 'Minibús', 'Grupo electrógeno', 'Motosoldadora', 'Otros'],
  // ---- Programa de engrase (formato F-MT-18-TM) ----
  tiposEngrase: [
    { codigo: 'EG', nombre: 'ENGRASE GENERAL', horas: 0.5 },
    { codigo: 'EP', nombre: 'ENGRASE PARCIAL', horas: 0.25 }
  ],
  // Plan por familia: secuencia de tipos que se repite cada "intervalo" días (tomado del F-MT-18-TM)
  planesEngrase: {
    'Excavadora': { secuencia: ['EG', 'EP'], intervalo: 3 },
    'Tractor de orugas': { secuencia: ['EG', 'EP'], intervalo: 3 },
    'Cargador frontal': { secuencia: ['EG', 'EP'], intervalo: 3 },
    'Retroexcavadora': { secuencia: ['EG', 'EP'], intervalo: 3 },
    'Motoniveladora': { secuencia: ['EG', 'EP'], intervalo: 3 },
    'Zaranda': { secuencia: ['EG'], intervalo: 3 },
    'Volquete': { secuencia: ['EG', 'EP'], intervalo: 6 },
    'Cisterna': { secuencia: ['EG'], intervalo: 10 },
    'Tracto camión': { secuencia: ['EG'], intervalo: 10 },
    'Rodillo': { secuencia: ['EG', 'EP'], intervalo: 6 },
    'Grúa': { secuencia: ['EG'], intervalo: 7 },
    'Otros': { secuencia: ['EG'], intervalo: 7 }
  },
  familiasSinPrograma: ['Camioneta 4x4', 'Minibús', 'Grupo electrógeno', 'Motosoldadora'],
  estadosMovilizacion: ['MOVILIZADO', 'DESMOVILIZADO', 'PROCESO'],
  // ---- Neumáticos: puntos de medición de remanente (cocada) ----
  medicionesCocada: ['Interior', 'Central', 'Exterior'],
  sistemasLubricacion: ['Manual', 'Centralizado automático', 'Centralizado manual (bloque)', 'Mixto'],
  tiposComponente: ['Pasador', 'Buje', 'Rótula', 'Rodamiento', 'Cruceta / Cardán', 'Tornamesa', 'Cilindro hidráulico', 'Articulación', 'Pivote / King pin', 'Muelle / Ballesta', 'Leva / Ajustador de freno', 'Varillaje', 'Otro'],
  // precioKg = costo por kg de grasa usada · precioPunto = costo por cada punto engrasado
  tiposGrasa: [
    { nombre: 'Grasa EP2 Litio', marca: '', base: 'Litio EP', nlgi: '2', precioKg: 18, precioPunto: 0 },
    { nombre: 'Grasa EP2 Litio complejo + Moly', marca: '', base: 'Complejo de litio + MoS2', nlgi: '2', precioKg: 28, precioPunto: 0 },
    { nombre: 'Grasa EP1 (sistema centralizado)', marca: '', base: 'Litio EP', nlgi: '1', precioKg: 22, precioPunto: 0 },
    { nombre: 'Grasa EP0 (bajas temperaturas)', marca: '', base: 'Litio EP', nlgi: '0', precioKg: 24, precioPunto: 0 },
    { nombre: 'Grasa sulfonato de calcio', marca: '', base: 'Sulfonato de calcio', nlgi: '2', precioKg: 35, precioPunto: 0 },
    { nombre: 'Premalube NCH 1', marca: 'NCH', base: 'Grasa EP extrema presión', nlgi: '1', precioKg: 0, precioPunto: 0 }
  ],
  tecnicos: [],
  // Técnicos del área (Configuración → Técnicos del área). especialidad: Engrase | Neumáticos | Engrase y neumáticos
  tecnicosDet: [],
  codigosEliminados: [],       // equipos eliminados del maestro: no se vuelven a crear al reimportar el Backlog
  responsables: ['Supervisor de mantenimiento', 'Planner de equipos', 'Jefe de taller'],
  ubicaciones: ['Taller principal', 'Tajo', 'Botadero', 'Planta', 'Campamento'],
  marcasNeum: ['Michelin', 'Bridgestone', 'Goodyear', 'Continental', 'Firestone', 'Triangle', 'Otra'],
  medidas: ['295/80R22.5', '315/80R22.5', '11R22.5', '12.00R24', '13.00R24', '14.00R24', '17.5R25', '20.5R25', '23.5R25', '265/70R16', '245/75R16'],
  disenos: ['Direccional', 'Tracción', 'Mixto / Todo posición', 'L3', 'L5', 'E3', 'G2', 'AT', 'MT'],
  tiposNeumatico: [
    { nombre: 'Radial camión (volquete / cisterna)', profNueva: 22, profAlerta: 6, profRetiro: 4, presionRec: 115, tolerancia: 10 },
    { nombre: 'Radial carretera (direccional)', profNueva: 18, profAlerta: 5, profRetiro: 3, presionRec: 110, tolerancia: 10 },
    { nombre: 'OTR cargador / motoniveladora', profNueva: 35, profAlerta: 12, profRetiro: 8, presionRec: 65, tolerancia: 10 },
    { nombre: 'Camioneta AT/MT', profNueva: 12, profAlerta: 4, profRetiro: 2, presionRec: 40, tolerancia: 8 },
    { nombre: 'Minibús', profNueva: 14, profAlerta: 4, profRetiro: 2, presionRec: 85, tolerancia: 10 }
  ],
  estadosNeum: ['Nuevo', 'En servicio', 'En observación', 'En reparación', 'Reencauchado', 'Retirado', 'Baja definitiva'],
  estadosEngrase: ['Ejecutado', 'Parcial', 'No ejecutado', 'Reprogramado'],
  condiciones: ['Sin novedad', 'Desgaste central', 'Desgaste en ambos hombros', 'Desgaste lateral', 'Desgaste diagonal', 'Desgaste irregular', 'Cortes', 'Deformaciones', 'Separación de banda'],
  condicionesCriticas: ['Cortes', 'Deformaciones', 'Separación de banda'],
  umbrales: {
    engraseAmarilloPct: 15,      // % de la frecuencia restante para pasar a amarillo
    engraseAmarilloDias: 2,      // días restantes para pasar a amarillo
    engraseCriticoPct: 25,       // % de sobre-intervalo para alerta CRÍTICA
    parcialActualiza: false,     // si un engrase "Parcial" reinicia el contador
    inspeccionDias: 15,          // días máximos entre inspecciones de neumáticos
    desgasteIrregularMm: 2,      // diferencia mínima (mm) entre zonas para detectar desgaste irregular
    desgasteCriticoPct: 80,      // % de desgaste para considerar crítico
    presionTolPct: 10,           // tolerancia de presión por defecto (±%)
    presionCriticaPct: 20,       // desviación de presión para prioridad ALTA
    minInspecciones: 2,          // mediciones mínimas para proyectar vida útil
    minUsoProyeccion: 50,        // uso mínimo (h o km) para proyectar
    horasDiaDefault: 10,         // uso diario por defecto (horómetro)
    kmDiaDefault: 150,           // uso diario por defecto (kilometraje)
    diasProxReemplazo: 30,       // días para "próximo a reemplazo"
    diasSinEngrase: 4,           // días máximos sin engrase (PRIORID-ENGR)
    alertasPorPunto: false       // alertas por punto de engrase (horas) además del programa
  },
  plantillasEngrase: {
    'Excavadora': [
      P('EX-01', 'Pasador pie de pluma', 'Pluma – base (izq/der)', 'Pasador', 25, 10, 1),
      P('EX-02', 'Cilindro de pluma – base', 'Cilindros pluma (2)', 'Cilindro hidráulico', 20, 10, 1),
      P('EX-03', 'Cilindro de pluma – vástago', 'Cilindros pluma (2)', 'Cilindro hidráulico', 20, 10, 1),
      P('EX-04', 'Pasador pluma – brazo', 'Unión pluma/brazo', 'Pasador', 25, 10, 1),
      P('EX-05', 'Cilindro de brazo – base', 'Brazo', 'Cilindro hidráulico', 20, 10, 1),
      P('EX-06', 'Cilindro de brazo – vástago', 'Brazo', 'Cilindro hidráulico', 20, 10, 1),
      P('EX-07', 'Pasador brazo – cucharón', 'Cucharón', 'Pasador', 30, 10, 1),
      P('EX-08', 'Eslabones / Link en H', 'Cucharón', 'Articulación', 30, 10, 1),
      P('EX-09', 'Cilindro de cucharón – base', 'Cucharón', 'Cilindro hidráulico', 20, 10, 1),
      P('EX-10', 'Cilindro de cucharón – vástago', 'Cucharón', 'Cilindro hidráulico', 20, 10, 1),
      P('EX-11', 'Rodamiento de tornamesa', 'Superestructura', 'Tornamesa', 60, 250, 15),
      P('EX-12', 'Piñón / corona de giro', 'Superestructura', 'Tornamesa', 200, 500, 30),
      P('EX-13', 'Ajustador de oruga', 'Tren de rodaje (izq/der)', 'Otro', 50, 250, 15)
    ],
    'Tractor de orugas': [
      P('TR-01', 'Cilindro levante hoja – base', 'Hoja (izq/der)', 'Cilindro hidráulico', 20, 10, 1),
      P('TR-02', 'Cilindro levante hoja – vástago', 'Hoja (izq/der)', 'Cilindro hidráulico', 20, 10, 1),
      P('TR-03', 'Brazos de empuje – muñón', 'Bastidor de empuje', 'Pasador', 30, 10, 1),
      P('TR-04', 'Cilindro de inclinación', 'Hoja', 'Cilindro hidráulico', 20, 10, 1),
      P('TR-05', 'Tirantes / Brace', 'Hoja', 'Rótula', 20, 10, 1),
      P('TR-06', 'Pasadores ripper', 'Ripper (4)', 'Pasador', 25, 10, 1),
      P('TR-07', 'Cilindros ripper', 'Ripper', 'Cilindro hidráulico', 20, 10, 1),
      P('TR-08', 'Barra ecualizadora – extremos', 'Tren de rodaje', 'Pasador', 40, 250, 15),
      P('TR-09', 'Ajustador de cadena', 'Tren de rodaje', 'Otro', 50, 250, 15)
    ],
    'Retroexcavadora': [
      P('RE-01', 'Pasadores brazos cargador', 'Cargador delantero (4)', 'Pasador', 20, 10, 1),
      P('RE-02', 'Cilindros de levante cargador', 'Cargador delantero (4)', 'Cilindro hidráulico', 15, 10, 1),
      P('RE-03', 'Articulación cucharón delantero', 'Cargador delantero', 'Articulación', 20, 10, 1),
      P('RE-04', 'Pasador pluma retro', 'Retro', 'Pasador', 20, 10, 1),
      P('RE-05', 'Cilindros pluma / brazo retro', 'Retro', 'Cilindro hidráulico', 15, 10, 1),
      P('RE-06', 'Articulación cucharón retro', 'Retro', 'Articulación', 20, 10, 1),
      P('RE-07', 'Pivotes de giro', 'Torre de giro', 'Pivote / King pin', 20, 10, 1),
      P('RE-08', 'Estabilizadores', 'Patas estabilizadoras (4)', 'Pasador', 15, 50, 7),
      P('RE-09', 'Pivote eje delantero', 'Eje delantero', 'Pivote / King pin', 20, 50, 7),
      P('RE-10', 'Crucetas de cardán', 'Transmisión (3)', 'Cruceta / Cardán', 10, 250, 15)
    ],
    'Volquete': [
      P('VO-01', 'Pines de muelle delantero', 'Suspensión del. (4)', 'Muelle / Ballesta', 15, 50, 7),
      P('VO-02', 'Pines de muelle posterior', 'Suspensión post. (4)', 'Muelle / Ballesta', 15, 50, 7),
      P('VO-03', 'King pin / Pivote dirección', 'Eje delantero (izq/der)', 'Pivote / King pin', 20, 50, 7),
      P('VO-04', 'Rótulas barra de dirección', 'Dirección', 'Rótula', 10, 50, 7),
      P('VO-05', 'Crucetas de cardán', 'Transmisión (3)', 'Cruceta / Cardán', 10, 100, 15),
      P('VO-06', 'Pivote de tolva', 'Tolva (izq/der)', 'Pasador', 25, 50, 7),
      P('VO-07', 'Cilindro de levante de tolva', 'Tolva', 'Cilindro hidráulico', 20, 50, 7),
      P('VO-08', 'Levas / ajustadores de freno', 'Ejes (6)', 'Leva / Ajustador de freno', 10, 100, 15)
    ],
    'Cargador frontal': [
      P('CF-01', 'Pasador pie brazo de levante', 'Brazos (izq/der)', 'Pasador', 30, 10, 1),
      P('CF-02', 'Cilindros de levante', 'Brazos (4 puntos)', 'Cilindro hidráulico', 20, 10, 1),
      P('CF-03', 'Cilindro de volteo', 'Cucharón (2 puntos)', 'Cilindro hidráulico', 20, 10, 1),
      P('CF-04', 'Palanca / Bell crank', 'Varillaje Z', 'Articulación', 30, 10, 1),
      P('CF-05', 'Pasadores de cucharón', 'Cucharón (izq/der)', 'Pasador', 30, 10, 1),
      P('CF-06', 'Articulación central', 'Bastidor (sup/inf)', 'Articulación', 40, 50, 7),
      P('CF-07', 'Cilindros de dirección', 'Dirección (4 puntos)', 'Cilindro hidráulico', 15, 50, 7),
      P('CF-08', 'Oscilación eje trasero', 'Eje posterior', 'Buje', 40, 250, 15),
      P('CF-09', 'Crucetas de cardán', 'Transmisión (3)', 'Cruceta / Cardán', 10, 250, 15)
    ],
    'Motoniveladora': [
      P('MN-01', 'Círculo – guías y piñón', 'Círculo', 'Tornamesa', 40, 50, 7),
      P('MN-02', 'Rótula barra de tiro', 'Barra de tiro', 'Rótula', 20, 10, 1),
      P('MN-03', 'Cilindros levante hoja', 'Hoja (izq/der)', 'Cilindro hidráulico', 20, 10, 1),
      P('MN-04', 'Cilindro desplazamiento lateral', 'Hoja', 'Cilindro hidráulico', 15, 10, 1),
      P('MN-05', 'Articulación bastidor', 'Bastidor (sup/inf)', 'Articulación', 30, 50, 7),
      P('MN-06', 'Pivotes de dirección', 'Eje delantero (izq/der)', 'Pivote / King pin', 20, 50, 7),
      P('MN-07', 'Inclinación de ruedas', 'Eje delantero', 'Varillaje', 15, 50, 7),
      P('MN-08', 'Escarificador', 'Escarificador (4)', 'Pasador', 20, 50, 7),
      P('MN-09', 'Crucetas de cardán', 'Transmisión', 'Cruceta / Cardán', 10, 250, 15)
    ],
    'Rodillo': [
      P('RO-01', 'Articulación central', 'Bastidor (sup/inf)', 'Articulación', 30, 50, 7),
      P('RO-02', 'Cilindros de dirección', 'Dirección (2)', 'Cilindro hidráulico', 15, 50, 7),
      P('RO-03', 'Rodamientos del tambor', 'Tambor', 'Rodamiento', 30, 250, 15),
      P('RO-04', 'Crucetas de cardán', 'Transmisión', 'Cruceta / Cardán', 10, 250, 15)
    ],
    'Cisterna': [
      P('CI-01', 'Pines de muelle', 'Suspensión (8)', 'Muelle / Ballesta', 15, 50, 7),
      P('CI-02', 'King pin / Pivote dirección', 'Eje delantero', 'Pivote / King pin', 20, 50, 7),
      P('CI-03', 'Rótulas barra de dirección', 'Dirección', 'Rótula', 10, 50, 7),
      P('CI-04', 'Crucetas de cardán', 'Transmisión', 'Cruceta / Cardán', 10, 100, 15),
      P('CI-05', 'Levas / ajustadores de freno', 'Ejes', 'Leva / Ajustador de freno', 10, 100, 15),
      P('CI-06', 'Rodamientos bomba de agua / riego', 'Sistema de riego', 'Rodamiento', 15, 100, 15)
    ],
    'Tracto camión': [
      P('TC-01', 'Quinta rueda', 'Plato de enganche', 'Otro', 100, 50, 7),
      P('TC-02', 'Pines de muelle', 'Suspensión', 'Muelle / Ballesta', 15, 50, 7),
      P('TC-03', 'King pin / Pivote dirección', 'Eje delantero', 'Pivote / King pin', 20, 50, 7),
      P('TC-04', 'Crucetas de cardán', 'Transmisión', 'Cruceta / Cardán', 10, 100, 15),
      P('TC-05', 'Levas / ajustadores de freno', 'Ejes', 'Leva / Ajustador de freno', 10, 100, 15)
    ],
    'Zaranda': [
      P('ZA-01', 'Rodamientos de cubierta vibratoria', 'Caja vibradora', 'Rodamiento', 40, 10, 1),
      P('ZA-02', 'Rodamientos de fajas / transportadores', 'Fajas', 'Rodamiento', 15, 10, 1),
      P('ZA-03', 'Rodillos / poleas', 'Transportadores', 'Rodamiento', 10, 50, 7),
      P('ZA-04', 'Pivotes de plegado', 'Fajas laterales', 'Pasador', 15, 50, 7)
    ],
    'Grúa': [
      P('GR-01', 'Pivote de pluma', 'Pluma', 'Pasador', 30, 50, 7),
      P('GR-02', 'Cilindro de levante pluma', 'Pluma', 'Cilindro hidráulico', 20, 50, 7),
      P('GR-03', 'Secciones telescópicas – patines', 'Pluma telescópica', 'Otro', 50, 100, 15),
      P('GR-04', 'Rodamiento de giro', 'Superestructura', 'Tornamesa', 60, 100, 15),
      P('GR-05', 'Poleas de cabeza de pluma', 'Cabeza de pluma', 'Rodamiento', 15, 50, 7),
      P('GR-06', 'Estabilizadores', 'Outriggers (4)', 'Pasador', 15, 50, 7),
      P('GR-07', 'Crucetas de cardán', 'Transmisión', 'Cruceta / Cardán', 10, 250, 15)
    ],
    'Camioneta 4x4': [
      P('CA-01', 'Crucetas de cardán', 'Transmisión del./post.', 'Cruceta / Cardán', 8, 250, 30),
      P('CA-02', 'Rótulas de suspensión', 'Suspensión delantera', 'Rótula', 8, 250, 30),
      P('CA-03', 'Terminales de dirección', 'Dirección', 'Rótula', 8, 250, 30)
    ],
    'Minibús': [
      P('MB-01', 'Pines de muelle', 'Suspensión', 'Muelle / Ballesta', 10, 100, 15),
      P('MB-02', 'King pin / Pivote dirección', 'Eje delantero', 'Pivote / King pin', 15, 100, 15),
      P('MB-03', 'Crucetas de cardán', 'Transmisión', 'Cruceta / Cardán', 8, 250, 30),
      P('MB-04', 'Terminales de dirección', 'Dirección', 'Rótula', 8, 100, 15)
    ],
    'Otros': []
  },
  // Plantillas de distribución de neumáticos. tipo: 'simple' (1 por lado) o 'dual' (2 por lado)
  layoutsNeum: {
    'Volquete': { ejes: [{ nombre: 'Eje 1 – Direccional', tipo: 'simple' }, { nombre: 'Eje 2 – Tracción', tipo: 'dual' }, { nombre: 'Eje 3 – Tracción', tipo: 'dual' }], repuestos: 1 },
    'Cisterna': { ejes: [{ nombre: 'Eje 1 – Direccional', tipo: 'simple' }, { nombre: 'Eje 2 – Tracción', tipo: 'dual' }, { nombre: 'Eje 3 – Tracción', tipo: 'dual' }], repuestos: 1 },
    'Camioneta 4x4': { ejes: [{ nombre: 'Eje delantero', tipo: 'simple' }, { nombre: 'Eje posterior', tipo: 'simple' }], repuestos: 1 },
    'Cargador frontal': { ejes: [{ nombre: 'Eje delantero', tipo: 'simple' }, { nombre: 'Eje posterior', tipo: 'simple' }], repuestos: 0 },
    'Motoniveladora': { ejes: [{ nombre: 'Eje delantero', tipo: 'simple' }, { nombre: 'Tándem – eje medio', tipo: 'simple' }, { nombre: 'Tándem – eje posterior', tipo: 'simple' }], repuestos: 0 },
    'Minibús': { ejes: [{ nombre: 'Eje delantero', tipo: 'simple' }, { nombre: 'Eje posterior', tipo: 'dual' }], repuestos: 1 },
    'Retroexcavadora': { ejes: [{ nombre: 'Eje delantero', tipo: 'simple' }, { nombre: 'Eje posterior', tipo: 'simple' }], repuestos: 0 },
    'Rodillo': { ejes: [{ nombre: 'Eje motriz posterior', tipo: 'simple' }], repuestos: 0 },
    'Grúa': { ejes: [{ nombre: 'Eje 1', tipo: 'simple' }, { nombre: 'Eje 2', tipo: 'simple' }], repuestos: 0 },
    'Tracto camión': { ejes: [{ nombre: 'Eje 1 – Direccional', tipo: 'simple' }, { nombre: 'Eje 2 – Tracción', tipo: 'dual' }, { nombre: 'Eje 3 – Tracción', tipo: 'dual' }], repuestos: 1 },
    'Zaranda': { ejes: [], repuestos: 0 },
    'Excavadora': { ejes: [], repuestos: 0 },
    'Tractor de orugas': { ejes: [], repuestos: 0 },
    'Otros': null
  },
  // Plantillas adicionales de distribución seleccionables manualmente
  layoutsExtra: {
    'Volquete 4x2 (6 neumáticos)': { ejes: [{ nombre: 'Eje 1 – Direccional', tipo: 'simple' }, { nombre: 'Eje 2 – Tracción', tipo: 'dual' }], repuestos: 1 },
    'Volquete 6x4 (10 neumáticos)': { ejes: [{ nombre: 'Eje 1 – Direccional', tipo: 'simple' }, { nombre: 'Eje 2 – Tracción', tipo: 'dual' }, { nombre: 'Eje 3 – Tracción', tipo: 'dual' }], repuestos: 1 },
    'Volquete 8x4 (12 neumáticos)': { ejes: [{ nombre: 'Eje 1 – Direccional', tipo: 'simple' }, { nombre: 'Eje 2 – Direccional', tipo: 'simple' }, { nombre: 'Eje 3 – Tracción', tipo: 'dual' }, { nombre: 'Eje 4 – Tracción', tipo: 'dual' }], repuestos: 1 },
    'Camioneta 4x4 (4 + repuesto)': { ejes: [{ nombre: 'Eje delantero', tipo: 'simple' }, { nombre: 'Eje posterior', tipo: 'simple' }], repuestos: 1 },
    'Cisterna 3 ejes (10)': { ejes: [{ nombre: 'Eje 1', tipo: 'simple' }, { nombre: 'Eje 2', tipo: 'dual' }, { nombre: 'Eje 3', tipo: 'dual' }], repuestos: 1 },
    'Cargador frontal (4)': { ejes: [{ nombre: 'Eje delantero', tipo: 'simple' }, { nombre: 'Eje posterior', tipo: 'simple' }], repuestos: 0 },
    'Motoniveladora (6)': { ejes: [{ nombre: 'Eje delantero', tipo: 'simple' }, { nombre: 'Tándem medio', tipo: 'simple' }, { nombre: 'Tándem posterior', tipo: 'simple' }], repuestos: 0 },
    'Minibús (6 + repuesto)': { ejes: [{ nombre: 'Eje delantero', tipo: 'simple' }, { nombre: 'Eje posterior', tipo: 'dual' }], repuestos: 1 },
    'Sin neumáticos (orugas)': { ejes: [], repuestos: 0 }
  },
  mapeoBacklog: null
};

EQ.ESTADOS_INSTALABLES = ['Nuevo', 'Reencauchado', 'Retirado', 'En servicio', 'En observación'];
EQ.FAMILIAS_ORUGA = ['Excavadora', 'Tractor de orugas'];

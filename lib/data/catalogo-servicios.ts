// ============================================================================
// lib/data/catalogo-servicios.ts
// Catálogo completo de servicios IURISLEX
// Fuente: 01_Catalogo_Servicios_IURISLEX.xlsx
// ============================================================================

export interface ServicioCatalogo {
  codigo: string;
  categoria: CategoriaServicio;
  nombre: string;
  descripcion: string;
  precioBase: number;
  unidad: string;
  activo: boolean;
}

export type CategoriaServicio =
  | 'Consultoría'
  | 'Contratos'
  | 'Notarial'
  | 'Litigio Civil'
  | 'Litigio Laboral'
  | 'Litigio Penal'
  | 'Litigio Familia';

export const CATEGORIAS: CategoriaServicio[] = [
  'Consultoría',
  'Contratos',
  'Notarial',
  'Litigio Civil',
  'Litigio Laboral',
  'Litigio Penal',
  'Litigio Familia',
];

export const CATEGORIA_COLORES: Record<CategoriaServicio, string> = {
  'Consultoría': 'bg-violet-50 text-violet-700 border-violet-200',
  'Contratos': 'bg-blue-50 text-blue-700 border-blue-200',
  'Notarial': 'bg-amber-50 text-amber-700 border-amber-200',
  'Litigio Civil': 'bg-rose-50 text-rose-700 border-rose-200',
  'Litigio Laboral': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Litigio Penal': 'bg-red-50 text-red-700 border-red-200',
  'Litigio Familia': 'bg-pink-50 text-pink-700 border-pink-200',
};

export const CATALOGO: ServicioCatalogo[] = [
  // ── Consultoría ──
  { codigo: 'SRV-001', categoria: 'Consultoría', nombre: 'Consulta Jurídica General', descripcion: 'Orientación legal inicial sobre cualquier materia (hasta 1 hora)', precioBase: 500, unidad: 'Por consulta', activo: true },
  { codigo: 'SRV-002', categoria: 'Consultoría', nombre: 'Consulta Jurídica Especializada', descripcion: 'Análisis profundo de caso específico con opinión escrita', precioBase: 1200, unidad: 'Por consulta', activo: true },
  { codigo: 'SRV-003', categoria: 'Consultoría', nombre: 'Asesoría Mensual Empresarial', descripcion: 'Asesoría jurídica continua para empresas (incluye 8 horas)', precioBase: 5000, unidad: 'Mensual', activo: true },
  { codigo: 'SRV-004', categoria: 'Consultoría', nombre: 'Due Diligence Legal', descripcion: 'Revisión integral de situación legal de empresa/negocio', precioBase: 15000, unidad: 'Por proyecto', activo: true },
  { codigo: 'SRV-005', categoria: 'Consultoría', nombre: 'Segunda Opinión Legal', descripcion: 'Revisión y análisis de caso ya asesorado por otro abogado', precioBase: 800, unidad: 'Por caso', activo: true },

  // ── Contratos ──
  { codigo: 'SRV-010', categoria: 'Contratos', nombre: 'Revisión de Contrato Simple', descripcion: 'Análisis y observaciones de contrato existente (hasta 10 páginas)', precioBase: 800, unidad: 'Por documento', activo: true },
  { codigo: 'SRV-011', categoria: 'Contratos', nombre: 'Revisión de Contrato Complejo', descripcion: 'Análisis de contratos complejos (más de 10 páginas)', precioBase: 2000, unidad: 'Por documento', activo: true },
  { codigo: 'SRV-012', categoria: 'Contratos', nombre: 'Elaboración de Contrato Simple', descripcion: 'Redacción de contratos básicos (arrendamiento, servicios)', precioBase: 1500, unidad: 'Por documento', activo: true },
  { codigo: 'SRV-013', categoria: 'Contratos', nombre: 'Elaboración de Contrato Complejo', descripcion: 'Redacción de contratos especializados (joint venture, franquicia)', precioBase: 4500, unidad: 'Por documento', activo: true },
  { codigo: 'SRV-014', categoria: 'Contratos', nombre: 'Autorización de Contrato', descripcion: 'Revisión y firma de autorización notarial', precioBase: 1200, unidad: 'Por documento', activo: true },
  { codigo: 'SRV-015', categoria: 'Contratos', nombre: 'Negociación de Contrato', descripcion: 'Representación en negociación de términos contractuales', precioBase: 3000, unidad: 'Por negociación', activo: true },

  // ── Notarial ──
  { codigo: 'SRV-020', categoria: 'Notarial', nombre: 'Elaboración de Minuta', descripcion: 'Redacción de documento base para escritura pública', precioBase: 1500, unidad: 'Por documento', activo: true },
  { codigo: 'SRV-021', categoria: 'Notarial', nombre: 'Escrituración Simple', descripcion: 'Formalización en escritura pública (compraventa, donación)', precioBase: 2500, unidad: 'Por escritura', activo: true },
  { codigo: 'SRV-022', categoria: 'Notarial', nombre: 'Escrituración Compleja', descripcion: 'Escrituras con múltiples partes o cláusulas especiales', precioBase: 5000, unidad: 'Por escritura', activo: true },
  { codigo: 'SRV-023', categoria: 'Notarial', nombre: 'Testimonio', descripcion: 'Copia certificada de escritura pública', precioBase: 150, unidad: 'Por testimonio', activo: true },
  { codigo: 'SRV-024', categoria: 'Notarial', nombre: 'Acta Notarial', descripcion: 'Levantamiento de acta para hacer constar hechos', precioBase: 800, unidad: 'Por acta', activo: true },
  { codigo: 'SRV-025', categoria: 'Notarial', nombre: 'Autenticación de Firmas', descripcion: 'Legalización de firmas en documentos', precioBase: 200, unidad: 'Por firma', activo: true },
  { codigo: 'SRV-026', categoria: 'Notarial', nombre: 'Protocolización', descripcion: 'Incorporación de documento al protocolo notarial', precioBase: 600, unidad: 'Por documento', activo: true },
  { codigo: 'SRV-027', categoria: 'Notarial', nombre: 'Constitución de Sociedad', descripcion: 'Creación legal de empresa (incluye escritura e inscripciones)', precioBase: 8000, unidad: 'Por sociedad', activo: true },
  { codigo: 'SRV-028', categoria: 'Notarial', nombre: 'Modificación de Estatutos', descripcion: 'Cambios en escritura constitutiva de sociedad', precioBase: 4000, unidad: 'Por modificación', activo: true },
  { codigo: 'SRV-029', categoria: 'Notarial', nombre: 'Testamento', descripcion: 'Elaboración y formalización de testamento', precioBase: 3500, unidad: 'Por documento', activo: true },

  // ── Litigio Civil ──
  { codigo: 'SRV-030', categoria: 'Litigio Civil', nombre: 'Demanda Civil Ordinaria', descripcion: 'Preparación y presentación de demanda en juicio ordinario', precioBase: 8000, unidad: 'Por caso', activo: true },
  { codigo: 'SRV-031', categoria: 'Litigio Civil', nombre: 'Demanda Civil Sumaria', descripcion: 'Preparación y presentación en juicio sumario', precioBase: 5000, unidad: 'Por caso', activo: true },
  { codigo: 'SRV-032', categoria: 'Litigio Civil', nombre: 'Juicio Ejecutivo', descripcion: 'Cobro judicial de deudas con título ejecutivo', precioBase: 6000, unidad: 'Por caso', activo: true },
  { codigo: 'SRV-033', categoria: 'Litigio Civil', nombre: 'Contestación de Demanda', descripcion: 'Defensa ante demanda civil presentada', precioBase: 5000, unidad: 'Por caso', activo: true },
  { codigo: 'SRV-034', categoria: 'Litigio Civil', nombre: 'Recurso de Apelación Civil', descripcion: 'Impugnación de sentencia ante sala de apelaciones', precioBase: 4000, unidad: 'Por recurso', activo: true },
  { codigo: 'SRV-035', categoria: 'Litigio Civil', nombre: 'Recurso de Casación', descripcion: 'Impugnación ante Corte Suprema de Justicia', precioBase: 8000, unidad: 'Por recurso', activo: true },
  { codigo: 'SRV-036', categoria: 'Litigio Civil', nombre: 'Medidas Cautelares', descripcion: 'Solicitud de arraigo, embargo, anotación de demanda', precioBase: 2500, unidad: 'Por medida', activo: true },
  { codigo: 'SRV-037', categoria: 'Litigio Civil', nombre: 'Ejecución de Sentencia', descripcion: 'Cumplimiento forzoso de sentencia favorable', precioBase: 3500, unidad: 'Por ejecución', activo: true },

  // ── Litigio Laboral ──
  { codigo: 'SRV-040', categoria: 'Litigio Laboral', nombre: 'Demanda Laboral', descripcion: 'Representación de trabajador en juicio ordinario laboral', precioBase: 6000, unidad: 'Por caso', activo: true },
  { codigo: 'SRV-041', categoria: 'Litigio Laboral', nombre: 'Defensa Patronal', descripcion: 'Representación de empleador ante demanda laboral', precioBase: 8000, unidad: 'Por caso', activo: true },
  { codigo: 'SRV-042', categoria: 'Litigio Laboral', nombre: 'Reinstalación', descripcion: 'Proceso para reintegro de trabajador despedido', precioBase: 5000, unidad: 'Por caso', activo: true },
  { codigo: 'SRV-043', categoria: 'Litigio Laboral', nombre: 'Cálculo de Prestaciones', descripcion: 'Liquidación detallada de derechos laborales', precioBase: 1500, unidad: 'Por cálculo', activo: true },
  { codigo: 'SRV-044', categoria: 'Litigio Laboral', nombre: 'Conflicto Colectivo', descripcion: 'Representación en conflictos sindicales/colectivos', precioBase: 15000, unidad: 'Por caso', activo: true },
  { codigo: 'SRV-045', categoria: 'Litigio Laboral', nombre: 'Audiencia Laboral', descripcion: 'Asistencia y representación por audiencia', precioBase: 2000, unidad: 'Por audiencia', activo: true },

  // ── Litigio Penal ──
  { codigo: 'SRV-050', categoria: 'Litigio Penal', nombre: 'Defensa Penal - Delitos Menores', descripcion: 'Representación en delitos con pena menor a 5 años', precioBase: 10000, unidad: 'Por caso', activo: true },
  { codigo: 'SRV-051', categoria: 'Litigio Penal', nombre: 'Defensa Penal - Delitos Graves', descripcion: 'Representación en delitos con pena mayor a 5 años', precioBase: 25000, unidad: 'Por caso', activo: true },
  { codigo: 'SRV-052', categoria: 'Litigio Penal', nombre: 'Querella', descripcion: 'Presentación de acusación particular', precioBase: 8000, unidad: 'Por caso', activo: true },
  { codigo: 'SRV-053', categoria: 'Litigio Penal', nombre: 'Criterio de Oportunidad', descripcion: 'Gestión de salida alternativa al proceso penal', precioBase: 5000, unidad: 'Por gestión', activo: true },
  { codigo: 'SRV-054', categoria: 'Litigio Penal', nombre: 'Suspensión Condicional', descripcion: 'Solicitud de suspensión de la persecución penal', precioBase: 4000, unidad: 'Por solicitud', activo: true },
  { codigo: 'SRV-055', categoria: 'Litigio Penal', nombre: 'Medida Sustitutiva', descripcion: 'Solicitud de medida alternativa a prisión preventiva', precioBase: 3000, unidad: 'Por solicitud', activo: true },
  { codigo: 'SRV-056', categoria: 'Litigio Penal', nombre: 'Audiencia Penal', descripcion: 'Asistencia por audiencia en proceso penal', precioBase: 2500, unidad: 'Por audiencia', activo: true },
  { codigo: 'SRV-057', categoria: 'Litigio Penal', nombre: 'Revisión de Expediente Penal', descripcion: 'Análisis completo de caso penal', precioBase: 2000, unidad: 'Por revisión', activo: true },

  // ── Litigio Familia ──
  { codigo: 'SRV-060', categoria: 'Litigio Familia', nombre: 'Divorcio Voluntario', descripcion: 'Disolución de matrimonio por mutuo acuerdo', precioBase: 5000, unidad: 'Por caso', activo: true },
  { codigo: 'SRV-061', categoria: 'Litigio Familia', nombre: 'Divorcio Contencioso', descripcion: 'Disolución de matrimonio por causa legal', precioBase: 10000, unidad: 'Por caso', activo: true },
  { codigo: 'SRV-062', categoria: 'Litigio Familia', nombre: 'Pensión Alimenticia', descripcion: 'Demanda o defensa en juicio de alimentos', precioBase: 4000, unidad: 'Por caso', activo: true },
  { codigo: 'SRV-063', categoria: 'Litigio Familia', nombre: 'Guarda y Custodia', descripcion: 'Proceso para definir custodia de menores', precioBase: 6000, unidad: 'Por caso', activo: true },
  { codigo: 'SRV-064', categoria: 'Litigio Familia', nombre: 'Reconocimiento de Paternidad', descripcion: 'Proceso para establecer filiación', precioBase: 5000, unidad: 'Por caso', activo: true },
  { codigo: 'SRV-065', categoria: 'Litigio Familia', nombre: 'Violencia Intrafamiliar', descripcion: 'Medidas de protección y acompañamiento', precioBase: 4000, unidad: 'Por caso', activo: true },
];

/**
 * Busca servicios en el catálogo por texto.
 */
export function buscarServicios(query: string, categoria?: CategoriaServicio): ServicioCatalogo[] {
  let lista = CATALOGO.filter(s => s.activo);
  if (categoria) lista = lista.filter(s => s.categoria === categoria);
  if (query) {
    const q = query.toLowerCase();
    lista = lista.filter(s =>
      s.nombre.toLowerCase().includes(q) ||
      s.descripcion.toLowerCase().includes(q) ||
      s.codigo.toLowerCase().includes(q)
    );
  }
  return lista;
}

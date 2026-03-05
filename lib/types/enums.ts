// ============================================================================
// lib/types/enums.ts
// Mapeo 1:1 con los ENUMs de PostgreSQL en schema legal
// ============================================================================

// --- Base ---

export enum TipoPersona {
  PERSONA = 'persona',
  EMPRESA = 'empresa',
}

export enum EstadoCliente {
  ACTIVO = 'activo',
  INACTIVO = 'inactivo',
  PROSPECTO = 'prospecto',
}

export enum EstadoExpediente {
  ACTIVO = 'activo',
  SUSPENDIDO = 'suspendido',
  ARCHIVADO = 'archivado',
  FINALIZADO = 'finalizado',
}

// --- Contabilidad ---

export enum EstadoCotizacion {
  BORRADOR = 'borrador',
  ENVIADA = 'enviada',
  ACEPTADA = 'aceptada',
  RECHAZADA = 'rechazada',
  VENCIDA = 'vencida',
}

export enum EstadoFactura {
  PENDIENTE = 'pendiente',
  PAGADA = 'pagada',
  PARCIAL = 'parcial',
  ANULADA = 'anulada',
  VENCIDA = 'vencida',
}

export enum EstadoPago {
  REGISTRADO = 'registrado',
  CONFIRMADO = 'confirmado',
  RECHAZADO = 'rechazado',
}

export enum TipoPago {
  ANTICIPO = 'anticipo',
  PARCIAL = 'parcial',
  TOTAL = 'total',
  CONSULTA_EXTRA = 'consulta_extra',
}

// --- Notariado ---

export enum TipoInstrumento {
  COMPRAVENTA = 'compraventa',
  MANDATO = 'mandato',
  SOCIEDAD_ANONIMA = 'sociedad_anonima',
  SOCIEDAD_LIMITADA = 'sociedad_limitada',
  DONACION = 'donacion',
  MUTUO = 'mutuo',
  ARRENDAMIENTO = 'arrendamiento',
  PODER = 'poder',
  TESTAMENTO = 'testamento',
  CAPITULACIONES = 'capitulaciones',
  PROTOCOLIZACION = 'protocolizacion',
  AMPLIACION = 'ampliacion',
  MODIFICACION_ESTATUTOS = 'modificacion_estatutos',
  DISOLUCION = 'disolucion',
  LIQUIDACION = 'liquidacion',
  FUSION = 'fusion',
  OTRO = 'otro',
}

export enum EstadoEscritura {
  BORRADOR = 'borrador',
  AUTORIZADA = 'autorizada',
  ESCANEADA = 'escaneada',
  CON_TESTIMONIO = 'con_testimonio',
  CANCELADA = 'cancelada',
}

export enum TipoTestimonio {
  PRIMER_TESTIMONIO = 'primer_testimonio',
  TESTIMONIO_ESPECIAL = 'testimonio_especial',
  DUPLICADO = 'duplicado',
  SEGUNDO_TESTIMONIO = 'segundo_testimonio',
}

export enum EstadoTestimonio {
  BORRADOR = 'borrador',
  GENERADO = 'generado',
  FIRMADO = 'firmado',
  ENTREGADO = 'entregado',
}

export enum EstadoAviso {
  BORRADOR = 'borrador',
  GENERADO = 'generado',
  ENVIADO = 'enviado',
  CONFIRMADO = 'confirmado',
}

export enum TipoActa {
  NOTIFICACION = 'notificacion',
  REQUERIMIENTO = 'requerimiento',
  PROTESTO = 'protesto',
  PRESENCIA = 'presencia',
  SOBREVIVENCIA = 'sobrevivencia',
  MATRIMONIO = 'matrimonio',
  UNION_DE_HECHO = 'union_de_hecho',
  OTRO = 'otro',
}

// --- Labels para UI (español) ---

export const TIPO_INSTRUMENTO_LABEL: Record<TipoInstrumento, string> = {
  [TipoInstrumento.COMPRAVENTA]: 'Compraventa',
  [TipoInstrumento.MANDATO]: 'Mandato',
  [TipoInstrumento.SOCIEDAD_ANONIMA]: 'Sociedad Anónima',
  [TipoInstrumento.SOCIEDAD_LIMITADA]: 'Sociedad Limitada',
  [TipoInstrumento.DONACION]: 'Donación',
  [TipoInstrumento.MUTUO]: 'Mutuo',
  [TipoInstrumento.ARRENDAMIENTO]: 'Arrendamiento',
  [TipoInstrumento.PODER]: 'Poder',
  [TipoInstrumento.TESTAMENTO]: 'Testamento',
  [TipoInstrumento.CAPITULACIONES]: 'Capitulaciones Matrimoniales',
  [TipoInstrumento.PROTOCOLIZACION]: 'Protocolización',
  [TipoInstrumento.AMPLIACION]: 'Ampliación',
  [TipoInstrumento.MODIFICACION_ESTATUTOS]: 'Modificación de Estatutos',
  [TipoInstrumento.DISOLUCION]: 'Disolución',
  [TipoInstrumento.LIQUIDACION]: 'Liquidación',
  [TipoInstrumento.FUSION]: 'Fusión',
  [TipoInstrumento.OTRO]: 'Otro',
};

export const ESTADO_ESCRITURA_LABEL: Record<EstadoEscritura, string> = {
  [EstadoEscritura.BORRADOR]: 'Borrador',
  [EstadoEscritura.AUTORIZADA]: 'Autorizada',
  [EstadoEscritura.ESCANEADA]: 'Escaneada',
  [EstadoEscritura.CON_TESTIMONIO]: 'Con Testimonio',
  [EstadoEscritura.CANCELADA]: 'Cancelada',
};

export const ESTADO_COTIZACION_LABEL: Record<EstadoCotizacion, string> = {
  [EstadoCotizacion.BORRADOR]: 'Borrador',
  [EstadoCotizacion.ENVIADA]: 'Enviada',
  [EstadoCotizacion.ACEPTADA]: 'Aceptada',
  [EstadoCotizacion.RECHAZADA]: 'Rechazada',
  [EstadoCotizacion.VENCIDA]: 'Vencida',
};

export const ESTADO_FACTURA_LABEL: Record<EstadoFactura, string> = {
  [EstadoFactura.PENDIENTE]: 'Pendiente',
  [EstadoFactura.PAGADA]: 'Pagada',
  [EstadoFactura.PARCIAL]: 'Pago Parcial',
  [EstadoFactura.ANULADA]: 'Anulada',
  [EstadoFactura.VENCIDA]: 'Vencida',
};

export const ESTADO_TESTIMONIO_LABEL: Record<EstadoTestimonio, string> = {
  [EstadoTestimonio.BORRADOR]: 'Borrador',
  [EstadoTestimonio.GENERADO]: 'Generado',
  [EstadoTestimonio.FIRMADO]: 'Firmado',
  [EstadoTestimonio.ENTREGADO]: 'Entregado',
};

export const TIPO_ACTA_LABEL: Record<TipoActa, string> = {
  [TipoActa.NOTIFICACION]: 'Notificación',
  [TipoActa.REQUERIMIENTO]: 'Requerimiento',
  [TipoActa.PROTESTO]: 'Protesto',
  [TipoActa.PRESENCIA]: 'Presencia',
  [TipoActa.SOBREVIVENCIA]: 'Sobrevivencia',
  [TipoActa.MATRIMONIO]: 'Matrimonio',
  [TipoActa.UNION_DE_HECHO]: 'Unión de Hecho',
  [TipoActa.OTRO]: 'Otro',
};

// --- Colores para badges en UI ---

export const ESTADO_ESCRITURA_COLOR: Record<EstadoEscritura, string> = {
  [EstadoEscritura.BORRADOR]: 'bg-gray-100 text-gray-700',
  [EstadoEscritura.AUTORIZADA]: 'bg-blue-100 text-blue-700',
  [EstadoEscritura.ESCANEADA]: 'bg-cyan-100 text-cyan-700',
  [EstadoEscritura.CON_TESTIMONIO]: 'bg-green-100 text-green-700',
  [EstadoEscritura.CANCELADA]: 'bg-red-100 text-red-700',
};

export const ESTADO_COTIZACION_COLOR: Record<EstadoCotizacion, string> = {
  [EstadoCotizacion.BORRADOR]: 'bg-gray-100 text-gray-700',
  [EstadoCotizacion.ENVIADA]: 'bg-blue-100 text-blue-700',
  [EstadoCotizacion.ACEPTADA]: 'bg-green-100 text-green-700',
  [EstadoCotizacion.RECHAZADA]: 'bg-red-100 text-red-700',
  [EstadoCotizacion.VENCIDA]: 'bg-amber-100 text-amber-700',
};

export const ESTADO_FACTURA_COLOR: Record<EstadoFactura, string> = {
  [EstadoFactura.PENDIENTE]: 'bg-amber-100 text-amber-700',
  [EstadoFactura.PAGADA]: 'bg-green-100 text-green-700',
  [EstadoFactura.PARCIAL]: 'bg-blue-100 text-blue-700',
  [EstadoFactura.ANULADA]: 'bg-red-100 text-red-700',
  [EstadoFactura.VENCIDA]: 'bg-red-100 text-red-700',
};

export const ESTADO_TESTIMONIO_COLOR: Record<EstadoTestimonio, string> = {
  [EstadoTestimonio.BORRADOR]: 'bg-gray-100 text-gray-700',
  [EstadoTestimonio.GENERADO]: 'bg-blue-100 text-blue-700',
  [EstadoTestimonio.FIRMADO]: 'bg-cyan-100 text-cyan-700',
  [EstadoTestimonio.ENTREGADO]: 'bg-green-100 text-green-700',
};

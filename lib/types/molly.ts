// ============================================================================
// lib/types/molly.ts
// Tipos para Molly Mail — asistente de email con IA
// ============================================================================

// ── Enums / Union types ────────────────────────────────────────────────────

export type EmailClasificacion =
  | 'legal'
  | 'administrativo'
  | 'financiero'
  | 'spam'
  | 'personal'
  | 'urgente'
  | 'pendiente';

export type ThreadStatus = 'abierto' | 'en_proceso' | 'cerrado' | 'archivado';

export type DraftStatus = 'pendiente' | 'aprobado' | 'enviado' | 'rechazado' | 'editado';

export type ContactTipo =
  | 'cliente'
  | 'contraparte'
  | 'juzgado'
  | 'notaria'
  | 'gobierno'
  | 'proveedor'
  | 'interno'
  | 'desconocido';

export type EmailDirection = 'inbound' | 'outbound';

export type ApprovedVia = 'telegram' | 'dashboard' | 'api';

// ── Database interfaces ────────────────────────────────────────────────────

export interface EmailContact {
  id: string;
  email: string;
  nombre: string | null;
  cliente_id: string | null;
  tipo: ContactTipo;
  notas: string | null;
  created_at: string;
  updated_at: string;
}

export interface EmailThread {
  id: string;
  subject: string;
  conversation_id: string | null;
  account: string;
  clasificacion: EmailClasificacion;
  urgencia: number;
  cliente_id: string | null;
  status: ThreadStatus;
  last_message_at: string;
  message_count: number;
  created_at: string;
  updated_at: string;
}

export interface EmailMessage {
  id: string;
  thread_id: string;
  microsoft_id: string;
  from_email: string;
  from_name: string | null;
  to_emails: string[];
  cc_emails: string[];
  subject: string;
  body_text: string | null;
  body_html: string | null;
  direction: EmailDirection;
  clasificacion: string | null;
  confidence_score: number | null;
  resumen: string | null;
  attachments: AttachmentMeta[];
  received_at: string;
  created_at: string;
}

export interface EmailDraft {
  id: string;
  thread_id: string;
  message_id: string | null;
  to_email: string;
  subject: string;
  body_text: string;
  body_html: string | null;
  tone: string | null;
  status: DraftStatus;
  approved_via: ApprovedVia | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CalendarEventLog {
  id: string;
  microsoft_event_id: string | null;
  title: string;
  start_at: string;
  end_at: string;
  related_thread_id: string | null;
  notas: string | null;
  created_at: string;
}

export interface TelegramCommand {
  id: string;
  chat_id: string;
  command: string;
  payload: Record<string, unknown>;
  response: string | null;
  created_at: string;
}

// ── Attachment metadata (stored in JSONB) ──────────────────────────────────

export interface AttachmentMeta {
  name: string;
  contentType: string;
  size: number;
}

// ── AI result types ────────────────────────────────────────────────────────

export interface MollyClassification {
  tipo: EmailClasificacion;
  urgencia: number;
  resumen: string;
  cliente_probable: string | null;
  requiere_respuesta: boolean;
  confianza: number;
  // Scheduling intent detection
  scheduling_intent: boolean;
  suggested_date: string | null;   // YYYY-MM-DD or null
  suggested_time: string | null;   // HH:mm or null
  event_type: 'consulta_nueva' | 'seguimiento' | null;
}

export type SchedulingIntentStatus = 'pendiente' | 'agendada' | 'ignorada';

export interface EmailSchedulingIntent {
  id: string;
  thread_id: string;
  message_id: string;
  from_email: string;
  event_type: 'consulta_nueva' | 'seguimiento';
  suggested_date: string;          // YYYY-MM-DD
  suggested_time: string | null;   // HH:mm or null
  available_slots: unknown;        // JSONB array of FreeSlot
  status: SchedulingIntentStatus;
  created_at: string;
}

export interface MollyDraftResult {
  subject: string;
  body_text: string;
  body_html: string;
  tone: string;
}

// ── Microsoft Graph types ──────────────────────────────────────────────────

export interface GraphMailMessage {
  id: string;
  conversationId: string | null;
  subject: string;
  bodyPreview: string;
  body: {
    contentType: string;
    content: string;
  };
  from: {
    emailAddress: {
      name: string;
      address: string;
    };
  };
  toRecipients: Array<{
    emailAddress: {
      name: string;
      address: string;
    };
  }>;
  ccRecipients: Array<{
    emailAddress: {
      name: string;
      address: string;
    };
  }>;
  receivedDateTime: string;
  hasAttachments: boolean;
  attachments?: Array<{
    name: string;
    contentType: string;
    size: number;
  }>;
}

-- ============================================================================
-- Migración: outlook_event_id en legal.audiencias
--
-- Espeja la audiencia al calendario de Outlook de Amanda (evento INTERNO, solo
-- visible para ella, sin invitar al cliente). Guarda el id del evento de Graph
-- para que al editar se ACTUALICE y al borrar/cancelar se ELIMINE el mismo
-- evento, sin duplicar — mismo patrón que legal.citas.outlook_event_id y
-- legal.llamadas_programadas.outlook_event_id.
--
-- NULL = la audiencia aún no está en el Outlook de Amanda. Eso da idempotencia:
-- el botón "Sincronizar" crea solo si es NULL.
--
-- Aditiva y reversible: solo agrega una columna nullable. NO toca legal.citas ni
-- el pipeline de recordatorios (.ics al cliente).
-- ============================================================================

ALTER TABLE legal.audiencias ADD COLUMN IF NOT EXISTS outlook_event_id TEXT;
COMMENT ON COLUMN legal.audiencias.outlook_event_id IS 'ID del evento en el calendario de Outlook de Amanda (evento interno, sin attendees). Permite actualizar/eliminar el mismo evento al editar/cancelar sin duplicar. NULL = aún no sincronizada.';

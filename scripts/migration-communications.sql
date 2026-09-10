-- ============================================================
-- Migration: communications channel + contact_id nullable
-- ============================================================
-- - Erweitert channel-Enum um 'online_meeting' und 'note'
-- - Macht contact_id optional (Notizen brauchen nicht zwingend Kontakt)
-- ============================================================

alter table communications drop constraint if exists communications_channel_check;
alter table communications
  add constraint communications_channel_check
  check (channel in ('email', 'phone', 'letter', 'meeting', 'online_meeting', 'portal', 'note'));

alter table communications alter column contact_id drop not null;

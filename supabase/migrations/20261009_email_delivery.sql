-- Run this in Supabase SQL Editor. Safe to run once after the base schema exists.
alter table public.celik_minda_orders
  add column if not exists delivery_email_status text not null default 'pending',
  add column if not exists delivery_email_sent_at timestamptz;

alter table public.celik_minda_orders
  drop constraint if exists celik_minda_orders_delivery_email_status_check;
alter table public.celik_minda_orders
  add constraint celik_minda_orders_delivery_email_status_check
  check (delivery_email_status in ('pending', 'sending', 'sent', 'failed', 'not_required'));

-- PDF delivery uses the configured Google Drive folder links in lib/email-delivery.ts.

-- ============================================================================
-- AI Belassistent — Supabase schema (profielen voor identiteitsverificatie)
-- Voer dit uit in de Supabase SQL-editor. Row-Level Security is VERPLICHT en staat
-- hieronder aan: elke gebruiker kan UITSLUITEND zijn eigen profiel lezen/schrijven.
-- ============================================================================

-- pgcrypto is beschikbaar voor optionele veld-versleuteling. In deze baseline
-- vertrouwen we op RLS + HTTPS + Supabase at-rest-encryptie + geen client-side
-- blootstelling van andermans data. Wil je kolom-encryptie, gebruik dan pgp_sym_encrypt
-- met een server-side sleutel (let op: de client leest dan ciphertext).
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  user_id       uuid primary key references auth.users (id) on delete cascade,
  first_name    text,
  last_name     text,
  postcode      text,
  house_number  text,
  birth_date    date,
  -- Optioneel: klantnummers per bedrijf, als de gebruiker die wil opslaan.
  customer_numbers text,
  is_premium    boolean not null default false,
  -- AVG: tijdstip waarop toestemming is gegeven vóór opslag.
  consent_at    timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- NOOIT opslaan: BSN, bankrekening/creditcard, kopie ID. Daar zijn bewust geen kolommen.

comment on table public.profiles is
  'Verificatieprofiel per gebruiker. Bevat GEEN BSN/bank/ID. Beschermd door RLS.';

-- ---------------------------------------------------------------------------
-- Row-Level Security: alleen eigen rij (user_id = auth.uid())
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
drop policy if exists "profiles_delete_own" on public.profiles;

create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = user_id);

create policy "profiles_insert_own"
  on public.profiles for insert
  with check (auth.uid() = user_id);

create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "profiles_delete_own"
  on public.profiles for delete
  using (auth.uid() = user_id);

-- updated_at automatisch bijwerken
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

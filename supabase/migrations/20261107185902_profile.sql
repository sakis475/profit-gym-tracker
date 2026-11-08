-- What the daily nutrition targets are calculated from. One row per user. Body weight is not
-- stored here, it is the latest weigh-in in body_weight.
create table public.profile (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  -- A birth date rather than an age, so the age stays right as time passes
  "birthDate" date,
  sex text check (sex in ('male', 'female')),
  "heightCm" double precision check ("heightCm" > 0),
  "activityLevel" text check ("activityLevel" in ('sedentary', 'light', 'moderate', 'active', 'very_active')),
  goal text check (goal in ('lose', 'lose_slow', 'maintain', 'gain_slow')),
  "updatedAt" timestamptz not null default now()
);

-- Row level security: the same select / insert / update policies as the other tables
alter table public.profile enable row level security;
grant select, insert, update on public.profile to authenticated;

create policy "Authenticated users select own profile rows" on public.profile
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Authenticated users insert own profile rows" on public.profile
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Authenticated users update own profile rows" on public.profile
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Dishes: a named group of foods inside a meal, like an omelette of eggs, egg white and feta.
-- A dish is not a recipe that is shared. Each one lives in a single place, either a day of the
-- plan ("day") or a date of the log ("date"), so changing one never changes another. Reusing a
-- dish copies its foods into a new one.
create table public.dishes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  "mealId" uuid not null references public.meals (id),
  day smallint check (day between 0 and 6),
  date date,
  "order" smallint,
  "createdAt" timestamptz not null default now(),
  "disabledAt" timestamptz,
  constraint dishes_day_or_date check ((day is null) <> (date is null))
);
create index dishes_user_id_day_idx on public.dishes (user_id, day);
create index dishes_user_id_date_idx on public.dishes (user_id, date);
create index "dishes_mealId_idx" on public.dishes ("mealId");

-- The dish a planned food belongs to, null for a food on its own
alter table public.meal_plan add column "dishId" uuid references public.dishes (id);
create index "meal_plan_dishId_idx" on public.meal_plan ("dishId");

-- The dish a logged food was eaten in: the planned dish it was ticked from, or a dish added to
-- that date. Null for a food on its own.
alter table public.food_log add column "dishId" uuid references public.dishes (id);
create index "food_log_dishId_idx" on public.food_log ("dishId");

-- Row level security: the same select / insert / update policies as the other nutrition tables
alter table public.dishes enable row level security;
grant select, insert, update on public.dishes to authenticated;

create policy "Authenticated users select own dishes rows" on public.dishes
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Authenticated users insert own dishes rows" on public.dishes
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Authenticated users update own dishes rows" on public.dishes
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

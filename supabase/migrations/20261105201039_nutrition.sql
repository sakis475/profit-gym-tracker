-- Nutrition: foods, meal slots, a weekly meal plan, daily goals, a log of what was eaten,
-- and weekly body weight. Like the workout tables, rows are soft deleted through "disabledAt"
-- and every user only reaches their own rows.

-- Nutrition values are per 100 of the unit for 'g' and 'ml', per 1 for 'piece' and 'scoop'
create table public.foods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  unit text not null default 'g' check (unit in ('g', 'ml', 'piece', 'scoop')),
  kcal double precision not null default 0 check (kcal >= 0),
  protein double precision not null default 0 check (protein >= 0),
  carbs double precision not null default 0 check (carbs >= 0),
  fat double precision not null default 0 check (fat >= 0),
  fiber double precision not null default 0 check (fiber >= 0),
  notes text,
  "createdAt" timestamptz not null default now(),
  "disabledAt" timestamptz
);
create index foods_user_id_idx on public.foods (user_id);

-- The meals of a day (breakfast, lunch, ...) in the order they are eaten
create table public.meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  "order" smallint,
  "createdAt" timestamptz not null default now(),
  "disabledAt" timestamptz
);
create index meals_user_id_idx on public.meals (user_id);

-- What to eat: day of the week 0 (Sunday) to 6 (Saturday) like scheduler.day, so Date.getDay()
create table public.meal_plan (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day smallint not null check (day between 0 and 6),
  "mealId" uuid not null references public.meals (id),
  "foodId" uuid not null references public.foods (id),
  quantity double precision not null check (quantity > 0),
  "order" smallint,
  "createdAt" timestamptz not null default now(),
  "disabledAt" timestamptz
);
create index meal_plan_user_id_day_idx on public.meal_plan (user_id, day);
create index "meal_plan_mealId_idx" on public.meal_plan ("mealId");
create index "meal_plan_foodId_idx" on public.meal_plan ("foodId");

-- One row per user; a null goal means no goal for that value
create table public.nutrition_goals (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  kcal double precision check (kcal >= 0),
  protein double precision check (protein >= 0),
  carbs double precision check (carbs >= 0),
  fat double precision check (fat >= 0),
  fiber double precision check (fiber >= 0),
  "updatedAt" timestamptz not null default now()
);

-- What was eaten. The nutrition values are the totals for the quantity, copied from the food
-- when logged, so changing a food later does not rewrite past days. "planId" is the plan entry
-- it was logged from, null for something eaten off plan.
create table public.food_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date date not null,
  "mealId" uuid not null references public.meals (id),
  "foodId" uuid not null references public.foods (id),
  "planId" uuid references public.meal_plan (id),
  quantity double precision not null check (quantity > 0),
  kcal double precision not null default 0,
  protein double precision not null default 0,
  carbs double precision not null default 0,
  fat double precision not null default 0,
  fiber double precision not null default 0,
  "createdAt" timestamptz not null default now(),
  "disabledAt" timestamptz
);
create index food_log_user_id_date_idx on public.food_log (user_id, date);
create index "food_log_mealId_idx" on public.food_log ("mealId");
create index "food_log_foodId_idx" on public.food_log ("foodId");
create index "food_log_planId_idx" on public.food_log ("planId");

-- Weekly weigh-ins, dated on the Monday of their week. One per date.
create table public.body_weight (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date date not null,
  kg double precision not null check (kg > 0),
  notes text,
  "createdAt" timestamptz not null default now(),
  "disabledAt" timestamptz
);
create unique index body_weight_user_id_date_key on public.body_weight (user_id, date) where "disabledAt" is null;

-- Row level security: the same select / insert / update policies as the workout tables.
-- There is no delete policy, rows are disabled instead.
do $$
declare
  t text;
begin
  foreach t in array array['foods', 'meals', 'meal_plan', 'nutrition_goals', 'food_log', 'body_weight'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('grant select, insert, update on public.%I to authenticated', t);
    execute format(
      'create policy "Authenticated users select own %1$s rows" on public.%1$I for select to authenticated using ((select auth.uid()) = user_id)',
      t
    );
    execute format(
      'create policy "Authenticated users insert own %1$s rows" on public.%1$I for insert to authenticated with check ((select auth.uid()) = user_id)',
      t
    );
    execute format(
      'create policy "Authenticated users update own %1$s rows" on public.%1$I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)',
      t
    );
  end loop;
end
$$;

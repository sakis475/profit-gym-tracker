-- What goes in a food, like eggs, egg white and feta in an omelette. A food added to the plan or
-- the log starts with a copy of these (see meal_plan / food_log "parentId"), so each planned or
-- logged one can then change on its own. One level only: a food with contents does not go in
-- another, and a food that goes in another has no contents.
create table public.food_contents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- The food it goes in
  "foodId" uuid not null references public.foods (id),
  -- The food that goes in, and how much of it
  "contentId" uuid not null references public.foods (id),
  quantity double precision not null check (quantity > 0),
  "order" smallint,
  "createdAt" timestamptz not null default now(),
  "disabledAt" timestamptz,
  constraint food_contents_not_itself check ("foodId" <> "contentId")
);
create index food_contents_user_id_idx on public.food_contents (user_id);
create index "food_contents_foodId_idx" on public.food_contents ("foodId");
create index "food_contents_contentId_idx" on public.food_contents ("contentId");

-- Row level security: the same select / insert / update policies as the other nutrition tables
alter table public.food_contents enable row level security;
grant select, insert, update on public.food_contents to authenticated;

create policy "Authenticated users select own food_contents rows" on public.food_contents
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Authenticated users insert own food_contents rows" on public.food_contents
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Authenticated users update own food_contents rows" on public.food_contents
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

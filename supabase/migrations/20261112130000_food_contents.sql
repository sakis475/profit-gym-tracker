-- Foods inside foods: an omelette is a food (with no values of its own, or some) that eggs, egg
-- white and feta are put in. What is put in belongs to that one planned or logged food alone, so
-- Tuesday's omelette can leave out the feta without changing Monday's or any eaten before.
-- "parentId" is the planned / logged food a row was put in, null for one on its own. One level
-- only: a food put in another has nothing put in it.

alter table public.meal_plan add column "parentId" uuid references public.meal_plan (id);
create index "meal_plan_parentId_idx" on public.meal_plan ("parentId");

alter table public.food_log add column "parentId" uuid references public.food_log (id);
create index "food_log_parentId_idx" on public.food_log ("parentId");

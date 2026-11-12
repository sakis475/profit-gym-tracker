-- Dishes were replaced by foods put in other foods (see "parentId"), so they go
alter table public.meal_plan drop column "dishId";
alter table public.food_log drop column "dishId";
drop table public.dishes;

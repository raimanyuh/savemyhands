-- Stud antes and split pots can produce fractional net results. Preserve
-- those amounts instead of rejecting them or rounding to whole chips.
-- Existing integer values, defaults, ownership policies and indexes remain.
alter table public.hands
  alter column result type numeric using result::numeric;

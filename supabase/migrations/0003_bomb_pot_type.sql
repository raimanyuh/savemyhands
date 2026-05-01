-- Add 'BP' (bomb pot) to the allowed pot_type values. The recorder
-- classifies bomb-pot hands as BP at save time so they're filterable
-- and labelable distinctly from limped pots — the original constraint
-- in 0001_hands.sql predated the bomb-pot variant, so saving a hand
-- with state.bombPotOn=true triggered a `hands_pot_type_check`
-- violation and the request 500'd.
alter table public.hands drop constraint hands_pot_type_check;
alter table public.hands add constraint hands_pot_type_check
  check (pot_type in ('BP','LP','SRP','3BP','4BP','5BP'));

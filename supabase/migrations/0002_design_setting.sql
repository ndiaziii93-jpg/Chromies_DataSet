-- Adds the design switch to team_settings.
--
-- Safe to run against a project that already has 0001_init.sql applied, and
-- safe to run twice. 0001 carries the same change for a fresh project, so a
-- new project needs only that one.

alter table team_settings
  add column if not exists design text not null default 'diamond';

do $$
begin
  alter table team_settings
    add constraint team_settings_design_check check (design in ('diamond', 'classic'));
exception
  when duplicate_object then null;
end
$$;

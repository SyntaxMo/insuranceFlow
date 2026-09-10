-- Run this manually in the Supabase SQL Editor.
-- It adds no columns and grants no anonymous table access.

revoke all on table public.users from anon;
revoke all on table public.vehicles from anon;
revoke all on table public.policies from anon;
revoke all on table public.claims from anon;
revoke all on table public.claim_documents from anon;
revoke all on table public.claim_ai_analyses from anon;

alter table public.users enable row level security;
alter table public.vehicles enable row level security;
alter table public.policies enable row level security;
alter table public.claims enable row level security;
alter table public.claim_documents enable row level security;
alter table public.claim_ai_analyses enable row level security;

create or replace function public.current_app_user_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select u.id
  from public.users as u
  where u.auth_user_id = (select auth.uid())
  limit 1
$$;

create or replace function public.current_app_user_is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select u.role in ('CLAIMS_OFFICER', 'ADMIN')
      from public.users as u
      where u.auth_user_id = (select auth.uid())
      limit 1
    ),
    false
  )
$$;

revoke all on function public.current_app_user_id() from public;
revoke all on function public.current_app_user_is_staff() from public;
grant execute on function public.current_app_user_id() to authenticated, service_role;
grant execute on function public.current_app_user_is_staff() to authenticated, service_role;

grant select on table public.users to authenticated;
grant select on table public.vehicles to authenticated;
grant select on table public.policies to authenticated;
grant select on table public.claims to authenticated;
grant select on table public.claim_documents to authenticated;
grant select on table public.claim_ai_analyses to authenticated;

-- Replace existing policies on these application tables so an older permissive
-- policy cannot be OR-combined with the ownership policies below.
do $$
declare
  policy_record record;
begin
  for policy_record in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = any (
        array[
          'users',
          'vehicles',
          'policies',
          'claims',
          'claim_documents',
          'claim_ai_analyses'
        ]
      )
  loop
    execute format(
      'drop policy if exists %I on %I.%I',
      policy_record.policyname,
      policy_record.schemaname,
      policy_record.tablename
    );
  end loop;
end
$$;

drop policy if exists "users_select_self_or_staff" on public.users;
create policy "users_select_self_or_staff"
on public.users for select to authenticated
using (
  auth_user_id = (select auth.uid())
  or (select public.current_app_user_is_staff())
);

drop policy if exists "vehicles_select_owner_or_staff" on public.vehicles;
create policy "vehicles_select_owner_or_staff"
on public.vehicles for select to authenticated
using (
  owner_id = (select public.current_app_user_id())
  or (select public.current_app_user_is_staff())
);

drop policy if exists "policies_select_owner_or_staff" on public.policies;
create policy "policies_select_owner_or_staff"
on public.policies for select to authenticated
using (
  user_id = (select public.current_app_user_id())
  or (select public.current_app_user_is_staff())
);

drop policy if exists "claims_select_owner_or_staff" on public.claims;
create policy "claims_select_owner_or_staff"
on public.claims for select to authenticated
using (
  (select public.current_app_user_is_staff())
  or exists (
    select 1
    from public.policies as p
    where p.id = claims.policy_id
      and p.user_id = (select public.current_app_user_id())
  )
);

drop policy if exists "claim_documents_select_owner_or_staff" on public.claim_documents;
create policy "claim_documents_select_owner_or_staff"
on public.claim_documents for select to authenticated
using (
  (select public.current_app_user_is_staff())
  or exists (
    select 1
    from public.claims as c
    join public.policies as p on p.id = c.policy_id
    where c.id = claim_documents.claim_id
      and p.user_id = (select public.current_app_user_id())
  )
);

drop policy if exists "claim_ai_analyses_select_owner_or_staff" on public.claim_ai_analyses;
create policy "claim_ai_analyses_select_owner_or_staff"
on public.claim_ai_analyses for select to authenticated
using (
  (select public.current_app_user_is_staff())
  or exists (
    select 1
    from public.claims as c
    join public.policies as p on p.id = c.policy_id
    where c.id = claim_ai_analyses.claim_id
      and p.user_id = (select public.current_app_user_id())
  )
);

-- Application writes remain in validated server routes using service_role.
-- No INSERT/UPDATE/DELETE grant is made to anon or authenticated clients.

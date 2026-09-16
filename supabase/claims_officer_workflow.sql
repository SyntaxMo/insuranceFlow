-- Applied manually in Supabase for the Claims Officer V1 workflow.
-- Keep application writes behind the server-only service-role client.

begin;

alter table public.claims
  add constraint claims_status_v1_check
  check (upper(status) in ('SUBMITTED', 'UNDER_REVIEW', 'MORE_INFO_REQUIRED', 'APPROVED', 'REJECTED', 'CLOSED'))
  not valid;
alter table public.claims validate constraint claims_status_v1_check;

create table public.claim_status_history (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null references public.claims(id) on delete cascade,
  from_status text,
  to_status text not null,
  action text not null,
  note text,
  actor_user_id uuid references public.users(id) on delete set null,
  actor_role text not null,
  created_at timestamptz not null default now(),
  constraint claim_status_history_from_status_check check (from_status is null or upper(from_status) in ('SUBMITTED', 'UNDER_REVIEW', 'MORE_INFO_REQUIRED', 'APPROVED', 'REJECTED', 'CLOSED')),
  constraint claim_status_history_to_status_check check (upper(to_status) in ('SUBMITTED', 'UNDER_REVIEW', 'MORE_INFO_REQUIRED', 'APPROVED', 'REJECTED', 'CLOSED')),
  constraint claim_status_history_action_check check (action in ('CLAIM_SUBMITTED', 'STATUS_IMPORTED', 'REVIEW_STARTED', 'MORE_INFO_REQUESTED', 'CUSTOMER_INFO_SUBMITTED', 'CLAIM_APPROVED', 'CLAIM_REJECTED', 'CLAIM_CLOSED')),
  constraint claim_status_history_actor_role_check check (actor_role in ('CUSTOMER', 'CLAIMS_OFFICER', 'ADMIN', 'SYSTEM')),
  constraint claim_status_history_note_length_check check (note is null or char_length(note) <= 1000),
  constraint claim_status_history_initial_event_check check (
    (action in ('CLAIM_SUBMITTED', 'STATUS_IMPORTED') and from_status is null)
    or (action not in ('CLAIM_SUBMITTED', 'STATUS_IMPORTED') and from_status is not null)
  )
);

create index claim_status_history_claim_created_at_idx on public.claim_status_history (claim_id, created_at, id);
create index claims_status_updated_at_idx on public.claims (status, updated_at desc);
alter table public.claim_status_history enable row level security;
revoke all on table public.claim_status_history from anon, authenticated;
grant select, insert on table public.claim_status_history to service_role;

insert into public.claim_status_history (claim_id, from_status, to_status, action, note, actor_user_id, actor_role, created_at)
select c.id, null, upper(c.status),
  case when upper(c.status) = 'SUBMITTED' then 'CLAIM_SUBMITTED' else 'STATUS_IMPORTED' end,
  case when upper(c.status) = 'SUBMITTED' then null else 'Existing claim status recorded when workflow history was introduced.' end,
  null, 'SYSTEM', coalesce(c.created_at, now())
from public.claims as c;

create or replace function public.create_claim_with_history(
  p_policy_id uuid,
  p_claim_number text,
  p_accident_date timestamptz,
  p_accident_location text,
  p_description text,
  p_contact_email text,
  p_contact_phone text,
  p_actor_user_id uuid
)
returns table (claim_id uuid, claim_number text)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_actor_role text;
  v_claim_id uuid;
  v_claim_number text;
begin
  select upper(u.role) into v_actor_role from public.users as u where u.id = p_actor_user_id;
  if v_actor_role is distinct from 'CUSTOMER' then
    raise exception using errcode = '42501', message = 'Only an authenticated customer may submit a claim.';
  end if;
  if not exists (
    select 1 from public.policies as p
    where p.id = p_policy_id and (
      p.user_id = p_actor_user_id
      or exists (select 1 from public.customer_policy_links as cpl where cpl.policy_id = p.id and cpl.portal_user_id = p_actor_user_id)
    )
  ) then
    raise exception using errcode = '42501', message = 'The customer is not authorized to submit a claim for this policy.';
  end if;
  if nullif(btrim(p_claim_number), '') is null or nullif(btrim(p_accident_location), '') is null or nullif(btrim(p_description), '') is null then
    raise exception using errcode = '22023', message = 'Required claim information is missing.';
  end if;

  insert into public.claims (policy_id, claim_number, accident_date, accident_location, description, contact_email, contact_phone, status)
  values (p_policy_id, btrim(p_claim_number), p_accident_date, btrim(p_accident_location), btrim(p_description), nullif(btrim(p_contact_email), ''), nullif(btrim(p_contact_phone), ''), 'SUBMITTED')
  returning id, public.claims.claim_number into v_claim_id, v_claim_number;

  insert into public.claim_status_history (claim_id, from_status, to_status, action, note, actor_user_id, actor_role)
  values (v_claim_id, null, 'SUBMITTED', 'CLAIM_SUBMITTED', null, p_actor_user_id, v_actor_role);
  return query select v_claim_id, v_claim_number;
end;
$$;

revoke all on function public.create_claim_with_history(uuid, text, timestamptz, text, text, text, text, uuid) from public, anon, authenticated;
grant execute on function public.create_claim_with_history(uuid, text, timestamptz, text, text, text, text, uuid) to service_role;

create or replace function public.transition_claim_status(
  p_claim_id uuid,
  p_to_status text,
  p_action text,
  p_note text,
  p_actor_user_id uuid
)
returns table (claim_id uuid, previous_status text, new_status text, history_id uuid, transitioned_at timestamptz)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_from_status text;
  v_to_status text := upper(btrim(p_to_status));
  v_action text := upper(btrim(p_action));
  v_note text := nullif(btrim(p_note), '');
  v_actor_role text;
  v_expected_action text;
  v_history_id uuid;
  v_created_at timestamptz;
begin
  select upper(u.role) into v_actor_role from public.users as u where u.id = p_actor_user_id;
  if v_actor_role is null then raise exception using errcode = '42501', message = 'The authenticated application profile was not found.'; end if;
  select upper(c.status) into v_from_status from public.claims as c where c.id = p_claim_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'Claim not found.'; end if;

  if v_actor_role in ('CLAIMS_OFFICER', 'ADMIN') then
    v_expected_action := case
      when v_from_status = 'SUBMITTED' and v_to_status = 'UNDER_REVIEW' then 'REVIEW_STARTED'
      when v_from_status = 'UNDER_REVIEW' and v_to_status = 'MORE_INFO_REQUIRED' then 'MORE_INFO_REQUESTED'
      when v_from_status = 'UNDER_REVIEW' and v_to_status = 'APPROVED' then 'CLAIM_APPROVED'
      when v_from_status = 'UNDER_REVIEW' and v_to_status = 'REJECTED' then 'CLAIM_REJECTED'
      when v_from_status in ('APPROVED', 'REJECTED') and v_to_status = 'CLOSED' then 'CLAIM_CLOSED'
      else null end;
  elsif v_actor_role = 'CUSTOMER' then
    if not exists (
      select 1 from public.claims as c join public.policies as p on p.id = c.policy_id
      where c.id = p_claim_id and (
        p.user_id = p_actor_user_id
        or exists (select 1 from public.customer_policy_links as cpl where cpl.policy_id = p.id and cpl.portal_user_id = p_actor_user_id)
      )
    ) then
      raise exception using errcode = '42501', message = 'The customer is not authorized to update this claim.';
    end if;
    v_expected_action := case when v_from_status = 'MORE_INFO_REQUIRED' and v_to_status = 'UNDER_REVIEW' then 'CUSTOMER_INFO_SUBMITTED' else null end;
  else
    raise exception using errcode = '42501', message = 'This role cannot update claim status.';
  end if;

  if v_expected_action is null then raise exception using errcode = '22023', message = 'The requested claim status transition is not allowed.'; end if;
  if v_action is distinct from v_expected_action then raise exception using errcode = '22023', message = 'The claim action does not match the requested transition.'; end if;
  if v_action in ('MORE_INFO_REQUESTED', 'CLAIM_REJECTED') and v_note is null then raise exception using errcode = '22023', message = 'A message or reason is required for this action.'; end if;
  if v_note is not null and char_length(v_note) > 1000 then raise exception using errcode = '22023', message = 'The action note must not exceed 1000 characters.'; end if;

  update public.claims set status = v_to_status, updated_at = now() where id = p_claim_id;
  insert into public.claim_status_history (claim_id, from_status, to_status, action, note, actor_user_id, actor_role)
  values (p_claim_id, v_from_status, v_to_status, v_action, v_note, p_actor_user_id, v_actor_role)
  returning id, created_at into v_history_id, v_created_at;
  return query select p_claim_id, v_from_status, v_to_status, v_history_id, v_created_at;
end;
$$;

revoke all on function public.transition_claim_status(uuid, text, text, text, uuid) from public, anon, authenticated;
grant execute on function public.transition_claim_status(uuid, text, text, text, uuid) to service_role;

commit;

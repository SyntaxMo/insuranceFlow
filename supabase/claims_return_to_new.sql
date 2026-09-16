-- Applied manually in Supabase after claims_officer_workflow.sql.
-- Adds the audited UNDER_REVIEW -> SUBMITTED transition without changing any
-- other claim transition, table, RLS policy, or function permission.

begin;

alter table public.claim_status_history
  drop constraint claim_status_history_action_check;

alter table public.claim_status_history
  add constraint claim_status_history_action_check
  check (
    action in (
      'CLAIM_SUBMITTED',
      'STATUS_IMPORTED',
      'REVIEW_STARTED',
      'REVIEW_RETURNED',
      'MORE_INFO_REQUESTED',
      'CUSTOMER_INFO_SUBMITTED',
      'CLAIM_APPROVED',
      'CLAIM_REJECTED',
      'CLAIM_CLOSED'
    )
  )
  not valid;

alter table public.claim_status_history
  validate constraint claim_status_history_action_check;

create or replace function public.transition_claim_status(
  p_claim_id uuid,
  p_to_status text,
  p_action text,
  p_note text,
  p_actor_user_id uuid
)
returns table (
  claim_id uuid,
  previous_status text,
  new_status text,
  history_id uuid,
  transitioned_at timestamptz
)
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
  select upper(u.role)
  into v_actor_role
  from public.users as u
  where u.id = p_actor_user_id;

  if v_actor_role is null then
    raise exception using
      errcode = '42501',
      message = 'The authenticated application profile was not found.';
  end if;

  select upper(c.status)
  into v_from_status
  from public.claims as c
  where c.id = p_claim_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'Claim not found.';
  end if;

  if v_actor_role in ('CLAIMS_OFFICER', 'ADMIN') then
    v_expected_action :=
      case
        when v_from_status = 'SUBMITTED'
         and v_to_status = 'UNDER_REVIEW'
          then 'REVIEW_STARTED'
        when v_from_status = 'UNDER_REVIEW'
         and v_to_status = 'SUBMITTED'
          then 'REVIEW_RETURNED'
        when v_from_status = 'UNDER_REVIEW'
         and v_to_status = 'MORE_INFO_REQUIRED'
          then 'MORE_INFO_REQUESTED'
        when v_from_status = 'UNDER_REVIEW'
         and v_to_status = 'APPROVED'
          then 'CLAIM_APPROVED'
        when v_from_status = 'UNDER_REVIEW'
         and v_to_status = 'REJECTED'
          then 'CLAIM_REJECTED'
        when v_from_status in ('APPROVED', 'REJECTED')
         and v_to_status = 'CLOSED'
          then 'CLAIM_CLOSED'
        else null
      end;
  elsif v_actor_role = 'CUSTOMER' then
    if not exists (
      select 1
      from public.claims as c
      join public.policies as p on p.id = c.policy_id
      where c.id = p_claim_id
        and (
          p.user_id = p_actor_user_id
          or exists (
            select 1
            from public.customer_policy_links as cpl
            where cpl.policy_id = p.id
              and cpl.portal_user_id = p_actor_user_id
          )
        )
    ) then
      raise exception using
        errcode = '42501',
        message = 'The customer is not authorized to update this claim.';
    end if;

    v_expected_action :=
      case
        when v_from_status = 'MORE_INFO_REQUIRED'
         and v_to_status = 'UNDER_REVIEW'
          then 'CUSTOMER_INFO_SUBMITTED'
        else null
      end;
  else
    raise exception using
      errcode = '42501',
      message = 'This role cannot update claim status.';
  end if;

  if v_expected_action is null then
    raise exception using
      errcode = '22023',
      message = 'The requested claim status transition is not allowed.';
  end if;

  if v_action is distinct from v_expected_action then
    raise exception using
      errcode = '22023',
      message = 'The claim action does not match the requested transition.';
  end if;

  if v_action in ('MORE_INFO_REQUESTED', 'CLAIM_REJECTED')
     and v_note is null then
    raise exception using
      errcode = '22023',
      message = 'A message or reason is required for this action.';
  end if;

  if v_note is not null and char_length(v_note) > 1000 then
    raise exception using
      errcode = '22023',
      message = 'The action note must not exceed 1000 characters.';
  end if;

  update public.claims
  set status = v_to_status, updated_at = now()
  where id = p_claim_id;

  insert into public.claim_status_history (
    claim_id,
    from_status,
    to_status,
    action,
    note,
    actor_user_id,
    actor_role
  )
  values (
    p_claim_id,
    v_from_status,
    v_to_status,
    v_action,
    v_note,
    p_actor_user_id,
    v_actor_role
  )
  returning id, created_at into v_history_id, v_created_at;

  return query
  select p_claim_id, v_from_status, v_to_status, v_history_id, v_created_at;
end;
$$;

revoke all on function public.transition_claim_status(uuid, text, text, text, uuid)
  from public, anon, authenticated;
grant execute on function public.transition_claim_status(uuid, text, text, text, uuid)
  to service_role;

commit;

-- Run manually in the Supabase SQL Editor before enabling OTP verification.
-- These functions are callable only with the server-side service_role client.

create or replace function public.increment_policy_link_verification_attempt(
  p_verification_id uuid,
  p_requesting_user_id uuid
)
returns integer
language sql
security invoker
set search_path = ''
as $$
  update public.policy_link_verifications
  set attempt_count = attempt_count + 1
  where id = p_verification_id
    and requesting_user_id = p_requesting_user_id
    and consumed_at is null
    and expires_at > now()
    and attempt_count < 5
  returning attempt_count;
$$;

create or replace function public.complete_policy_link_verification(
  p_verification_id uuid,
  p_requesting_user_id uuid,
  p_policy_id uuid
)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  verification_row public.policy_link_verifications%rowtype;
  existing_portal_user_id uuid;
begin
  select *
  into verification_row
  from public.policy_link_verifications
  where id = p_verification_id
    and requesting_user_id = p_requesting_user_id
    and policy_id = p_policy_id
    and consumed_at is null
  for update;

  if not found then
    return 'invalid';
  end if;

  if verification_row.expires_at <= now() then
    return 'expired';
  end if;

  if verification_row.attempt_count >= 5 then
    return 'attempts';
  end if;

  select portal_user_id
  into existing_portal_user_id
  from public.customer_policy_links
  where policy_id = p_policy_id
  for update;

  if found then
    if existing_portal_user_id <> p_requesting_user_id then
      return 'linked_other';
    end if;

    update public.policy_link_verifications
    set consumed_at = now()
    where id = p_verification_id;
    return 'already_linked';
  end if;

  begin
    insert into public.customer_policy_links (
      portal_user_id,
      policy_id,
      verification_method,
      verified_at
    ) values (
      p_requesting_user_id,
      p_policy_id,
      'EMAIL_OTP',
      now()
    );
  exception
    when unique_violation then
      select portal_user_id
      into existing_portal_user_id
      from public.customer_policy_links
      where policy_id = p_policy_id;

      if existing_portal_user_id = p_requesting_user_id then
        update public.policy_link_verifications
        set consumed_at = now()
        where id = p_verification_id;
        return 'already_linked';
      end if;

      return 'linked_other';
  end;

  update public.policy_link_verifications
  set consumed_at = now()
  where id = p_verification_id;

  return 'linked';
end;
$$;

revoke all on function public.increment_policy_link_verification_attempt(uuid, uuid)
from public, anon, authenticated;
revoke all on function public.complete_policy_link_verification(uuid, uuid, uuid)
from public, anon, authenticated;

grant execute on function public.increment_policy_link_verification_attempt(uuid, uuid)
to service_role;
grant execute on function public.complete_policy_link_verification(uuid, uuid, uuid)
to service_role;

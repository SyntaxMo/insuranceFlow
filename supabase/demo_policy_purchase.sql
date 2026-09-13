-- Run this file manually in the Supabase SQL Editor before issuing demo policies.
-- It adds nullable metadata for new purchases and keeps existing seeded policies valid.

alter table public.policies
  add column if not exists annual_premium numeric(10,3),
  add column if not exists purchase_request_id uuid;

create unique index if not exists policies_purchase_request_id_unique
  on public.policies (purchase_request_id)
  where purchase_request_id is not null;

create unique index if not exists vehicles_plate_number_normalized_unique
  on public.vehicles (upper(btrim(plate_number)));

create unique index if not exists vehicles_vin_normalized_unique
  on public.vehicles (upper(btrim(vin)))
  where vin is not null and btrim(vin) <> '';

create or replace function public.issue_demo_motor_policy(
  p_portal_user_id uuid,
  p_request_id uuid,
  p_make text,
  p_model text,
  p_year integer,
  p_plate_number text,
  p_vin text,
  p_coverage_type text,
  p_excess_amount numeric,
  p_coverage_limit numeric,
  p_annual_premium numeric
)
returns table (
  outcome text,
  issued_policy_id uuid,
  issued_vehicle_id uuid,
  issued_policy_number text,
  issued_start_date date,
  issued_end_date date
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_policy public.policies%rowtype;
  v_vehicle_id uuid;
  v_policy_number text;
  v_attempt integer := 0;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('purchase:' || p_request_id::text, 0));

  select * into v_policy
  from public.policies
  where purchase_request_id = p_request_id;

  if found then
    if v_policy.user_id <> p_portal_user_id then
      return query select 'request_conflict', null::uuid, null::uuid, null::text, null::date, null::date;
    else
      return query select 'already_issued', v_policy.id, v_policy.vehicle_id, v_policy.policy_number, v_policy.start_date, v_policy.end_date;
    end if;
    return;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('plate:' || upper(btrim(p_plate_number)), 0));
  if exists (select 1 from public.vehicles where upper(btrim(plate_number)) = upper(btrim(p_plate_number))) then
    return query select 'duplicate_plate', null::uuid, null::uuid, null::text, null::date, null::date;
    return;
  end if;

  if nullif(btrim(p_vin), '') is not null then
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('vin:' || upper(btrim(p_vin)), 0));
    if exists (select 1 from public.vehicles where upper(btrim(vin)) = upper(btrim(p_vin))) then
      return query select 'duplicate_vin', null::uuid, null::uuid, null::text, null::date, null::date;
      return;
    end if;
  end if;

  insert into public.vehicles (owner_id, make, model, year, plate_number, vin)
  values (p_portal_user_id, p_make, p_model, p_year, upper(btrim(p_plate_number)), nullif(upper(btrim(p_vin)), ''))
  returning id into v_vehicle_id;

  loop
    v_attempt := v_attempt + 1;
    v_policy_number := 'MOT-' || extract(year from current_date)::integer::text || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    begin
      insert into public.policies (
        policy_number, user_id, vehicle_id, status, coverage_type,
        excess_amount, coverage_limit, annual_premium, start_date, end_date,
        purchase_request_id
      ) values (
        v_policy_number, p_portal_user_id, v_vehicle_id, 'ACTIVE', p_coverage_type,
        p_excess_amount, p_coverage_limit, p_annual_premium, current_date,
        (current_date + interval '1 year - 1 day')::date, p_request_id
      ) returning * into v_policy;
      exit;
    exception when unique_violation then
      if v_attempt >= 5 then raise; end if;
    end;
  end loop;

  return query select 'issued', v_policy.id, v_vehicle_id, v_policy.policy_number, v_policy.start_date, v_policy.end_date;
end;
$$;

revoke execute on function public.issue_demo_motor_policy(uuid, uuid, text, text, integer, text, text, text, numeric, numeric, numeric)
  from public, anon, authenticated;
grant execute on function public.issue_demo_motor_policy(uuid, uuid, text, text, integer, text, text, text, numeric, numeric, numeric)
  to service_role;

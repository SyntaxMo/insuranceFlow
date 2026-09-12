-- Run manually in the Supabase SQL Editor.
-- Guarantees one unconsumed verification per requesting customer and policy,
-- including when two send requests arrive concurrently.

create unique index if not exists policy_link_verifications_one_unconsumed_idx
on public.policy_link_verifications (requesting_user_id, policy_id)
where consumed_at is null;

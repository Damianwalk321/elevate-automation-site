create policy "user_credits_select_own"
on public.user_credits
for select
to authenticated
using (
  user_id = auth.uid()
  or lower(coalesce(email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
  or user_id in (
    select u.id from public.users u
    where u.auth_user_id = auth.uid()
       or lower(coalesce(u.email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
  )
);

create policy "credit_events_select_own"
on public.credit_events
for select
to authenticated
using (
  user_id = auth.uid()
  or lower(coalesce(email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
  or user_id in (
    select u.id from public.users u
    where u.auth_user_id = auth.uid()
       or lower(coalesce(u.email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
  )
);

create policy "affiliates_select_own"
on public.affiliates
for select
to authenticated
using (
  user_id in (
    select u.id from public.users u
    where u.auth_user_id = auth.uid()
       or lower(coalesce(u.email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
  )
);

create policy "referrals_select_own"
on public.referrals
for select
to authenticated
using (
  exists (
    select 1
    from public.affiliates a
    where a.id = referrals.affiliate_id
      and a.user_id in (
        select u.id from public.users u
        where u.auth_user_id = auth.uid()
           or lower(coalesce(u.email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
      )
  )
);

create policy "commissions_select_own"
on public.commissions
for select
to authenticated
using (
  exists (
    select 1
    from public.affiliates a
    where a.id = commissions.affiliate_id
      and a.user_id in (
        select u.id from public.users u
        where u.auth_user_id = auth.uid()
           or lower(coalesce(u.email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
      )
  )
);

create policy "payouts_select_own"
on public.payouts
for select
to authenticated
using (
  exists (
    select 1
    from public.affiliates a
    where a.id = payouts.affiliate_id
      and a.user_id in (
        select u.id from public.users u
        where u.auth_user_id = auth.uid()
           or lower(coalesce(u.email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
      )
  )
);

create policy "user_referral_codes_select_own"
on public.user_referral_codes
for select
to authenticated
using (
  user_id in (
    select u.id from public.users u
    where u.auth_user_id = auth.uid()
       or lower(coalesce(u.email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
  )
);

create policy "user_post_activity_select_own"
on public.user_post_activity
for select
to authenticated
using (
  user_id = auth.uid()
  or user_id in (
    select u.id from public.users u
    where u.auth_user_id = auth.uid()
       or lower(coalesce(u.email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
  )
);

create policy "organizations_select_member"
on public.organizations
for select
to authenticated
using (
  exists (
    select 1
    from public.organization_members m
    where m.organization_id = organizations.id
      and m.user_id in (
        select u.id from public.users u
        where u.auth_user_id = auth.uid()
           or lower(coalesce(u.email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
      )
  )
);

create policy "organization_members_select_member"
on public.organization_members
for select
to authenticated
using (
  user_id in (
    select u.id from public.users u
    where u.auth_user_id = auth.uid()
       or lower(coalesce(u.email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
  )
  or exists (
    select 1
    from public.organization_members m
    where m.organization_id = organization_members.organization_id
      and m.user_id in (
        select u.id from public.users u
        where u.auth_user_id = auth.uid()
           or lower(coalesce(u.email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
      )
  )
);

create policy "dealerships_select_member"
on public.dealerships
for select
to authenticated
using (
  exists (
    select 1
    from public.organization_members m
    where m.organization_id = dealerships.organization_id
      and m.user_id in (
        select u.id from public.users u
        where u.auth_user_id = auth.uid()
           or lower(coalesce(u.email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
      )
  )
);

create policy "scanner_configs_select_member"
on public.scanner_configs
for select
to authenticated
using (
  exists (
    select 1
    from public.dealerships d
    join public.organization_members m on m.organization_id = d.organization_id
    where d.id = scanner_configs.dealership_id
      and m.user_id in (
        select u.id from public.users u
        where u.auth_user_id = auth.uid()
           or lower(coalesce(u.email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
      )
  )
);

create policy "license_keys_no_client_access"
on public.license_keys
for select
to authenticated
using (false);

create policy "webhook_events_no_client_access"
on public.webhook_events
for select
to authenticated
using (false);

create policy "posting_limits_no_client_access"
on public.posting_limits
for select
to authenticated
using (false);

create policy "post_logs_no_client_access"
on public.post_logs
for select
to authenticated
using (false);

create policy "license_activations_no_client_access"
on public.license_activations
for select
to authenticated
using (false);

create policy "user_profiles_select_own"
on public.user_profiles
for select
to authenticated
using (lower(coalesce(user_email, '')) = lower(coalesce(auth.jwt() ->> 'email', '')));

create policy "user_profiles_insert_own"
on public.user_profiles
for insert
to authenticated
with check (lower(coalesce(user_email, '')) = lower(coalesce(auth.jwt() ->> 'email', '')));

create policy "user_profiles_update_own"
on public.user_profiles
for update
to authenticated
using (lower(coalesce(user_email, '')) = lower(coalesce(auth.jwt() ->> 'email', '')))
with check (lower(coalesce(user_email, '')) = lower(coalesce(auth.jwt() ->> 'email', '')));

create schema if not exists private;

create unique index if not exists posting_usage_user_date_unique_idx
  on public.posting_usage (user_id, date_key)
  where user_id is not null and date_key is not null;

alter table public.profiles enable row level security;
alter table public.users enable row level security;
alter table public.subscriptions enable row level security;
alter table public.license_keys enable row level security;
alter table public.user_credits enable row level security;
alter table public.credit_events enable row level security;
alter table public.user_referral_codes enable row level security;
alter table public.user_post_activity enable row level security;
alter table public.payouts enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.dealerships enable row level security;
alter table public.scanner_configs enable row level security;
alter table public.affiliates enable row level security;
alter table public.webhook_events enable row level security;
alter table public.posting_limits enable row level security;
alter table public.post_logs enable row level security;
alter table public.license_activations enable row level security;

create policy "profiles_select_own"
on public.profiles
for select
to authenticated
using (id = auth.uid() or lower(coalesce(email, '')) = lower(coalesce(auth.jwt() ->> 'email', '')));

create policy "profiles_insert_own"
on public.profiles
for insert
to authenticated
with check (
  id = auth.uid()
  and lower(coalesce(email, lower(coalesce(auth.jwt() ->> 'email', '')))) = lower(coalesce(auth.jwt() ->> 'email', ''))
);

create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create policy "users_select_own"
on public.users
for select
to authenticated
using (auth_user_id = auth.uid() or lower(coalesce(email, '')) = lower(coalesce(auth.jwt() ->> 'email', '')));

create policy "users_update_own"
on public.users
for update
to authenticated
using (auth_user_id = auth.uid())
with check (auth_user_id = auth.uid());

create policy "subscriptions_select_own"
on public.subscriptions
for select
to authenticated
using (
  user_id in (
    select u.id from public.users u
    where u.auth_user_id = auth.uid()
       or lower(coalesce(u.email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
  )
  or lower(coalesce(email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
);

create policy "posting_usage_select_own"
on public.posting_usage
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

create policy "posting_usage_insert_own"
on public.posting_usage
for insert
to authenticated
with check (
  user_id = auth.uid()
  or lower(coalesce(email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
  or user_id in (
    select u.id from public.users u
    where u.auth_user_id = auth.uid()
       or lower(coalesce(u.email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
  )
);

create policy "posting_usage_update_own"
on public.posting_usage
for update
to authenticated
using (
  user_id = auth.uid()
  or lower(coalesce(email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
  or user_id in (
    select u.id from public.users u
    where u.auth_user_id = auth.uid()
       or lower(coalesce(u.email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
  )
)
with check (
  user_id = auth.uid()
  or lower(coalesce(email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
  or user_id in (
    select u.id from public.users u
    where u.auth_user_id = auth.uid()
       or lower(coalesce(u.email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
  )
);

create policy "usage_logs_select_own"
on public.usage_logs
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

create policy "user_listings_select_own"
on public.user_listings
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

create policy "listings_select_own"
on public.listings
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

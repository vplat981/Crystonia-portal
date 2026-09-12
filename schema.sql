-- Run this in your Supabase project's SQL Editor before deploying.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text unique not null check (char_length(display_name) between 2 and 24),
  balance integer not null default 100 check (balance >= 0),
  created_at timestamptz not null default now()
);

create table public.transfers (
  id uuid primary key default gen_random_uuid(), sender_id uuid references public.profiles(id), recipient_id uuid not null references public.profiles(id), amount integer not null check (amount > 0), note text, created_at timestamptz not null default now()
);

create table public.mail (
  id uuid primary key default gen_random_uuid(), sender_id uuid not null references public.profiles(id), recipient_id uuid not null references public.profiles(id), subject text not null check (char_length(subject) between 1 and 80), body text not null check (char_length(body) between 1 and 1000), created_at timestamptz not null default now()
);

create table public.marketplace_items (
  id uuid primary key default gen_random_uuid(), title text not null, description text not null, price integer not null check (price > 0), icon text not null default '✦', active boolean not null default true, created_at timestamptz not null default now()
);

create table public.purchases (
  id uuid primary key default gen_random_uuid(), buyer_id uuid not null references public.profiles(id), item_id uuid not null references public.marketplace_items(id), price_paid integer not null, created_at timestamptz not null default now()
);

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(), author_id uuid not null references public.profiles(id), body text not null check (char_length(body) between 1 and 500), created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.transfers enable row level security;
alter table public.mail enable row level security;
alter table public.marketplace_items enable row level security;
alter table public.purchases enable row level security;
alter table public.chat_messages enable row level security;

create policy "members see profiles" on public.profiles for select to authenticated using (true);
create policy "members see their transfers" on public.transfers for select to authenticated using (sender_id = auth.uid() or recipient_id = auth.uid());
create policy "members see their mail" on public.mail for select to authenticated using (recipient_id = auth.uid() or sender_id = auth.uid());
create policy "members browse market" on public.marketplace_items for select to authenticated using (active = true);
create policy "members see own purchases" on public.purchases for select to authenticated using (buyer_id = auth.uid());
create policy "members read chat" on public.chat_messages for select to authenticated using (true);
create policy "members write chat" on public.chat_messages for insert to authenticated with check (author_id = auth.uid());

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name) values (new.id, coalesce(nullif(new.raw_user_meta_data->>'display_name', ''), split_part(new.email, '@', 1)));
  return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

create or replace function public.transfer_crystallines(recipient_name text, transfer_amount integer, transfer_note text default null) returns void language plpgsql security definer set search_path = public as $$
declare target_id uuid; sender_balance integer;
begin
  if transfer_amount is null or transfer_amount <= 0 then raise exception 'Enter a positive amount.'; end if;
  select id into target_id from profiles where lower(display_name) = lower(trim(recipient_name));
  if target_id is null then raise exception 'That citizen does not exist.'; end if;
  if target_id = auth.uid() then raise exception 'You cannot transfer to yourself.'; end if;
  select balance into sender_balance from profiles where id = auth.uid() for update;
  if sender_balance < transfer_amount then raise exception 'Your treasury does not have enough crystallines.'; end if;
  update profiles set balance = balance - transfer_amount where id = auth.uid();
  update profiles set balance = balance + transfer_amount where id = target_id;
  insert into transfers(sender_id, recipient_id, amount, note) values (auth.uid(), target_id, transfer_amount, nullif(trim(transfer_note), ''));
end; $$;

create or replace function public.buy_marketplace_item(item_id uuid) returns void language plpgsql security definer set search_path = public as $$
declare item record; funds integer;
begin
  select * into item from marketplace_items where id = item_id and active = true; if item is null then raise exception 'This item is no longer available.'; end if;
  select balance into funds from profiles where id = auth.uid() for update; if funds < item.price then raise exception 'Not enough crystallines.'; end if;
  update profiles set balance = balance - item.price where id = auth.uid();
  insert into purchases(buyer_id, item_id, price_paid) values (auth.uid(), item.id, item.price);
end; $$;

create or replace function public.send_crystal_mail(recipient_name text, message_subject text, message_body text) returns void language plpgsql security definer set search_path = public as $$
declare target_id uuid;
begin
  select id into target_id from profiles where lower(display_name) = lower(trim(recipient_name)); if target_id is null then raise exception 'That citizen does not exist.'; end if;
  insert into mail(sender_id, recipient_id, subject, body) values (auth.uid(), target_id, trim(message_subject), trim(message_body));
end; $$;

grant execute on function public.transfer_crystallines(text, integer, text) to authenticated;
grant execute on function public.buy_marketplace_item(uuid) to authenticated;
grant execute on function public.send_crystal_mail(text, text, text) to authenticated;

insert into public.marketplace_items (title, description, price, icon) values
  ('Prism Passport', 'A glimmering travel document for Crystonian citizens.', 18, '▣'),
  ('Aurora Pin', 'Wear the northern lights on your lapel.', 12, '✦'),
  ('Crystal Tea Set', 'A ceremonial set for five peaceful guests.', 35, '◌'),
  ('Cyvathon Friendship Ribbon', 'Celebrate our alliance with Cyvathon.', 8, '≈');

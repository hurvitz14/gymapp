-- Roles + coach codes
alter table public.profiles add column role text not null default 'trainee' check (role in ('trainee','coach'));
alter table public.profiles add column coach_code text unique;

-- Stop clients from editing role / coach_code directly (they change only through RPCs)
revoke insert, update on public.profiles from authenticated;
grant insert (id, display_name) on public.profiles to authenticated;
grant update (id, display_name, weight_unit, step_goal, calorie_goal, protein_goal, goal_weight_kg, weight_goal, push_enabled) on public.profiles to authenticated;

create table public.coach_links (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles(id) on delete cascade,
  trainee_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (coach_id, trainee_id),
  check (coach_id <> trainee_id)
);
create index on public.coach_links (trainee_id);
alter table public.coach_links enable row level security;
create policy "see own links" on public.coach_links for select to authenticated
  using (coach_id = (select auth.uid()) or trainee_id = (select auth.uid()));
create policy "remove own links" on public.coach_links for delete to authenticated
  using (coach_id = (select auth.uid()) or trainee_id = (select auth.uid()));

create function public.is_coach_of(trainee uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.coach_links where coach_id = (select auth.uid()) and trainee_id = trainee);
$$;
revoke all on function public.is_coach_of(uuid) from public, anon;
grant execute on function public.is_coach_of(uuid) to authenticated;

create policy "coach reads trainee profiles" on public.profiles for select to authenticated
  using (public.is_coach_of(id));
create policy "trainee reads coach profile" on public.profiles for select to authenticated
  using (exists (select 1 from public.coach_links l where l.trainee_id = (select auth.uid()) and l.coach_id = profiles.id));

create table public.check_ins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  week_start date not null,
  feel smallint check (feel between 1 and 5),
  energy smallint check (energy between 1 and 5),
  sleep smallint check (sleep between 1 and 5),
  adherence smallint check (adherence between 1 and 5),
  problems text check (length(problems) <= 2000),
  notes text check (length(notes) <= 2000),
  weight_kg numeric(5,2),
  photo_paths text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, week_start)
);
alter table public.check_ins enable row level security;
create policy "own check-ins" on public.check_ins for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "coach reads check-ins" on public.check_ins for select to authenticated
  using (public.is_coach_of(user_id));

create table public.check_in_replies (
  id uuid primary key default gen_random_uuid(),
  check_in_id uuid not null references public.check_ins(id) on delete cascade,
  coach_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index on public.check_in_replies (check_in_id);
create index on public.check_in_replies (coach_id);
alter table public.check_in_replies enable row level security;
create policy "read replies" on public.check_in_replies for select to authenticated
  using (coach_id = (select auth.uid())
         or exists (select 1 from public.check_ins c where c.id = check_in_id and c.user_id = (select auth.uid())));
create policy "coach replies" on public.check_in_replies for insert to authenticated
  with check (coach_id = (select auth.uid())
              and exists (select 1 from public.check_ins c where c.id = check_in_id and public.is_coach_of(c.user_id)));
create policy "coach deletes own replies" on public.check_in_replies for delete to authenticated
  using (coach_id = (select auth.uid()));

-- RPCs
create function public.become_coach() returns text
language plpgsql security definer set search_path = '' as $$
declare c text;
begin
  select coach_code into c from public.profiles where id = (select auth.uid());
  if c is null then
    loop
      c := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
      exit when not exists (select 1 from public.profiles where coach_code = c);
    end loop;
  end if;
  update public.profiles set role = 'coach', coach_code = c where id = (select auth.uid());
  return c;
end $$;
revoke all on function public.become_coach() from public, anon;
grant execute on function public.become_coach() to authenticated;

create function public.link_to_coach(code text) returns text
language plpgsql security definer set search_path = '' as $$
declare cid uuid; cname text;
begin
  select id, display_name into cid, cname from public.profiles
   where role = 'coach' and coach_code = upper(trim(code));
  if cid is null then raise exception 'Invalid coach code'; end if;
  if cid = (select auth.uid()) then raise exception 'You cannot coach yourself'; end if;
  insert into public.coach_links (coach_id, trainee_id) values (cid, (select auth.uid())) on conflict do nothing;
  return coalesce(cname, 'Coach');
end $$;
revoke all on function public.link_to_coach(text) from public, anon;
grant execute on function public.link_to_coach(text) to authenticated;

-- Notifications for check-ins and replies
create function public.notify_new_check_in() returns trigger
language plpgsql security definer set search_path = '' as $$
declare nm text;
begin
  select coalesce(display_name, 'A trainee') into nm from public.profiles where id = new.user_id;
  insert into public.notifications (user_id, type, title, body, data)
  select l.coach_id, 'checkin', 'New weekly check-in', nm || ' submitted a check-in', jsonb_build_object('check_in_id', new.id, 'trainee_id', new.user_id)
  from public.coach_links l where l.trainee_id = new.user_id;
  return new;
end $$;
revoke all on function public.notify_new_check_in() from public, anon, authenticated;
create trigger check_ins_notify after insert on public.check_ins for each row execute function public.notify_new_check_in();

create function public.notify_reply() returns trigger
language plpgsql security definer set search_path = '' as $$
declare uid uuid;
begin
  select user_id into uid from public.check_ins where id = new.check_in_id;
  insert into public.notifications (user_id, type, title, body, data)
  values (uid, 'coach', 'Your coach replied', left(new.body, 120), jsonb_build_object('check_in_id', new.check_in_id));
  return new;
end $$;
revoke all on function public.notify_reply() from public, anon, authenticated;
create trigger replies_notify after insert on public.check_in_replies for each row execute function public.notify_reply();

-- Private photo bucket
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('checkin-photos', 'checkin-photos', false, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;
create policy "own checkin photos" on storage.objects for all to authenticated
  using (bucket_id = 'checkin-photos' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'checkin-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "coach reads checkin photos" on storage.objects for select to authenticated
  using (bucket_id = 'checkin-photos'
         and (storage.foldername(name))[1] in (select trainee_id::text from public.coach_links where coach_id = (select auth.uid())));

-- Daily cap for AI food estimates (written only by the edge function via service role)
create table public.estimate_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null default current_date,
  n int not null default 0,
  primary key (user_id, day)
);
alter table public.estimate_usage enable row level security;
create function public.bump_estimate_usage(uid uuid) returns int
language plpgsql security definer set search_path = '' as $$
declare c int;
begin
  insert into public.estimate_usage (user_id, day, n) values (uid, current_date, 1)
  on conflict (user_id, day) do update set n = public.estimate_usage.n + 1
  returning n into c;
  return c;
end $$;
revoke all on function public.bump_estimate_usage(uuid) from public, anon, authenticated;
grant execute on function public.bump_estimate_usage(uuid) to service_role;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  weight_unit text not null default 'kg' check (weight_unit in ('kg','lb')),
  step_goal int not null default 10000,
  calorie_goal int not null default 2400,
  protein_goal int not null default 150,
  goal_weight_kg numeric(5,2),
  weight_goal text not null default 'maintain' check (weight_goal in ('lose','gain','maintain')),
  push_enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  muscle_group text not null,
  equipment text not null default 'other',
  kind text not null default 'weight_reps' check (kind in ('weight_reps','bodyweight_reps','duration','distance')),
  created_at timestamptz not null default now()
);
create index on public.exercises (user_id);

create table public.routines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  notes text,
  created_at timestamptz not null default now()
);
create index on public.routines (user_id);

create table public.routine_exercises (
  id uuid primary key default gen_random_uuid(),
  routine_id uuid not null references public.routines(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  position int not null default 0,
  target_sets int not null default 3,
  target_reps int not null default 10,
  rest_seconds int not null default 90
);
create index on public.routine_exercises (routine_id);
create index on public.routine_exercises (user_id);
create index on public.routine_exercises (exercise_id);

create table public.workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  routine_id uuid references public.routines(id) on delete set null,
  name text not null default 'Workout',
  notes text,
  started_at timestamptz not null default now(),
  ended_at timestamptz
);
create index on public.workouts (user_id, started_at desc);
create index on public.workouts (routine_id);

create table public.workout_exercises (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid not null references public.workouts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  position int not null default 0,
  notes text
);
create index on public.workout_exercises (workout_id);
create index on public.workout_exercises (user_id);
create index on public.workout_exercises (exercise_id);

create table public.sets (
  id uuid primary key default gen_random_uuid(),
  workout_exercise_id uuid not null references public.workout_exercises(id) on delete cascade,
  workout_id uuid not null references public.workouts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  set_index int not null default 0,
  set_type text not null default 'normal' check (set_type in ('normal','warmup','drop','failure')),
  weight_kg numeric(7,2),
  reps int,
  duration_s int,
  distance_m numeric(9,2),
  rpe numeric(3,1),
  completed boolean not null default true,
  created_at timestamptz not null default now()
);
create index on public.sets (user_id, exercise_id);
create index on public.sets (workout_exercise_id);
create index on public.sets (workout_id);
create index on public.sets (exercise_id);

create table public.body_weights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  logged_on date not null default current_date,
  weight_kg numeric(5,2) not null check (weight_kg > 0),
  created_at timestamptz not null default now(),
  unique (user_id, logged_on)
);

create table public.step_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  logged_on date not null default current_date,
  steps int not null check (steps >= 0),
  updated_at timestamptz not null default now(),
  unique (user_id, logged_on)
);

create table public.meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  logged_on date not null default current_date,
  meal_type text not null default 'snack' check (meal_type in ('breakfast','lunch','dinner','snack')),
  name text not null,
  calories int not null default 0,
  protein_g numeric(6,1) not null default 0,
  carbs_g numeric(6,1) not null default 0,
  fat_g numeric(6,1) not null default 0,
  created_at timestamptz not null default now()
);
create index on public.meals (user_id, logged_on);

create table public.personal_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('lift_weight','lift_1rm','body_weight')),
  exercise_id uuid references public.exercises(id) on delete cascade,
  set_id uuid references public.sets(id) on delete cascade,
  value numeric(8,2) not null,
  previous_value numeric(8,2),
  achieved_at timestamptz not null default now()
);
create index on public.personal_records (user_id, achieved_at desc);
create index on public.personal_records (exercise_id);
create index on public.personal_records (set_id);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null default 'pr',
  title text not null,
  body text,
  data jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.notifications (user_id, created_at desc);

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);
create index on public.push_subscriptions (user_id);

-- Row level security
alter table public.profiles enable row level security;
alter table public.exercises enable row level security;
alter table public.routines enable row level security;
alter table public.routine_exercises enable row level security;
alter table public.workouts enable row level security;
alter table public.workout_exercises enable row level security;
alter table public.sets enable row level security;
alter table public.body_weights enable row level security;
alter table public.step_logs enable row level security;
alter table public.meals enable row level security;
alter table public.personal_records enable row level security;
alter table public.notifications enable row level security;
alter table public.push_subscriptions enable row level security;

create policy "own profile" on public.profiles for all to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy "read global or own exercises" on public.exercises for select to authenticated
  using (user_id is null or user_id = (select auth.uid()));
create policy "insert own exercises" on public.exercises for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "update own exercises" on public.exercises for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "delete own exercises" on public.exercises for delete to authenticated
  using (user_id = (select auth.uid()));

create policy "own routines" on public.routines for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own routine exercises" on public.routine_exercises for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own workouts" on public.workouts for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own workout exercises" on public.workout_exercises for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own sets" on public.sets for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own body weights" on public.body_weights for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own step logs" on public.step_logs for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own meals" on public.meals for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "read own records" on public.personal_records for select to authenticated
  using (user_id = (select auth.uid()));
create policy "read own notifications" on public.notifications for select to authenticated
  using (user_id = (select auth.uid()));
create policy "update own notifications" on public.notifications for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "delete own notifications" on public.notifications for delete to authenticated
  using (user_id = (select auth.uid()));
create policy "own push subscriptions" on public.push_subscriptions for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- New user -> profile
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email,'@',1)));
  return new;
end $$;
revoke all on function public.handle_new_user() from public, anon, authenticated;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Lift PR detection
create function public.detect_lift_pr() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  ex_name text;
  prev_w numeric; prev_e numeric;
  new_e numeric;
  hit_w boolean := false; hit_e boolean := false;
  msg text;
begin
  if not new.completed or new.set_type = 'warmup' or coalesce(new.reps,0) <= 0 or coalesce(new.weight_kg,0) <= 0 then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.completed and old.weight_kg is not distinct from new.weight_kg and old.reps is not distinct from new.reps then
    return new;
  end if;

  select max(weight_kg), max(weight_kg * (1 + reps / 30.0))
    into prev_w, prev_e
  from public.sets
  where user_id = new.user_id and exercise_id = new.exercise_id and id <> new.id
    and completed and set_type <> 'warmup' and coalesce(reps,0) > 0 and coalesce(weight_kg,0) > 0;

  if prev_w is null then
    return new; -- first ever log is a baseline, not a PR
  end if;

  new_e := round(new.weight_kg * (1 + new.reps / 30.0), 2);
  hit_w := new.weight_kg > prev_w;
  hit_e := new_e > round(prev_e, 2);
  if not (hit_w or hit_e) then return new; end if;

  select name into ex_name from public.exercises where id = new.exercise_id;

  if hit_w then
    insert into public.personal_records (user_id, kind, exercise_id, set_id, value, previous_value)
    values (new.user_id, 'lift_weight', new.exercise_id, new.id, new.weight_kg, prev_w);
  end if;
  if hit_e then
    insert into public.personal_records (user_id, kind, exercise_id, set_id, value, previous_value)
    values (new.user_id, 'lift_1rm', new.exercise_id, new.id, new_e, round(prev_e, 2));
  end if;

  msg := case when hit_w
    then format('%s kg × %s on %s (previous best %s kg)', new.weight_kg, new.reps, ex_name, prev_w)
    else format('New estimated 1RM on %s: %s kg', ex_name, new_e) end;

  insert into public.notifications (user_id, type, title, body, data)
  values (new.user_id, 'pr', 'New personal record 🏆', msg,
          jsonb_build_object('exercise_id', new.exercise_id, 'set_id', new.id, 'weight_pr', hit_w, 'e1rm_pr', hit_e));
  return new;
end $$;
revoke all on function public.detect_lift_pr() from public, anon, authenticated;
create trigger sets_detect_pr after insert or update of completed, weight_kg, reps on public.sets
  for each row execute function public.detect_lift_pr();

-- Body weight milestone detection: every 5 kg crossed toward the goal direction
create function public.detect_body_weight_milestone() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  goal text;
  prev numeric;
  crossed numeric;
begin
  select weight_goal into goal from public.profiles where id = new.user_id;
  if goal is null or goal = 'maintain' then return new; end if;

  select weight_kg into prev from public.body_weights
  where user_id = new.user_id and logged_on < new.logged_on
  order by logged_on desc limit 1;
  if prev is null then return new; end if;

  if goal = 'lose' and new.weight_kg < prev then
    crossed := ceil(new.weight_kg / 5.0) * 5;
    if crossed < prev and crossed >= new.weight_kg then
      null;
    else
      return new;
    end if;
  elsif goal = 'gain' and new.weight_kg > prev then
    crossed := floor(new.weight_kg / 5.0) * 5;
    if crossed > prev and crossed <= new.weight_kg then
      null;
    else
      return new;
    end if;
  else
    return new;
  end if;

  insert into public.personal_records (user_id, kind, value, previous_value)
  values (new.user_id, 'body_weight', crossed, prev);
  insert into public.notifications (user_id, type, title, body, data)
  values (new.user_id, 'pr', 'Body weight milestone 🎯',
          format('You passed %s kg (now %s kg)', crossed, new.weight_kg),
          jsonb_build_object('milestone_kg', crossed, 'weight_kg', new.weight_kg));
  return new;
end $$;
revoke all on function public.detect_body_weight_milestone() from public, anon, authenticated;
create trigger body_weights_milestone after insert or update of weight_kg on public.body_weights
  for each row execute function public.detect_body_weight_milestone();

-- Realtime for in-app PR celebrations
alter publication supabase_realtime add table public.notifications;

-- Seed global exercise library
insert into public.exercises (name, muscle_group, equipment, kind) values
('Bench Press (Barbell)','Chest','barbell','weight_reps'),
('Incline Bench Press (Dumbbell)','Chest','dumbbell','weight_reps'),
('Chest Fly (Cable)','Chest','cable','weight_reps'),
('Push Up','Chest','bodyweight','bodyweight_reps'),
('Dip','Triceps','bodyweight','bodyweight_reps'),
('Squat (Barbell)','Quads','barbell','weight_reps'),
('Front Squat','Quads','barbell','weight_reps'),
('Leg Press','Quads','machine','weight_reps'),
('Leg Extension','Quads','machine','weight_reps'),
('Lunge (Dumbbell)','Quads','dumbbell','weight_reps'),
('Deadlift (Barbell)','Back','barbell','weight_reps'),
('Romanian Deadlift','Hamstrings','barbell','weight_reps'),
('Leg Curl','Hamstrings','machine','weight_reps'),
('Hip Thrust (Barbell)','Glutes','barbell','weight_reps'),
('Pull Up','Back','bodyweight','bodyweight_reps'),
('Lat Pulldown (Cable)','Back','cable','weight_reps'),
('Bent Over Row (Barbell)','Back','barbell','weight_reps'),
('Seated Row (Cable)','Back','cable','weight_reps'),
('One Arm Row (Dumbbell)','Back','dumbbell','weight_reps'),
('Face Pull','Shoulders','cable','weight_reps'),
('Overhead Press (Barbell)','Shoulders','barbell','weight_reps'),
('Shoulder Press (Dumbbell)','Shoulders','dumbbell','weight_reps'),
('Lateral Raise (Dumbbell)','Shoulders','dumbbell','weight_reps'),
('Rear Delt Fly','Shoulders','dumbbell','weight_reps'),
('Shrug (Dumbbell)','Traps','dumbbell','weight_reps'),
('Bicep Curl (Dumbbell)','Biceps','dumbbell','weight_reps'),
('Barbell Curl','Biceps','barbell','weight_reps'),
('Hammer Curl','Biceps','dumbbell','weight_reps'),
('Tricep Pushdown (Cable)','Triceps','cable','weight_reps'),
('Skull Crusher','Triceps','barbell','weight_reps'),
('Calf Raise (Machine)','Calves','machine','weight_reps'),
('Plank','Core','bodyweight','duration'),
('Hanging Leg Raise','Core','bodyweight','bodyweight_reps'),
('Cable Crunch','Core','cable','weight_reps'),
('Running (Outdoor)','Cardio','none','distance'),
('Treadmill','Cardio','machine','distance'),
('Cycling','Cardio','machine','distance'),
('Rowing Machine','Cardio','machine','distance');

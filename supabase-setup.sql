-- ============================================================
-- ClassPulse — Supabase setup
-- Paste this ENTIRE file into Supabase SQL Editor and click RUN
-- ============================================================

create extension if not exists pgcrypto;

-- ---------- TABLES ----------

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  name text not null,
  role text not null check (role in ('teacher','student')),
  roll_number text,
  section text,
  department text,
  created_at timestamptz default now()
);

create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles(id),
  course_name text not null,
  section text not null,
  session_secret text not null default encode(gen_random_bytes(16),'hex'),
  is_active boolean default true,
  started_at timestamptz default now(),
  ended_at timestamptz
);

create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  student_id uuid not null references public.profiles(id),
  qr_verified boolean default true,
  ble_verified boolean default true,
  checked_in_at timestamptz default now(),
  unique (session_id, student_id)
);

create table if not exists public.quizzes (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  question text not null,
  options jsonb not null,
  correct_option_index int not null,
  pushed_at timestamptz default now()
);

create table if not exists public.quiz_responses (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  student_id uuid not null references public.profiles(id),
  selected_option_index int not null,
  is_correct boolean not null,
  responded_at timestamptz default now(),
  unique (quiz_id, student_id)
);

-- ---------- ROW LEVEL SECURITY ----------

alter table public.profiles enable row level security;
alter table public.sessions enable row level security;
alter table public.attendance enable row level security;
alter table public.quizzes enable row level security;
alter table public.quiz_responses enable row level security;

-- Profiles: everyone logged-in can read (needed for feeds/roster); you can only create/edit your own
create policy "read profiles" on public.profiles for select to authenticated using (true);
create policy "insert own profile" on public.profiles for insert to authenticated with check (auth.uid() = id);
create policy "update own profile" on public.profiles for update to authenticated using (auth.uid() = id);

-- Sessions: readable by all logged-in users; only teachers manage their own
create policy "read sessions" on public.sessions for select to authenticated using (true);
create policy "teacher creates session" on public.sessions for insert to authenticated with check (auth.uid() = teacher_id);
create policy "teacher updates own session" on public.sessions for update to authenticated using (auth.uid() = teacher_id);

-- Attendance: readable by all logged-in users (live feed + analytics). Inserts happen ONLY via the checkin() function below.
create policy "read attendance" on public.attendance for select to authenticated using (true);

-- Quizzes: readable by all; only the session's teacher can push
create policy "read quizzes" on public.quizzes for select to authenticated using (true);
create policy "teacher pushes quiz" on public.quizzes for insert to authenticated
  with check (exists (select 1 from public.sessions s where s.id = session_id and s.teacher_id = auth.uid()));

-- Quiz responses: students insert their own; everyone can read (teacher analytics)
create policy "read responses" on public.quiz_responses for select to authenticated using (true);
create policy "student answers quiz" on public.quiz_responses for insert to authenticated with check (auth.uid() = student_id);

-- ---------- CHECK-IN FUNCTION (server-side TOTP validation) ----------
-- The QR encodes a 6-char code derived from the session secret + 12-second time window.
-- This function recomputes the expected code on the SERVER and only marks attendance if it matches
-- the current or previous window. Expired codes (screenshots!) are rejected.

create or replace function public.checkin(p_session_id uuid, p_code text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_secret text;
  v_active boolean;
  v_win bigint;
  v_now text;
  v_prev text;
  v_student uuid := auth.uid();
begin
  if v_student is null then
    return json_build_object('status','error','message','Not logged in');
  end if;

  select session_secret, is_active into v_secret, v_active
  from sessions where id = p_session_id;

  if v_secret is null then
    return json_build_object('status','error','message','Session not found');
  end if;

  if not v_active then
    return json_build_object('status','ended');
  end if;

  v_win  := floor(extract(epoch from clock_timestamp()) / 12);
  v_now  := upper(substr(encode(digest(v_secret || ':' || v_win::text,     'sha256'),'hex'),1,6));
  v_prev := upper(substr(encode(digest(v_secret || ':' || (v_win-1)::text, 'sha256'),'hex'),1,6));

  if upper(p_code) <> v_now and upper(p_code) <> v_prev then
    return json_build_object('status','expired');
  end if;

  insert into attendance (session_id, student_id, qr_verified, ble_verified)
  values (p_session_id, v_student, true, true)
  on conflict (session_id, student_id) do nothing;

  return json_build_object('status','ok');
end;
$$;

grant execute on function public.checkin to authenticated;

-- ---------- REALTIME (live check-in feed + live quiz push) ----------

alter publication supabase_realtime add table public.attendance;
alter publication supabase_realtime add table public.quizzes;

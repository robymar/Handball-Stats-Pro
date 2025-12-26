
-- EJECUTA ESTO EN EL SQL EDITOR DE SUPABASE DASHBOARD

-- 1. Tabla de Perfiles (Usuarios del App)
create table public.profiles (
  id uuid references auth.users not null,
  email text,
  full_name text,
  updated_at timestamp with time zone,
  
  primary key (id)
);

alter table public.profiles enable row level security;
create policy "Public profiles are viewable by everyone." on public.profiles for select using ( true );
create policy "Users can insert their own profile." on public.profiles for insert with check ( auth.uid() = id );
create policy "Users can update own profile." on public.profiles for update using ( auth.uid() = id );

-- Trigger para crear perfil automáticamente al registrarse
create or replace function public.handle_new_user() 
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- 2. Tabla de Equipos
create table public.teams (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) not null,
  name text not null,
  category text,
  gender text check (gender in ('MALE', 'FEMALE', 'MIXED')),
  logo_url text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.teams enable row level security;
create policy "Users can view own teams" on public.teams for select using ( auth.uid() = user_id );
create policy "Users can insert own teams" on public.teams for insert with check ( auth.uid() = user_id );
create policy "Users can update own teams" on public.teams for update using ( auth.uid() = user_id );
create policy "Users can delete own teams" on public.teams for delete using ( auth.uid() = user_id );


-- 3. Tabla de Partidos (Matches)
create table public.matches (
  id text primary key, -- Usamos text porque tu app genera IDs tipo string/UUID manual
  user_id uuid references public.profiles(id) not null,
  team_id uuid references public.teams(id), -- Opcional, si queremos vincular
  
  home_team text not null,
  away_team text not null,
  home_score int default 0,
  away_score int default 0,
  date timestamp with time zone,
  location text,
  
  -- AQUÍ LA MAGIA: Guardamos todo el estado del partido en JSON
  match_data jsonb not null, 
  
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.matches enable row level security;
create policy "Users can view own matches" on public.matches for select using ( auth.uid() = user_id );
create policy "Users can insert own matches" on public.matches for insert with check ( auth.uid() = user_id );
create policy "Users can update own matches" on public.matches for update using ( auth.uid() = user_id );
create policy "Users can delete own matches" on public.matches for delete using ( auth.uid() = user_id );

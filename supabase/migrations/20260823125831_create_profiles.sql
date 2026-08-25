create table public.profiles (
    id uuid primary key default gen_random_uuid(),

    name text,

    date_of_birth date,

    height_cm numeric,
    weight_kg numeric,

    primary_sport text,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
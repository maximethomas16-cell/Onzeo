# FC Regny - Setup gratuit avec Supabase

Cette version gratuite remplace le serveur Node par:

- un site statique public
- une administration connectee a Supabase
- un stockage central dans une table JSON

## 1. Creer le projet Supabase

Creer un projet gratuit puis recuperer:

- `Project URL`
- `anon public key`

## 2. Creer la table

Executer ce SQL dans Supabase SQL Editor:

```sql
create table if not exists public.season_data (
  id text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.admin_users (
  email text primary key
);

alter table public.season_data enable row level security;
alter table public.admin_users enable row level security;

drop policy if exists "season public read" on public.season_data;
create policy "season public read"
on public.season_data
for select
to anon, authenticated
using (true);

drop policy if exists "season admin write" on public.season_data;
create policy "season admin write"
on public.season_data
for all
to authenticated
using (
  exists (
    select 1
    from public.admin_users
    where admin_users.email = auth.email()
  )
)
with check (
  exists (
    select 1
    from public.admin_users
    where admin_users.email = auth.email()
  )
);

drop policy if exists "admin list self" on public.admin_users;
create policy "admin list self"
on public.admin_users
for select
to authenticated
using (email = auth.email());
```

## 3. Inserer la saison initiale

Executer ensuite:

```sql
insert into public.season_data (id, payload)
values (
  'public',
  $$PASTE_JSON_HERE$$::jsonb
)
on conflict (id) do update
set payload = excluded.payload,
    updated_at = timezone('utc', now());
```

Remplacer `$$PASTE_JSON_HERE$$` par le contenu de `data/season.json`.

## 4. Creer les admins

1. Creer les comptes dans `Authentication > Users`
2. Ajouter leurs emails dans `public.admin_users`

Exemple:

```sql
insert into public.admin_users (email)
values ('admin@club.fr');
```

## 5. Configurer le front

Editer `public/config.js`:

```js
export const APP_CONFIG = {
  provider: "supabase",
  seasonFile: "./data/season.json",
  allowLocalAdmin: false,
  supabaseUrl: "https://xxxx.supabase.co",
  supabaseAnonKey: "eyJ...",
  supabaseSeasonTable: "season_data",
  supabaseSeasonId: "public",
};
```

## 6. Generer le site statique

```bash
npm run build:static
```

Le site pret a publier sera dans `dist-static/`.

## 7. Hebergement gratuit

Options recommandees:

- Cloudflare Pages
- GitHub Pages si le repo est public ou si votre plan GitHub le permet

Dans les deux cas:

- dossier de sortie: `dist-static`
- aucun serveur Node necessaire

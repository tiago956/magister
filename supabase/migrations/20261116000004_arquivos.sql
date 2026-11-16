-- Arquivos: pastas do Google Drive vinculadas ao Magister, visíveis conforme o perfil
-- (função, turmas e matérias que a pessoa leciona). O compartilhamento continua no Drive.

create table public.pastas_drive (
  id integer generated always as identity primary key,
  titulo text not null check (length(btrim(titulo)) between 1 and 120),
  descricao text check (descricao is null or length(descricao) <= 1000),
  drive_id text not null unique check (drive_id ~ '^[A-Za-z0-9_-]{10,100}$'),
  -- Regras: lista vazia = sem restrição por esse critério; os critérios se somam (E).
  papeis public.papel[] not null default '{}',
  turmas smallint[] not null default '{}',
  disciplinas smallint[] not null default '{}',
  ordem smallint not null default 0,
  criado_por uuid references public.perfis (id) on delete set null default auth.uid(),
  criado_em timestamptz not null default now()
);

create or replace function privado.ve_pasta(p_pasta integer)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select privado.eh_gestor()) or exists (
    select 1
    from public.pastas_drive pd
    join public.perfis p on p.id = (select auth.uid()) and p.ativo
    where pd.id = p_pasta
      and (cardinality(pd.papeis) = 0 or p.papel = any (pd.papeis))
      and (cardinality(pd.turmas) = 0 or exists (
            select 1 from public.atribuicoes a where a.professor_id = p.id and a.turma_id = any (pd.turmas)))
      and (cardinality(pd.disciplinas) = 0 or exists (
            select 1 from public.atribuicoes a where a.professor_id = p.id and a.disciplina_id = any (pd.disciplinas)))
  );
$$;

revoke execute on function privado.ve_pasta(integer) from public, anon;
grant execute on function privado.ve_pasta(integer) to authenticated;

alter table public.pastas_drive enable row level security;
create policy "vê pastas do perfil" on public.pastas_drive for select to authenticated using ((select privado.ve_pasta(id)));
create policy "gestão insere pastas" on public.pastas_drive for insert to authenticated with check ((select privado.eh_gestor()));
create policy "gestão altera pastas" on public.pastas_drive for update to authenticated
  using ((select privado.eh_gestor())) with check ((select privado.eh_gestor()));
create policy "gestão remove pastas" on public.pastas_drive for delete to authenticated using ((select privado.eh_gestor()));

-- Acesso de leitura ao Drive de cada pessoa (concedido por ela mesma). Fora da API.
create table privado.google_drive_tokens (
  perfil_id uuid primary key references public.perfis (id) on delete cascade,
  refresh_token text not null,
  access_token text,
  expira_em timestamptz,
  atualizado_em timestamptz not null default now()
);
revoke all on privado.google_drive_tokens from public, anon, authenticated;

create or replace function public.guardar_google_drive(p_refresh text, p_access text, p_expira timestamptz)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then raise exception 'Sessão expirada.'; end if;
  if p_refresh is not null then
    insert into privado.google_drive_tokens (perfil_id, refresh_token, access_token, expira_em)
    values ((select auth.uid()), p_refresh, p_access, p_expira)
    on conflict (perfil_id) do update
      set refresh_token = excluded.refresh_token, access_token = excluded.access_token,
          expira_em = excluded.expira_em, atualizado_em = now();
  else
    update privado.google_drive_tokens
       set access_token = p_access, expira_em = p_expira, atualizado_em = now()
     where perfil_id = (select auth.uid());
  end if;
end;
$$;

create or replace function public.meu_google_drive()
returns table (refresh_token text, access_token text, expira_em timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select refresh_token, access_token, expira_em from privado.google_drive_tokens
  where perfil_id = (select auth.uid());
$$;

create or replace function public.desconectar_google_drive()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from privado.google_drive_tokens where perfil_id = (select auth.uid());
$$;

revoke execute on function public.guardar_google_drive(text, text, timestamptz) from public, anon;
revoke execute on function public.meu_google_drive() from public, anon;
revoke execute on function public.desconectar_google_drive() from public, anon;
grant execute on function public.guardar_google_drive(text, text, timestamptz) to authenticated;
grant execute on function public.meu_google_drive() to authenticated;
grant execute on function public.desconectar_google_drive() to authenticated;

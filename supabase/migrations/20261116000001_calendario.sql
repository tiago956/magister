-- Calendário escolar: eventos, turmas envolvidas e link de assinatura (ICS) por pessoa.

create type public.tipo_evento as enum ('avaliacao', 'evento', 'reuniao', 'feriado', 'recesso', 'letivo');

create table public.eventos (
  id integer generated always as identity primary key,
  titulo text not null check (length(btrim(titulo)) between 1 and 160),
  tipo public.tipo_evento not null,
  descricao text check (descricao is null or length(descricao) <= 2000),
  data_inicio date not null,
  data_fim date not null,
  hora_inicio time,
  hora_fim time,
  suspende_aulas boolean not null default false,
  disciplina_id smallint references public.disciplinas (id) on delete set null,
  criado_por uuid references public.perfis (id) on delete set null default auth.uid(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint eventos_periodo check (data_fim >= data_inicio and data_fim - data_inicio <= 366),
  constraint eventos_horario check (
    (hora_inicio is null and hora_fim is null)
    or (hora_inicio is not null and hora_fim is not null and hora_fim > hora_inicio)
  )
);

create index eventos_periodo_idx on public.eventos (data_inicio, data_fim);

-- Sem linhas aqui, o evento vale para a escola toda.
create table public.evento_turmas (
  evento_id integer not null references public.eventos (id) on delete cascade,
  turma_id smallint not null references public.turmas (id) on delete cascade,
  primary key (evento_id, turma_id)
);

create index evento_turmas_turma_idx on public.evento_turmas (turma_id);

-- Quem pode agendar: coordenação, direção e secretaria.
create or replace function privado.pode_agendar()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.perfis
    where id = (select auth.uid()) and ativo and papel in ('coordenacao', 'direcao', 'secretaria')
  );
$$;

revoke execute on function privado.pode_agendar() from public, anon;
grant execute on function privado.pode_agendar() to authenticated;

create or replace function public.carimbar_evento()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.atualizado_em := now();
  if tg_op = 'INSERT' then
    new.criado_por := (select auth.uid());
  else
    new.criado_por := old.criado_por;
    new.criado_em := old.criado_em;
  end if;
  return new;
end;
$$;

revoke execute on function public.carimbar_evento() from public, anon, authenticated;

create trigger carimbar_evento
before insert or update on public.eventos
for each row execute function public.carimbar_evento();

alter table public.eventos enable row level security;
alter table public.evento_turmas enable row level security;

create policy "equipe lê eventos" on public.eventos for select to authenticated using (true);
create policy "agenda insere eventos" on public.eventos for insert to authenticated with check ((select privado.pode_agendar()));
create policy "agenda altera eventos" on public.eventos for update to authenticated
  using ((select privado.pode_agendar())) with check ((select privado.pode_agendar()));
create policy "agenda remove eventos" on public.eventos for delete to authenticated using ((select privado.pode_agendar()));

create policy "equipe lê turmas do evento" on public.evento_turmas for select to authenticated using (true);
create policy "agenda insere turmas do evento" on public.evento_turmas for insert to authenticated with check ((select privado.pode_agendar()));
create policy "agenda remove turmas do evento" on public.evento_turmas for delete to authenticated using ((select privado.pode_agendar()));

-- Link pessoal de assinatura. Fica fora da API para que ninguém leia o link de outra pessoa.
create table privado.tokens_agenda (
  perfil_id uuid primary key references public.perfis (id) on delete cascade,
  token uuid not null unique default gen_random_uuid(),
  criado_em timestamptz not null default now()
);

revoke all on privado.tokens_agenda from public, anon, authenticated;

-- Devolve (e cria, na primeira vez) o link de quem está logado.
create or replace function public.meu_token_agenda()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'Sessão expirada.';
  end if;
  insert into privado.tokens_agenda (perfil_id) values ((select auth.uid()))
  on conflict (perfil_id) do nothing;
  select token into v from privado.tokens_agenda where perfil_id = (select auth.uid());
  return v;
end;
$$;

-- Troca o link (o anterior deixa de funcionar).
create or replace function public.renovar_token_agenda()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'Sessão expirada.';
  end if;
  insert into privado.tokens_agenda (perfil_id) values ((select auth.uid()))
  on conflict (perfil_id) do update set token = gen_random_uuid(), criado_em = now()
  returning token into v;
  return v;
end;
$$;

revoke execute on function public.meu_token_agenda() from public, anon;
grant execute on function public.meu_token_agenda() to authenticated;
revoke execute on function public.renovar_token_agenda() from public, anon;
grant execute on function public.renovar_token_agenda() to authenticated;

-- Eventos de um link de assinatura. Professores recebem os eventos da escola toda
-- e os das turmas em que dão aula; coordenação, direção e secretaria recebem todos.
create or replace function public.agenda_do_token(p_token uuid)
returns table (
  id integer,
  titulo text,
  tipo public.tipo_evento,
  descricao text,
  data_inicio date,
  data_fim date,
  hora_inicio time,
  hora_fim time,
  suspende_aulas boolean,
  turmas text,
  atualizado_em timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  with dono as (
    select p.id, p.papel
    from privado.tokens_agenda t
    join public.perfis p on p.id = t.perfil_id
    where t.token = p_token and p.ativo
  )
  select e.id, e.titulo, e.tipo, e.descricao, e.data_inicio, e.data_fim, e.hora_inicio, e.hora_fim,
         e.suspende_aulas,
         (select string_agg(tu.nome, ', ' order by tu.ordem)
            from public.evento_turmas et join public.turmas tu on tu.id = et.turma_id
           where et.evento_id = e.id),
         e.atualizado_em
  from public.eventos e, dono
  where dono.papel <> 'professor'
     or not exists (select 1 from public.evento_turmas et where et.evento_id = e.id)
     or exists (
       select 1 from public.evento_turmas et
       join public.atribuicoes a on a.turma_id = et.turma_id
       where et.evento_id = e.id and a.professor_id = dono.id
     )
  order by e.data_inicio, e.hora_inicio nulls first, e.id;
$$;

revoke execute on function public.agenda_do_token(uuid) from public;
grant execute on function public.agenda_do_token(uuid) to anon, authenticated;

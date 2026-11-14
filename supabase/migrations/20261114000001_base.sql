-- =============================================================
-- Magister · Base do banco de dados
-- Perfis, turmas, disciplinas, grade horária e atribuições.
-- =============================================================

-- Tipos -------------------------------------------------------

create type public.papel as enum ('professor', 'coordenacao', 'direcao', 'secretaria');

create type public.perfil_docente as enum ('regente', 'especialista');

create type public.segmento as enum ('infantil', 'fundamental');

create type public.modelo_aula as enum (
  'sete_momentos',    -- Fundamental (inclui Inglês, Latim e Bíblia)
  'quatro_momentos',  -- Infantil (todas as disciplinas) e Educação Física
  'artes_musica',     -- Artes e Música
  'leitura'           -- Leitura (literatura infantil): só livro e páginas
);

-- Perfis (um por conta Google da escola) ----------------------

create table public.perfis (
  id uuid primary key references auth.users (id) on delete cascade,
  nome text not null,
  email text not null unique,
  papel public.papel not null default 'professor',
  perfil_docente public.perfil_docente,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

comment on table public.perfis is 'Pessoas da equipe. Criado automaticamente no primeiro login.';

-- Turmas -------------------------------------------------------

create table public.turmas (
  id smallint generated always as identity primary key,
  codigo text not null unique,          -- INF4, INF5, 1EFI ... 5EFI
  nome text not null,                   -- Infantil 4, 1º ano ...
  segmento public.segmento not null,
  duracao_aula_min smallint not null,   -- 40 no Infantil, 45 no Fundamental
  ordem smallint not null,
  ano_letivo smallint not null default 2027
);

-- Disciplinas --------------------------------------------------

create table public.disciplinas (
  id smallint generated always as identity primary key,
  nome text not null unique,
  do_regente boolean not null,          -- true: professor da turma; false: especialista
  modelo_fundamental public.modelo_aula not null,
  modelo_infantil public.modelo_aula not null,
  ordem smallint not null
);

-- Grade horária ------------------------------------------------
-- Cada linha é um horário de uma turma. Aulas têm disciplina;
-- momentos sem plano (Assembly, Intervalo, Parque, Brinquedo,
-- Projetos) têm apenas um rótulo.

create table public.grade_horaria (
  id integer generated always as identity primary key,
  turma_id smallint not null references public.turmas (id) on delete cascade,
  dia_semana smallint not null check (dia_semana between 1 and 5), -- 1 = segunda
  inicio time not null,
  fim time not null check (fim > inicio),
  disciplina_id smallint references public.disciplinas (id),
  rotulo text,
  unique (turma_id, dia_semana, inicio),
  check ((disciplina_id is null) <> (rotulo is null))
);

create index grade_horaria_turma_idx on public.grade_horaria (turma_id, dia_semana);
create index grade_horaria_disciplina_idx on public.grade_horaria (disciplina_id);

-- Atribuições --------------------------------------------------
-- Qual professor responde por qual disciplina em qual turma.
-- Uma disciplina por turma tem um único professor.

create table public.atribuicoes (
  id integer generated always as identity primary key,
  professor_id uuid not null references public.perfis (id) on delete cascade,
  turma_id smallint not null references public.turmas (id) on delete cascade,
  disciplina_id smallint not null references public.disciplinas (id) on delete cascade,
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid references public.perfis (id),
  unique (turma_id, disciplina_id)
);

create index atribuicoes_professor_idx on public.atribuicoes (professor_id);
create index atribuicoes_disciplina_idx on public.atribuicoes (disciplina_id);
create index atribuicoes_atualizado_por_idx on public.atribuicoes (atualizado_por);

-- Funções auxiliares -------------------------------------------

-- Coordenação e direção administram o sistema.
create or replace function public.eh_gestor()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.perfis
    where id = (select auth.uid())
      and ativo
      and papel in ('coordenacao', 'direcao')
  );
$$;

-- Modelo de aula de uma disciplina numa turma.
create or replace function public.modelo_da_aula(p_segmento public.segmento, p_disciplina_id smallint)
returns public.modelo_aula
language sql
stable
set search_path = ''
as $$
  select case when p_segmento = 'infantil' then d.modelo_infantil else d.modelo_fundamental end
  from public.disciplinas d
  where d.id = p_disciplina_id;
$$;

-- Primeiro login: só contas do domínio da escola entram.
create or replace function public.ao_criar_usuario()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if lower(split_part(new.email, '@', 2)) <> 'trinitasvillabranca.com.br' then
    raise exception 'Acesso restrito às contas da Trinitas.';
  end if;

  insert into public.perfis (id, nome, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    lower(new.email)
  );
  return new;
end;
$$;

create trigger ao_criar_usuario
  after insert on auth.users
  for each row execute function public.ao_criar_usuario();

-- Marca data e autor de cada mudança de atribuição.
create or replace function public.carimbar_atribuicao()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.atualizado_em := now();
  new.atualizado_por := auth.uid();
  return new;
end;
$$;

create trigger carimbar_atribuicao
  before insert or update on public.atribuicoes
  for each row execute function public.carimbar_atribuicao();

-- Visão das aulas da semana -----------------------------------
-- Junta grade, turma, disciplina, modelo e professor atribuído.

create view public.aulas_semanais
with (security_invoker = true)
as
select
  g.id as grade_id,
  g.dia_semana,
  g.inicio,
  g.fim,
  t.id as turma_id,
  t.nome as turma,
  t.codigo as turma_codigo,
  t.segmento,
  t.ordem as turma_ordem,
  d.id as disciplina_id,
  d.nome as disciplina,
  public.modelo_da_aula(t.segmento, d.id) as modelo,
  a.professor_id
from public.grade_horaria g
join public.turmas t on t.id = g.turma_id
join public.disciplinas d on d.id = g.disciplina_id
left join public.atribuicoes a on a.turma_id = g.turma_id and a.disciplina_id = g.disciplina_id;

-- Regras de acesso (RLS) ---------------------------------------

alter table public.perfis enable row level security;
alter table public.turmas enable row level security;
alter table public.disciplinas enable row level security;
alter table public.grade_horaria enable row level security;
alter table public.atribuicoes enable row level security;

-- Toda a equipe autenticada pode ler os cadastros.
create policy "equipe lê perfis" on public.perfis for select to authenticated using (true);
create policy "equipe lê turmas" on public.turmas for select to authenticated using (true);
create policy "equipe lê disciplinas" on public.disciplinas for select to authenticated using (true);
create policy "equipe lê grade" on public.grade_horaria for select to authenticated using (true);
create policy "equipe lê atribuições" on public.atribuicoes for select to authenticated using (true);

-- Só a gestão (coordenação e direção) altera.
create policy "gestão altera perfis" on public.perfis for update to authenticated
  using ((select public.eh_gestor())) with check ((select public.eh_gestor()));

create policy "gestão insere turmas" on public.turmas for insert to authenticated with check ((select public.eh_gestor()));
create policy "gestão altera turmas" on public.turmas for update to authenticated using ((select public.eh_gestor())) with check ((select public.eh_gestor()));
create policy "gestão remove turmas" on public.turmas for delete to authenticated using ((select public.eh_gestor()));

create policy "gestão insere disciplinas" on public.disciplinas for insert to authenticated with check ((select public.eh_gestor()));
create policy "gestão altera disciplinas" on public.disciplinas for update to authenticated using ((select public.eh_gestor())) with check ((select public.eh_gestor()));
create policy "gestão remove disciplinas" on public.disciplinas for delete to authenticated using ((select public.eh_gestor()));

create policy "gestão insere grade" on public.grade_horaria for insert to authenticated with check ((select public.eh_gestor()));
create policy "gestão altera grade" on public.grade_horaria for update to authenticated using ((select public.eh_gestor())) with check ((select public.eh_gestor()));
create policy "gestão remove grade" on public.grade_horaria for delete to authenticated using ((select public.eh_gestor()));

create policy "gestão insere atribuições" on public.atribuicoes for insert to authenticated with check ((select public.eh_gestor()));
create policy "gestão altera atribuições" on public.atribuicoes for update to authenticated using ((select public.eh_gestor())) with check ((select public.eh_gestor()));
create policy "gestão remove atribuições" on public.atribuicoes for delete to authenticated using ((select public.eh_gestor()));

-- Funções expostas apenas a quem está logado.
revoke execute on function public.eh_gestor() from public, anon;
grant execute on function public.eh_gestor() to authenticated;
revoke execute on function public.modelo_da_aula(public.segmento, smallint) from public, anon;
grant execute on function public.modelo_da_aula(public.segmento, smallint) to authenticated;
revoke execute on function public.ao_criar_usuario() from public, anon, authenticated;

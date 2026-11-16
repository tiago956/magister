-- Uma pessoa pode ter várias funções (ex.: coordenação e professor).
-- "funcoes" é a fonte da verdade; "papel" passa a ser a função principal, calculada.

alter table public.perfis add column funcoes public.papel[] not null default '{professor}';
update public.perfis set funcoes = array[papel];
alter table public.perfis add constraint perfis_funcoes check (cardinality(funcoes) between 1 and 4);

create or replace function public.ajustar_funcoes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_quem uuid := (select auth.uid());
begin
  -- Compatibilidade: quem alterar só "papel" troca as funções por essa única.
  if tg_op = 'UPDATE' and new.papel is distinct from old.papel and new.funcoes = old.funcoes then
    new.funcoes := array[new.papel];
  end if;

  new.funcoes := (select array_agg(distinct f order by f) from unnest(new.funcoes) f);
  if new.funcoes is null or cardinality(new.funcoes) = 0 then
    raise exception 'Marque ao menos uma função.';
  end if;

  new.papel := case
    when 'direcao' = any (new.funcoes) then 'direcao'
    when 'coordenacao' = any (new.funcoes) then 'coordenacao'
    when 'secretaria' = any (new.funcoes) then 'secretaria'
    else 'professor' end::public.papel;

  if tg_op = 'UPDATE' and ('direcao' = any (new.funcoes)) <> ('direcao' = any (old.funcoes)) then
    -- Só a direção concede ou retira a função Direção (alterações diretas no banco, sem usuário, são permitidas).
    if v_quem is not null and not exists (
      select 1 from public.perfis where id = v_quem and ativo and 'direcao' = any (funcoes)
    ) then
      raise exception 'Só a direção pode conceder ou retirar a função Direção.';
    end if;
    -- Nunca deixar a escola sem nenhum diretor ativo.
    if not ('direcao' = any (new.funcoes)) and not exists (
      select 1 from public.perfis where id <> old.id and ativo and 'direcao' = any (funcoes)
    ) then
      raise exception 'É preciso manter ao menos uma pessoa na direção.';
    end if;
  end if;
  return new;
end;
$$;

revoke execute on function public.ajustar_funcoes() from public, anon, authenticated;

create trigger ajustar_funcoes
before insert or update of funcoes, papel on public.perfis
for each row execute function public.ajustar_funcoes();

-- Regras de acesso passam a olhar todas as funções da pessoa.
create or replace function privado.eh_gestor()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.perfis
    where id = (select auth.uid()) and ativo and funcoes && array['coordenacao', 'direcao']::public.papel[]
  );
$$;

create or replace function privado.pode_agendar()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.perfis
    where id = (select auth.uid()) and ativo and funcoes && array['coordenacao', 'direcao', 'secretaria']::public.papel[]
  );
$$;

create or replace function privado.curso_e_para(p_curso integer, p_perfil uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.cursos c join public.perfis p on p.id = p_perfil
    where c.id = p_curso and p.ativo and (
      c.publico = 'todos'
      or (c.publico = 'papeis' and c.papeis && p.funcoes)
      or (c.publico = 'pessoas' and exists (
            select 1 from public.curso_pessoas cp where cp.curso_id = c.id and cp.perfil_id = p.id))
    )
  );
$$;

create or replace function privado.ve_pasta(p_pasta integer)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.pastas_drive pd
    join public.perfis p on p.id = (select auth.uid()) and p.ativo
    where pd.id = p_pasta
      and (
        'direcao' = any (p.funcoes)
        or (
          (cardinality(pd.papeis) = 0 or pd.papeis && p.funcoes)
          and (cardinality(pd.turmas) = 0 or exists (
                select 1 from public.atribuicoes a where a.professor_id = p.id and a.turma_id = any (pd.turmas)))
          and (cardinality(pd.disciplinas) = 0 or exists (
                select 1 from public.atribuicoes a where a.professor_id = p.id and a.disciplina_id = any (pd.disciplinas)))
        )
      )
  );
$$;

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
language sql stable security definer set search_path = ''
as $$
  with dono as (
    select p.id, p.funcoes
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
  where dono.funcoes && array['coordenacao', 'direcao', 'secretaria']::public.papel[]
     or not exists (select 1 from public.evento_turmas et where et.evento_id = e.id)
     or exists (
       select 1 from public.evento_turmas et
       join public.atribuicoes a on a.turma_id = et.turma_id
       where et.evento_id = e.id and a.professor_id = dono.id
     )
  order by e.data_inicio, e.hora_inicio nulls first, e.id;
$$;

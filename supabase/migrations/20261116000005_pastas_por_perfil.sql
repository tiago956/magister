-- Só a direção vê todas as pastas; coordenação e demais seguem as regras de cada pasta.
create or replace function privado.ve_pasta(p_pasta integer)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.pastas_drive pd
    join public.perfis p on p.id = (select auth.uid()) and p.ativo
    where pd.id = p_pasta
      and (
        p.papel = 'direcao'
        or (
          (cardinality(pd.papeis) = 0 or p.papel = any (pd.papeis))
          and (cardinality(pd.turmas) = 0 or exists (
                select 1 from public.atribuicoes a where a.professor_id = p.id and a.turma_id = any (pd.turmas)))
          and (cardinality(pd.disciplinas) = 0 or exists (
                select 1 from public.atribuicoes a where a.professor_id = p.id and a.disciplina_id = any (pd.disciplinas)))
        )
      )
  );
$$;

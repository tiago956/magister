-- =============================================================
-- Magister · Modelo padrão de plano de aula
-- Estrutura da Classical Press (Faça Agora, Nosso objetivo hoje,
-- Estratégias, Quick Check, Fechamento) com o Catecismo na abertura.
-- Vale para todas as matérias, exceto Música, Educação Física e Leitura.
-- =============================================================

alter type public.modelo_aula add value if not exists 'padrao';

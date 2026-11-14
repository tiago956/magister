# Magister

Sistema pedagógico da **Trinitas Escola Cristã Clássica** (unidade Jacareí): planos de aula, revisão pela coordenação, calendário pedagógico, atribuições de turmas e matérias e acesso aos materiais do Drive.

Endereço previsto: **magister.trinitasvillabranca.com.br**

## O que já está pronto (etapa 1: base)

- Login com a conta Google da escola. Contas de fora do domínio `trinitasvillabranca.com.br` são recusadas pelo banco de dados.
- Banco de dados com turmas, matérias, grade horária de 2027 e atribuições, com regras de acesso: toda a equipe lê, só coordenação e direção alteram.
- **Painel**: cada professor vê as suas aulas da semana, com o modelo de aula de cada uma.
- **Atribuições** (coordenação e direção): atribuir regente (uma turma, várias matérias) ou especialista (uma matéria, várias turmas), grade semanal por turma, quadro de cobertura e papéis de acesso da equipe.

Próximas etapas: editor de planos de aula, revisão, calendário sincronizado, Drive e avisos no Slack.

## Tecnologia

- [Next.js](https://nextjs.org) 16 (App Router) e TypeScript
- [Supabase](https://supabase.com): banco Postgres, login e regras de acesso (RLS)
- Tailwind CSS 4, na identidade do Manual de Identidade Visual da Trinitas

## Como colocar para funcionar

### 1. Banco de dados (Supabase)

No painel do Supabase, abra **SQL Editor** e execute, nesta ordem, o conteúdo dos arquivos:

1. `supabase/migrations/20261114000001_base.sql` (tabelas, regras de acesso e restrição de domínio)
2. `supabase/migrations/20261114000002_dados_iniciais.sql` (7 turmas, 12 matérias e a grade semanal)

### 2. Login com Google

**No Google Cloud** (com a conta administradora do Google Workspace da escola):

1. Crie um projeto chamado *Magister*.
2. Em **APIs e serviços → Tela de permissão OAuth**, escolha o tipo **Interno** (só contas da escola).
3. Em **Credenciais → Criar credenciais → ID do cliente OAuth**, tipo **Aplicativo da Web**.
4. Em **URIs de redirecionamento autorizados**, coloque `https://SEU-PROJETO.supabase.co/auth/v1/callback`.
5. Guarde o **ID do cliente** e a **chave secreta do cliente**.

**No Supabase**:

1. **Authentication → Sign In / Providers → Google**: ative e cole o ID e a chave secreta do cliente.
2. **Authentication → URL Configuration**:
   - *Site URL*: `https://magister.trinitasvillabranca.com.br` (ou `http://localhost:3000` enquanto testa)
   - *Redirect URLs*: `http://localhost:3000/**` e `https://magister.trinitasvillabranca.com.br/**`

### 3. Primeiro acesso da direção

Depois do seu primeiro login, rode no SQL Editor (trocando o e-mail):

```sql
update public.perfis set papel = 'direcao' where email = 'seu-email@trinitasvillabranca.com.br';
```

A partir daí, os papéis da equipe (professor, coordenação, direção, secretaria) são alterados pela tela de Atribuições.

### 4. Rodar no computador (opcional)

```bash
cp .env.example .env.local   # preencha com a Project URL e a chave anon do Supabase
npm install
npm run dev                  # abre em http://localhost:3000
```

### 5. Publicar

A publicação prevista é na Vercel, apontando o subdomínio `magister.trinitasvillabranca.com.br` por DNS. As variáveis de ambiente são as mesmas do `.env.example`. **Nunca** coloque a chave `service_role` no código nem no GitHub.

## Organização do código

```
src/
  app/
    login/              página de entrada (botão Google)
    auth/callback/      retorno do Google
    auth/sair/          encerrar sessão
    (sistema)/          área logada: painel, atribuições e próximos módulos
  lib/
    supabase/           clientes do Supabase e renovação da sessão
    dados.ts            tipos, nomes e funções comuns
  proxy.ts              protege as rotas e renova a sessão
supabase/migrations/    estrutura e dados iniciais do banco
```

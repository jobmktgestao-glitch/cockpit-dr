# 🟠 COCKPIT FINANCEIRO — DR MARKETING
### Guia de publicação (Supabase + GitHub + Netlify)

Este é um app **separado** do Cockpit da Escalada. Dados, login e site são independentes.

---

## PARTE 1 — SUPABASE

Você pode **reaproveitar o mesmo projeto Supabase** do outro cockpit (mais simples) ou criar um novo.
A tabela é diferente (`dr_state`), então não há risco de misturar os dados.

1. Acesse o projeto no Supabase → **SQL Editor** → **New query**
2. Cole todo o conteúdo do arquivo **`supabase.sql`** deste projeto → **Run**
3. Deve aparecer "Success. No rows returned"
4. Se for um projeto NOVO do Supabase:
   - **Authentication → Users → Add user** → seu e-mail + senha → marque **Auto Confirm User**
   - **Authentication → Sign In / Providers → Email** → desative **"Allow new users to sign up"**
5. **Project Settings → API Keys** → anote a **Project URL** e a **anon public key**

---

## PARTE 2 — GITHUB

1. Acesse **github.com/new**
2. Nome: `cockpit-dr` → **Private** ✅ → **Create repository**
3. Na tela do repositório vazio, clique em **"uploading an existing file"**
4. Descompacte o zip e arraste **o conteúdo** da pasta (arquivos soltos + as **pastas** `src` e `netlify`)
5. **Commit changes**

⚠️ Arraste as PASTAS `src` e `netlify` inteiras — não entre nelas para pegar os arquivos.

---

## PARTE 3 — NETLIFY

1. **app.netlify.com → Add new site → Import an existing project**
2. Conecte o GitHub → escolha **cockpit-dr**
3. Em **Environment variables**, adicione:

| Key | Value |
|---|---|
| `VITE_SUPABASE_URL` | Project URL do Supabase |
| `VITE_SUPABASE_ANON_KEY` | anon public key |
| `ANTHROPIC_API_KEY` | sua chave da API (para o chat) |

4. **Deploy site**
5. Em **Site configuration → Change site name**, coloque algo como `cockpitdr`
   → fica `https://cockpitdr.netlify.app`

---

## PARTE 4 — PRIMEIRO USO

1. Entre com e-mail/senha
2. Aba **Bancos**: cadastre as contas da DR e os saldos de abertura
3. Aba **Config**: lance receitas e despesas (use 🔁 Mensal para recorrentes)
4. Ou use o chat **Falar com o Claude** em Config e mande tudo de uma vez

### Categorias já cadastradas
- **Receitas:** Escalada no Digital, Plano 45, Consultoria e Mentoria, Trade Marketing, IA para Executivos, Palestras/Workshops, Outros
- **Despesas:** Ferramentas, Fornecedor, Equipe, Marketing, Impostos, Repasse Job, Escritório, Eventos, Diversos

O horizonte é de **12 meses rolantes** a partir do mês atual — sempre atualizado sozinho.

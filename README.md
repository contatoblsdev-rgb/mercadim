# Mercadim

PWA de notas fiscais de mercado: registre o cupom, acompanhe o preço de cada produto, compare mercados, monte a lista da próxima compra com a família e veja quanto gastou no mês.

- **Front-end:** HTML, CSS e JavaScript puros, sem etapa de build. Publica direto do GitHub no Cloudflare Pages.
- **Back-end:** Supabase (login com Google, banco Postgres com regras de acesso por usuário, tempo real para a lista).
- **QR Code da NFC-e:** lido no próprio celular (jsQR), sem custo.

## Estrutura

| Arquivo | O que é |
|---|---|
| `index.html` | Telas do app (entrada, app, abas) |
| `styles.css` | Visual (claro e escuro) |
| `app.js` | Toda a lógica do app |
| `config.js` | URL e chave pública do Supabase |
| `sw.js` | Service worker (instalação e uso sem internet) |
| `manifest.webmanifest` + `icons/` | Dados do app instalado |
| `_headers` | Cabeçalhos do Cloudflare (evita cache velho do app) |
| `supabase/schema.sql` | Tabelas, regras de acesso e funções do banco |

## Configuração (uma vez)

### 1. Supabase
1. Crie o projeto `mercadim` (plano gratuito, região São Paulo).
2. Abra **SQL Editor**, cole todo o conteúdo de `supabase/schema.sql` e clique em **Run**.
3. Em **Project Settings → API**, copie a **Project URL** e a **anon public key** para o `config.js`.

### 2. Login com Google
1. No Google Cloud Console (pode ser o mesmo projeto do EloFit), vá em **APIs e serviços → Credenciais → Criar credenciais → ID do cliente OAuth → Aplicativo da Web**.
2. Em **URIs de redirecionamento autorizados**, coloque: `https://SEU-PROJETO.supabase.co/auth/v1/callback`
3. Copie o **ID do cliente** e a **Chave secreta**.
4. No Supabase: **Authentication → Sign In / Providers → Google**, ative e cole o ID e a chave.
5. No Supabase: **Authentication → URL Configuration**:
   - **Site URL:** o endereço do app (ex.: `https://mercadim.pages.dev`)
   - **Redirect URLs:** o mesmo endereço com `/**` no final (ex.: `https://mercadim.pages.dev/**`)

### 3. Cloudflare Pages
1. **Workers & Pages → Create → Pages → Connect to Git** e escolha o repositório `mercadim`.
2. **Framework preset:** None. **Build command:** em branco. **Build output directory:** `/`
3. Salve. Cada push na `main` publica sozinho.
4. Se quiser um domínio próprio, adicione em **Custom domains** e atualize a Site URL do Supabase.

## Como a lista compartilhada funciona
- Cada pessoa entra com a própria conta Google. As **notas e gastos são só de quem registrou**.
- A **lista de compras é da casa**. Em **Conta** (foto no alto) aparece o código de 6 letras da sua casa. A outra pessoa abre Conta, digita o código e passa a ver e editar a mesma lista, ao vivo.

## Atualizar o app
Edite os arquivos e faça push. Se mudar algum arquivo que fica guardado no celular, aumente a versão em `sw.js` (`mercadim-v1` → `mercadim-v2`) para os celulares pegarem a versão nova na hora.

## Próximos passos possíveis
- Leitura automática dos itens pela foto (Claude API via Supabase Edge Function, com a chave guardada no servidor).

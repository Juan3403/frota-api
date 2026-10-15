# Frota API

API REST para controle de **multas** e **vencimentos de documentos** (CRLV de veículos e CNH de motoristas) de uma frota. Os dados de exemplo são fictícios.

**Stack:** TypeScript, Fastify, PostgreSQL, OpenAPI (Swagger UI), Vitest, Docker, GitHub Actions.

## Decisões de projeto

- **Validação por JSON Schema (TypeBox):** os mesmos schemas validam a entrada, tipam o código e geram a documentação OpenAPI.
- **SQL direto com `pg`:** consultas parametrizadas, sem ORM, atrás de uma interface `Db` de um único método.
- **Testes sem Docker:** a interface `Db` permite trocar o `pg` pelo PGlite (PostgreSQL em WASM), então os testes rodam o SQL real do Postgres em qualquer máquina e no CI.
- **Autenticação JWT com papéis:** `admin` lê e escreve; `leitor` só consulta. Senhas guardadas com `scrypt` (sem dependência extra) e login que não revela se o e-mail existe.
- **Erros do banco viram HTTP coerente:** duplicado vira `409`, referência inexistente vira `422` e validação vira `400`.

## Rodar com Docker

```bash
cp .env.example .env        # defina JWT_SECRET (32+ caracteres) e, se quiser, ADMIN_EMAIL/ADMIN_PASSWORD
docker compose up --build   # portas: API 3100, Postgres 5433 (mude com API_PORT e DB_PORT)
```

API em http://localhost:3100 e documentação interativa em http://localhost:3100/docs.

## Rodar localmente

```bash
cp .env.example .env     # ajuste DATABASE_URL
npm install
npm run dev
```

## Testes

```bash
npm test
```

## Autenticação

Todas as rotas exigem `Authorization: Bearer <token>`, exceto `/health`, `/auth/login` e `/docs`.

```bash
# 1. o primeiro admin é criado no boot a partir de ADMIN_EMAIL/ADMIN_PASSWORD (se não houver usuários)
# 2. login
curl -X POST localhost:3100/auth/login -H 'Content-Type: application/json'   -d '{"email":"admin@exemplo.com","senha":"sua-senha"}'
# 3. use o token retornado (vale 8h)
curl localhost:3100/vehicles -H "Authorization: Bearer $TOKEN"
```

No Swagger UI (`/docs`), use **Authorize** e cole o token.

## Endpoints

| Método | Rota | Descrição |
|---|---|---|
| POST | `/auth/login` | Retorna o token JWT (público) |
| POST | `/users` | Cria usuário `admin` ou `leitor` (só admin) |
| GET/POST | `/vehicles` | Lista (paginada) e cria veículos |
| GET/PUT/DELETE | `/vehicles/:id` | Consulta, atualiza e remove |
| GET/POST | `/drivers` | Lista (paginada) e cria motoristas |
| GET/DELETE | `/drivers/:id` | Consulta e remove |
| GET/POST | `/fines` | Lista (filtros `status`, `vehicle_id`) e cria multas |
| PATCH | `/fines/:id/status` | `aberta`, `paga` ou `recorrida` |
| GET | `/fines/summary` | Quantidade e total por status |
| GET | `/vencimentos?dias=30` | CRLV e CNH vencidos ou a vencer em até N dias |
| GET | `/health` | Verificação de saúde |

As listagens `/vehicles`, `/drivers` e `/fines` aceitam `?limit=` (1–200, padrão 50) e `?offset=`; o total vem no header `X-Total-Count`.

## Próximos passos

- Notificação de vencimentos por e-mail

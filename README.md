# Frota API

API REST para controle de **multas** e **vencimentos de documentos** (CRLV de veículos e CNH de motoristas) de uma frota. Os dados de exemplo são fictícios.

**Stack:** TypeScript, Fastify, PostgreSQL, OpenAPI (Swagger UI), Vitest, Docker, GitHub Actions.

## Decisões de projeto

- **Validação por JSON Schema (TypeBox):** os mesmos schemas validam a entrada, tipam o código e geram a documentação OpenAPI.
- **SQL direto com `pg`:** consultas parametrizadas, sem ORM, atrás de uma interface `Db` de um único método.
- **Testes sem Docker:** a interface `Db` permite trocar o `pg` pelo PGlite (PostgreSQL em WASM), então os testes rodam o SQL real do Postgres em qualquer máquina e no CI.
- **Erros do banco viram HTTP coerente:** duplicado vira `409`, referência inexistente vira `422` e validação vira `400`.

## Rodar com Docker

```bash
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

## Endpoints

| Método | Rota | Descrição |
|---|---|---|
| GET/POST | `/vehicles` | Lista e cria veículos |
| GET/PUT/DELETE | `/vehicles/:id` | Consulta, atualiza e remove |
| GET/POST | `/drivers` | Lista e cria motoristas |
| GET/DELETE | `/drivers/:id` | Consulta e remove |
| GET/POST | `/fines` | Lista (filtros `status`, `vehicle_id`) e cria multas |
| PATCH | `/fines/:id/status` | `aberta`, `paga` ou `recorrida` |
| GET | `/fines/summary` | Quantidade e total por status |
| GET | `/vencimentos?dias=30` | CRLV e CNH vencidos ou a vencer em até N dias |
| GET | `/health` | Verificação de saúde |

## Próximos passos

- Autenticação (JWT) e papéis
- Paginação nas listagens
- Notificação de vencimentos por e-mail

# Requisitos UX + IA

Protótipo de uma aplicação de captura e gestão de requisitos orientada por experiência do usuário e apoiada por inteligência artificial, pensada para equipes ágeis do serviço público. O modelo de referência tem três regras: a auditoria de usabilidade e acessibilidade acontece já na descoberta, um item só entra na sprint quando cada risco sinalizado tem tratamento registrado, e os vínculos de rastreabilidade sugeridos pela IA dependem da confirmação de uma pessoa.

Este repositório é um projeto pessoal de portfólio. Ele se inspira no modelo estudado em uma dissertação de mestrado, mas não faz parte dela e não deve ser apresentado como resultado dela. Todos os dados são fictícios.

## Situação

A fase 1 está pronta e cobre a base sobre a qual as demais regras serão construídas:

- esqueleto do monólito modular (NestJS, Drizzle e PostgreSQL no servidor; React, Vite e o Padrão Digital de Governo no cliente);
- porta `MotorDeIA` com dois adaptadores, um simulado e determinístico e outro para modelos locais servidos pelo Ollama;
- classificação de cada necessidade em quatro níveis (público, interno, restrito, sigiloso), sem a qual nenhuma chamada à IA sai, e guarda de roteamento que desvia insumo restrito ou sigiloso, e qualquer projeto com dados reais, para o motor local;
- entidade Sugestão: toda saída da IA é validada por esquema e fica pendente até que uma pessoa a aceite, edite ou recuse, informando o papel exercido (Product Owner, UX ou governança);
- registro de uso de IA com modelo, versão, versão do prompt, classificação da entrada, entrada, saída bruta, fontes citadas e decisão humana, somente de inclusão no próprio banco, filtrável por período, item, capacidade, provedor e decisão e exportável em CSV e JSON;
- primeira tarefa de IA, a proposta de história com papel, ação e benefício em campos separados, critérios Dado-Quando-Então, perfil e fontes, a partir de uma necessidade escrita em linguagem natural.

O mapeamento entre o que foi construído e os requisitos aprovados está em [docs/decisoes.md](docs/decisoes.md#requisitos-cobertos-na-fase-1).

A auditoria antecipada, o portão da Definition of Ready e a matriz de rastreabilidade vêm nas fases seguintes; o roteiro está em [docs/decisoes.md](docs/decisoes.md).

## Como rodar

É preciso ter Node 22, pnpm 10 e Docker.

```bash
pnpm install
docker compose up -d banco              # PostgreSQL com pgvector
cp .env.exemplo .env                     # ajuste se precisar
pnpm db:migrar
pnpm db:semear                           # carrega o cenário fictício da FUNCEP
pnpm dev:servidor                        # http://localhost:3000/api
pnpm dev:cliente                         # http://localhost:5173
```

Para usar um modelo local, suba o Ollama com `docker compose --profile local up -d ollama`, baixe um modelo (`docker compose exec ollama ollama pull llama3.1:8b`) e escolha "ollama" no seletor de motor da tela. Se o Ollama não responder, a tentativa fica registrada como sugestão inválida, com o erro, e nada entra no projeto.

## Testes

```bash
pnpm test                                # testes de unidade
DATABASE_URL_TESTE=postgres://requisitos:requisitos@localhost:5432/requisitos_teste pnpm test
```

Com `DATABASE_URL_TESTE` definida, os testes de integração apagam esse banco, aplicam as migrações e recarregam os dados fictícios antes de cada caso. Use um banco só para isso. A integração contínua roda tudo contra um PostgreSQL de serviço.

## Organização

```
apps/servidor/src
  motor-ia/      porta MotorDeIA, tarefas, adaptadores e guarda de roteamento
  sugestoes/     sugestões, decisão humana, registro de IA e exportação
  captura/       necessidades, perfis e histórias
  banco/         esquema Drizzle, migrações e carga dos dados fictícios
apps/cliente/src telas de captura e de registro de IA
dados-ficticios/ cenário da FUNCEP, município inventado de Pedra Clara
docs/            decisões de arquitetura e roteiro
```

## API da fase 1

| Método | Caminho | Uso |
|---|---|---|
| GET | `/api/saude` | motores e tarefas disponíveis |
| GET | `/api/projetos` | projetos |
| GET | `/api/projetos/:id/necessidades` | necessidades do projeto |
| POST | `/api/projetos/:id/necessidades` | registra necessidade (`textoOriginal`, `tipoOrigem` obrigatório, `classificacao` opcional) |
| PUT | `/api/necessidades/:id/classificacao` | `{"classificacao": "publico" \| "interno" \| "restrito" \| "sigiloso", "anonimizacaoConfirmada": bool}` |
| GET | `/api/projetos/:id/perfis` e `/historias` | perfis e histórias |
| POST | `/api/necessidades/:id/proposta-historia` | pede proposta à IA (corpo opcional `{"motor": "ollama"}`) |
| GET | `/api/sugestoes/:id` | sugestão com a chamada de IA que a gerou |
| POST | `/api/sugestoes/:id/decisao` | `{"decisao": "aceitar" \| "editar" \| "recusar", "pessoa": "...", "papel": "product_owner" \| "ux" \| "governanca", "conteudoEditado"?, "observacao"?}` |
| GET | `/api/registro-ia` | registro de uso de IA, com filtros `projeto`, `item`, `tarefa`, `provedor`, `situacao`, `de` e `ate` (AAAA-MM-DD) |
| GET | `/api/registro-ia/exportar?formato=csv` | exportação em CSV (ou `json`), com os mesmos filtros |

## Uso e propriedade intelectual

O código serve, por enquanto, apenas como protótipo e portfólio. Qualquer uso comercial depende de verificação prévia da política de propriedade intelectual da universidade e dos instrumentos de cooperação aplicáveis. Nenhum dado, tela ou documento de sistema real foi usado.

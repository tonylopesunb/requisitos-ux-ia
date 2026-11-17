# Decisões de arquitetura

As decisões abaixo foram aprovadas em 17/11/2026 e orientam todas as fases. Ficam registradas aqui para que quem chegue ao código entenda por que ele tem esta forma.

## Decisões aprovadas

1. Monólito modular, com cinco módulos de domínio: captura, auditoria antecipada, Definition of Ready, rastreabilidade e registro de IA. Os módulos conversam por serviços explícitos, de modo que uma separação futura seja possível sem reescrever as regras.
2. TypeScript de ponta a ponta. React, Vite e o Padrão Digital de Governo (DSGov) no cliente; NestJS, Drizzle e Zod no servidor; pg-boss para filas quando as chamadas de IA passarem a ser assíncronas.
3. PostgreSQL com a extensão pgvector, que será usada na fase de rastreabilidade para sugerir vínculos por semelhança.
4. Uma porta própria, `MotorDeIA`, com adaptadores trocáveis (simulado, Ollama e, mais adiante, um provedor em nuvem restrito a dados fictícios). Toda saída passa por um esquema Zod antes de virar sugestão.
5. Guarda de roteamento no servidor: projeto marcado com dados reais só pode usar adaptador local, e a recusa acontece antes de qualquer chamada.
6. Implantação com Docker Compose em uma única máquina.

A ideia que amarra as seis é a entidade Sugestão. Nada que a IA produza entra no domínio sem uma decisão humana, e é essa decisão que gera a linha do registro de uso de IA.

## Como a fase 1 aplica essas decisões

O serviço de sugestões chama o motor escolhido pelo roteador, valida a saída pelo esquema da tarefa e grava, numa só transação, a sugestão e a chamada que a produziu. Quando a saída não é JSON ou foge do esquema, a sugestão nasce como inválida: fica no registro, com a saída bruta e o erro, mas não pode ser aceita. A decisão humana exige a identificação de quem decidiu; na edição, o conteúdo editado passa pelo mesmo esquema, e só então o aplicador da tarefa grava o resultado no domínio (no caso da proposta de história, uma nova história com a origem `proposta_ia_aceita` ou `proposta_ia_editada`).

O registro histórico dos dados fictícios, com 26 entradas, é carregado como sugestões já decididas, para que a tela e a exportação tenham material desde o primeiro uso. As tarefas desse histórico que ainda não existem no código (auditoria, tratamento e vínculo) podem ser aceitas ou recusadas, mas não editadas, até que suas fases sejam implementadas.

## Requisitos cobertos na fase 1

A referência é o documento "Requisitos funcionais derivados do modelo de referência", aprovado em 17/11/2026, com 30 requisitos funcionais e 6 não funcionais. A fase 1 atende, no todo ou em parte, os itens abaixo.

| Requisito | Situação na fase 1 |
|---|---|
| RF-01 Registrar a necessidade | Atendido: texto livre, tipo de origem obrigatório, data e estado "nova". Os identificadores seguem o padrão NEC-xx dos dados fictícios, e não N-xx. |
| RF-02 Classificar o insumo | Atendido: sem classificação, ou com insumo restrito ou sigiloso sem anonimização confirmada, a chamada é bloqueada antes de sair. |
| RF-04 Propor história, critérios e perfil | Atendido sem a jornada (RF-03), que entra depois; papel, ação e benefício chegam separados e um campo vazio marca a história como incompleta. |
| RF-07 Revisar a especificação | Em parte: a sugestão é aceita, editada ou recusada como um todo, e o rascunho original fica guardado ao lado da versão editada; a revisão critério a critério fica para a fase 3. |
| RF-21 Atribuir decisões a papéis e pessoas | Em parte: cada decisão grava a pessoa e o papel exercido; ainda não há autenticação. |
| RF-27 Registrar cada chamada à IA | Atendido, inclusive classificação da entrada e fontes citadas. |
| RF-28 Consultar e exportar o registro | Atendido: filtros por período, item, capacidade, provedor e decisão, aplicados também à exportação. |
| RF-29 Indicar a proveniência do texto | Atendido para a história (aceita, editada ou autoria humana). |
| RF-30 Trocar o provedor e rotear pela classificação | Atendido com os adaptadores simulado e Ollama; o de nuvem entra na fase 5. |
| RNF-01 Interface única de inferência | Atendido pela porta `MotorDeIA`. |
| RNF-03 Somente dados fictícios | Atendido; a carga usa o cenário da FUNCEP e o validador do conjunto roda na integração contínua. |
| RNF-04 Registro somente de inclusão | Atendido no banco por gatilhos: a chamada não muda nem é apagada, e a sugestão só muda uma vez, de pendente para decidida. |
| RNF-06 Português do Brasil | Atendido nas telas, mensagens e documentação. |

O RNF-02 (funcionar com a IA desligada) e o RNF-05 (a própria aplicação em WCAG 2.2 AA e eMAG) orientam as fases seguintes; as telas da fase 1 já usam rótulos, foco visível e regiões de aviso, mas ainda não passaram por auditoria.

## Roteiro

| Fase | Entrega |
|---|---|
| 1 | Esqueleto, motor de IA com adaptadores simulado e Ollama, sugestões e registro de IA (concluída) |
| 2 | Auditoria antecipada pelas heurísticas de Nielsen e por critérios WCAG e eMAG, com severidade, sobre necessidade, história e protótipo |
| 3 | Tratamento de riscos e portão da Definition of Ready |
| 4 | Matriz de rastreabilidade com vínculos sugeridos por semelhança e confirmados por pessoas |
| 5 | Adaptador de nuvem para demonstração, autenticação e perfis de acesso |

## Pendências fora do código

O nome do produto e o público-alvo ainda não foram decididos; "Requisitos UX + IA" é um nome de trabalho. Antes de qualquer uso comercial, é preciso verificar a política de propriedade intelectual da universidade e os instrumentos de cooperação aplicáveis.

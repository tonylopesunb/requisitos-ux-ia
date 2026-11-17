# Conjunto de dados fictícios

Dados de demonstração para a aplicação de captura e gestão de requisitos. Tudo aqui foi inventado: o órgão, o município, as pessoas, os serviços, as datas e os números. Nenhum registro, tela ou documento do Isma 2.0 ou da PGDF serviu de base ou de exemplo, e o domínio escolhido (cultura e esporte municipal) fica deliberadamente longe do contexto jurídico e fiscal.

## O cenário

A Fundação Municipal de Cultura e Esporte de Pedra Clara (FUNCEP) mantém cinco serviços digitais: reserva de quadras, inscrição em oficinas culturais, cadastro de artistas, passe cultural para pessoas idosas e agenda de eventos. Uma equipe de produto de cinco pessoas trabalha em sprints de duas semanas, e a SPR-14 está em andamento em novembro de 2026.

Os seis perfis de usuário foram escolhidos para que cada regra do modelo tenha onde aparecer. Há uma aposentada com baixa visão e pouca familiaridade digital, um professor cego que usa leitor de tela, uma artista com conexão pré-paga instável, um servidor do balcão que conhece os pontos de abandono, uma coordenadora com daltonismo e um estudante surdo que lê português como segunda língua.

## Arquivos

| Arquivo | Conteúdo |
|---|---|
| `orgao.json` | Órgão, serviços, canais, equipe de produto e sprints |
| `catalogos.json` | Heurísticas de Nielsen, escala de severidade de 0 a 4, critérios WCAG 2.2 e recomendações do eMAG usados, tipos de tratamento e checklist da DoR |
| `perfis.json` | Seis perfis (PER-01 a PER-06) |
| `necessidades.json` | Oito necessidades em linguagem natural, com canal, data e quem relatou |
| `historias.json` | Oito histórias de referência com critérios de aceite, estado de cada item da DoR e situação |
| `prototipos.json` | Oito protótipos descritos por tela e elemento, na versão auditada, com histórico de versões |
| `riscos.json` | 23 riscos de usabilidade e acessibilidade, com heurística, WCAG, eMAG, severidade e tratamento |
| `rastreabilidade.json` | 21 vínculos entre necessidade, história, protótipo e entrega, com a decisão humana |
| `registro_ia.json` | 26 registros de uso de IA com modelo, versão, data, entrada, saída e decisão |
| `entregas.json` | Três incrementos publicados no portal |
| `validar.py` | Verificação de integridade, incluindo o cálculo do portão da DoR |

Os identificadores seguem o padrão `PREFIXO-NN` e se cruzam entre os arquivos, de modo que cada arquivo corresponde a uma tabela e a carga em banco é direta.

## Como cada regra do modelo aparece

A auditoria antecipada (regra 1) incide sobre os três tipos de objeto previstos. A maior parte dos riscos recai sobre elementos de protótipo, mas o RSK-21 aponta um problema num critério de aceite da HIS-01 e o RSK-22 nasce da própria necessidade NEC-05, cujo jargão se repete em todo o serviço de oficinas. Os riscos registrados por pessoas (RSK-09, RSK-14 e RSK-23) mostram o que a IA deixou passar.

O portão da Definition of Ready (regra 2) separa as histórias em dois grupos. HIS-03, HIS-05 e HIS-08 estão bloqueadas porque têm riscos sem tratamento; as outras cinco cumpriram a DoR e estão em sprint ou já entregues. Os quatro tipos de tratamento aparecem pelo menos uma vez, inclusive a aceitação justificada (RSK-11 e RSK-21) e a transferência para o backlog (RSK-22). O RSK-19 traz uma sugestão de tratamento da IA ainda sem decisão, que serve para demonstrar o fluxo de aceite na tela.

A rastreabilidade validada por pessoas (regra 3) reúne vínculos confirmados, um vínculo editado (VIN-07, em que a IA apontou a história errada do mesmo serviço), um recusado (VIN-20, associação por semelhança superficial de tema) e dois pendentes. O VIN-14 pendente é o que mantém o item DOR-3 da HIS-05 em aberto.

No registro de IA há decisões dos quatro tipos. Na IA-0007 a proposta foi recusada e a analista escreveu a HIS-07 à mão; nas IA-0001, IA-0003 e IA-0005 a observação explica por que a proposta foi editada, o que serve de material para discutir a qualidade das sugestões. A IA-0008 foi executada com o motor local via Ollama, para mostrar a troca de provedor.

## Sugestão de roteiro para a demonstração

1. Abrir a NEC-02 e pedir à IA a proposta de história, comparando-a com a HIS-02.
2. Auditar o PRT-08 e mostrar os dois riscos abertos de severidade 4.
3. Tentar mover a HIS-08 para a sprint e ver o portão recusar.
4. Aceitar a sugestão de tratamento IA-0026 e registrar o tratamento do RSK-20 à mão.
5. Abrir a matriz de rastreabilidade, recusar ou confirmar o VIN-21 e exportar o registro de IA.

## Ressalvas

Os nomes de modelo e as versões no registro de IA são ilustrativos e devem ser trocados pelos que a aplicação usar de fato. Os números de recomendação do eMAG seguem a versão 3.1 e os critérios WCAG seguem a versão 2.2; convém conferi-los contra o texto oficial antes de qualquer apresentação pública. Contrastes citados nos riscos foram calculados pela fórmula de luminância relativa da WCAG.

Para verificar a integridade depois de qualquer edição, rode `python3 validar.py` nesta pasta. O script confere as referências cruzadas, a coerência entre situação e tratamento dos riscos, as datas de validação dos vínculos, o estado da DoR de cada história e a ausência de termos vedados.

CREATE TABLE "chamadas_ia" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sugestao_id" uuid NOT NULL,
	"tarefa" text NOT NULL,
	"provedor" text NOT NULL,
	"modelo" text NOT NULL,
	"versao_modelo" text NOT NULL,
	"versao_prompt" text NOT NULL,
	"local" boolean NOT NULL,
	"classificacao_entrada" text,
	"entrada" jsonb NOT NULL,
	"prompt" text,
	"saida_bruta" text,
	"saida_valida" boolean NOT NULL,
	"fontes" jsonb,
	"erro" text,
	"duracao_ms" integer,
	"executada_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "historias" (
	"id" text PRIMARY KEY NOT NULL,
	"projeto_id" text NOT NULL,
	"necessidade_id" text,
	"perfil_id" text,
	"titulo" text NOT NULL,
	"papel" text,
	"acao" text,
	"beneficio" text,
	"historia" text NOT NULL,
	"criterios_aceite" jsonb NOT NULL,
	"origem" text NOT NULL,
	"sugestao_id" uuid,
	"situacao" text DEFAULT 'em_especificacao' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "necessidades" (
	"id" text PRIMARY KEY NOT NULL,
	"projeto_id" text NOT NULL,
	"texto_original" text NOT NULL,
	"tipo_origem" text NOT NULL,
	"classificacao" text,
	"anonimizacao_confirmada" boolean DEFAULT false NOT NULL,
	"estado" text DEFAULT 'nova' NOT NULL,
	"canal" text,
	"servico_id" text,
	"perfis_afetados" text[] DEFAULT '{}' NOT NULL,
	"data_registro" date DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "perfis" (
	"id" text PRIMARY KEY NOT NULL,
	"projeto_id" text NOT NULL,
	"nome" text NOT NULL,
	"resumo" text NOT NULL,
	"detalhes" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projetos" (
	"id" text PRIMARY KEY NOT NULL,
	"nome" text NOT NULL,
	"orgao" text NOT NULL,
	"dados_reais" boolean DEFAULT false NOT NULL,
	"motor_preferido" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sugestoes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"codigo" text NOT NULL,
	"projeto_id" text NOT NULL,
	"tarefa" text NOT NULL,
	"alvo_tipo" text NOT NULL,
	"alvo_id" text NOT NULL,
	"conteudo" jsonb,
	"situacao" text DEFAULT 'pendente' NOT NULL,
	"decisao" text,
	"conteudo_final" jsonb,
	"decidido_por" text,
	"papel" text,
	"decidido_em" timestamp with time zone,
	"observacao" text,
	"resultado_tipo" text,
	"resultado_id" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sugestoes_codigo_unique" UNIQUE("codigo")
);
--> statement-breakpoint
ALTER TABLE "chamadas_ia" ADD CONSTRAINT "chamadas_ia_sugestao_id_sugestoes_id_fk" FOREIGN KEY ("sugestao_id") REFERENCES "public"."sugestoes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "historias" ADD CONSTRAINT "historias_projeto_id_projetos_id_fk" FOREIGN KEY ("projeto_id") REFERENCES "public"."projetos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "historias" ADD CONSTRAINT "historias_necessidade_id_necessidades_id_fk" FOREIGN KEY ("necessidade_id") REFERENCES "public"."necessidades"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "historias" ADD CONSTRAINT "historias_perfil_id_perfis_id_fk" FOREIGN KEY ("perfil_id") REFERENCES "public"."perfis"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "necessidades" ADD CONSTRAINT "necessidades_projeto_id_projetos_id_fk" FOREIGN KEY ("projeto_id") REFERENCES "public"."projetos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "perfis" ADD CONSTRAINT "perfis_projeto_id_projetos_id_fk" FOREIGN KEY ("projeto_id") REFERENCES "public"."projetos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sugestoes" ADD CONSTRAINT "sugestoes_projeto_id_projetos_id_fk" FOREIGN KEY ("projeto_id") REFERENCES "public"."projetos"("id") ON DELETE no action ON UPDATE no action;
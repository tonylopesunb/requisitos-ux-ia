-- RNF-04: o registro de uso de IA e as decisões humanas são somente de inclusão.
-- A chamada à IA nunca muda depois de gravada; a sugestão só pode mudar uma vez,
-- de "pendente" para a decisão humana, e nenhuma das duas pode ser apagada.

CREATE FUNCTION recusar_alteracao_registro_ia() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'O registro de uso de IA é somente de inclusão (%.%).', TG_TABLE_NAME, TG_OP
    USING ERRCODE = 'integrity_constraint_violation';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER chamadas_ia_somente_inclusao
  BEFORE UPDATE OR DELETE ON chamadas_ia
  FOR EACH ROW EXECUTE FUNCTION recusar_alteracao_registro_ia();
--> statement-breakpoint
CREATE TRIGGER sugestoes_sem_exclusao
  BEFORE DELETE ON sugestoes
  FOR EACH ROW EXECUTE FUNCTION recusar_alteracao_registro_ia();
--> statement-breakpoint
CREATE FUNCTION decisao_unica_sugestao() RETURNS trigger AS $$
BEGIN
  IF OLD.situacao <> 'pendente' THEN
    RAISE EXCEPTION 'A sugestão % já foi decidida e não pode ser alterada; registre uma nova sugestão.', OLD.codigo
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  IF NEW.id IS DISTINCT FROM OLD.id OR NEW.codigo IS DISTINCT FROM OLD.codigo
     OR NEW.projeto_id IS DISTINCT FROM OLD.projeto_id OR NEW.tarefa IS DISTINCT FROM OLD.tarefa
     OR NEW.alvo_tipo IS DISTINCT FROM OLD.alvo_tipo OR NEW.alvo_id IS DISTINCT FROM OLD.alvo_id
     OR NEW.conteudo IS DISTINCT FROM OLD.conteudo OR NEW.criado_em IS DISTINCT FROM OLD.criado_em THEN
    RAISE EXCEPTION 'Só os campos da decisão humana podem ser gravados na sugestão %.', OLD.codigo
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER sugestoes_decisao_unica
  BEFORE UPDATE ON sugestoes
  FOR EACH ROW EXECUTE FUNCTION decisao_unica_sugestao();

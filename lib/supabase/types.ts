/**
 * Tipos do banco de dados Supabase — Primus
 *
 * PLACEHOLDER: Este arquivo será substituído pelo output de:
 *   supabase gen types typescript --project-id ilkqkqzhnlmhoxqavcfp > lib/supabase/types.ts
 *
 * Por enquanto, define tipos manuais baseados no schema 001_initial_schema.sql
 * para permitir desenvolvimento antes de conectar ao banco real.
 */

// ---- Enums do schema ----

export type PerfilUsuario =
  | 'administrador'
  | 'coordenador'
  | 'gestor'
  | 'engenharia_clinica'
  | 'inspetor'
  | 'tecnico'

export type SetorTecnico =
  | 'engenharia_clinica'
  | 'manutencao'
  | 'farmacia'
  | 'almoxarifado'

export type TipoNaoConformidade =
  | 'equipamento'
  | 'infraestrutura'
  | 'medicamento'
  | 'material_insumo'
  | 'outro'

export type StatusAtivo =
  | 'operacional'
  | 'operacional_com_restricoes'
  | 'indisponivel'
  | 'em_manutencao'

export type StatusLocal =
  | 'pronta'
  | 'pronta_com_ressalvas'
  | 'nao_pronta'
  | 'liberada_manualmente'

export type StatusExecucao =
  | 'em_andamento'
  | 'concluida'
  | 'cancelada'

export type RespostaItem =
  | 'conforme'
  | 'nao_conforme'
  | 'nao_se_aplica'

export type CriticidadeItem =
  | 'critico'
  | 'importante'
  | 'informativo'

export type StatusNaoConformidade =
  | 'aberta'
  | 'em_analise'
  | 'em_correcao'
  | 'aguardando_validacao'
  | 'encerrada'
  | 'correcao_recusada'

export type FrequenciaChecklist =
  | 'diario'
  | 'semanal'
  | 'mensal'
  | 'sob_demanda'

export type TipoLocal =
  | 'sala'
  | 'area_comum'

// ---- Interfaces das tabelas principais ----

export interface Hospital {
  id: string
  nome: string
  cnpj: string | null
  ativo: boolean
  created_at: string
  updated_at: string
}

export interface Unidade {
  id: string
  hospital_id: string
  nome: string
  created_at: string
  updated_at: string
}

export interface CentroCirurgico {
  id: string
  unidade_id: string
  nome: string
  created_at: string
  updated_at: string
}

export interface Local {
  id: string
  centro_cirurgico_id: string
  nome: string
  tipo: TipoLocal
  status: StatusLocal
  justificativa_override: string | null
  created_at: string
  updated_at: string
}

export interface CategoriaAtivo {
  id: string
  hospital_id: string
  nome: string
  created_at: string
}

export interface Ativo {
  id: string
  hospital_id: string
  local_id: string
  categoria_id: string
  nome: string
  patrimonio: string | null
  codigo_qr: string
  status: StatusAtivo
  created_at: string
  updated_at: string
}

export interface SalaAtivo {
  id: string
  local_id: string
  ativo_id: string
  compartilhado: boolean
  criado_em: string
}

export interface Usuario {
  id: string
  hospital_id: string
  auth_user_id: string
  nome: string
  email: string
  perfil: PerfilUsuario
  setor: SetorTecnico | null
  ativo: boolean
  created_at: string
  updated_at: string
}

export interface ModeloChecklist {
  id: string
  categoria_id: string
  hospital_id: string
  nome: string
  nome_variante: string | null
  versao: number
  ativo: boolean
  frequencia: FrequenciaChecklist
  horarios_do_dia: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

export interface ItemModeloChecklist {
  id: string
  modelo_id: string
  secao: string | null
  descricao: string
  criticidade: CriticidadeItem
  evidencia_obrigatoria: boolean
  tipo_evidencia: string | null
  ordem: number
  materiais_referencia: Record<string, unknown> | null
  created_at: string
}

export interface TarefaChecklist {
  id: string
  modelo_id: string
  local_id: string
  data_programada: string
  horario_programado: string | null
  status: string
  created_at: string
}

export interface ExecucaoChecklist {
  id: string
  tarefa_id: string | null
  modelo_id: string
  ativo_id: string | null
  local_id: string
  usuario_id: string
  status: StatusExecucao
  iniciada_em: string
  concluida_em: string | null
  created_at: string
}

export interface ItemExecucaoChecklist {
  id: string
  execucao_id: string
  item_modelo_id: string
  resposta: RespostaItem
  observacao: string | null
  evidencia_url: string | null
  respondido_em: string
}

export interface NaoConformidade {
  id: string
  hospital_id: string
  item_execucao_id: string
  ativo_id: string | null
  local_id: string
  descricao: string
  criticidade: CriticidadeItem
  status: StatusNaoConformidade
  responsavel_id: string | null
  tipo: TipoNaoConformidade
  setor_responsavel: SetorTecnico | null
  prazo: string | null
  evidencia_url: string | null
  created_at: string
  updated_at: string
}

export interface HistoricoStatusNaoConformidade {
  id: string
  nao_conformidade_id: string
  status_de: StatusNaoConformidade | string
  status_para: StatusNaoConformidade | string
  usuario_id: string | null
  criado_em: string
}

export interface RegistroManutencao {
  id: string
  nao_conformidade_id: string
  usuario_id: string
  descricao: string
  status: string
  finalizada_em: string | null
  criado_em: string
}

// ---- Tipo Database (placeholder para Supabase Client) ----

export interface Database {
  public: {
    Tables: {
      hospitais: { Row: Hospital; Insert: Partial<Hospital>; Update: Partial<Hospital> }
      unidades: { Row: Unidade; Insert: Partial<Unidade>; Update: Partial<Unidade> }
      centros_cirurgicos: { Row: CentroCirurgico; Insert: Partial<CentroCirurgico>; Update: Partial<CentroCirurgico> }
      locais: { Row: Local; Insert: Partial<Local>; Update: Partial<Local> }
      categorias_ativos: { Row: CategoriaAtivo; Insert: Partial<CategoriaAtivo>; Update: Partial<CategoriaAtivo> }
      ativos: { Row: Ativo; Insert: Partial<Ativo>; Update: Partial<Ativo> }
      sala_ativos: { Row: SalaAtivo; Insert: Partial<SalaAtivo>; Update: Partial<SalaAtivo> }
      usuarios: { Row: Usuario; Insert: Partial<Usuario>; Update: Partial<Usuario> }
      modelos_checklist: { Row: ModeloChecklist; Insert: Partial<ModeloChecklist>; Update: Partial<ModeloChecklist> }
      itens_modelo_checklist: { Row: ItemModeloChecklist; Insert: Partial<ItemModeloChecklist>; Update: Partial<ItemModeloChecklist> }
      tarefas_checklist: { Row: TarefaChecklist; Insert: Partial<TarefaChecklist>; Update: Partial<TarefaChecklist> }
      execucoes_checklist: { Row: ExecucaoChecklist; Insert: Partial<ExecucaoChecklist>; Update: Partial<ExecucaoChecklist> }
      itens_execucao_checklist: { Row: ItemExecucaoChecklist; Insert: Partial<ItemExecucaoChecklist>; Update: Partial<ItemExecucaoChecklist> }
      nao_conformidades: { Row: NaoConformidade; Insert: Partial<NaoConformidade>; Update: Partial<NaoConformidade> }
      historico_status_nao_conformidade: { Row: HistoricoStatusNaoConformidade; Insert: Partial<HistoricoStatusNaoConformidade>; Update: Partial<HistoricoStatusNaoConformidade> }
      registros_manutencao: { Row: RegistroManutencao; Insert: Partial<RegistroManutencao>; Update: Partial<RegistroManutencao> }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: {
      perfil_usuario: PerfilUsuario
      status_ativo: StatusAtivo
      status_local: StatusLocal
      status_execucao: StatusExecucao
      resposta_item: RespostaItem
      criticidade_item: CriticidadeItem
      status_nao_conformidade: StatusNaoConformidade
      frequencia_checklist: FrequenciaChecklist
      tipo_local: TipoLocal
    }
  }
}

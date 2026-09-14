/**
 * Módulo de roteamento de NC → setor técnico responsável.
 *
 * Mapeia cada tipo de não conformidade ao setor que deve tratá-la.
 * Módulo puro — sem dependência de UI ou banco.
 */

import type { TipoNaoConformidade, SetorTecnico } from '@/lib/supabase/types'

// ── Mapa de Roteamento ──────────────────────────────────────────────

export const MAPA_ROTEAMENTO: Record<TipoNaoConformidade, SetorTecnico | null> = {
  equipamento: 'engenharia_clinica',
  infraestrutura: 'manutencao',
  medicamento: 'farmacia',
  material_insumo: 'almoxarifado',
  outro: null,
}

/**
 * Dado o tipo da NC, retorna o setor responsável.
 * Retorna null se não há roteamento automático (tipo 'outro').
 */
export function obterSetorResponsavel(tipo: TipoNaoConformidade): SetorTecnico | null {
  return MAPA_ROTEAMENTO[tipo] ?? null
}

// ── Labels ──────────────────────────────────────────────────────────

export const TIPOS_NC_LABELS: Record<TipoNaoConformidade, string> = {
  equipamento: 'Equipamento',
  infraestrutura: 'Infraestrutura',
  medicamento: 'Medicamento',
  material_insumo: 'Material / Insumo',
  outro: 'Outro',
}

export const TIPOS_NC_ICONES: Record<TipoNaoConformidade, string> = {
  equipamento: '⚙️',
  infraestrutura: '🏗️',
  medicamento: '💊',
  material_insumo: '📦',
  outro: '📋',
}

export const SETORES_LABELS: Record<SetorTecnico, string> = {
  engenharia_clinica: 'Engenharia Clínica',
  manutencao: 'Manutenção',
  farmacia: 'Farmácia',
  almoxarifado: 'Almoxarifado',
}

export const SETORES_ICONES: Record<SetorTecnico, string> = {
  engenharia_clinica: '⚙️',
  manutencao: '🏗️',
  farmacia: '💊',
  almoxarifado: '📦',
}

export const SETORES_CORES: Record<SetorTecnico, { bg: string; text: string; border: string }> = {
  engenharia_clinica: { bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-200/80' },
  manutencao: { bg: 'bg-slate-100', text: 'text-slate-800', border: 'border-slate-300' },
  farmacia: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
  almoxarifado: { bg: 'bg-[#F2E8E1]', text: 'text-[#6E3516]', border: 'border-[#D9C3B0]' },
}

/**
 * Retorna o caminho do ícone/foto oficial de cada equipamento no Primus.
 */
export function obterIconeEquipamento(nome?: string, categoria?: string): string {
  const n = `${nome || ''} ${categoria || ''}`.toLowerCase()
  if (n.includes('anestesia')) return '/carrinho-anestesia.webp'
  if (n.includes('parada') || n.includes('carrinho')) return '/carrinho-parada.webp'
  if (n.includes('bisturi')) return '/bisturi.webp'
  if (n.includes('aspirador')) return '/aspirador.webp'
  if (n.includes('bomba') || n.includes('infus')) return '/bomba-infusao.webp'
  if (n.includes('foco')) return '/foco.webp'
  if (n.includes('gases') || n.includes('gas')) return '/gas.webp'
  if (n.includes('mesa') || n.includes('cama') || n.includes('cirurgic') || n.includes('cirúrgic')) return '/cama.webp'
  if (n.includes('monitor')) return '/monitor.webp'
  return '/cama.webp'
}

// ── Todos os tipos e setores (para iteração em selects/chips) ───────

export const TODOS_TIPOS_NC: TipoNaoConformidade[] = [
  'equipamento',
  'infraestrutura',
  'medicamento',
  'material_insumo',
  'outro',
]

export const TODOS_SETORES: SetorTecnico[] = [
  'engenharia_clinica',
  'manutencao',
  'farmacia',
  'almoxarifado',
]

/**
 * Verifica se há pelo menos um técnico ativo no setor dado.
 * Retorna true para engenharia_clinica e false para demais setores por padrão.
 */
export function verificarTecnicoAtivo(setor: SetorTecnico | null, _hospitalId?: string): boolean {
  if (!setor) return false
  return setor === 'engenharia_clinica'
}


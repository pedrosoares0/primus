'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Avatar, AvatarPerfil } from '@/components/ui/Avatar'
import { criarClienteSupabase } from '@/lib/supabase/client'
import { dadosCache } from '@/lib/cache/dadosCache'
import { CardsMetricasAtivos, type ContadoresAtivos } from '@/components/coordenador/CardsMetricasAtivos'

export type PeriodoFiltro = '7d' | '15d' | '30d'

export interface PainelDashboardProps {
  hospitalId: string
  periodo?: PeriodoFiltro
  onPeriodoChange?: (periodo: PeriodoFiltro) => void
}

interface InspetorRanking {
  usuarioId: string
  nome: string
  perfil: string
  avatarUrl?: string
  totalRondas: number
  totalConformes: number
  totalNaoConformes: number
}

interface DadosDashboard {
  // Contadores Globais de Ativos
  contadoresAtivos: ContadoresAtivos
  // Rondas
  rondasNoPeriodo: number
  rondasSemNcNoPeriodo: number
  // NCs
  ncsAbertasNoPeriodo: number
  ncsEncerradasNoPeriodo: number
  totalNcsAbertas: number
  // Itens inspecionados
  totalItensConformes: number
  totalItens: number
  // Ranking de ativos
  rankingAtivos: {
    ativoId: string
    nomeAtivo: string
    categoria: string
    localNome: string
    centroCirurgicoNome: string
    quantidadeNcs: number
  }[]
  // Ranking de inspetores
  rankingInspetores: InspetorRanking[]
  // Tempo médio de resolução (ms)
  tempoMedioResolucaoMs: number | null
  tempoMedioAnteriorMs: number | null
  // NCs por criticidade
  ncsPorCriticidade: { critico: number; importante: number; informativo: number }
  // Rondas por dia
  rondasPorDia: {
    data: string
    diaSemana: string
    diaNumero: string
    mesCurto: string
    dataFormatada: string
    quantidade: number
  }[]
  // Rondas recentes
  rondasRecentes: {
    id: string
    inspetorNome: string
    inspetorPerfil?: string
    inspetorAvatarUrl?: string | null
    inspetorSetor?: string | null
    nomeAtivo: string
    localNome: string
    centroCirurgicoNome: string
    dataHora: string
    status: string
  }[]
}

const DIAS_SEMANA_CURTO = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const MESES_CURTO = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

function formatarDataChaveLocal(d: Date): string {
  const ano = d.getFullYear()
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${ano}-${mes}-${dia}`
}

function obterDataInicio(periodo: PeriodoFiltro): Date {
  const agora = new Date()
  const dias = periodo === '7d' ? 7 : periodo === '15d' ? 15 : 30
  const d = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() - (dias - 1), 0, 0, 0, 0)
  return d
}

function formatarDuracao(ms: number): string {
  if (ms <= 0) return '0min'
  const horas = Math.floor(ms / 3600000)
  const minutos = Math.floor((ms % 3600000) / 60000)
  if (horas >= 24) {
    const dias = Math.floor(horas / 24)
    const horasRestantes = horas % 24
    return `${dias}d ${horasRestantes}h`
  }
  if (horas > 0) return `${horas}h ${minutos}min`
  return `${minutos}min`
}

function gerarDiasNoPeriodo(periodo: PeriodoFiltro): {
  data: string
  diaSemana: string
  diaNumero: string
  mesCurto: string
  dataFormatada: string
}[] {
  const dias = periodo === '7d' ? 7 : periodo === '15d' ? 15 : 30
  const resultado: {
    data: string
    diaSemana: string
    diaNumero: string
    mesCurto: string
    dataFormatada: string
  }[] = []
  const agora = new Date()
  for (let i = dias - 1; i >= 0; i--) {
    const d = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() - i)
    resultado.push({
      data: formatarDataChaveLocal(d),
      diaSemana: DIAS_SEMANA_CURTO[d.getDay()],
      diaNumero: String(d.getDate()).padStart(2, '0'),
      mesCurto: MESES_CURTO[d.getMonth()],
      dataFormatada: `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`,
    })
  }
  return resultado
}

/**
 * Anel de Progresso Circular Moderno & Limpo (Apple Health Style)
 */
function AnelCircular3D({
  porcentagem,
  gradienteId,
  corInicio,
  corFim,
  tamanho = 74,
  espessura = 6,
}: {
  porcentagem: number | null
  gradienteId: string
  corInicio: string
  corFim: string
  tamanho?: number
  espessura?: number
}) {
  const pct = porcentagem !== null ? Math.min(Math.max(porcentagem, 0), 100) : 0
  const raio = (tamanho - espessura) / 2
  const circunferencia = 2 * Math.PI * raio
  const offset = circunferencia - (pct / 100) * circunferencia

  return (
    <div className="relative flex items-center justify-center select-none" style={{ width: tamanho, height: tamanho }}>
      <svg width={tamanho} height={tamanho} className="rotate-[-90deg] overflow-visible">
        <defs>
          <linearGradient id={gradienteId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={corInicio} />
            <stop offset="100%" stopColor={corFim} />
          </linearGradient>
        </defs>

        {/* Trilha de Fundo Suave */}
        <circle
          cx={tamanho / 2}
          cy={tamanho / 2}
          r={raio}
          stroke="#F1F5F9"
          strokeWidth={espessura}
          fill="transparent"
        />

        {/* Arco de Progresso com Gradiente */}
        {porcentagem !== null && (
          <circle
            cx={tamanho / 2}
            cy={tamanho / 2}
            r={raio}
            stroke={`url(#${gradienteId})`}
            strokeWidth={espessura}
            strokeDasharray={circunferencia}
            strokeDashoffset={offset}
            strokeLinecap="round"
            fill="transparent"
            className="transition-all duration-1000 ease-out"
          />
        )}
      </svg>

      {/* Porcentagem Centralizada */}
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-[14px] font-black font-nunito text-slate-800 tracking-tight leading-none">
          {porcentagem !== null ? `${porcentagem}%` : '—'}
        </span>
      </div>
    </div>
  )
}

/**
 * Coluna Individual do Pódio Monocromático (Clean Apple Style)
 */
function ColunaPodio({
  posicao,
  inspetor,
  alturaPilar,
}: {
  posicao: 1 | 2 | 3
  inspetor?: InspetorRanking
  alturaPilar: string
}) {
  if (!inspetor) {
    return (
      <div className="flex flex-col items-center opacity-30">
        <div className="w-10 h-10 rounded-2xl bg-gray-100 border border-dashed border-gray-300 mb-2 flex items-center justify-center text-[10px] text-gray-400 font-bold">
          —
        </div>
        <div className={`w-full ${alturaPilar} rounded-t-2xl bg-slate-100 border border-slate-200 flex items-center justify-center`}>
          <span className="text-xl font-black text-slate-300">{posicao}</span>
        </div>
      </div>
    )
  }

  const nomeCompleto = inspetor.nome && inspetor.nome.trim() ? inspetor.nome : 'Inspetor'
  const primeiroNome = nomeCompleto
    .replace(/^(Enf\.|Coord\.|Eng\.|Dr\.|Dra\.)\s*/i, '')
    .split(' ')[0] || nomeCompleto

  const nomeLimpo = nomeCompleto.replace(/^(Enf\.|Coord\.|Eng\.|Dr\.|Dra\.)\s*/i, '')
  const iniciais = nomeLimpo && nomeLimpo !== 'Inspetor'
    ? nomeLimpo
      .split(' ')
      .filter(Boolean)
      .map((n) => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase()
    : 'IN'

  const avatarUrl =
    inspetor.avatarUrl ||
    (inspetor.perfil === 'engenharia_clinica' || inspetor.perfil === 'engenharia'
      ? 'https://heroui-assets.nyc3.cdn.digitaloceanspaces.com/avatars/red.jpg'
      : inspetor.perfil === 'coordenador'
        ? 'https://heroui-assets.nyc3.cdn.digitaloceanspaces.com/avatars/purple.jpg'
        : inspetor.perfil === 'gestor'
          ? 'https://heroui-assets.nyc3.cdn.digitaloceanspaces.com/avatars/orange.jpg'
          : 'https://heroui-assets.nyc3.cdn.digitaloceanspaces.com/avatars/blue.jpg')

  return (
    <div className="flex flex-col items-center text-center">
      {/* Bloco Superior: Avatar Oficial + Nome + Métricas */}
      <div className="flex flex-col items-center mb-2.5 space-y-1 w-full">
        {/* Avatar Oficial por Perfil */}
        <AvatarPerfil perfil={inspetor.perfil} nome={inspetor.nome} tamanho="lg" />

        {/* Nome do Inspetor */}
        <p className="text-[11.5px] font-black text-gray-900 truncate max-w-[85px] leading-tight pt-0.5">
          {primeiroNome}
        </p>

        {/* Quantidade de Rondas em Cinza (Sem fundo) */}
        <span className="text-[10px] font-bold font-nunito text-gray-400">
          {inspetor.totalRondas} ronda{inspetor.totalRondas !== 1 ? 's' : ''}
        </span>

        {/* Indicadores Conformes (✓ verde) e NCs (✕ vermelho) sem badge no fundo */}
        <div className="flex items-center justify-center gap-2 pt-0.5 font-nunito">
          {/* Check Verde: Conformes */}
          <span className="inline-flex items-center gap-0.5 text-[10px] font-black font-nunito text-emerald-600">
            <span className="text-[11px]">✓</span>
            <span>{inspetor.totalConformes}</span>
          </span>

          {/* X Vermelho: NCs */}
          <span className="inline-flex items-center gap-0.5 text-[10px] font-black font-nunito text-red-500">
            <span className="text-[11px]">✕</span>
            <span>{inspetor.totalNaoConformes}</span>
          </span>
        </div>
      </div>

      {/* Pilar Físico do Pódio Monocromático (Uma única cor clean para os 3) */}
      <div className={`w-full ${alturaPilar} rounded-t-2xl bg-gradient-to-b from-slate-100 to-slate-200/80 border border-slate-200/90 flex flex-col justify-between overflow-hidden shadow-xs`}>
        {/* Topo do Bloco (Lid) */}
        <div className="w-full h-3 bg-slate-200/70 border-b border-slate-200/90" />

        {/* Face Frontal com Apenas o Número Limpo */}
        <div className="flex-1 flex items-center justify-center pb-1">
          <span className="text-2xl font-black font-nunito leading-none text-slate-600">
            {posicao}
          </span>
        </div>
      </div>
    </div>
  )
}

export function PainelDashboard({ hospitalId, periodo: periodoProp, onPeriodoChange }: PainelDashboardProps) {
  const router = useRouter()
  const [periodoInterno, setPeriodoInterno] = useState<PeriodoFiltro>('7d')
  const periodo = periodoProp ?? periodoInterno
  const setPeriodo = (p: PeriodoFiltro) => {
    setPeriodoInterno(p)
    onPeriodoChange?.(p)
  }
  const cacheKey = `coordenador_dashboard_v3_${hospitalId}_${periodo}`
  const [dados, setDados] = useState<DadosDashboard | null>(() => dadosCache.get<DadosDashboard>(cacheKey))
  const [carregando, setCarregando] = useState(() => !dadosCache.get(cacheKey))

  useEffect(() => {
    async function carregarDados() {
      if (!dadosCache.get(cacheKey)) {
        setCarregando(true)
      }
      try {
        const supabase = criarClienteSupabase() as any
        const dataInicio = obterDataInicio(periodo)
        const dataInicioISO = dataInicio.toISOString()

        // Período anterior para comparação do tempo de resolução
        const diasPeriodo = periodo === '7d' ? 7 : periodo === '15d' ? 15 : 30
        const dataInicioAnterior = new Date(dataInicio.getTime() - diasPeriodo * 24 * 60 * 60 * 1000)
        const dataInicioAnteriorISO = dataInicioAnterior.toISOString()

        // Helper robusto para formatar nome
        const formatarNome = (u: any): string => {
          if (!u) return 'Inspetor'
          const nomeCandidato = u.nome || u.full_name || u.name
          if (nomeCandidato && typeof nomeCandidato === 'string' && nomeCandidato.trim() && nomeCandidato.trim() !== 'Inspetor') {
            return nomeCandidato.trim()
          }
          if (u.email && typeof u.email === 'string') {
            const parte = u.email.split('@')[0]
            const partes = parte.split(/[\._\-]/).filter(Boolean)
            if (partes.length > 0) {
              return partes.map((p: string) => p.charAt(0).toUpperCase() + p.slice(1)).join(' ')
            }
            return parte
          }
          return 'Inspetor'
        }

        // Executar TODAS as queries em PARALELO simultâneo com Promise.all
        const [
          execsRes,
          usuariosRes,
          ncsAbertasRes,
          ncsEncerradasPeriodoRes,
          ncsEncerradasAnteriorRes,
          totalNcsAbertasRes,
          ncsParaRankingRes,
          ncsTodasPeriodoRes,
          ativosRes,
          historicoEncerramentoRes,
        ] = await Promise.all([
          supabase
            .from('execucoes_checklist')
            .select('id, finalizado_em, iniciado_em, usuario_id, status, ativo_id, ativos(nome, local_id, locais(nome, centros_cirurgicos(nome)))')
            .eq('status', 'concluida'),
          supabase
            .from('usuarios')
            .select('*'),
          supabase
            .from('nao_conformidades')
            .select('id', { count: 'exact' })
            .eq('hospital_id', hospitalId)
            .gte('criado_em', dataInicioISO),
          supabase
            .from('nao_conformidades')
            .select('id, criado_em, status')
            .eq('hospital_id', hospitalId)
            .eq('status', 'encerrada')
            .gte('criado_em', dataInicioISO),
          supabase
            .from('nao_conformidades')
            .select('id, criado_em, status')
            .eq('hospital_id', hospitalId)
            .eq('status', 'encerrada')
            .gte('criado_em', dataInicioAnteriorISO)
            .lt('criado_em', dataInicioISO),
          supabase
            .from('nao_conformidades')
            .select('id', { count: 'exact' })
            .eq('hospital_id', hospitalId)
            .neq('status', 'encerrada'),
          supabase
            .from('nao_conformidades')
            .select('id, ativo_id, criticidade, ativos(id, nome, categorias_ativos(nome), locais(nome, centros_cirurgicos(nome)))')
            .eq('hospital_id', hospitalId)
            .gte('criado_em', dataInicioISO),
          supabase
            .from('nao_conformidades')
            .select('id, criticidade')
            .eq('hospital_id', hospitalId)
            .gte('criado_em', dataInicioISO),
          supabase
            .from('ativos')
            .select('id, status, locais(nome)')
            .eq('hospital_id', hospitalId),
          // Buscar datas reais de encerramento do histórico de status
          supabase
            .from('historico_status_nao_conformidade')
            .select('nao_conformidade_id, criado_em')
            .eq('status_para', 'encerrada'),
        ])

        const mapaUsuarios = new Map<string, { nome: string; perfil: string; avatarUrl?: string; setor?: string }>()
        let todasExecucoes: any[] = execsRes.data || []

        // Mapear usuários das execuções
        todasExecucoes.forEach((r: any) => {
          if (r.usuarios && r.usuario_id) {
            mapaUsuarios.set(r.usuario_id, {
              nome: formatarNome(r.usuarios),
              perfil: r.usuarios.perfil || 'inspetor',
              avatarUrl: r.usuarios.avatar_url,
              setor: r.usuarios.setor,
            })
          }
        })

        // Mapear tabela de usuários
        if (usuariosRes.data && usuariosRes.data.length > 0) {
          usuariosRes.data.forEach((u: any) => {
            const info = {
              nome: formatarNome(u),
              perfil: u.perfil || 'inspetor',
              avatarUrl: u.avatar_url,
              setor: u.setor,
            }
            if (u.id) mapaUsuarios.set(u.id, info)
            if (u.auth_user_id) mapaUsuarios.set(u.auth_user_id, info)
          })
        }

        const rondasData = todasExecucoes.filter((r: any) => {
          const dataRonda = r.finalizado_em || r.iniciado_em
          if (!dataRonda) return false
          return new Date(dataRonda).getTime() >= dataInicio.getTime()
        })

        const ncsAbertasPeriodoData = ncsAbertasRes.data || []
        const ncsAbertasCount = ncsAbertasRes.count ?? ncsAbertasPeriodoData.length
        const ncsEncerradasPeriodo = ncsEncerradasPeriodoRes.data || []
        const ncsEncerradasAnterior = ncsEncerradasAnteriorRes.data || []
        const totalNcsAbertas = totalNcsAbertasRes.count ?? 0
        const ncsParaRanking = ncsParaRankingRes.data || []
        const ncsTodasPeriodo = ncsTodasPeriodoRes.data || []

        // Itens de execução do período e cálculo de conformidades
        let totalItensConformes = 0
        let totalItens = 0
        let rondasSemNcNoPeriodo = 0
        let itensPeriodoData: any[] = []

        if (rondasData.length > 0) {
          const execIds = rondasData.map((e: any) => e.id)
          const { data: itensPeriodo } = await supabase
            .from('itens_execucao_checklist')
            .select('id, execucao_id, resposta')
            .in('execucao_id', execIds)

          if (itensPeriodo) {
            itensPeriodoData = itensPeriodo
            totalItens = itensPeriodo.length
            totalItensConformes = itensPeriodo.filter((i: any) => i.resposta === 'conforme').length

            // Identificar quais execuções tiveram qualquer Não Conformidade
            const execucoesComNc = new Set(
              itensPeriodo
                .filter((i: any) => i.resposta === 'nao_conforme')
                .map((i: any) => i.execucao_id)
            )
            rondasSemNcNoPeriodo = rondasData.filter((r: any) => !execucoesComNc.has(r.id)).length
          }
        }

        // Ranking de Inspetores mais ativos no período
        const mapaInspetores = new Map<string, InspetorRanking>()
        rondasData.forEach((r: any) => {
          const uId = r.usuario_id
          if (!uId) return
          if (!mapaInspetores.has(uId)) {
            const uInfo = mapaUsuarios.get(uId)
            const nomeInsp = uInfo?.nome || (r.usuarios ? formatarNome(r.usuarios) : null) || 'Inspetor'
            mapaInspetores.set(uId, {
              usuarioId: uId,
              nome: nomeInsp,
              perfil: uInfo?.perfil || r.usuarios?.perfil || 'inspetor',
              avatarUrl: uInfo?.avatarUrl || r.usuarios?.avatar_url,
              totalRondas: 0,
              totalConformes: 0,
              totalNaoConformes: 0,
            })
          }
          mapaInspetores.get(uId)!.totalRondas++
        })

        if (itensPeriodoData.length > 0 && rondasData.length > 0) {
          const mapaExecucaoParaUsuario = new Map<string, string>()
          rondasData.forEach((r: any) => mapaExecucaoParaUsuario.set(r.id, r.usuario_id))

          itensPeriodoData.forEach((item: any) => {
            const uId = mapaExecucaoParaUsuario.get(item.execucao_id)
            if (uId && mapaInspetores.has(uId)) {
              if (item.resposta === 'conforme') {
                mapaInspetores.get(uId)!.totalConformes++
              } else if (item.resposta === 'nao_conforme') {
                mapaInspetores.get(uId)!.totalNaoConformes++
              }
            }
          })
        }

        const rankingInspetores = Array.from(mapaInspetores.values())
          .sort((a, b) => b.totalRondas - a.totalRondas || b.totalConformes - a.totalConformes)
          .slice(0, 3)

        // 10. Rondas recentes (estritamente últimas 3)
        const rondasOrdenadas = [...(todasExecucoes || [])].sort((a: any, b: any) => {
          const dtA = new Date(a.finalizado_em || a.iniciado_em || 0).getTime()
          const dtB = new Date(b.finalizado_em || b.iniciado_em || 0).getTime()
          return dtB - dtA
        }).slice(0, 3)

        // --- Processar dados ---

        // Ranking de ativos com mais NCs
        const contagemPorAtivo = new Map<string, { nomeAtivo: string; categoria: string; localNome: string; centroCirurgicoNome: string; quantidade: number }>()
        if (ncsParaRanking) {
          ncsParaRanking.forEach((nc: any) => {
            if (!nc.ativo_id || !nc.ativos) return
            const atual = contagemPorAtivo.get(nc.ativo_id)
            if (atual) {
              atual.quantidade++
            } else {
              contagemPorAtivo.set(nc.ativo_id, {
                nomeAtivo: nc.ativos.nome || 'Ativo',
                categoria: nc.ativos.categorias_ativos?.nome || 'Equipamento',
                localNome: nc.ativos.locais?.nome || 'Sala',
                centroCirurgicoNome: nc.ativos.locais?.centros_cirurgicos?.nome || 'Centro Cirúrgico',
                quantidade: 1,
              })
            }
          })
        }
        const rankingAtivos = Array.from(contagemPorAtivo.entries())
          .map(([ativoId, info]) => ({ ativoId, ...info, quantidadeNcs: info.quantidade }))
          .sort((a, b) => b.quantidadeNcs - a.quantidadeNcs)
          .slice(0, 5)

        // Mapa de datas reais de encerramento (historico_status_nao_conformidade)
        const mapaEncerramentos = new Map<string, string>()
        if (historicoEncerramentoRes.data) {
          historicoEncerramentoRes.data.forEach((h: any) => {
            // Pega o registro mais recente de encerramento para cada NC
            const existente = mapaEncerramentos.get(h.nao_conformidade_id)
            if (!existente || new Date(h.criado_em) > new Date(existente)) {
              mapaEncerramentos.set(h.nao_conformidade_id, h.criado_em)
            }
          })
        }

        // Tempo médio de resolução real (a partir das NCs encerradas)
        let tempoMedioResolucaoMs: number | null = null
        if (ncsEncerradasPeriodo && ncsEncerradasPeriodo.length > 0) {
          const tempos = ncsEncerradasPeriodo
            .map((nc: any) => {
              const dataEncerramento = mapaEncerramentos.get(nc.id)
              if (!dataEncerramento) return 0
              const dtFim = new Date(dataEncerramento).getTime()
              const dtIni = new Date(nc.criado_em).getTime()
              return Math.max(dtFim - dtIni, 0)
            })
            .filter((t: number) => t > 0)

          if (tempos.length > 0) {
            tempoMedioResolucaoMs = Math.round(tempos.reduce((a: number, b: number) => a + b, 0) / tempos.length)
          }
        }

        let tempoMedioAnteriorMs: number | null = null
        if (ncsEncerradasAnterior && ncsEncerradasAnterior.length > 0) {
          const temposAnt = ncsEncerradasAnterior
            .map((nc: any) => {
              const dataEncerramento = mapaEncerramentos.get(nc.id)
              if (!dataEncerramento) return 0
              const dtFim = new Date(dataEncerramento).getTime()
              const dtIni = new Date(nc.criado_em).getTime()
              return Math.max(dtFim - dtIni, 0)
            })
            .filter((t: number) => t > 0)

          if (temposAnt.length > 0) {
            tempoMedioAnteriorMs = Math.round(temposAnt.reduce((a: number, b: number) => a + b, 0) / temposAnt.length)
          }
        }

        // NCs por criticidade
        const ncsPorCriticidade = { critico: 0, importante: 0, informativo: 0 }
        if (ncsTodasPeriodo) {
          ncsTodasPeriodo.forEach((nc: any) => {
            if (nc.criticidade in ncsPorCriticidade) {
              ncsPorCriticidade[nc.criticidade as keyof typeof ncsPorCriticidade]++
            }
          })
        }

        // Rondas por dia (agrupamento pelo timezone local da data)
        const diasPeriodoArr = gerarDiasNoPeriodo(periodo)
        const contagemPorDia = new Map<string, number>()
        rondasData.forEach((r: any) => {
          const dataRonda = r.finalizado_em || r.iniciado_em
          if (dataRonda) {
            const chave = formatarDataChaveLocal(new Date(dataRonda))
            contagemPorDia.set(chave, (contagemPorDia.get(chave) || 0) + 1)
          }
        })
        const rondasPorDia = diasPeriodoArr.map((d) => ({
          ...d,
          quantidade: contagemPorDia.get(d.data) || 0,
        }))

        // Rondas recentes formatadas com perfil e avatar do usuário
        const rondasRecentesFormatadas = rondasOrdenadas.map((r: any) => {
          const uInfo = mapaUsuarios.get(r.usuario_id)
          const nomeInsp = uInfo?.nome || (r.usuarios ? formatarNome(r.usuarios) : null) || 'Inspetor'
          return {
            id: r.id,
            inspetorNome: nomeInsp,
            inspetorPerfil: uInfo?.perfil || r.usuarios?.perfil || 'inspetor',
            inspetorAvatarUrl: uInfo?.avatarUrl || r.usuarios?.avatar_url || null,
            inspetorSetor: uInfo?.setor || r.usuarios?.setor || null,
            nomeAtivo: r.ativos?.nome || 'Ativo',
            localNome: r.ativos?.locais?.nome || 'Local',
            centroCirurgicoNome: r.ativos?.locais?.centros_cirurgicos?.nome || 'Centro Cirúrgico',
            dataHora: r.finalizado_em || r.iniciado_em,
            status: r.status,
          }
        })

        // Cálculo de contadores globais de ativos para os cards de métricas
        const ativosData = ativosRes.data || []
        const ativosValidos = ativosData.filter((a: any) => {
          const nomeLocal = (a.locais?.nome || '').toLowerCase()
          return !nomeLocal.includes('sala 02') && !nomeLocal.includes('sala 2')
        })
        const totalAtivos = ativosValidos.length
        const totalOperacional = ativosValidos.filter((a: any) => a.status === 'operacional').length
        const totalRestricoes = ativosValidos.filter((a: any) => a.status === 'operacional_com_restricoes').length
        const totalIndisponivel = ativosValidos.filter((a: any) => a.status === 'indisponivel' || a.status === 'em_manutencao').length
        const taxaAtivosConformidade = totalAtivos > 0 ? Math.round((totalOperacional / totalAtivos) * 100) : 100

        const contadoresAtivos: ContadoresAtivos = {
          total: totalAtivos,
          operacional: totalOperacional,
          operacional_com_restricoes: totalRestricoes,
          indisponivelOuManutencao: totalIndisponivel,
          taxaConformidade: taxaAtivosConformidade,
          totalSalas: 3,
        }

        const resultadoCalculado = {
          contadoresAtivos,
          rondasNoPeriodo: rondasData.length,
          rondasSemNcNoPeriodo,
          ncsAbertasNoPeriodo: ncsAbertasCount || ncsAbertasPeriodoData?.length || 0,
          ncsEncerradasNoPeriodo: ncsEncerradasPeriodo?.length || 0,
          totalNcsAbertas: totalNcsAbertas || 0,
          totalItensConformes,
          totalItens,
          rankingAtivos,
          rankingInspetores,
          tempoMedioResolucaoMs,
          tempoMedioAnteriorMs,
          ncsPorCriticidade,
          rondasPorDia,
          rondasRecentes: rondasRecentesFormatadas,
        }

        setDados(resultadoCalculado)
        dadosCache.set(cacheKey, resultadoCalculado)
      } catch (err) {
        console.error('Erro ao carregar dashboard:', err)
      } finally {
        setCarregando(false)
      }
    }

    carregarDados()
  }, [hospitalId, periodo, cacheKey])

  // Taxa de itens aprovados (Opção 3)
  const taxaItensAprovados = useMemo(() => {
    if (!dados || dados.totalItens === 0) return null
    return Math.round((dados.totalItensConformes / dados.totalItens) * 100)
  }, [dados])

  // Taxa de rondas sem falhas (Opção 2)
  const taxaRondasSemFalhas = useMemo(() => {
    if (!dados || dados.rondasNoPeriodo === 0) return null
    return Math.round((dados.rondasSemNcNoPeriodo / dados.rondasNoPeriodo) * 100)
  }, [dados])

  // Taxa de controle não-crítico
  const taxaNaoCritica = useMemo(() => {
    if (!dados || dados.ncsAbertasNoPeriodo === 0) return 100
    const criticas = dados.ncsPorCriticidade.critico
    const naoCriticas = Math.max(dados.ncsAbertasNoPeriodo - criticas, 0)
    return Math.round((naoCriticas / dados.ncsAbertasNoPeriodo) * 100)
  }, [dados])

  const labelPeriodo = periodo === '7d' ? '7 dias' : periodo === '15d' ? '15 dias' : '30 dias'

  const maxRondasDia = useMemo(() => {
    if (!dados) return 1
    const max = Math.max(...dados.rondasPorDia.map((d) => d.quantidade), 1)
    return max
  }, [dados])

  // Tendência do tempo de resolução
  const tendenciaResolucao = useMemo(() => {
    if (!dados || dados.tempoMedioResolucaoMs === null || dados.tempoMedioAnteriorMs === null) return null
    if (dados.tempoMedioAnteriorMs === 0) return null
    const diff = dados.tempoMedioResolucaoMs - dados.tempoMedioAnteriorMs
    if (Math.abs(diff) < 60000) return 'estavel'
    return diff > 0 ? 'piorou' : 'melhorou'
  }, [dados])

  if (carregando) {
    return (
      <div className="space-y-4">
        {[1, 2, 3, 4].map((n) => (
          <div key={n} className="bg-white rounded-[24px] p-5 border border-gray-100/80 animate-pulse space-y-3">
            <div className="h-4 bg-gray-200 rounded w-1/3" />
            <div className="h-8 bg-gray-200 rounded w-1/4" />
            <div className="h-3 bg-gray-200 rounded w-2/3" />
          </div>
        ))}
      </div>
    )
  }

  if (!dados) {
    return (
      <div className="py-12 px-6 bg-white rounded-[28px] border border-gray-100/80 text-center space-y-4">
        <p className="text-sm text-gray-500 font-semibold">Erro ao carregar dados do dashboard.</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* 4 Cards de Métricas Principais (Início do Painel) */}
      <CardsMetricasAtivos
        contadores={dados.contadoresAtivos}
        clicavel={false}
      />

      {/* Barra de Resumo Rápido no Topo */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-2.5 sm:p-3 rounded-2xl border border-slate-200/70 shadow-2xs">
        <div className="flex items-center gap-2 pl-1">
          <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">Período ativo:</span>
          <span className="text-xs font-black text-slate-800 bg-slate-100 px-3 py-1 rounded-full border border-slate-200/60">
            {periodo === '7d' ? 'Últimos 7 dias' : periodo === '15d' ? 'Últimos 15 dias' : 'Últimos 30 dias'}
          </span>
        </div>

        <div className="flex items-center gap-2 pr-1">
          <span className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-700 font-bold font-nunito text-[11px] px-3 py-1 rounded-full border border-blue-200/60">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            {dados.rondasNoPeriodo} rondas concluídas
          </span>
          <span className="inline-flex items-center gap-1.5 bg-rose-50 text-rose-700 font-bold font-nunito text-[11px] px-3 py-1 rounded-full border border-rose-200/60">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
            {dados.ncsAbertasNoPeriodo} NCs
          </span>
        </div>
      </div>

      {/* Grid Principal do Dashboard (12 Colunas no Desktop) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        
        {/* ══════════════════════════════════════════════════
            COLUNA ESQUERDA (lg:col-span-7) — INDICADORES & RONDAS
           ══════════════════════════════════════════════════ */}
        <div className="lg:col-span-7 space-y-5">
          
          {/* ATIVIDADE DE RONDAS (RONDAS CONCLUÍDAS POR DIA) */}
          <div className="bg-white rounded-[28px] p-5 sm:p-6 border border-gray-100 shadow-[var(--shadow-card)]">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-[15px] font-bold text-gray-900 tracking-tight leading-none font-space-grotesk">
                  Atividade de Rondas
                </h3>
                <p className="text-[11px] text-gray-400 font-medium mt-1">
                  Volume diário de rondas de inspeção concluídas
                </p>
              </div>
              <span className="text-[10.5px] font-bold font-nunito text-gray-600 bg-gray-50 px-3 py-1 rounded-full border border-gray-200/80 shrink-0">
                {dados.rondasNoPeriodo} concluída{dados.rondasNoPeriodo !== 1 ? 's' : ''}
              </span>
            </div>

            <div className="pt-3 pb-1">
              <div className="relative">
                {/* 1. Fileira de Barras: Altura fixa com baseline compartilhada e imutável */}
                <div
                  className={`flex items-end w-full ${
                    periodo === '7d'
                      ? 'gap-2 sm:gap-3'
                      : periodo === '15d'
                      ? 'gap-1 sm:gap-1.5'
                      : 'gap-0.5 sm:gap-1'
                  }`}
                  style={{ height: '94px' }}
                >
                  {dados.rondasPorDia.map((dia) => {
                    const altura = maxRondasDia > 0 ? (dia.quantidade / maxRondasDia) * 100 : 0
                    const hojeLocal = formatarDataChaveLocal(new Date())
                    const ehHoje = dia.data === hojeLocal
                    const temRonda = dia.quantidade > 0

                    return (
                      <div
                        key={dia.data}
                        className="flex-1 flex flex-col items-center justify-end h-full group relative cursor-pointer"
                      >
                        {/* Tooltip flutuante no hover / toque */}
                        <div className="absolute -top-7 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-150 z-30 bg-gray-900/90 text-white text-[9.5px] font-bold px-2 py-0.5 rounded-md whitespace-nowrap shadow-lg backdrop-blur-sm">
                          {dia.quantidade} ronda{dia.quantidade !== 1 ? 's' : ''} • {dia.diaSemana}, {dia.diaNumero}/{dia.mesCurto}
                        </div>

                        {/* Contador numérico acima da barra */}
                        <div className="h-4 flex items-center justify-center shrink-0 mb-1">
                          <span
                            className={`font-black font-nunito leading-none transition-colors ${
                              periodo === '30d' ? 'text-[8.5px]' : 'text-[10px]'
                            } ${
                              temRonda
                                ? 'text-gray-800'
                                : 'text-transparent group-hover:text-gray-400'
                            }`}
                          >
                            {dia.quantidade}
                          </span>
                        </div>

                        {/* Track da Barra e Preenchimento com altura máxima garantida */}
                        <div
                          className={`w-full h-[74px] flex items-end overflow-hidden ${
                            periodo === '7d'
                              ? 'bg-gray-100/80 rounded-xl p-0.5 shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)]'
                              : periodo === '15d'
                              ? 'bg-gray-100/50 hover:bg-gray-100/80 rounded-lg p-0.5'
                              : 'bg-gray-100/35 hover:bg-blue-50/70 rounded-t-sm p-px'
                          }`}
                        >
                          <div
                            className={`w-full transition-all duration-500 ${
                              periodo === '7d'
                                ? 'rounded-[10px]'
                                : periodo === '15d'
                                ? 'rounded-[6px]'
                                : 'rounded-t-xs sm:rounded-t-sm'
                            } ${
                              ehHoje && temRonda
                                ? 'bg-gradient-to-t from-[#17A592] to-[#2ED29E] shadow-[0_2px_6px_rgba(23,165,146,0.35),inset_0_1px_0.5px_rgba(255,255,255,0.5)]'
                                : temRonda
                                ? 'bg-gradient-to-t from-blue-500 to-sky-400 shadow-[0_2px_5px_rgba(59,130,246,0.3),inset_0_1px_0.5px_rgba(255,255,255,0.5)]'
                                : 'bg-transparent'
                            }`}
                            style={{
                              height: temRonda ? `${Math.max(altura, 14)}%` : '0%',
                            }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Linha de base horizontal que ancora todas as colunas com precisão */}
                <div className="w-full h-[1.5px] bg-gray-100/90 rounded-full mt-1 mb-1.5" />

                {/* 2. Fileira de Rótulos de Data perfeitamente alinhada com as colunas */}
                <div
                  className={`flex items-start w-full ${
                    periodo === '7d'
                      ? 'gap-2 sm:gap-3'
                      : periodo === '15d'
                      ? 'gap-1 sm:gap-1.5'
                      : 'gap-0.5 sm:gap-1'
                  } h-[28px] overflow-visible`}
                >
                  {dados.rondasPorDia.map((dia, idx) => {
                    const totalDias = dados.rondasPorDia.length
                    const hojeLocal = formatarDataChaveLocal(new Date())
                    const ehHoje = dia.data === hojeLocal

                    let mostrarLabel = false
                    let textoLinha1 = dia.diaSemana
                    let textoLinha2 = dia.diaNumero

                    if (periodo === '7d') {
                      mostrarLabel = true
                      textoLinha1 = ehHoje ? 'Hoje' : dia.diaSemana
                      textoLinha2 = dia.diaNumero
                    } else if (periodo === '15d') {
                      mostrarLabel = idx % 2 === 0 || idx === totalDias - 1
                      textoLinha1 = ehHoje ? 'Hoje' : dia.diaSemana
                      textoLinha2 = dia.diaNumero
                    } else {
                      const marcos30d = [0, 6, 12, 18, 24, totalDias - 1]
                      mostrarLabel = marcos30d.includes(idx)
                      if (ehHoje) {
                        textoLinha1 = 'Hoje'
                        textoLinha2 = dia.diaNumero
                      } else if (idx === 0 || dia.diaNumero === '01') {
                        textoLinha1 = dia.mesCurto
                        textoLinha2 = dia.diaNumero
                      } else {
                        textoLinha1 = dia.diaSemana
                        textoLinha2 = dia.diaNumero
                      }
                    }

                    return (
                      <div
                        key={`label-${dia.data}`}
                        className="flex-1 flex flex-col items-center justify-start text-center relative overflow-visible"
                      >
                        {mostrarLabel ? (
                          <div className="flex flex-col items-center leading-none whitespace-nowrap">
                            <span
                              className={`font-bold transition-colors ${
                                periodo === '30d' ? 'text-[8px]' : 'text-[9px]'
                              } ${ehHoje ? 'text-[#17A592]' : 'text-gray-400'}`}
                            >
                              {textoLinha1}
                            </span>
                            <span
                              className={`font-bold mt-0.5 transition-colors ${
                                periodo === '30d' ? 'text-[8px]' : 'text-[8.5px]'
                              } ${ehHoje ? 'text-[#17A592] font-black' : 'text-gray-400'}`}
                            >
                              {textoLinha2}
                            </span>
                            {ehHoje && (
                              <span className="w-1 h-1 rounded-full bg-[#17A592] mt-0.5 shrink-0" />
                            )}
                          </div>
                        ) : (
                          <span
                            className={`rounded-full bg-gray-200/70 mt-1.5 shrink-0 ${
                              periodo === '30d' ? 'w-0.5 h-0.5' : 'w-1 h-1'
                            }`}
                          />
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Tempo Médio de Resolução */}
          <div className="bg-white rounded-[28px] p-5 border border-gray-100 shadow-[var(--shadow-card)]">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Tempo Médio de Resolução</span>
            <p className="text-[24px] font-black font-nunito text-gray-900 mt-2 leading-none">
              {dados.tempoMedioResolucaoMs !== null ? formatarDuracao(dados.tempoMedioResolucaoMs) : '—'}
            </p>
            {tendenciaResolucao && (
              <div className={`mt-2 inline-flex items-center gap-1 text-[10px] font-bold font-nunito px-2 py-0.5 rounded-full ${
                tendenciaResolucao === 'melhorou' ? 'bg-emerald-50 text-emerald-600' :
                tendenciaResolucao === 'piorou' ? 'bg-red-50 text-red-500' :
                'bg-gray-50 text-gray-400'
              }`}>
                {tendenciaResolucao === 'melhorou' ? '↓' : tendenciaResolucao === 'piorou' ? '↑' : '→'}
                {tendenciaResolucao === 'melhorou' ? ' Melhorou vs período anterior' : tendenciaResolucao === 'piorou' ? ' Piorou vs período anterior' : ' Estável'}
              </div>
            )}
          </div>

        </div>

        {/* ══════════════════════════════════════════════════
            COLUNA DIREITA (lg:col-span-5) — RANKINGS & FEED
           ══════════════════════════════════════════════════ */}
        <div className="lg:col-span-5 space-y-5">
          
          {/* RANKING DE ATIVOS COM MAIS NCs */}
          <div className="bg-white rounded-[28px] p-5 sm:p-6 border border-gray-100 shadow-[var(--shadow-card)]">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-[14px] font-bold text-gray-900 tracking-tight leading-none font-space-grotesk">
                    Ativos com Mais NCs
                  </h3>
                  <p className="text-[10px] text-gray-400 font-medium mt-1">
                    Frequência por equipamento
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-bold text-gray-500 bg-gray-50 px-2.5 py-1 rounded-full border border-gray-100 shrink-0">
                {labelPeriodo}
              </span>
            </div>

            {dados.rankingAtivos.length > 0 ? (
              <div className="space-y-3">
                {dados.rankingAtivos.slice(0, 5).map((ativo, idx) => {
                  const maxNcs = dados.rankingAtivos[0]?.quantidadeNcs || 1
                  const proporcao = (ativo.quantidadeNcs / maxNcs) * 100

                  return (
                    <div
                      key={ativo.ativoId}
                      className="bg-gray-50/70 rounded-2xl p-3 border border-gray-100/80 space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="w-6 h-6 rounded-lg bg-gradient-to-b from-white to-gray-50 border border-gray-200/90 flex items-center justify-center text-[10px] font-black font-nunito text-gray-700 shrink-0 shadow-[0_1.5px_3px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,1)]">
                            {idx + 1}º
                          </span>
                          <div className="min-w-0">
                            <p className="text-[12.5px] font-bold text-gray-900 truncate leading-tight">
                              {ativo.nomeAtivo}
                            </p>
                            <p className="text-[10px] text-gray-400 font-medium truncate mt-0.5">
                              {ativo.localNome} · {ativo.centroCirurgicoNome}
                            </p>
                          </div>
                        </div>
                        <span className="text-[10.5px] font-black font-nunito text-red-600 bg-red-50 border border-red-200/70 px-2.5 py-0.5 rounded-full shrink-0">
                          {ativo.quantidadeNcs} NC{ativo.quantidadeNcs !== 1 ? 's' : ''}
                        </span>
                      </div>

                      <div className="w-full h-2 bg-gray-200/80 rounded-full overflow-hidden p-[1px] shadow-[inset_0_1px_2px_rgba(0,0,0,0.08)]">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-amber-400 via-rose-500 to-red-500 shadow-[0_1.5px_4px_rgba(239,68,68,0.35)] transition-all duration-500"
                          style={{ width: `${Math.max(proporcao, 8)}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="py-8 text-center bg-gray-50/50 rounded-2xl border border-dashed border-gray-200">
                <p className="text-[11px] text-gray-400 font-medium">
                  Nenhuma não conformidade registrada em {labelPeriodo}.
                </p>
              </div>
            )}
          </div>

          {/* PÓDIO LEADERBOARD DE INSPETORES */}
          <div className="bg-white rounded-[28px] p-5 sm:p-6 border border-gray-100 shadow-[var(--shadow-card)] space-y-4">
            <div className="flex items-center justify-between pb-1 border-b border-gray-100/80">
              <div>
                <h3 className="text-[14px] font-bold text-gray-900 tracking-tight leading-none font-space-grotesk">
                  Inspetores Mais Ativos
                </h3>
                <p className="text-[10px] text-gray-400 font-medium mt-1">
                  Top 3 em rondas concluídas
                </p>
              </div>
              <span className="text-[10px] font-bold text-gray-500 bg-gray-50 px-2.5 py-1 rounded-full border border-gray-100 shrink-0">
                {labelPeriodo}
              </span>
            </div>

            {dados.rankingInspetores.length > 0 ? (
              <div className="pt-3 pb-1 space-y-3">
                <div className="grid grid-cols-3 items-end gap-2">
                  <ColunaPodio
                    posicao={1}
                    inspetor={dados.rankingInspetores[0]}
                    alturaPilar="h-[100px]"
                  />
                  <ColunaPodio
                    posicao={2}
                    inspetor={dados.rankingInspetores[1]}
                    alturaPilar="h-[72px]"
                  />
                  <ColunaPodio
                    posicao={3}
                    inspetor={dados.rankingInspetores[2]}
                    alturaPilar="h-[52px]"
                  />
                </div>
              </div>
            ) : (
              <div className="py-8 text-center bg-gray-50/50 rounded-2xl border border-dashed border-gray-200">
                <p className="text-[11px] text-gray-400 font-medium">
                  Nenhuma ronda realizada em {labelPeriodo}.
                </p>
              </div>
            )}
          </div>

          {/* RONDAS RECENTES (ESTRITAMENTE ÚLTIMAS 3) */}
          {dados.rondasRecentes.length > 0 && (
            <div className="bg-white rounded-[28px] p-5 sm:p-6 border border-gray-100 shadow-[var(--shadow-card)]">
              <h3 className="text-[14px] font-bold text-gray-900 tracking-tight mb-3 font-space-grotesk">Rondas Recentes</h3>
              <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1 scrollbar-thin">
                {dados.rondasRecentes.slice(0, 3).map((ronda) => {
                  const dataObj = ronda.dataHora ? new Date(ronda.dataHora) : null
                  const hora = dataObj
                    ? dataObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                    : ''
                  const dia = dataObj
                    ? dataObj.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
                    : ''

                  return (
                    <div key={ronda.id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-50 transition-colors">
                      <AvatarPerfil
                        perfil={ronda.inspetorPerfil}
                        avatarUrl={ronda.inspetorAvatarUrl}
                        nome={ronda.inspetorNome}
                        setor={ronda.inspetorSetor}
                        tamanho="sm"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-bold text-gray-900 truncate">{ronda.inspetorNome}</p>
                        <p className="text-[10px] text-gray-400 font-medium truncate">
                          {ronda.nomeAtivo} · {ronda.localNome}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[10.5px] font-bold font-nunito text-gray-700">{hora}</p>
                        <p className="text-[9px] font-bold font-nunito text-gray-400">{dia}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}

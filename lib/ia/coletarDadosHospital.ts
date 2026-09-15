/**
 * Coleta de dados do hospital para contexto da IA
 *
 * Busca um snapshot estruturado de todos os dados relevantes
 * do hospital do coordenador para injetar como contexto no
 * system prompt do Gemini — garantindo respostas baseadas em
 * dados reais e sem alucinação.
 */

type SupabaseClient = any

export async function buscarResumoHospital(
  supabase: SupabaseClient,
  hospitalId?: string | null
): Promise<string> {
  // Query builders com filtro opcional de hospital_id
  let qAtivos = supabase
    .from('ativos')
    .select('id, nome, status, patrimonio, categorias_ativos(nome), locais(nome)')
    .order('nome')
  if (hospitalId) qAtivos = qAtivos.eq('hospital_id', hospitalId)

  let qNcsAbertas = supabase
    .from('nao_conformidades')
    .select(`
      id, numero_unico, criticidade, status, tipo, setor_responsavel, criado_em, prazo,
      ativos(nome, locais(nome)),
      usuarios:responsavel_id(nome)
    `)
    .neq('status', 'encerrada')
    .order('criado_em', { ascending: false })
  if (hospitalId) qNcsAbertas = qNcsAbertas.eq('hospital_id', hospitalId)

  let qExecucoes = supabase
    .from('execucoes_checklist')
    .select(`
      id, status, iniciado_em, finalizado_em,
      usuarios:usuario_id(nome),
      ativos(nome, locais(nome))
    `)
    .eq('status', 'concluida')
    .order('finalizado_em', { ascending: false })
    .limit(30)
  if (hospitalId) qExecucoes = qExecucoes.eq('hospital_id', hospitalId)

  let qUsuarios = supabase
    .from('usuarios')
    .select('id, nome, email, perfil, setor')
    .in('perfil', ['inspetor', 'engenharia_clinica', 'tecnico', 'coordenador'])
  if (hospitalId) qUsuarios = qUsuarios.eq('hospital_id', hospitalId)

  let qNcsEncerradas = supabase
    .from('nao_conformidades')
    .select('id, criticidade, tipo, criado_em, responsavel_id, ativos(nome)')
    .eq('status', 'encerrada')
    .gte('criado_em', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
    .order('criado_em', { ascending: false })
  if (hospitalId) qNcsEncerradas = qNcsEncerradas.eq('hospital_id', hospitalId)

  // Executar todas as queries em paralelo
  const [
    locaisRes,
    ativosRes,
    ncsAbertasRes,
    execucoesRes,
    usuariosRes,
    ncsEncerradasRes,
    historicoEncerramentoRes,
  ] = await Promise.all([
    supabase
      .from('locais')
      .select('id, nome, status, tipo, centros_cirurgicos(nome)')
      .order('nome'),
    qAtivos,
    qNcsAbertas,
    qExecucoes,
    qUsuarios,
    qNcsEncerradas,
    supabase
      .from('historico_status_nao_conformidade')
      .select('nao_conformidade_id, criado_em')
      .eq('status_para', 'encerrada'),
  ])

  const locais = locaisRes.data || []
  const ativos = ativosRes.data || []
  const ncsAbertas = ncsAbertasRes.data || []
  const execucoes = execucoesRes.data || []
  const ncsEncerradas = ncsEncerradasRes.data || []
  let usuarios = usuariosRes.data || []

  // Fallback se usuários não retornou por restrição de hospital_id
  if (usuarios.length === 0) {
    const { data: todosUsuarios } = await supabase
      .from('usuarios')
      .select('id, nome, email, perfil, setor')
      .in('perfil', ['inspetor', 'engenharia_clinica', 'tecnico', 'coordenador'])
    if (todosUsuarios && todosUsuarios.length > 0) {
      usuarios = todosUsuarios
    }
  }

  // Se houve inspeções, buscar itens para calcular conformidade
  let itensInfo = ''
  if (execucoes.length > 0) {
    const execIds = execucoes.slice(0, 20).map((e: any) => e.id)
    const { data: itens } = await supabase
      .from('itens_execucao_checklist')
      .select('id, execucao_id, resposta')
      .in('execucao_id', execIds)

    if (itens && itens.length > 0) {
      const totalItens = itens.length
      const conformes = itens.filter((i: any) => i.resposta === 'conforme').length
      const naoConformes = itens.filter((i: any) => i.resposta === 'nao_conforme').length
      const naSe = itens.filter((i: any) => i.resposta === 'nao_se_aplica').length
      const taxaConformidade = totalItens > 0 ? Math.round((conformes / totalItens) * 100) : 0
      itensInfo = `
## Conformidade das Últimas 20 Inspeções
- Total de itens verificados: ${totalItens}
- Conformes: ${conformes} (${taxaConformidade}%)
- Não conformes: ${naoConformes}
- Não se aplica: ${naSe}`
    }
  }

  // ---- Montar contexto textual ----

  const dataAtual = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  const STATUS_LABELS: Record<string, string> = {
    pronta: '✅ Pronta',
    pronta_com_ressalvas: '⚠️ Pronta com Ressalvas',
    nao_pronta: '❌ Não Pronta',
    liberada_manualmente: '🔓 Liberada Manualmente',
    operacional: '✅ Operacional',
    operacional_com_restricoes: '⚠️ Operacional com Restrições',
    indisponivel: '❌ Indisponível',
    em_manutencao: '🔧 Em Manutenção',
  }

  const CRITICIDADE_LABELS: Record<string, string> = {
    critico: '🔴 Crítico',
    importante: '🟠 Importante',
    informativo: '🔵 Informativo',
  }

  const STATUS_NC_LABELS: Record<string, string> = {
    aberta: 'Aberta',
    em_analise: 'Em Análise',
    em_correcao: 'Em Correção',
    aguardando_validacao: 'Aguardando Validação',
    correcao_recusada: 'Correção Recusada',
  }

  // -- Salas --
  let blocoSalas = '## Salas Cirúrgicas\n'
  if (locais.length === 0) {
    blocoSalas += 'Nenhuma sala cadastrada.\n'
  } else {
    locais.forEach((l: any) => {
      const ncsNaSala = ncsAbertas.filter(
        (nc: any) => nc.ativos?.locais?.nome === l.nome
      ).length
      const ativosNaSala = ativos.filter(
        (a: any) => a.locais?.nome === l.nome
      )
      blocoSalas += `- **${l.nome}** (${l.centros_cirurgicos?.nome || 'Centro Cirúrgico'}): Status ${STATUS_LABELS[l.status] || l.status} | ${ativosNaSala.length} equipamentos | ${ncsNaSala} NCs abertas\n`
    })
  }

  // -- Ativos --
  let blocoAtivos = '## Equipamentos (Ativos)\n'
  const ativosOperacionais = ativos.filter((a: any) => a.status === 'operacional').length
  const ativosRestritos = ativos.filter((a: any) => a.status === 'operacional_com_restricoes').length
  const ativosIndisponiveis = ativos.filter((a: any) => a.status === 'indisponivel' || a.status === 'em_manutencao').length
  blocoAtivos += `Total: ${ativos.length} | Operacionais: ${ativosOperacionais} | Com restrições: ${ativosRestritos} | Indisponíveis/Manutenção: ${ativosIndisponiveis}\n\n`

  // Listar ativos com problemas
  const ativosComProblema = ativos.filter((a: any) => a.status !== 'operacional')
  if (ativosComProblema.length > 0) {
    blocoAtivos += 'Equipamentos com problemas:\n'
    ativosComProblema.forEach((a: any) => {
      blocoAtivos += `- **${a.nome}** (${a.categorias_ativos?.nome || 'Categoria'}) em ${a.locais?.nome || 'Local'}: ${STATUS_LABELS[a.status] || a.status}\n`
    })
  } else {
    blocoAtivos += 'Todos os equipamentos estão operacionais.\n'
  }

  // -- NCs Abertas --
  let blocoNCs = '## Não Conformidades (NCs) Abertas\n'
  if (ncsAbertas.length === 0) {
    blocoNCs += 'Nenhuma NC aberta no momento. 🎉\n'
  } else {
    // Contadores por criticidade
    const criticas = ncsAbertas.filter((nc: any) => nc.criticidade === 'critico').length
    const importantes = ncsAbertas.filter((nc: any) => nc.criticidade === 'importante').length
    const informativas = ncsAbertas.filter((nc: any) => nc.criticidade === 'informativo').length
    blocoNCs += `Total: ${ncsAbertas.length} | Críticas: ${criticas} | Importantes: ${importantes} | Informativas: ${informativas}\n\n`

    // Contadores por status
    const porStatus = new Map<string, number>()
    ncsAbertas.forEach((nc: any) => {
      porStatus.set(nc.status, (porStatus.get(nc.status) || 0) + 1)
    })
    blocoNCs += 'Por status: '
    porStatus.forEach((count, status) => {
      blocoNCs += `${STATUS_NC_LABELS[status] || status}: ${count} | `
    })
    blocoNCs += '\n\n'

    // Listar cada NC
    blocoNCs += 'Detalhes:\n'
    ncsAbertas.forEach((nc: any) => {
      const responsavel = nc.usuarios?.nome || 'Sem responsável'
      const ativoNome = nc.ativos?.nome || 'N/A'
      const localNome = nc.ativos?.locais?.nome || 'N/A'
      const prazoStr = nc.prazo ? new Date(nc.prazo).toLocaleDateString('pt-BR') : 'Sem prazo'
      blocoNCs += `- **${nc.numero_unico || 'NC'}** | ${CRITICIDADE_LABELS[nc.criticidade] || nc.criticidade} | ${STATUS_NC_LABELS[nc.status] || nc.status} | Ativo: ${ativoNome} (${localNome}) | Tipo: ${nc.tipo} | Setor: ${nc.setor_responsavel || 'N/A'} | Responsável: ${responsavel} | Prazo: ${prazoStr} | Aberta em: ${new Date(nc.criado_em).toLocaleDateString('pt-BR')}\n`
    })
  }

  // -- Ranking de recorrência (ativos com mais NCs) --
  let blocoRecorrencia = '## Recorrência de NCs por Equipamento\n'
  const contagemPorAtivo = new Map<string, { nome: string; local: string; count: number }>()
  ;[...ncsAbertas, ...ncsEncerradas].forEach((nc: any) => {
    const ativoNome = nc.ativos?.nome
    if (!ativoNome) return
    const existing = contagemPorAtivo.get(ativoNome)
    if (existing) {
      existing.count++
    } else {
      contagemPorAtivo.set(ativoNome, {
        nome: ativoNome,
        local: nc.ativos?.locais?.nome || 'N/A',
        count: 1,
      })
    }
  })
  const rankingRecorrencia = Array.from(contagemPorAtivo.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)

  if (rankingRecorrencia.length > 0) {
    rankingRecorrencia.forEach((item, i) => {
      blocoRecorrencia += `${i + 1}. **${item.nome}** (${item.local}): ${item.count} NCs\n`
    })
  } else {
    blocoRecorrencia += 'Sem dados de recorrência.\n'
  }

  // -- Tempo médio de resolução --
  // Mapa de datas reais de encerramento do histórico
  const mapaEncerramentos = new Map<string, string>()
  if (historicoEncerramentoRes.data) {
    historicoEncerramentoRes.data.forEach((h: any) => {
      const existente = mapaEncerramentos.get(h.nao_conformidade_id)
      if (!existente || new Date(h.criado_em) > new Date(existente)) {
        mapaEncerramentos.set(h.nao_conformidade_id, h.criado_em)
      }
    })
  }

  let blocoTempoResolucao = '## Tempo Médio de Resolução (Últimos 30 dias)\n'
  if (ncsEncerradas.length > 0) {
    const tempos = ncsEncerradas
      .map((nc: any) => {
        const dataEncerramento = mapaEncerramentos.get(nc.id)
        if (!dataEncerramento) return 0
        const ini = new Date(nc.criado_em).getTime()
        const fim = new Date(dataEncerramento).getTime()
        return Math.max(fim - ini, 0)
      })
      .filter((t: number) => t > 0)

    if (tempos.length > 0) {
      const mediaMs = tempos.reduce((a: number, b: number) => a + b, 0) / tempos.length
      const horas = Math.floor(mediaMs / 3600000)
      const minutos = Math.floor((mediaMs % 3600000) / 60000)
      blocoTempoResolucao += `NCs encerradas: ${ncsEncerradas.length} | Tempo médio: ${horas > 24 ? `${Math.floor(horas / 24)}d ${horas % 24}h` : `${horas}h ${minutos}min`}\n`
    } else {
      blocoTempoResolucao += `NCs encerradas: ${ncsEncerradas.length} | Tempo médio: não calculável\n`
    }
  } else {
    blocoTempoResolucao += 'Nenhuma NC encerrada nos últimos 30 dias.\n'
  }

  // -- Equipe e Produtividade de Inspeções --
  let blocoEquipe = '## Equipe do Hospital\n'
  const inspetores = usuarios.filter((u: any) => u.perfil === 'inspetor')
  const tecnicos = usuarios.filter((u: any) => u.perfil === 'tecnico' || u.perfil === 'engenharia_clinica')
  const coordenadores = usuarios.filter((u: any) => u.perfil === 'coordenador')
  blocoEquipe += `Total cadastrado: ${usuarios.length} | Inspetores: ${inspetores.length} | Técnicos/Engenheiros: ${tecnicos.length} | Coordenadores: ${coordenadores.length}\n\n`

  if (inspetores.length > 0) {
    blocoEquipe += '### Inspetores & Volume de Rondas/Inspeções:\n'
    
    // Contabilizar rondas por inspetor
    const inspetoresComMetricas = inspetores.map((u: any) => {
      const rondas = execucoes.filter((e: any) => e.usuarios?.nome === u.nome || e.usuario_id === u.id).length
      return {
        nome: u.nome || u.email?.split('@')[0] || 'Inspetor',
        email: u.email,
        rondas,
      }
    }).sort((a: { rondas: number }, b: { rondas: number }) => b.rondas - a.rondas)

    inspetoresComMetricas.forEach((ins: { nome: string; rondas: number }, idx: number) => {
      blocoEquipe += `${idx + 1}. **${ins.nome}**: ${ins.rondas} rondas/inspeções concluídas\n`
    })

    if (inspetoresComMetricas.length > 0) {
      const maisRondas = inspetoresComMetricas[0]
      const menosRondas = inspetoresComMetricas[inspetoresComMetricas.length - 1]
      blocoEquipe += `\n* Inspetor com MAIS rondas: **${maisRondas.nome}** (${maisRondas.rondas} rondas)\n`
      blocoEquipe += `* Inspetor com MENOS rondas: **${menosRondas.nome}** (${menosRondas.rondas} rondas)\n`
    }
  }

  if (tecnicos.length > 0) {
    blocoEquipe += '\n### Técnicos e Engenharia Clínica:\n'
    tecnicos.forEach((u: any) => {
      const nome = u.nome || u.email?.split('@')[0] || 'Técnico'
      const ncsResp = ncsAbertas.filter((nc: any) => nc.usuarios?.nome === nome).length
      blocoEquipe += `- **${nome}** (${u.perfil === 'engenharia_clinica' ? 'Engenharia Clínica' : 'Técnico'}): ${ncsResp} NCs atribuídas\n`
    })
  }

  // -- Inspeções recentes --
  let blocoInspecoes = '## Últimas Inspeções Concluídas\n'
  if (execucoes.length === 0) {
    blocoInspecoes += 'Nenhuma inspeção registrada.\n'
  } else {
    execucoes.slice(0, 15).forEach((e: any) => {
      const inspetorNome = e.usuarios?.nome || 'Inspetor'
      const ativoNome = e.ativos?.nome || 'Ativo'
      const localNome = e.ativos?.locais?.nome || 'Local'
      const data = e.finalizado_em
        ? new Date(e.finalizado_em).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
        : 'Em andamento'
      blocoInspecoes += `- ${data} | ${inspetorNome} → ${ativoNome} (${localNome}) | ${e.status}\n`
    })
  }

  // ---- Montar snapshot final ----
  return `# Dados do Hospital — Snapshot em Tempo Real
Data/Hora: ${dataAtual}

${blocoSalas}

${blocoAtivos}

${blocoNCs}

${blocoRecorrencia}

${blocoTempoResolucao}
${itensInfo}

${blocoInspecoes}

${blocoEquipe}
`
}

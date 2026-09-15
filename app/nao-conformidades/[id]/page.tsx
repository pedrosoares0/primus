'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { Botao } from '@/components/ui/Botao'
import { PillTag } from '@/components/ui/PillTag'
import { AvatarPerfil } from '@/components/ui/Avatar'
import { criarClienteSupabase } from '@/lib/supabase/client'
import { SETORES_LABELS, SETORES_CORES, SETORES_ICONES, TIPOS_NC_LABELS, verificarTecnicoAtivo, obterIconeEquipamento } from '@/lib/roteamentoNC'
import type { StatusNaoConformidade, StatusAtivo, SetorTecnico, TipoNaoConformidade } from '@/lib/supabase/types'

const STATUS_CORES: Record<StatusNaoConformidade, 'azul' | 'laranja' | 'verde' | 'vermelho' | 'cinza'> = {
  aberta: 'vermelho',
  em_analise: 'azul',
  em_correcao: 'laranja',
  aguardando_validacao: 'verde',
  encerrada: 'cinza',
  correcao_recusada: 'vermelho',
}

const STATUS_LABELS: Record<StatusNaoConformidade, string> = {
  aberta: 'Aberta',
  em_analise: 'Em Resolução',
  em_correcao: 'Em Correção',
  aguardando_validacao: 'Aguardando Validação',
  encerrada: 'Encerrada',
  correcao_recusada: 'Correção Recusada',
}

function calcularTempoDesdeAbertura(dataCriacao?: string) {
  if (!dataCriacao) return 'Recentemente'
  const criada = new Date(dataCriacao)
  const agora = new Date()
  const diffMs = agora.getTime() - criada.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHoras = Math.floor(diffMins / 60)
  const diffDias = Math.floor(diffHoras / 24)

  if (diffMins < 60) return `Há ${diffMins} min`
  if (diffHoras < 24) return `Há ${diffHoras} h`
  return `Há ${diffDias} d`
}

export default function DetalheNCEngenharia() {
  const params = useParams()
  const router = useRouter()
  const ncId = params.id as string

  const [nc, setNc] = useState<any | null>(null)
  const [usuario, setUsuario] = useState({ id: '', nome: '', perfil: '' })
  const [fotoZoom, setFotoZoom] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [avisoSucesso, setAvisoSucesso] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(true)
  
  // Controle do encerramento pelo Coordenador
  const [mostrarModalConfirmacaoEncerramento, setMostrarModalConfirmacaoEncerramento] = useState(false)
  const [encerrando, setEncerrando] = useState(false)

  // Controle do formulário de manutenção
  const [mostrarFormManutencao, setMostrarFormManutencao] = useState(false)
  const [descricaoReparo, setDescricaoReparo] = useState('')
  const [erroForm, setErroForm] = useState('')

  // Controle de resolução direta
  const [mostrarFormResolucao, setMostrarFormResolucao] = useState(false)
  const [descricaoResolucao, setDescricaoResolucao] = useState('')
  const [erroFormResolucao, setErroFormResolucao] = useState('')

  async function carregarDados() {
    try {
      if (!ncId) return
      const supabase = criarClienteSupabase() as any

      // 1. Obter usuário logado
      let currentUser = null
      const stored = (localStorage.getItem('primus_usuario_atual') || localStorage.getItem('argus_usuario_atual'))
      if (stored) {
        try {
          currentUser = JSON.parse(stored)
        } catch (e) {
          console.error(e)
        }
      }
      
      if (!currentUser) {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const { data: profile } = await supabase
            .from('usuarios')
            .select('id, nome, perfil, hospital_id')
            .eq('id', user.id)
            .single()
          if (profile) {
            currentUser = profile
          }
        }
      }

      if (currentUser) {
        setUsuario({ id: currentUser.id, nome: currentUser.nome, perfil: currentUser.perfil })
      }

      // 2. Buscar a NC pelo ID do Supabase com relacionamentos
      const { data: ncData, error: ncError } = await supabase
        .from('nao_conformidades')
        .select('*, ativos(*, categorias_ativos(*), locais(*, centros_cirurgicos(*, unidades(*)))), itens_execucao_checklist(*, execucoes_checklist(usuario_id, usuarios(id, nome, email, avatar_url, perfil)))')
        .eq('id', ncId)
        .single()

      if (ncError || !ncData) {
        setErro('Não conformidade não encontrada no banco de dados.')
        return
      }

      // 3. Buscar nome do responsável se houver
      let responsavelNome = null
      if (ncData.responsavel_id) {
        const { data: resp } = await supabase
          .from('usuarios')
          .select('nome')
          .eq('id', ncData.responsavel_id)
          .single()
        if (resp) {
          responsavelNome = resp.nome
        }
      }

      // 4. Buscar histórico de status do banco real
      const { data: historicoData } = await supabase
        .from('historico_status_nao_conformidade')
        .select('*')
        .eq('nao_conformidade_id', ncId)
        .order('criado_em', { ascending: true })

      // 5. Buscar registro de manutenção em andamento ou finalizado
      const { data: maintData } = await supabase
        .from('registros_manutencao')
        .select('*')
        .eq('nao_conformidade_id', ncId)
        .order('criado_em', { ascending: false })

      const localAtivo = ncData.ativos?.locais || {}
      const centroCirurgico = localAtivo.centros_cirurgicos || {}
      const unidade = centroCirurgico.unidades || {}
      const itemExec = ncData.itens_execucao_checklist || {}
      const execChecklist = Array.isArray(itemExec.execucoes_checklist) 
        ? itemExec.execucoes_checklist[0] 
        : (itemExec.execucoes_checklist || {})
      const inspetorUsuario = Array.isArray(execChecklist.usuarios) 
        ? execChecklist.usuarios[0] 
        : (execChecklist.usuarios || null)

      let criadoPorNome = 'Inspetor'
      let criadoPorAvatar = null
      let criadoPorPerfil = 'inspetor'

      if (inspetorUsuario) {
        criadoPorNome = inspetorUsuario.nome || 'Inspetor'
        criadoPorAvatar = inspetorUsuario.avatar_url || null
        criadoPorPerfil = inspetorUsuario.perfil || 'inspetor'
      } else if (execChecklist.usuario_id) {
        const { data: uData } = await supabase
          .from('usuarios')
          .select('nome, avatar_url, perfil')
          .eq('id', execChecklist.usuario_id)
          .single()
        if (uData) {
          criadoPorNome = uData.nome || 'Inspetor'
          criadoPorAvatar = uData.avatar_url || null
          criadoPorPerfil = uData.perfil || 'inspetor'
        }
      }

      const descItem = (typeof itemExec.item_congelado === 'string' ? itemExec.item_congelado : itemExec.item_congelado?.descricao) || null
      const descFinal = itemExec.evidencia_texto || descItem || 'Não conformidade registrada no checklist.'

      // Formatar objeto da NC
      setNc({
        id: ncData.id,
        numero_unico: ncData.numero_unico || `NC-${ncData.criado_em ? new Date(ncData.criado_em).getFullYear() : '2026'}-${ncData.id.substring(0, 4).toUpperCase()}`,
        descricao: descFinal,
        criticidade: ncData.criticidade,
        status: ncData.status,
        prazo: ncData.prazo,
        created_at: ncData.criado_em,
        evidencia_url: ncData.evidencia_url || itemExec.evidencia_url || null,
        ativo: ncData.ativos ? {
          id: ncData.ativos.id,
          local_id: ncData.ativos.local_id,
          nome: ncData.ativos.nome,
          categoria: ncData.ativos.categorias_ativos?.nome || 'Equipamento',
          status: ncData.ativos.status,
          codigo_qr: ncData.ativos.codigo_qr,
          patrimonio: ncData.ativos.patrimonio,
        } : null,
        local: {
          nome: localAtivo.nome || 'Sala',
          unidade: unidade.nome || centroCirurgico.nome || '',
        },
        item_execucao: {
          item_congelado: descItem || ncData.ativos?.nome || 'Equipamento',
          evidencia_texto: itemExec.evidencia_texto || null,
        },
        criado_por_nome: criadoPorNome,
        criado_por_avatar: criadoPorAvatar,
        criado_por_perfil: criadoPorPerfil,
        responsavel_nome: responsavelNome,
        responsavel_id: ncData.responsavel_id,
        tipo: ncData.tipo || 'equipamento',
        setor_responsavel: ncData.setor_responsavel || null,
        registro_manutencao: maintData && maintData.length > 0 ? maintData[0] : null,
        historico: (historicoData || []).map((h: any) => ({
          ...h,
          status_anterior: h.status_de || h.status_anterior,
          status_novo: h.status_para || h.status_novo,
          created_at: h.criado_em || h.created_at,
        })),
      })

    } catch (err: any) {
      console.error(err)
      setErro(`Erro de conexão ao carregar dados: ${err.message || err}`)
    } finally {
      setCarregando(false)
    }
  }

  // Carrega dados iniciais
  useEffect(() => {
    carregarDados()
  }, [ncId])

  function atualizarNC() {
    carregarDados()
  }

  // Ação: Encerrar NC (Coordenador)
  async function executarEncerramentoNC() {
    if (!nc || encerrando) return
    setEncerrando(true)
    try {
      const supabase = criarClienteSupabase() as any

      // 1. Encerrar a NC
      const { error: ncError } = await supabase
        .from('nao_conformidades')
        .update({ 
          status: 'encerrada', 
          responsavel_id: usuario.id || nc.responsavel_id 
        })
        .eq('id', nc.id)

      if (ncError) throw ncError

      // 2. Restaurar status do Ativo para operacional
      if (nc.ativo?.id) {
        await supabase
          .from('ativos')
          .update({ status: 'operacional' })
          .eq('id', nc.ativo.id)
      }

      // 3. Registrar no histórico
      await supabase
        .from('historico_status_nao_conformidade')
        .insert({
          nao_conformidade_id: nc.id,
          status_de: nc.status,
          status_para: 'encerrada',
          usuario_id: usuario.id || null,
        })

      setMostrarModalConfirmacaoEncerramento(false)
      setAvisoSucesso('Não conformidade encerrada com sucesso!')
      setTimeout(() => setAvisoSucesso(null), 4000)
      atualizarNC()
    } catch (err: any) {
      console.error(err)
      alert(`Erro ao encerrar NC: ${err.message || err}`)
    } finally {
      setEncerrando(false)
    }
  }

  // Ação: Assumir NC
  async function handleAssumir() {
    if (!nc) return
    try {
      const supabase = criarClienteSupabase() as any
      
      const { error } = await supabase
        .from('nao_conformidades')
        .update({ responsavel_id: usuario.id })
        .eq('id', nc.id)

      if (error) throw error

      await supabase
        .from('historico_status_nao_conformidade')
        .insert({
          nao_conformidade_id: nc.id,
          status_de: nc.status,
          status_para: nc.status,
          usuario_id: usuario.id,
        })

      setAvisoSucesso('Você assumiu a responsabilidade por esta NC.')
      setTimeout(() => setAvisoSucesso(null), 4000)
      atualizarNC()
    } catch (err: any) {
      console.error(err)
      alert(`Erro ao assumir NC: ${err.message}`)
    }
  }

  // Ação: Iniciar Análise
  async function handleIniciarAnalise() {
    if (!nc) return
    try {
      const supabase = criarClienteSupabase() as any
      
      const { error } = await supabase
        .from('nao_conformidades')
        .update({ status: 'em_analise', responsavel_id: usuario.id })
        .eq('id', nc.id)

      if (error) throw error

      await supabase
        .from('historico_status_nao_conformidade')
        .insert({
          nao_conformidade_id: nc.id,
          status_de: nc.status,
          status_para: 'em_analise',
          usuario_id: usuario.id,
        })

      setAvisoSucesso('NC recebida com sucesso!')
      setTimeout(() => setAvisoSucesso(null), 4000)
      atualizarNC()
    } catch (err: any) {
      console.error(err)
      alert(`Erro ao receber NC: ${err.message}`)
    }
  }

  // Ação: Confirmar envio de registro de reparo e mudar para em_correcao
  async function handleSalvarCorrecao(e: React.FormEvent) {
    e.preventDefault()
    if (!nc) return
    if (!descricaoReparo.trim()) {
      setErroForm('Por favor, descreva o diagnóstico ou ações realizadas.')
      return
    }

    try {
      const supabase = criarClienteSupabase() as any

      const { error: maintError } = await supabase
        .from('registros_manutencao')
        .insert({
          nao_conformidade_id: nc.id,
          usuario_id: usuario.id,
          descricao: descricaoReparo,
          status: 'em_andamento',
        })

      if (maintError) throw maintError

      const { error: ncError } = await supabase
        .from('nao_conformidades')
        .update({ status: 'em_correcao' })
        .eq('id', nc.id)

      if (ncError) throw ncError

      if (nc.ativo?.id) {
        await supabase
          .from('ativos')
          .update({ status: 'em_manutencao' })
          .eq('id', nc.ativo.id)
      }

      await supabase
        .from('historico_status_nao_conformidade')
        .insert({
          nao_conformidade_id: nc.id,
          status_de: nc.status,
          status_para: 'em_correcao',
          usuario_id: usuario.id,
        })

      setAvisoSucesso('Manutenção registrada e status alterado para Em Correção.')
      setMostrarFormManutencao(false)
      setDescricaoReparo('')
      setErroForm('')
      setTimeout(() => setAvisoSucesso(null), 4000)
      atualizarNC()
    } catch (err: any) {
      console.error(err)
      setErroForm(`Erro ao salvar manutenção: ${err.message}`)
    }
  }

  // Ação: Finalizar Reparo
  async function handleFinalizarReparo() {
    if (!nc) return
    try {
      const supabase = criarClienteSupabase() as any

      if (nc.registro_manutencao?.id) {
        const { error: maintError } = await supabase
          .from('registros_manutencao')
          .update({ status: 'finalizada', finalizada_em: new Date().toISOString() })
          .eq('id', nc.registro_manutencao.id)
        if (maintError) throw maintError
      }

      const { error: ncError } = await supabase
        .from('nao_conformidades')
        .update({ status: 'aguardando_validacao' })
        .eq('id', nc.id)

      if (ncError) throw ncError

      await supabase
        .from('historico_status_nao_conformidade')
        .insert({
          nao_conformidade_id: nc.id,
          status_de: nc.status,
          status_para: 'aguardando_validacao',
          usuario_id: usuario.id,
        })

      setAvisoSucesso('Reparo finalizado! NC enviada para validação do coordenador.')
      setTimeout(() => setAvisoSucesso(null), 4000)
      atualizarNC()
    } catch (err: any) {
      console.error(err)
      alert(`Erro ao finalizar reparo: ${err.message}`)
    }
  }

  // Ação: Coordenador resolve NC diretamente
  async function handleResolverDiretamente(e: React.FormEvent) {
    e.preventDefault()
    if (!nc) return
    if (!descricaoResolucao.trim()) {
      setErroFormResolucao('Por favor, descreva a resolução aplicada.')
      return
    }

    try {
      const supabase = criarClienteSupabase() as any

      await supabase
        .from('registros_manutencao')
        .insert({
          nao_conformidade_id: nc.id,
          usuario_id: usuario.id,
          descricao: descricaoResolucao,
          status: 'finalizada',
          finalizada_em: new Date().toISOString(),
        })

      const { error: ncError } = await supabase
        .from('nao_conformidades')
        .update({ 
          status: 'encerrada', 
          responsavel_id: usuario.id 
        })
        .eq('id', nc.id)

      if (ncError) throw ncError

      if (nc.ativo?.id) {
        await supabase
          .from('ativos')
          .update({ status: 'operacional' })
          .eq('id', nc.ativo.id)
      }

      await supabase
        .from('historico_status_nao_conformidade')
        .insert({
          nao_conformidade_id: nc.id,
          status_de: nc.status,
          status_para: 'encerrada',
          usuario_id: usuario.id,
        })

      setAvisoSucesso('NC resolvida e encerrada diretamente.')
      setMostrarFormResolucao(false)
      setDescricaoResolucao('')
      setErroFormResolucao('')
      setTimeout(() => setAvisoSucesso(null), 4000)
      atualizarNC()
    } catch (err: any) {
      console.error(err)
      setErroFormResolucao(`Erro ao resolver NC: ${err.message}`)
    }
  }

  if (erro) {
    return (
      <div className="px-5 pt-10 text-center space-y-4">
        <p className="text-red-500 font-bold">{erro}</p>
        <button
          type="button"
          onClick={() => router.back()}
          className="inline-block text-[#17A592] font-bold cursor-pointer"
        >
          Voltar
        </button>
      </div>
    )
  }

  if (!nc) {
    return <div className="px-5 pt-10 text-center text-gray-500">Carregando...</div>
  }

  const corCriticidade =
    nc.criticidade === 'critico'
      ? 'vermelho'
      : nc.criticidade === 'importante'
      ? 'laranja'
      : 'azul'

  const corStatus = STATUS_CORES[nc.status as StatusNaoConformidade]
  const labelStatus = STATUS_LABELS[nc.status as StatusNaoConformidade]

  // Regra de Negócio: verificar se tem outro responsável
  const temOutroResponsavel = nc.responsavel_id !== null && nc.responsavel_id !== usuario.id

  // Identificação do perfil do usuário
  const ehCoordenador = usuario.perfil === 'coordenador' || usuario.perfil === 'gestor' || usuario.perfil === 'administrador'
  const setorNC = nc.setor_responsavel as SetorTecnico | null
  const temTecnicoNoSetor = verificarTecnicoAtivo(setorNC)
  const podeResolverDiretamente = ehCoordenador && !temTecnicoNoSetor && nc.status !== 'encerrada' && nc.status !== 'aguardando_validacao'
  const fotoAtivo = nc.ativo?.foto_url || obterIconeEquipamento(nc.ativo?.nome, nc.ativo?.categoria)

  function handleVoltar() {
    if (ehCoordenador) {
      router.push('/coordenador?aba=ncs')
    } else if (usuario.perfil === 'engenharia_clinica' || usuario.perfil === 'tecnico') {
      router.push('/engenharia')
    } else if (usuario.perfil === 'inspetor') {
      router.push('/inspetor')
    } else {
      if (typeof window !== 'undefined' && window.history.length > 1) {
        router.back()
      } else {
        router.push('/coordenador?aba=ncs')
      }
    }
  }

  return (
    <div className="min-h-screen bg-[#F4F6FA] pb-36">
      {/* Header com botão voltar e status limpo */}
      <div className="bg-white border-b border-gray-100 px-5 py-4 flex items-center justify-between relative z-30">
        <button
          type="button"
          onClick={handleVoltar}
          className="inline-flex items-center gap-1.5 text-[13px] font-bold text-gray-600 hover:text-black transition-colors cursor-pointer"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          {ehCoordenador ? 'Voltar para NCs' : 'Voltar'}
        </button>

        <div className="flex items-center gap-2">
          {/* Apenas exibe status se NÃO estiver aberta, evitando conflito visual com o badge crítico */}
          {nc.status !== 'aberta' && (
            <PillTag cor={corStatus}>{labelStatus}</PillTag>
          )}
        </div>
      </div>

      <div className="px-5 pt-4 space-y-4">
        {/* Toast Notificação de Sucesso */}
        {avisoSucesso && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-emerald-800 text-xs font-bold animate-[fadeIn_0.2s_ease-out] flex items-center gap-2">
            <svg className="w-4 h-4 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
            <span>{avisoSucesso}</span>
          </div>
        )}

        {/* Alerta de Responsável (visível para técnicos) */}
        {!ehCoordenador && temOutroResponsavel && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-amber-800 text-xs font-bold flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
              </svg>
            </div>
            <div>
              <p className="text-[13px] font-bold text-gray-900">Outro Responsável</p>
              <p className="text-[11px] text-gray-500 font-medium mt-0.5">
                Esta NC já está sob cuidados de <span className="font-bold">{nc.responsavel_nome}</span>. As ações de alteração foram bloqueadas.
              </p>
            </div>
          </div>
        )}

        {/* ── CARD 1: O ATIVO (Com foto/ícone oficial do ativo) ── */}
        <div className="bg-white rounded-[24px] p-5 shadow-[var(--shadow-card)] border border-gray-100/80">
          <div className="flex items-start gap-3.5">
            <div className="relative w-12 h-12 rounded-[18px] overflow-hidden bg-gray-50 flex items-center justify-center shrink-0 border border-gray-100/80 shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
              <img
                src={fotoAtivo}
                alt={nc.ativo?.nome || 'Ativo'}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                {nc.ativo?.categoria || 'Equipamento'}
              </span>
              <h2 className="text-base font-extrabold text-gray-900 leading-snug tracking-tight mt-0.5">
                {nc.ativo?.nome || 'Equipamento'}
              </h2>
              <div className="flex items-center gap-1.5 mt-1 text-xs text-gray-500 font-medium">
                <svg className="w-3.5 h-3.5 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                </svg>
                <span className="truncate font-semibold text-gray-700">{nc.local.nome}</span>
                {nc.local.unidade && (
                  <>
                    <span className="text-gray-300">•</span>
                    <span className="truncate text-gray-400">{nc.local.unidade}</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── CARD 2: A NÃO CONFORMIDADE / OCORRÊNCIA ── */}
        <div className="bg-white rounded-[24px] p-5 shadow-[var(--shadow-card)] border border-gray-100/80 space-y-4">
          {/* Metadados: Duas linhas separadas e bem estruturadas, sem sobreposição */}
          <div className="space-y-3 pb-3.5 border-b border-gray-100">
            {/* Linha 1: Tipo de Não Conformidade / Criticidade */}
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                Tipo de Não Conformidade:
              </span>
              <PillTag cor={corCriticidade}>
                {nc.criticidade === 'critico' ? 'Crítico' : nc.criticidade === 'importante' ? 'Importante' : 'Informativo'}
              </PillTag>
            </div>

            {/* Linha 2: Encaminhado para */}
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                Encaminhado para:
              </span>
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold ${
                setorNC && SETORES_CORES[setorNC]
                  ? `${SETORES_CORES[setorNC].bg} ${SETORES_CORES[setorNC].text} border ${SETORES_CORES[setorNC].border}`
                  : 'bg-teal-50 text-[#17A592] border border-teal-200'
              }`}>
                <span>{setorNC ? SETORES_ICONES[setorNC] : '⚙️'}</span>
                <span>{setorNC ? SETORES_LABELS[setorNC] : 'Engenharia Clínica'}</span>
              </span>
            </div>
          </div>

          {/* Item do checklist afetado (se relevante) */}
          {nc.item_execucao?.item_congelado && nc.item_execucao.item_congelado !== nc.ativo?.nome && (
            <div>
              <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Item Afetado</h4>
              <p className="text-[13px] font-bold text-gray-800 mt-0.5">{nc.item_execucao.item_congelado}</p>
            </div>
          )}

          {/* Descrição limpa, direta e sem repetição de texto */}
          <div className="space-y-1.5">
            <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Descrição da Ocorrência</h4>
            <div className="bg-gray-50/80 p-3.5 rounded-2xl border border-gray-100/90 text-xs text-gray-700 leading-relaxed font-medium">
              {nc.descricao || 'Nenhum detalhe adicional informado.'}
            </div>
          </div>

          {/* Evidência Fotográfica (se houver) */}
          {nc.evidencia_url && (
            <div className="space-y-1.5">
              <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Foto Registrada</h4>
              <div 
                className="relative group cursor-zoom-in overflow-hidden rounded-2xl border border-gray-200"
                onClick={() => setFotoZoom(nc.evidencia_url)}
              >
                <img
                  src={nc.evidencia_url}
                  alt="Foto de evidência"
                  className="w-full h-48 object-cover hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="bg-white/90 text-xs font-bold text-gray-800 px-3 py-1.5 rounded-full shadow-sm">
                    Ampliar Imagem
                  </span>
                </div>
              </div>
            </div>
          )}

          <div className="h-px bg-gray-100" />

          {/* Inspetor que registrou a NC */}
          <div className="flex items-center gap-3 pt-0.5">
            <AvatarPerfil
              perfil={nc.criado_por_perfil || 'inspetor'}
              nome={nc.criado_por_nome}
              avatarUrl={nc.criado_por_avatar}
              tamanho="sm"
            />
            <div>
              <p className="text-xs font-bold text-gray-900">Registrado por {nc.criado_por_nome}</p>
              <p className="text-[10px] text-gray-400">
                {new Date(nc.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        </div>

        {/* ── FORMULÁRIO DE REGISTRO DE MANUTENÇÃO (Técnico) ── */}
        {mostrarFormManutencao && (
          <div className="bg-white rounded-[24px] p-5 shadow-[var(--shadow-card)] border-2 border-[#17A592]/20 space-y-4 animate-[fadeIn_0.15s_ease-out]">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-900">Registrar Ação de Manutenção</h3>
              <button
                type="button"
                onClick={() => {
                  setMostrarFormManutencao(false)
                  setErroForm('')
                }}
                className="text-gray-400 hover:text-gray-600 text-xs font-bold"
              >
                Cancelar
              </button>
            </div>
            
            <form onSubmit={handleSalvarCorrecao} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                  Descrição das Ações Realizadas
                </label>
                <textarea
                  required
                  rows={4}
                  value={descricaoReparo}
                  onChange={(e) => setDescricaoReparo(e.target.value)}
                  placeholder="Descreva o diagnóstico inicial, peças trocadas, calibração realizada ou justificativa do reparo..."
                  className="w-full bg-[#F4F6FA] border border-gray-200/80 rounded-2xl px-4 py-3 text-[15px] text-gray-900 placeholder:text-gray-400 outline-none focus:border-[#17A592] focus:ring-1 focus:ring-[#17A592]/10 transition-all resize-none"
                />
                {erroForm && <p className="text-[11px] text-red-500 font-medium">{erroForm}</p>}
              </div>

              <Botao
                type="submit"
                variante="primario"
                tamanho="sm"
                larguraTotal
              >
                Gravar Registro e Avançar
              </Botao>
            </form>
          </div>
        )}

        {/* ── CARD 3: REGISTRO DE MANUTENÇÃO (Se houver) ── */}
        {nc.registro_manutencao && !mostrarFormManutencao && (
          <div className="bg-white rounded-[24px] p-5 shadow-[var(--shadow-card)] border border-gray-100/80 space-y-4 animate-[fadeIn_0.2s_ease-out]">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-gray-400 tracking-wider uppercase">Registro Técnico de Manutenção</span>
              <PillTag cor={nc.registro_manutencao.status === 'finalizada' ? 'verde' : 'laranja'}>
                {nc.registro_manutencao.status === 'finalizada' ? 'Finalizado' : 'Em andamento'}
              </PillTag>
            </div>

            <div className="bg-teal-50/40 rounded-xl p-3 border border-teal-100/50">
              <p className="text-xs text-gray-700 leading-relaxed font-normal">
                {nc.registro_manutencao.descricao}
              </p>
            </div>

            <div className="flex items-center justify-between text-[11px]">
              <div className="flex items-center gap-1.5 text-gray-400 font-medium">
                <svg className="w-3.5 h-3.5 text-gray-300" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                </svg>
                <span>Responsável: <span className="font-bold text-gray-600">{nc.responsavel_nome || 'N/A'}</span></span>
              </div>
            </div>

            {nc.registro_manutencao.finalizada_em && (
              <div className="text-[10px] text-gray-400 italic flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Finalizado em: {new Date(nc.registro_manutencao.finalizada_em).toLocaleString('pt-BR')}
              </div>
            )}
          </div>
        )}

        {/* ── CARD 4: TIMELINE / HISTÓRICO ── */}
        <div className="bg-white rounded-[24px] p-5 shadow-[var(--shadow-card)] border border-gray-100/80 space-y-4">
          <span className="text-[10px] font-bold text-gray-400 tracking-wider uppercase">Histórico de Alterações</span>

          <div className="relative border-l border-gray-200 pl-4 ml-2.5 space-y-4 py-2">
            {nc.historico.map((hist: any, idx: number) => {
              const bolinhaCor =
                hist.status_novo === 'aberta'
                  ? 'bg-red-500 ring-4 ring-red-100'
                  : hist.status_novo === 'em_analise'
                  ? 'bg-[#17A592] ring-4 ring-[#17A592]/10'
                  : hist.status_novo === 'em_correcao'
                  ? 'bg-amber-500 ring-4 ring-amber-100'
                  : hist.status_novo === 'aguardando_validacao'
                  ? 'bg-teal-500 ring-4 ring-teal-100'
                  : hist.status_novo === 'encerrada'
                  ? 'bg-emerald-500 ring-4 ring-emerald-100'
                  : 'bg-gray-500 ring-4 ring-gray-100'

              return (
                <div key={hist.id} className="relative animate-[fadeIn_0.3s_ease-out]" style={{ animationDelay: `${idx * 40}ms` }}>
                  <span className={`absolute -left-[25.5px] top-[3px] w-2.5 h-2.5 rounded-full ${bolinhaCor}`} />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-gray-800">
                      {hist.status_anterior !== hist.status_novo ? (
                        <>
                          Alterado para <span className="text-[#17A592]">{STATUS_LABELS[hist.status_novo as StatusNaoConformidade]}</span>
                        </>
                      ) : (
                        <>NC assumida por técnico</>
                      )}
                    </p>
                    {hist.justificativa && (
                      <p className="text-xs text-amber-700 bg-amber-50/60 p-2 rounded-lg border border-amber-100 mt-1 max-w-sm">
                        Justificativa: &quot;{hist.justificativa}&quot;
                      </p>
                    )}
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      {new Date(hist.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} ({new Date(hist.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })})
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── BARRA INFERIOR DE CTAs ── */}
      <div className="fixed bottom-0 left-0 right-0 z-40 max-w-md mx-auto px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] bg-gradient-to-t from-[#F4F6FA] via-[#F4F6FA]/90 to-transparent pt-6">
        <div className="bg-white/85 backdrop-blur-[18px] rounded-[24px] border border-white/60 shadow-[0_4px_24px_rgba(0,0,0,0.08)] p-3 flex flex-col gap-2.5">
          
          {/* Se for coordenador, exibe CTA exclusivo de encerramento da NC */}
          {ehCoordenador ? (
            nc.status === 'encerrada' ? (
              <div className="text-center py-3 bg-emerald-50 border border-emerald-100 rounded-2xl text-xs font-bold text-emerald-700 flex items-center justify-center gap-1.5">
                <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Não conformidade encerrada</span>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setMostrarModalConfirmacaoEncerramento(true)}
                className="w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-2xl text-[13px] font-extrabold text-white bg-gradient-to-b from-[#17A592] to-[#0D8775] hover:brightness-105 active:scale-[0.98] shadow-[0_4px_16px_rgba(23,165,146,0.35)] transition-all cursor-pointer"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Encerrar Não Conformidade</span>
              </button>
            )
          ) : temOutroResponsavel ? (
            <div className="text-center py-2 text-xs font-bold text-gray-400">
              Apenas {nc.responsavel_nome} pode interagir com esta NC
            </div>
          ) : (
            <>
              {/* Botão Primário Dinâmico Técnico */}
              {(nc.status === 'aberta' || nc.status === 'correcao_recusada') && (
                <Botao
                  variante="primario"
                  tamanho="lg"
                  larguraTotal
                  onClick={handleIniciarAnalise}
                  icone={
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  }
                >
                  Receber NC
                </Botao>
              )}

              {nc.status === 'em_analise' && !mostrarFormManutencao && (
                <Botao
                  variante="primario"
                  tamanho="lg"
                  larguraTotal
                  onClick={() => setMostrarFormManutencao(true)}
                  icone={
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                    </svg>
                  }
                >
                  Registrar Correção
                </Botao>
              )}

              {nc.status === 'em_correcao' && (
                <Botao
                  variante="primario"
                  tamanho="lg"
                  larguraTotal
                  onClick={handleFinalizarReparo}
                  icone={
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  }
                >
                  Concluir
                </Botao>
              )}

              {nc.status === 'aguardando_validacao' && (
                <div className="text-center py-3 bg-gray-50 border border-gray-100 rounded-full text-xs font-bold text-gray-500 flex items-center justify-center gap-1.5">
                  <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Aguardando validação do Coordenador</span>
                </div>
              )}

              {nc.status === 'encerrada' && (
                <div className="text-center py-3 bg-emerald-50 border border-emerald-100 rounded-full text-xs font-bold text-emerald-700 flex items-center justify-center gap-1.5">
                  <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Não conformidade encerrada</span>
                </div>
              )}

              {/* Botão Secundário para Técnico: Chamar Coordenador */}
              {!mostrarFormManutencao && nc.status !== 'encerrada' && (
                <button
                  type="button"
                  onClick={() => alert('Coordenador acionado via notificação rápida.')}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-full text-xs font-bold text-gray-600 bg-white hover:bg-gray-50 transition-colors border border-gray-200 cursor-pointer active:scale-95"
                >
                  <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2.2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.05 4.575a1.575 1.575 0 11-3.15 0 1.575 1.575 0 013.15 0zM8.475 7.875a.75.75 0 01.75.75v3.188a.75.75 0 01-1.5 0V8.625a.75.75 0 01.75-.75zM12 18.75a.75.75 0 110-1.5.75.75 0 010 1.5z" />
                  </svg>
                  Chamar Coordenador
                </button>
              )}

              {/* Botão extra: Assumir NC se estiver aberta ou recusada e sem responsável */}
              {(nc.status === 'aberta' || nc.status === 'correcao_recusada') && nc.responsavel_id === null && (
                <button
                  type="button"
                  onClick={handleAssumir}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-full text-[11px] font-bold text-[#17A592] hover:bg-[#17A592]/5 transition-colors cursor-pointer active:scale-95"
                >
                  Assumir NC sem iniciar análise
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── MODAL DE CONFIRMAÇÃO DE ENCERRAMENTO (Identidade Primus) ── */}
      {mostrarModalConfirmacaoEncerramento && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-[fadeIn_0.15s_ease-out]">
          <div className="bg-white rounded-[28px] p-5 sm:p-6 max-w-md w-full shadow-2xl border border-gray-100 space-y-4">
            <div className="flex items-center gap-3 pb-1 border-b border-gray-100">
              <div className="w-10 h-10 rounded-2xl bg-teal-50 border border-teal-100 text-[#17A592] flex items-center justify-center shrink-0">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-bold text-gray-900 tracking-tight">Encerrar Não Conformidade?</h3>
                <p className="text-xs text-gray-500 font-medium">Confirme os dados antes de finalizar</p>
              </div>
            </div>

            {/* Card Visual de Prévia da NC (Identidade Visual Fiel ao Card do Ativo) */}
            <div className="bg-[#FAFBFD] rounded-[24px] p-4 border border-slate-200/90 shadow-xs space-y-3">
              {/* Header do Card: Dias na Esquerda, Badges na Direita */}
              <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-200/60">
                <span className="text-xs text-slate-500 font-bold font-nunito whitespace-nowrap shrink-0 flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {calcularTempoDesdeAbertura(nc.created_at)}
                </span>
                <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                  <span className={`text-[10.5px] font-bold font-nunito px-2.5 py-0.5 rounded-full border inline-flex items-center gap-1 whitespace-nowrap ${
                    SETORES_CORES[nc.setor_responsavel as SetorTecnico]
                      ? `${SETORES_CORES[nc.setor_responsavel as SetorTecnico].bg} ${SETORES_CORES[nc.setor_responsavel as SetorTecnico].text} ${SETORES_CORES[nc.setor_responsavel as SetorTecnico].border}`
                      : 'bg-amber-50 text-amber-800 border-amber-200/80'
                  }`}>
                    <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />
                    {SETORES_LABELS[nc.setor_responsavel as SetorTecnico] || 'Engenharia Clínica'}
                  </span>
                  <PillTag cor={nc.criticidade === 'critico' ? 'vermelho' : nc.criticidade === 'importante' ? 'laranja' : 'azul'}>
                    {nc.criticidade === 'critico' ? 'Crítico' : nc.criticidade === 'importante' ? 'Importante' : 'Informativo'}
                  </PillTag>
                </div>
              </div>

              {/* Informações: Foto/Miniatura à ESQUERDA e Texto à DIREITA (Centralizado na Altura) */}
              <div className="flex items-center gap-3.5">
                <div className="w-16 h-16 sm:w-18 sm:h-18 rounded-[18px] overflow-hidden border border-slate-200/80 shrink-0 shadow-xs bg-slate-100 flex items-center justify-center">
                  <img
                    src={nc.foto_url || obterIconeEquipamento(nc.ativo?.nome, nc.ativo?.categoria)}
                    alt={nc.ativo?.nome || 'Ativo'}
                    className="w-full h-full object-cover"
                  />
                </div>

                <div className="flex-1 min-w-0">
                  <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider font-nunito block leading-none mb-1">
                    {nc.ativo?.categoria || 'EQUIPAMENTO'}
                  </span>
                  <h4 className="text-[15px] font-bold text-slate-900 leading-snug tracking-tight font-nunito truncate">
                    {nc.ativo?.nome || 'Equipamento'}
                  </h4>
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-1 font-medium truncate">
                    <svg className="w-3.5 h-3.5 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                    </svg>
                    <span className="font-bold text-slate-700">{nc.local?.nome || 'Sala'}</span>
                    <span>•</span>
                    <span className="text-slate-500">{nc.local?.unidade || 'Unidade de Internação'}</span>
                  </div>
                </div>
              </div>

              {/* Box elegante do Motivo / Problema Relatado */}
              {(nc.item_execucao?.evidencia_texto || nc.item_execucao?.item_congelado) && (
                <div className="bg-white rounded-xl px-3 py-2 border border-slate-200/70 text-xs text-slate-700 font-medium leading-relaxed shadow-2xs">
                  <span className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Problema relatado</span>
                  <p className="line-clamp-2">
                    {nc.item_execucao?.evidencia_texto || nc.item_execucao?.item_congelado}
                  </p>
                </div>
              )}
            </div>

            <p className="text-xs text-gray-500 font-medium leading-relaxed text-center px-2">
              O status será alterado para <strong className="text-gray-800">Encerrada</strong> e o ativo retornará para condição <strong className="text-emerald-700">Operacional</strong>.
            </p>

            <div className="flex gap-2.5 pt-1">
              <button
                type="button"
                disabled={encerrando}
                onClick={() => setMostrarModalConfirmacaoEncerramento(false)}
                className="flex-1 py-3 rounded-xl text-xs font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors disabled:opacity-50 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={encerrando}
                onClick={executarEncerramentoNC}
                className="flex-1 py-3 rounded-xl text-xs font-bold text-white bg-gradient-to-b from-[#17A592] to-[#0D8775] hover:brightness-105 shadow-[0_4px_12px_rgba(23,165,146,0.3)] active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5"
              >
                {encerrando ? (
                  <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  'Sim, Encerrar'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL ZOOM FOTO ── */}
      {fotoZoom && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-[fadeIn_0.18s_ease-out]"
          onClick={() => setFotoZoom(null)}
        >
          <div className="relative max-w-md w-full max-h-[80vh] flex flex-col items-center">
            <button
              type="button"
              className="absolute -top-12 right-2 text-white bg-white/10 hover:bg-white/20 p-2.5 rounded-full text-sm font-bold shadow-sm transition-colors cursor-pointer"
              onClick={() => setFotoZoom(null)}
            >
              Fechar ✕
            </button>
            <img
              src={fotoZoom}
              alt="Evidência expandida"
              className="w-full max-h-[70vh] object-contain rounded-2xl shadow-2xl"
            />
          </div>
        </div>
      )}
    </div>
  )
}

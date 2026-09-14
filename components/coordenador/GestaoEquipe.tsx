'use client'

import { useState, useEffect } from 'react'
import { criarClienteSupabase } from '@/lib/supabase/client'
import { dadosCache } from '@/lib/cache/dadosCache'
import { SETORES_LABELS, SETORES_CORES } from '@/lib/roteamentoNC'
import { Avatar, AvatarPerfil } from '@/components/ui/Avatar'
import type { SetorTecnico } from '@/lib/supabase/types'

interface GestaoEquipeProps {
  hospitalId: string
}

interface MembroEquipe {
  id: string
  nome: string
  email: string
  perfil: string
  setor: SetorTecnico | null
  // Métricas
  rondasRealizadas: number
  ultimaRonda: string | null
  ncsResponsavel: number
  ncsResolvidas: number
  ultimaAcao: string | null
}

export function GestaoEquipe({ hospitalId }: GestaoEquipeProps) {
  const [subAba, setSubAba] = useState<'inspetores' | 'tecnicos'>('inspetores')
  const cacheKey = `coordenador_equipe_${hospitalId}`
  const dadosIniciais = dadosCache.get<{ inspetores: MembroEquipe[]; tecnicos: MembroEquipe[] }>(cacheKey)

  const [inspetores, setInspetores] = useState<MembroEquipe[]>(() => dadosIniciais?.inspetores || [])
  const [tecnicos, setTecnicos] = useState<MembroEquipe[]>(() => dadosIniciais?.tecnicos || [])
  const [carregando, setCarregando] = useState(() => !dadosIniciais)

  useEffect(() => {
    async function carregarEquipe() {
      if (!dadosCache.get(cacheKey)) {
        setCarregando(true)
      }
      try {
        const supabase = criarClienteSupabase() as any

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

        // Executar busca de usuários, execuções e NCs em PARALELO (Promise.all)
        let queryUsuarios = supabase
          .from('usuarios')
          .select('id, nome, email, perfil')
          .in('perfil', ['inspetor', 'engenharia_clinica', 'tecnico'])

        if (hospitalId) {
          queryUsuarios = queryUsuarios.eq('hospital_id', hospitalId)
        }

        const [usuariosRes, execucoesRes, ncsRes] = await Promise.all([
          queryUsuarios,
          supabase
            .from('execucoes_checklist')
            .select('id, usuario_id, finalizado_em, iniciado_em, status')
            .eq('status', 'concluida'),
          supabase
            .from('nao_conformidades')
            .select('id, responsavel_id, status, criado_em')
            .eq('hospital_id', hospitalId),
        ])

        let usuarios = usuariosRes.data
        if (!usuarios || usuarios.length === 0) {
          const { data: todosUsuarios } = await supabase
            .from('usuarios')
            .select('id, nome, email, perfil')
            .in('perfil', ['inspetor', 'engenharia_clinica', 'tecnico'])
          usuarios = todosUsuarios
        }

        if (!usuarios) {
          setCarregando(false)
          return
        }

        const inspetoresRaw = usuarios.filter((u: any) => u.perfil === 'inspetor')
        const tecnicosRaw = usuarios.filter((u: any) => u.perfil === 'engenharia_clinica' || u.perfil === 'tecnico')
        const execucoes = execucoesRes.data || []
        const ncs = ncsRes.data || []

        // Mapear dados dos inspetores
        const inspetoresMapeados: MembroEquipe[] = inspetoresRaw.map((u: any) => {
          const rondasUsuario = (execucoes || []).filter((e: any) => e.usuario_id === u.id)
          const ordenadas = rondasUsuario.sort((a: any, b: any) => {
            const dataA = new Date(a.finalizado_em || a.iniciado_em || 0).getTime()
            const dataB = new Date(b.finalizado_em || b.iniciado_em || 0).getTime()
            return dataB - dataA
          })
          const ultimaRonda = ordenadas.length > 0
            ? ordenadas[0].finalizado_em || ordenadas[0].iniciado_em
            : null

          return {
            id: u.id,
            nome: formatarNome(u),
            email: u.email,
            perfil: u.perfil,
            rondasRealizadas: rondasUsuario.length,
            ultimaRonda,
            ncsResponsavel: 0,
            ncsResolvidas: 0,
            ultimaAcao: ultimaRonda,
          }
        })

        // Mapear dados dos técnicos
        const tecnicosMapeados: MembroEquipe[] = tecnicosRaw.map((u: any) => {
          const ncsDoUsuario = (ncs || []).filter((nc: any) => nc.responsavel_id === u.id)
          const resolvidos = ncsDoUsuario.filter((nc: any) => nc.status === 'encerrada')
          const ordenadas = ncsDoUsuario.sort((a: any, b: any) => {
            const dataA = new Date(a.criado_em || 0).getTime()
            const dataB = new Date(b.criado_em || 0).getTime()
            return dataB - dataA
          })
          const ultimaAcao = ordenadas.length > 0 ? ordenadas[0].criado_em : null
          const setorUsuario = u.setor || (u.perfil === 'engenharia_clinica' ? 'engenharia_clinica' : null)

          return {
            id: u.id,
            nome: formatarNome(u),
            email: u.email,
            perfil: u.perfil,
            setor: setorUsuario,
            rondasRealizadas: 0,
            ultimaRonda: null,
            ncsResponsavel: ncsDoUsuario.length,
            ncsResolvidas: resolvidos.length,
            ultimaAcao,
          }
        })

        setInspetores(inspetoresMapeados)
        setTecnicos(tecnicosMapeados)
        dadosCache.set(cacheKey, { inspetores: inspetoresMapeados, tecnicos: tecnicosMapeados })
      } catch (err) {
        console.error('Erro ao carregar equipe:', err)
      } finally {
        setCarregando(false)
      }
    }

    carregarEquipe()
  }, [hospitalId, cacheKey])

  function formatarTempoRelativo(data: string | null) {
    if (!data) return 'Sem registro'
    const agora = new Date()
    const d = new Date(data)
    const diffMs = agora.getTime() - d.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHoras = Math.floor(diffMins / 60)
    const diffDias = Math.floor(diffHoras / 24)

    if (diffMins < 60) return `Há ${diffMins} min`
    if (diffHoras < 24) return `Há ${diffHoras}h`
    if (diffDias === 1) return 'Ontem'
    if (diffDias < 7) return `Há ${diffDias} dias`
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
  }

  function statusAtividade(ultimaAcao: string | null): { label: string; cor: string; bg: string } {
    if (!ultimaAcao) return { label: 'Sem atividade', cor: 'text-gray-400', bg: 'bg-gray-200' }
    const diffHoras = (new Date().getTime() - new Date(ultimaAcao).getTime()) / 3600000
    if (diffHoras < 24) return { label: 'Ativo', cor: 'text-emerald-600', bg: 'bg-emerald-500' }
    if (diffHoras < 72) return { label: 'Recente', cor: 'text-amber-600', bg: 'bg-amber-400' }
    return { label: 'Inativo', cor: 'text-gray-400', bg: 'bg-gray-300' }
  }

  const listaAtual = subAba === 'inspetores' ? inspetores : tecnicos

  if (carregando) {
    return (
      <div className="space-y-4">
        <div className="bg-[#F1F3F6] p-1 rounded-full flex gap-1 select-none">
          <div className="flex-1 h-8 bg-white rounded-full animate-pulse" />
          <div className="flex-1 h-8 bg-gray-200 rounded-full animate-pulse" />
        </div>
        {[1, 2, 3].map((n) => (
          <div key={n} className="bg-white rounded-[24px] p-5 border border-gray-100/80 animate-pulse space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gray-200 rounded-full" />
              <div className="space-y-1 flex-1">
                <div className="h-4 bg-gray-200 rounded w-1/3" />
                <div className="h-3 bg-gray-200 rounded w-1/2" />
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Sub-Segmented Control */}
      <div className="bg-[#F1F3F6] p-1 rounded-full flex gap-1 select-none">
        <button
          onClick={() => setSubAba('inspetores')}
          className={[
            'flex-1 text-center py-2 px-3 text-[11px] font-bold tracking-tight rounded-full transition-all duration-200 cursor-pointer active:scale-95',
            subAba === 'inspetores'
              ? 'bg-white text-slate-800 shadow-[0_2px_6px_rgba(0,0,0,0.06)]'
              : 'text-gray-500 hover:text-slate-800',
          ].join(' ')}
        >
          Inspetores ({inspetores.length})
        </button>
        <button
          onClick={() => setSubAba('tecnicos')}
          className={[
            'flex-1 text-center py-2 px-3 text-[11px] font-bold tracking-tight rounded-full transition-all duration-200 cursor-pointer active:scale-95',
            subAba === 'tecnicos'
              ? 'bg-white text-slate-800 shadow-[0_2px_6px_rgba(0,0,0,0.06)]'
              : 'text-gray-500 hover:text-slate-800',
          ].join(' ')}
        >
          Técnicos ({tecnicos.length})
        </button>
      </div>

      {/* Resumo rápido */}
      <div className="flex gap-2">
        <div className="flex-1 bg-white rounded-2xl p-3 border border-gray-100 shadow-[var(--shadow-card)]">
          <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Total</span>
          <p className="text-xl font-black font-nunito text-gray-900 mt-1">{listaAtual.length}</p>
        </div>
        <div className="flex-1 bg-white rounded-2xl p-3 border border-gray-100 shadow-[var(--shadow-card)]">
          <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Ativos (24h)</span>
          <p className="text-xl font-black font-nunito text-emerald-600 mt-1">
            {listaAtual.filter((m) => {
              if (!m.ultimaAcao) return false
              return (new Date().getTime() - new Date(m.ultimaAcao).getTime()) < 86400000
            }).length}
          </p>
        </div>
        <div className="flex-1 bg-white rounded-2xl p-3 border border-gray-100 shadow-[var(--shadow-card)]">
          <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">
            {subAba === 'inspetores' ? 'Rondas' : 'NCs Ativas'}
          </span>
          <p className="text-xl font-black font-nunito text-[#17A592] mt-1">
            {subAba === 'inspetores'
              ? listaAtual.reduce((acc, m) => acc + m.rondasRealizadas, 0)
              : listaAtual.reduce((acc, m) => acc + m.ncsResponsavel, 0)}
          </p>
        </div>
      </div>

      {/* Lista de membros */}
      {listaAtual.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
          {listaAtual
            .sort((a, b) => {
              // Ordenar por atividade mais recente primeiro
              if (!a.ultimaAcao && !b.ultimaAcao) return 0
              if (!a.ultimaAcao) return 1
              if (!b.ultimaAcao) return -1
              return new Date(b.ultimaAcao).getTime() - new Date(a.ultimaAcao).getTime()
            })
            .map((membro) => {
              const status = statusAtividade(membro.ultimaAcao)
              const nomeLimpo = membro.nome ? membro.nome.replace(/^(Enf\.|Eng\.|Coord\.)\s*/i, '') : ''
              const iniciais = nomeLimpo
                ? nomeLimpo
                    .split(' ')
                    .filter((p) => p.length > 0)
                    .map((n) => n[0])
                    .join('')
                    .substring(0, 2)
                    .toUpperCase()
                : 'US'

              const avatarUrl =
                membro.perfil === 'engenharia_clinica' || membro.perfil === 'engenharia'
                  ? 'https://heroui-assets.nyc3.cdn.digitaloceanspaces.com/avatars/red.jpg'
                  : membro.perfil === 'coordenador'
                  ? 'https://heroui-assets.nyc3.cdn.digitaloceanspaces.com/avatars/purple.jpg'
                  : membro.perfil === 'gestor'
                  ? 'https://heroui-assets.nyc3.cdn.digitaloceanspaces.com/avatars/orange.jpg'
                  : 'https://heroui-assets.nyc3.cdn.digitaloceanspaces.com/avatars/blue.jpg'

              return (
                <div
                  key={membro.id}
                  className="bg-white rounded-[24px] p-4 border border-gray-100 shadow-[var(--shadow-card)] transition-all"
                >
                  {/* Header do card com Avatar oficial por perfil e setor */}
                  <div className="flex items-center gap-3">
                    <AvatarPerfil perfil={membro.perfil} nome={membro.nome} setor={membro.setor} tamanho="md" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-[13px] font-bold text-gray-900 truncate">{membro.nome}</h3>
                        <div className="flex items-center gap-1 shrink-0">
                          <span className={`w-1.5 h-1.5 rounded-full ${status.bg}`} />
                          <span className={`text-[9px] font-bold ${status.cor}`}>{status.label}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <p className="text-[10px] text-gray-400 font-medium truncate">{membro.email}</p>
                        {membro.setor && (
                          <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full border ${
                            SETORES_CORES[membro.setor]
                              ? `${SETORES_CORES[membro.setor].bg} ${SETORES_CORES[membro.setor].text} ${SETORES_CORES[membro.setor].border}`
                              : 'bg-gray-50 text-gray-500 border-gray-200'
                          }`}>
                            {SETORES_LABELS[membro.setor]}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Métricas */}
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    {subAba === 'inspetores' ? (
                      <div className="flex items-center gap-4">
                        <div className="flex-1">
                          <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Rondas</span>
                          <p className="text-[15px] font-extrabold text-gray-900">{membro.rondasRealizadas}</p>
                        </div>
                        <div className="flex-1">
                          <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Última Ronda</span>
                          <p className="text-[11px] font-bold text-gray-600 mt-0.5">
                            {formatarTempoRelativo(membro.ultimaRonda)}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-4">
                        <div className="flex-1">
                          <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">NCs Ativas</span>
                          <p className={`text-[15px] font-extrabold ${membro.ncsResponsavel > 0 ? 'text-amber-600' : 'text-gray-900'}`}>
                            {membro.ncsResponsavel}
                          </p>
                        </div>
                        <div className="flex-1">
                          <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Resolvidas</span>
                          <p className="text-[15px] font-extrabold text-emerald-600">{membro.ncsResolvidas}</p>
                        </div>
                        <div className="flex-1">
                          <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Última Ação</span>
                          <p className="text-[11px] font-bold text-gray-600 mt-0.5">
                            {formatarTempoRelativo(membro.ultimaAcao)}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
        </div>
      ) : (
        <div className="py-12 px-6 bg-white rounded-[28px] border border-gray-100/80 text-center space-y-4">
          <div className="mx-auto w-16 h-16 rounded-full bg-[#17A592]/10 flex items-center justify-center text-[#17A592]">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
            </svg>
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-gray-900">
              {subAba === 'inspetores' ? 'Nenhum inspetor cadastrado' : 'Nenhum técnico cadastrado'}
            </h3>
            <p className="text-[11px] text-gray-400 max-w-xs mx-auto leading-relaxed">
              {subAba === 'inspetores'
                ? 'Inspetores serão exibidos aqui após o cadastro pelo administrador.'
                : 'Técnicos serão exibidos aqui após o cadastro pelo administrador.'}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

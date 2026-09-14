'use client'

import { useState, useEffect } from 'react'
import { motion } from 'motion/react'
import { criarClienteSupabase } from '@/lib/supabase/client'
import { PainelDashboard, type PeriodoFiltro } from '@/components/coordenador/PainelDashboard'
import { FilaValidacaoNCs } from '@/components/coordenador/FilaValidacaoNCs'
import { GestaoEquipe } from '@/components/coordenador/GestaoEquipe'
import { GestaoAtivos } from '@/components/coordenador/GestaoAtivos'
import { OrbIA } from '@/components/ui/OrbIA'

type AbaCoordenador = 'dashboard' | 'ncs' | 'equipe' | 'ativos'

const ABAS: { id: AbaCoordenador; label: string; icone: React.ReactNode }[] = [
  {
    id: 'dashboard',
    label: 'Painel',
    icone: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
      </svg>
    ),
  },
  {
    id: 'ncs',
    label: 'NCs',
    icone: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    id: 'equipe',
    label: 'Equipe',
    icone: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
      </svg>
    ),
  },
  {
    id: 'ativos',
    label: 'Ativos',
    icone: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
      </svg>
    ),
  },
]

const TITULOS_ABA: Record<AbaCoordenador, { titulo: string; subtitulo: string }> = {
  dashboard: {
    titulo: 'Central de Comando',
    subtitulo: 'Visão geral de operações, equipe e ativos',
  },
  ncs: {
    titulo: 'Validação de NCs',
    subtitulo: 'Não conformidades da Engenharia Clínica',
  },
  equipe: {
    titulo: 'Gestão de Equipe',
    subtitulo: 'Inspetores e Engenheiros Clínicos',
  },
  ativos: {
    titulo: 'Gestão de Ativos',
    subtitulo: 'Equipamentos, status e etiquetas QR Code',
  },
}

export default function PaginaCoordenador() {
  const [abaAtiva, setAbaAtiva] = useState<AbaCoordenador>('dashboard')
  const [periodo, setPeriodo] = useState<PeriodoFiltro>('7d')
  const [hospitalId, setHospitalId] = useState<string>('')
  const [usuarioId, setUsuarioId] = useState<string>('')
  const [carregandoAuth, setCarregandoAuth] = useState(true)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const paramAba = params.get('aba') as AbaCoordenador
      if (paramAba && ['dashboard', 'ncs', 'equipe', 'ativos'].includes(paramAba)) {
        setAbaAtiva(paramAba)
      }
    }
  }, [])

  function alternarAba(novaAba: AbaCoordenador) {
    setAbaAtiva(novaAba)
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href)
      url.searchParams.set('aba', novaAba)
      window.history.replaceState(null, '', url.toString())
    }
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  useEffect(() => {
    async function carregarUsuario() {
      try {
        const supabase = criarClienteSupabase() as any
        const DEFAULT_HOSPITAL = 'e632822a-0000-0000-0000-000000000001'

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
            const { data: profiles } = await supabase
              .from('usuarios')
              .select('id, auth_user_id, nome, perfil, hospital_id')
              .or(`auth_user_id.eq.${user.id},id.eq.${user.id}`)
              .limit(1)
            if (profiles?.[0]) currentUser = profiles[0]
          }
        }

        const hId = currentUser?.hospital_id || DEFAULT_HOSPITAL
        setHospitalId(hId)
        setUsuarioId(currentUser?.id || '')
      } catch (err) {
        console.error('Erro ao resolver hospital do coordenador:', err)
        setHospitalId('e632822a-0000-0000-0000-000000000001')
      } finally {
        setCarregandoAuth(false)
      }
    }

    carregarUsuario()
  }, [])

  if (carregandoAuth || !hospitalId) {
    return (
      <div className="px-5 pt-5 pb-28">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-1/3" />
          <div className="h-4 bg-gray-200 rounded w-2/3" />
          <div className="h-32 bg-gray-200 rounded-3xl mt-4" />
        </div>
      </div>
    )
  }

  const { titulo, subtitulo } = TITULOS_ABA[abaAtiva]

  return (
    <div className="space-y-6">
      {/* Header com Título e Seletor de Abas Desktop */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight font-space-grotesk">
            {titulo}
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 font-medium mt-0.5">
            {subtitulo}
          </p>
        </div>

        {/* Seletor de Abas Desktop + Botão Orb ao lado fora da barra */}
        <div className="hidden md:flex items-center gap-3">
          {/* Extensão de Período Desktop (quando no dashboard) */}
          {abaAtiva === 'dashboard' && (
            <div className="flex items-center bg-white/70 backdrop-blur-[24px] saturate-[180%] p-1 rounded-full border border-white/80 shadow-xs gap-0.5">
              {([
                { id: '7d', label: '7 dias' },
                { id: '15d', label: '15 dias' },
                { id: '30d', label: '30 dias' },
              ] as const).map((opt) => {
                const ativo = periodo === opt.id
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setPeriodo(opt.id)}
                    className={`relative z-10 py-1.5 px-3 rounded-full cursor-pointer text-xs font-bold transition-colors select-none ${
                      ativo ? 'text-[#17A592] font-extrabold' : 'text-slate-400 hover:text-slate-700'
                    }`}
                  >
                    {ativo && (
                      <motion.div
                        layoutId="periodoAtivoDesktopBubble"
                        transition={{ type: 'spring', bounce: 0.22, duration: 0.42 }}
                        className="absolute inset-0 bg-[#17A592]/15 rounded-full shadow-[inset_0_1px_1.5px_rgba(255,255,255,0.8),inset_0_0_0_1px_rgba(23,165,146,0.25)] -z-10"
                      />
                    )}
                    <span>{opt.label}</span>
                  </button>
                )
              })}
            </div>
          )}

          <div className="flex items-center bg-slate-200/70 p-1.5 rounded-full gap-1 border border-slate-200/80 shadow-inner relative">
            {ABAS.map((aba) => {
              const ativa = abaAtiva === aba.id
              return (
                <button
                  key={aba.id}
                  type="button"
                  onClick={() => {
                    setAbaAtiva(aba.id)
                    window.scrollTo({ top: 0, behavior: 'smooth' })
                  }}
                  className={`relative z-10 flex items-center gap-2 py-2 px-4.5 rounded-full cursor-pointer text-xs font-bold transition-colors duration-200 select-none ${
                    ativa ? 'text-[#17A592]' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {ativa && (
                    <motion.div
                      layoutId="abaAtivaBubble"
                      transition={{ type: 'spring', bounce: 0.22, duration: 0.42 }}
                      className="absolute inset-0 bg-white rounded-full shadow-[0_3px_12px_rgba(0,0,0,0.08),0_1px_3px_rgba(0,0,0,0.04)] border border-slate-100/80 -z-10"
                    />
                  )}
                  <div className={`w-4 h-4 transition-colors duration-200 ${ativa ? 'text-[#17A592]' : 'text-slate-400'}`}>
                    {aba.icone}
                  </div>
                  <span className="font-extrabold">{aba.label}</span>
                </button>
              )
            })}
          </div>

          {/* Botão Orb Desktop — Fora da barra de abas, Glassmorphic com Orb ampliado */}
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent('primus:abrir-chat-ia'))}
            className="w-11 h-11 rounded-full bg-white/70 backdrop-blur-[24px] saturate-[180%] border border-white/80 shadow-[0_8px_32px_rgba(0,0,0,0.08),inset_0_1px_1px_rgba(255,255,255,0.8)] flex items-center justify-center cursor-pointer active:scale-95 transition-transform shrink-0"
            title="Abrir Primus IA"
          >
            <OrbIA tamanho={38} />
          </button>
        </div>
      </div>

      {/* Conteúdo das Abas com Persistência em Memória (Keep-Alive & Prefetch) */}
      <div className="w-full">
        <div className={abaAtiva === 'dashboard' ? 'block animate-fadeIn' : 'hidden'}>
          <PainelDashboard hospitalId={hospitalId} periodo={periodo} onPeriodoChange={setPeriodo} />
        </div>
        <div className={abaAtiva === 'ncs' ? 'block animate-fadeIn' : 'hidden'}>
          <FilaValidacaoNCs hospitalId={hospitalId} usuarioId={usuarioId} />
        </div>
        <div className={abaAtiva === 'equipe' ? 'block animate-fadeIn' : 'hidden'}>
          <GestaoEquipe hospitalId={hospitalId} />
        </div>
        <div className={abaAtiva === 'ativos' ? 'block animate-fadeIn' : 'hidden'}>
          <GestaoAtivos hospitalId={hospitalId} />
        </div>
      </div>

      {/* ══════════════════════════════════════════════════
          NAV INFERIOR — APENAS MOBILE (md:hidden)
          BARRA DE ABAS TERMINA EM ATIVOS + ORB GLASSMORPHIC
         ══════════════════════════════════════════════════ */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 max-w-md mx-auto px-4 pb-[max(0.65rem,env(safe-area-inset-bottom))] pointer-events-none flex flex-col items-start gap-1.5">
        {/* Extensão superior da navbar: Filtro de Período (alinhado à esquerda) */}
        {abaAtiva === 'dashboard' && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ type: 'spring', bounce: 0.22, duration: 0.35 }}
            className="pointer-events-auto"
          >
            <div className="inline-flex items-center bg-white/70 backdrop-blur-[24px] saturate-[180%] rounded-full border border-white/80 shadow-[0_8px_32px_rgba(0,0,0,0.1),inset_0_1px_1px_rgba(255,255,255,0.8)] p-1 gap-0.5">
              {([
                { id: '7d', label: '7 dias' },
                { id: '15d', label: '15 dias' },
                { id: '30d', label: '30 dias' },
              ] as const).map((opt) => {
                const ativo = periodo === opt.id
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setPeriodo(opt.id)}
                    className={`relative z-10 py-1 px-3 rounded-full cursor-pointer text-[10.5px] font-extrabold transition-colors duration-200 select-none ${
                      ativo ? 'text-[#17A592] font-black' : 'text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    {ativo && (
                      <motion.div
                        layoutId="periodoAtivoMobileBubble"
                        transition={{ type: 'spring', bounce: 0.22, duration: 0.42 }}
                        className="absolute inset-0 bg-[#17A592]/15 rounded-full shadow-[inset_0_1px_1.5px_rgba(255,255,255,0.8),inset_0_0_0_1px_rgba(23,165,146,0.25)] -z-10"
                      />
                    )}
                    <span>{opt.label}</span>
                  </button>
                )
              })}
            </div>
          </motion.div>
        )}

        <div className="flex items-center gap-2 pointer-events-auto w-full">
          {/* Navbar inferior (Dashboard até Ativos) */}
          <nav className="flex-1 bg-white/70 backdrop-blur-[24px] saturate-[180%] rounded-full border border-white/80 shadow-[0_8px_32px_rgba(0,0,0,0.1),inset_0_1px_1px_rgba(255,255,255,0.8)] p-1.5">
            <div className="flex items-center justify-between gap-1 relative">
              {ABAS.map((aba) => {
                const ativa = abaAtiva === aba.id
                return (
                  <button
                    key={aba.id}
                    type="button"
                    onClick={() => alternarAba(aba.id)}
                    className={`relative z-10 flex-1 flex flex-col items-center justify-center py-1.5 px-2 rounded-full cursor-pointer transition-colors duration-200 select-none active:scale-95 ${
                      ativa ? 'text-[#17A592] font-black' : 'text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    {ativa && (
                      <motion.div
                        layoutId="abaAtivaMobileBubble"
                        transition={{ type: 'spring', bounce: 0.22, duration: 0.42 }}
                        className="absolute inset-0 bg-gradient-to-b from-[#17A592]/20 to-[#17A592]/10 rounded-full shadow-[0_3px_10px_rgba(23,165,146,0.18),inset_0_1px_1.5px_rgba(255,255,255,0.8),inset_0_0_0_1px_rgba(23,165,146,0.22)] -z-10"
                      />
                    )}
                    <div className={`w-5 h-5 flex items-center justify-center shrink-0 ${ativa ? 'text-[#17A592]' : 'text-slate-400'}`}>
                      {aba.icone}
                    </div>
                    <span className="text-[9.5px] font-bold tracking-wide mt-0.5">{aba.label}</span>
                  </button>
                )
              })}
            </div>
          </nav>

          {/* Botão Orb Mobile — Glassmorphic idêntico à navbar com Orb ampliado e margem justa */}
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent('primus:abrir-chat-ia'))}
            className="w-[48px] h-[48px] rounded-full bg-white/70 backdrop-blur-[24px] saturate-[180%] border border-white/80 shadow-[0_8px_32px_rgba(0,0,0,0.1),inset_0_1px_1px_rgba(255,255,255,0.8)] flex items-center justify-center cursor-pointer active:scale-95 transition-transform shrink-0"
            title="Abrir Primus IA"
          >
            <OrbIA tamanho={42} />
          </button>
        </div>
      </div>
    </div>
  )
}

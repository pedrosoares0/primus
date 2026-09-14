'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { QRCodeAtivo } from '@/components/ui/QRCodeAtivo'
import { LiquidMetalButton } from '@/components/ui/liquid-metal-button'
import { PillTag } from '@/components/ui/PillTag'
import { criarClienteSupabase } from '@/lib/supabase/client'
import { dadosCache } from '@/lib/cache/dadosCache'
import type { StatusAtivo } from '@/lib/supabase/types'

const STATUS_ATIVO: Record<StatusAtivo, { label: string; dot: string; cor: 'verde' | 'laranja' | 'vermelho' | 'azul' }> = {
  operacional: { label: 'Operacional', dot: 'bg-emerald-500', cor: 'verde' },
  operacional_com_restricoes: { label: 'Com restrição', dot: 'bg-amber-500', cor: 'laranja' },
  indisponivel: { label: 'Indisponível', dot: 'bg-red-500', cor: 'vermelho' },
  em_manutencao: { label: 'Em manutenção', dot: 'bg-sky-500', cor: 'azul' },
}

export default function PaginaAtivo() {
  const params = useParams()
  const router = useRouter()
  const ativoId = params.id as string

  const cacheKey = `inspetor_ativo_${ativoId}`
  const cached = dadosCache.get<any>(cacheKey)

  const [ativo, setAtivo] = useState<any>(() => cached || null)
  const [carregando, setCarregando] = useState(() => !cached)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    async function carregarAtivo() {
      try {
        const supabase = criarClienteSupabase() as any

        const { data, error } = await supabase
          .from('ativos')
          .select('*, locais(*, centros_cirurgicos(*, unidades(*))), categorias_ativos(*)')
          .eq('id', ativoId)
          .single()

        if (error) {
          console.error(error)
          if (!cached) setErro(`Erro ao carregar ativo: ${error.message}`)
          return
        }

        if (!data) {
          if (!cached) setErro('Ativo não encontrado.')
          return
        }

        setAtivo(data)
        dadosCache.set(cacheKey, data)
      } catch (err: any) {
        console.error(err)
        if (!cached) setErro(`Erro de conexão: ${err.message || err}`)
      } finally {
        setCarregando(false)
      }
    }

    if (ativoId) {
      carregarAtivo()
    }
  }, [ativoId, cacheKey])

  if (erro) {
    return (
      <div className="min-h-[60dvh] flex flex-col items-center justify-center p-6 space-y-4">
        <p className="text-sm font-semibold text-red-500 text-center">{erro}</p>
        <Link href="/inspetor" className="text-xs font-bold text-[#246BFD] underline">
          Voltar para Início
        </Link>
      </div>
    )
  }

  if (carregando || !ativo) {
    return (
      <div className="min-h-[60dvh] flex items-center justify-center">
        <p className="text-sm font-semibold text-gray-400 animate-pulse">Carregando ativo...</p>
      </div>
    )
  }

  const statusCfg = STATUS_ATIVO[ativo.status as StatusAtivo] || STATUS_ATIVO.operacional
  const obterIconeEquipamento = (nome: string, categoria?: string) => {
    const n = `${nome || ''} ${categoria || ''}`.toLowerCase()
    if (n.includes('anestesia')) return '/carrinho-anestesia.webp'
    if (n.includes('parada') || n.includes('carrinho')) return '/carrinho-parada.webp'
    if (n.includes('bisturi')) return '/bisturi.webp'
    if (n.includes('aspirador')) return '/aspirador.webp'
    if (n.includes('bomba') || n.includes('infus')) return '/bomba-infusao.webp'
    if (n.includes('foco')) return '/foco.webp'
    if (n.includes('gases') || n.includes('gas')) return '/gas.webp'
    if (n.includes('mesa') || n.includes('cama')) return '/cama.webp'
    if (n.includes('monitor')) return '/monitor.webp'
    return '/carrinho-parada.webp'
  }
  const iconeAtivo = obterIconeEquipamento(ativo.nome, ativo.categorias_ativos?.nome)
  const isCarrinho = true
  const nomeLocal = ativo.locais?.nome || 'Sem local'
  const nomeSetor = ativo.locais?.centros_cirurgicos?.nome || 'Centro Cirúrgico'

  return (
    <div className="px-4 sm:px-5 pt-3 pb-10 space-y-4 sm:space-y-5">

      {/* Voltar */}
      <button
        type="button"
        onClick={() => {
          if (typeof window !== 'undefined' && window.history.length > 1) {
            router.back()
          } else if (ativo.local_id) {
            router.push(`/inspetor/local/${ativo.local_id}`)
          } else {
            router.push('/inspetor')
          }
        }}
        className="inline-flex items-center gap-1.5 text-[13px] font-bold text-gray-600 hover:text-black transition-colors -ml-1 cursor-pointer"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
        </svg>
        {nomeLocal ? `Voltar (${nomeLocal})` : 'Voltar'}
      </button>

      {/* ── Card do Ativo ── */}
      <div className="bg-white rounded-[28px] p-4 sm:p-5 shadow-[0_4px_24px_rgba(0,0,0,0.04)] border border-gray-100/80">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-3.5 min-w-0">
            {isCarrinho && (
              <div className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-[18px] overflow-hidden bg-gray-50 flex items-center justify-center shrink-0 shadow-[0_1px_3px_rgba(0,0,0,0.02)] border border-gray-100/30">
                <img
                  src={iconeAtivo}
                  alt={ativo.nome || 'Carrinho'}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 pointer-events-none rounded-[inherit] shadow-[inset_0_2.5px_8px_rgba(255,255,255,0.95)] border border-white/25" />
              </div>
            )}
            <div className="min-w-0 space-y-0.5">
              <h1 className="text-sm sm:text-lg font-bold text-gray-900 tracking-tight leading-tight">
                {ativo.nome?.replace(/\bSala\s+(\d+)/i, 'S. $1')}
              </h1>
              <p className="text-xs text-gray-500 font-semibold">{nomeSetor}</p>
              <p className="text-[10px] text-gray-400 font-medium">{nomeLocal}</p>
            </div>
          </div>
          <PillTag cor={statusCfg.cor} className="scale-90 sm:scale-100 origin-right">
            {statusCfg.label}
          </PillTag>
        </div>

        {/* Informações */}
        <div className="h-px bg-gray-100 my-3" />
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gray-50/50 rounded-xl p-3 border border-gray-100/50">
            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Categoria</p>
            <p className="text-xs font-bold text-gray-800">{ativo.categorias_ativos?.nome || 'Não definida'}</p>
          </div>
          <div className="bg-gray-50/50 rounded-xl p-3 border border-gray-100/50">
            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Patrimônio</p>
            <p className="text-xs font-bold text-gray-800">{ativo.patrimonio || '—'}</p>
          </div>
        </div>
      </div>

      {/* ── QR Code para Impressão ── */}
      <div className="bg-white rounded-[28px] p-4 sm:p-5 shadow-[0_4px_24px_rgba(0,0,0,0.04)] border border-gray-100/80">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-sm font-extrabold text-gray-900 tracking-tight">QR Code do Ativo</h2>
            <p className="text-[11px] text-gray-400 font-semibold mt-0.5">
              Imprima e cole no equipamento para iniciar rondas
            </p>
          </div>
        </div>

        <QRCodeAtivo
          ativoId={ativo.id}
          localId={ativo.local_id}
          nomeAtivo={ativo.nome}
          codigoQr={ativo.codigo_qr}
          patrimonio={ativo.patrimonio}
        />
      </div>

      {/* ── CTA: Ir para a tela de ronda ── */}
      <LiquidMetalButton
        tamanho="md"
        larguraTotal
        onClick={() => router.push(`/inspetor/local/${ativo.local_id}`)}
        icone={
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        }
        label="Ver Ronda / Inspeção"
      />
    </div>
  )
}

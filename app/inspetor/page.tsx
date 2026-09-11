'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Botao } from '@/components/ui/Botao'
import { LiquidMetalButton } from '@/components/ui/liquid-metal-button'
import { BarraBusca } from '@/components/ui/BarraBusca'
import { PillTag } from '@/components/ui/PillTag'
import { criarClienteSupabase } from '@/lib/supabase/client'
import { dadosCache } from '@/lib/cache/dadosCache'

export default function PaginaInicialInspetor() {
  const router = useRouter()
  const [termoBusca, setTermoBusca] = useState('')
  const [mostrarModalCodigo, setMostrarModalCodigo] = useState(false)
  const [codigoInput, setCodigoInput] = useState('')

  const cacheKey = 'inspetor_salas_lista'
  const [salas, setSalas] = useState<any[]>(() => dadosCache.get<any[]>(cacheKey) || [])
  const [carregando, setCarregando] = useState(() => !dadosCache.get(cacheKey))

  useEffect(() => {
    router.prefetch('/inspetor/scanner')
  }, [router])

  useEffect(() => {
    async function carregarSalas() {
      if (!dadosCache.get(cacheKey)) {
        setCarregando(true)
      }
      try {
        const supabase = criarClienteSupabase() as any

        // 1. Buscar salas, vínculos sala_ativos, execuções e não conformidades em paralelo
        const [locaisRes, salaAtivosRes, execsRes, ncsRes] = await Promise.all([
          supabase
            .from('locais')
            .select('*, centros_cirurgicos(*)')
            .eq('tipo', 'sala')
            .in('nome', ['Sala 01', 'Sala 03', 'Sala 04'])
            .order('nome', { ascending: true }),
          supabase
            .from('sala_ativos')
            .select('local_id, ativo_id, compartilhado'),
          supabase
            .from('execucoes_checklist')
            .select('id, ativo_id, usuario_id, status, finalizado_em, iniciado_em, usuarios(nome)')
            .eq('status', 'concluida')
            .order('finalizado_em', { ascending: false })
            .limit(100),
          supabase
            .from('nao_conformidades')
            .select('id, ativo_id, criticidade, status')
            .neq('status', 'encerrada')
        ])

        const locaisData = locaisRes.data || []
        const salaAtivosData = salaAtivosRes.data || []
        const execsData = execsRes.data || []
        const ncsData = ncsRes.data || []

        if (locaisData.length > 0) {
          // Início de hoje (00:00) para calcular status real do dia
          const inicioHoje = new Date()
          inicioHoje.setHours(0, 0, 0, 0)

          // Mapear ativos por sala
          const ativosPorSala = new Map<string, string[]>()
          salaAtivosData.forEach((sa: any) => {
            const lista = ativosPorSala.get(sa.local_id) || []
            lista.push(sa.ativo_id)
            ativosPorSala.set(sa.local_id, lista)
          })

          const formatados = locaisData.map((local: any) => {
            const ativosIds = ativosPorSala.get(local.id) || []
            const totalAtivos = ativosIds.length || 9

            // Execuções dos ativos desta sala
            const execsDestaSala = execsData.filter((e: any) => ativosIds.includes(e.ativo_id))
            
            // Execuções realizadas HOJE
            const execsHoje = execsDestaSala.filter((e: any) => {
              const d = new Date(e.finalizado_em || e.iniciado_em)
              return d >= inicioHoje
            })

            // Quantos ativos distintos foram inspecionados hoje
            const ativosInspecionadosHoje = new Set(execsHoje.map((e: any) => e.ativo_id)).size

            // Verificar se há NC ativa nos ativos desta sala
            const ncsDestaSala = ncsData.filter((nc: any) => ativosIds.includes(nc.ativo_id))
            const temNcCritica = ncsDestaSala.some((nc: any) => nc.criticidade === 'critico')
            const temNcImportante = ncsDestaSala.some((nc: any) => nc.criticidade === 'importante')

            // Determinar status real da sala
            let statusLabel = 'Pendente'
            let statusCor: 'verde' | 'laranja' | 'vermelho' | 'azul' | 'cinza' = 'azul'

            if (temNcCritica) {
              statusLabel = 'Crítico'
              statusCor = 'vermelho'
            } else if (temNcImportante) {
              statusLabel = 'Com restrição'
              statusCor = 'laranja'
            } else if (ativosInspecionadosHoje === totalAtivos && totalAtivos > 0) {
              statusLabel = `Pronta (${totalAtivos}/${totalAtivos})`
              statusCor = 'verde'
            } else if (ativosInspecionadosHoje > 0) {
              statusLabel = `Vistoriando (${ativosInspecionadosHoje}/${totalAtivos})`
              statusCor = 'cinza'
            } else {
              statusLabel = `Pendente (0/${totalAtivos})`
              statusCor = 'azul'
            }

            // Texto de inspeção (prioriza a inspeção de hoje, senão informa a última ou nenhuma)
            let textoInspecao = 'Pendente de inspeção hoje'
            const ultimaExec = execsDestaSala[0]

            if (ultimaExec) {
              const d = new Date(ultimaExec.finalizado_em || ultimaExec.iniciado_em)
              const nomeInsp = ultimaExec.usuarios?.nome?.split(' ')[0] || 'Inspetor'
              const horaMin = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
              const diaMes = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })

              if (d >= inicioHoje) {
                textoInspecao = `Insp. por ${nomeInsp} hoje às ${horaMin}`
              } else {
                textoInspecao = `Última em ${diaMes} às ${horaMin} (${nomeInsp})`
              }
            }

            return {
              id: local.id,
              nome: local.nome,
              setor: local.centros_cirurgicos?.nome || 'Centro Cirúrgico',
              status: local.status,
              statusLabel,
              statusCor,
              totalAtivos,
              ativosInspecionadosHoje,
              textoInspecao,
              concluidaHoje: ativosInspecionadosHoje === totalAtivos && totalAtivos > 0,
            }
          })

          setSalas(formatados)
          dadosCache.set(cacheKey, formatados)

          // Pré-carregar as rotas de cada sala
          formatados.forEach((s: any) => {
            router.prefetch(`/inspetor/local/${s.id}`)
          })
        } else {
          setSalas([])
        }
      } catch (err) {
        console.error('Erro ao carregar salas do inspetor:', err)
      } finally {
        setCarregando(false)
      }
    }
    carregarSalas()
  }, [cacheKey, router])

  const salasFiltradas = salas.filter(sala =>
    sala.nome.toLowerCase().includes(termoBusca.toLowerCase()) ||
    sala.setor.toLowerCase().includes(termoBusca.toLowerCase())
  )

  async function handleSubmeterCodigo(e: React.FormEvent) {
    e.preventDefault()
    const input = codigoInput.trim()
    if (!input) return

    try {
      const supabase = criarClienteSupabase() as any
      
      // 1. Tentar buscar local pelo código QR ou nome
      const { data: locais } = await supabase
        .from('locais')
        .select('id')
        .or(`codigo_qr.ilike.${input},nome.ilike.%${input}%`)
        .limit(1)

      if (locais && locais.length > 0) {
        setMostrarModalCodigo(false)
        router.push(`/inspetor/local/${locais[0].id}`)
        return
      }

      // 2. Tentar buscar ativo por codigo_qr, patrimonio ou nome
      const { data: ativos } = await supabase
        .from('ativos')
        .select('id, local_id')
        .or(`codigo_qr.ilike.${input},patrimonio.ilike.${input},nome.ilike.%${input}%`)
        .limit(1)

      if (ativos && ativos.length > 0) {
        setMostrarModalCodigo(false)
        router.push(`/inspetor/checklist/${ativos[0].id}`)
        return
      }

      alert(`Nenhum ativo ou sala encontrado com o código "${input}".`)
    } catch (err) {
      console.error(err)
      alert('Erro ao buscar o código.')
    }
  }

  const obterIconeSala = (nome: string) => {
    const n = (nome || '').toLowerCase()
    if (n.includes('1') || n.includes('01')) return '/icon-sala1.webp'
    if (n.includes('3') || n.includes('03')) return '/icon-sala3.webp'
    if (n.includes('4') || n.includes('04')) return '/icon-sala4.webp'
    return null
  }

  return (
    <div className="px-4 sm:px-5 pt-2 space-y-4 sm:space-y-5">
      {/* Card Principal: Leitura / Scan Rápido */}
      <div 
        style={{
          width: '100%',
          maxWidth: '420px',
          height: '280px',
          borderRadius: '41px',
          background: 'rgba(255, 255, 255, 0.18)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          boxShadow: 'inset 0 0 0 1px rgba(255, 255, 255, 0.1), inset 1.5px 1.5px 0 rgba(255, 255, 255, 0.25), inset 0 0 8px rgba(255, 255, 255, 0.1), 0 8px 24px rgba(0, 0, 0, 0.05)'
        }}
        className="mx-auto flex flex-col justify-center items-center p-6 text-center space-y-4 select-none"
      >
        <div className="w-12 h-12 rounded-[12px] overflow-hidden drop-shadow-[0_8px_16px_rgba(0,0,0,0.1)] active:scale-95 transition-transform shrink-0">
          <img 
            src="/icon-camera-macos.png" 
            alt="Câmera Scanner" 
            className="w-full h-full object-cover" 
          />
        </div>

        <div>
          <h2 className="text-base sm:text-lg font-bold text-slate-800 tracking-tight leading-tight">
            Conferência Rápida
          </h2>
          <p className="text-xs sm:text-[13px] text-slate-600 font-medium leading-relaxed mt-1 max-w-xs mx-auto">
            Aponte a câmera para a etiqueta do equipamento para abrir a verificação de prontidão.
          </p>
        </div>

        <div className="flex flex-col items-center gap-2 shrink-0">
          <LiquidMetalButton
            tamanho="md"
            onClick={() => router.push('/inspetor/scanner')}
            label="Escanear"
          />

          <button
            type="button"
            onClick={() => setMostrarModalCodigo(true)}
            className="text-[11px] font-bold text-slate-500 hover:text-slate-800 transition-colors py-0.5 px-2 cursor-pointer"
          >
            Digitar código manualmente
          </button>
        </div>
      </div>

      {/* Input de Busca */}
      <BarraBusca
        placeholder="Buscar sala cirúrgica"
        valor={termoBusca}
        aoMudar={setTermoBusca}
      />

      {/* Lista de Salas Cirúrgicas */}
      <div className="space-y-2.5 pb-4">
        {carregando && salas.length === 0 ? (
          <div className="space-y-2.5">
            {[1, 2, 3].map((n) => (
              <div key={n} className="bg-white rounded-[28px] p-3.5 sm:p-4 shadow-[0_4px_20px_rgba(0,0,0,0.04)] border border-gray-100/90 animate-pulse">
                <div className="flex items-center gap-3.5">
                  <div className="w-14 h-14 rounded-[18px] bg-gray-100 shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-3/5 bg-gray-200 rounded" />
                    <div className="h-3 w-2/5 bg-gray-100 rounded" />
                    <div className="h-3 w-4/5 bg-gray-100 rounded" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : salasFiltradas.length === 0 ? (
          <div className="text-center py-8 text-sm text-gray-400 font-semibold">
            Nenhuma sala encontrada.
          </div>
        ) : (
          salasFiltradas.map((sala, i) => (
            <Link
              key={sala.id}
              href={`/inspetor/local/${sala.id}`}
              prefetch={true}
              className="block bg-white rounded-[28px] p-3.5 sm:p-4 shadow-[0_4px_20px_rgba(0,0,0,0.04)] border border-gray-100/90 hover:border-gray-200 hover:shadow-md transition-all cursor-pointer select-none active:scale-[0.99]"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <div className="flex items-center justify-between gap-3 w-full">
                {/* Ícone da Sala */}
                <div className="flex items-center gap-3.5 min-w-0 flex-1">
                  {obterIconeSala(sala.nome) ? (
                    <div className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-[18px] overflow-hidden bg-gray-50 flex items-center justify-center shrink-0 border border-gray-100/40 shadow-xs">
                      <img
                        src={obterIconeSala(sala.nome)!}
                        alt={sala.nome}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 pointer-events-none rounded-[inherit] shadow-[inset_0_1.5px_4px_rgba(255,255,255,0.9)]" />
                    </div>
                  ) : (
                    <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-[18px] bg-gradient-to-br from-[#246BFD]/10 to-[#246BFD]/5 flex items-center justify-center shrink-0 border border-[#246BFD]/10">
                      <svg className="w-6 h-6 sm:w-7 sm:h-7 text-[#246BFD]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3H21m-3.75 3H21" />
                      </svg>
                    </div>
                  )}
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-base sm:text-lg font-bold text-[#1E293B] tracking-tight">
                        {sala.nome}
                      </h3>
                      <PillTag cor={sala.statusCor} className="scale-[0.85] origin-left">
                        {sala.statusLabel}
                      </PillTag>
                    </div>

                    <p className="text-xs font-semibold text-slate-500">
                      {sala.ativosInspecionadosHoje} de {sala.totalAtivos} equipamentos verificados hoje
                    </p>

                    {/* Mini Progress Bar da Ronda */}
                    <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden mt-1">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ease-out ${
                          sala.concluidaHoje ? 'bg-[#31B44A]' :
                          sala.statusCor === 'vermelho' ? 'bg-red-500' :
                          sala.ativosInspecionadosHoje > 0 ? 'bg-[#246BFD]' : 'bg-transparent'
                        }`}
                        style={{ width: `${sala.totalAtivos > 0 ? Math.round((sala.ativosInspecionadosHoje / sala.totalAtivos) * 100) : 0}%` }}
                      />
                    </div>

                    <div className="flex items-center gap-1.5 pt-0.5 text-[11px] text-slate-500 font-medium">
                      <span className={[
                        'w-2 h-2 rounded-full shrink-0',
                        sala.concluidaHoje ? 'bg-[#31B44A]' :
                        sala.statusCor === 'vermelho' ? 'bg-red-500' :
                        sala.ativosInspecionadosHoje > 0 ? 'bg-slate-500' : 'bg-slate-300'
                      ].join(' ')} />
                      <span className="truncate">{sala.textoInspecao}</span>
                    </div>
                  </div>
                </div>

                {/* Seta */}
                <div className="w-8 h-8 rounded-full bg-[#F4F6FA] flex items-center justify-center text-gray-400 hover:text-texto transition-colors shrink-0">
                  <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                </div>
              </div>
            </Link>
          ))
        )}
      </div>

      {/* Modal de Digitar Código */}
      {mostrarModalCodigo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-xs animate-[fadeIn_0.2s_ease-out]">
          <div className="bg-white rounded-[24px] p-6 max-w-sm w-full shadow-xl border border-gray-100 space-y-4">
            <h3 className="text-base font-bold text-texto">Digitar Código do QR</h3>
            <p className="text-xs text-gray-500">
              Insira o código gravado no QR Code do equipamento ou sala.
            </p>

            <form onSubmit={handleSubmeterCodigo} className="space-y-3">
              <input
                type="text"
                autoFocus
                placeholder="Ex: QR-SALA-01 ou QR-MON-S01"
                value={codigoInput}
                onChange={(e) => setCodigoInput(e.target.value)}
                className="w-full bg-[#F4F6FA] border border-gray-200 rounded-full px-4 py-3 text-[16px] text-texto font-mono uppercase tracking-wider outline-none focus:border-[#246BFD]"
              />
              <div className="flex gap-2 pt-2">
                <Botao
                  type="button"
                  variante="secundario"
                  larguraTotal
                  onClick={() => setMostrarModalCodigo(false)}
                >
                  Cancelar
                </Botao>
                <Botao
                  type="submit"
                  variante="primario"
                  larguraTotal
                >
                  Acessar
                </Botao>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

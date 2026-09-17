'use client'

import React from 'react'
import type { StatusAtivo } from '@/lib/supabase/types'

export type FiltroStatusAtivo = 'todos' | StatusAtivo

export interface ContadoresAtivos {
  total: number
  operacional: number
  operacional_com_restricoes: number
  indisponivelOuManutencao: number
  taxaConformidade: number
  totalSalas?: number
}

interface CardsMetricasAtivosProps {
  contadores: ContadoresAtivos
  filtroStatus?: FiltroStatusAtivo
  aoSelecionarFiltro?: (status: FiltroStatusAtivo) => void
  salaSelecionada?: string
  aoLimparFiltros?: () => void
  clicavel?: boolean
}

export function CardsMetricasAtivos({
  contadores,
  filtroStatus = 'todos',
  aoSelecionarFiltro,
  salaSelecionada = 'todas',
  aoLimparFiltros,
  clicavel = true,
}: CardsMetricasAtivosProps) {
  const totalSalasExibidas = contadores.totalSalas !== undefined ? contadores.totalSalas : 3

  const handleClick = (tipo: FiltroStatusAtivo | 'salas') => {
    if (!clicavel || !aoSelecionarFiltro) return

    if (tipo === 'salas') {
      if (aoLimparFiltros) {
        aoLimparFiltros()
      } else {
        aoSelecionarFiltro('todos')
      }
      return
    }

    aoSelecionarFiltro(filtroStatus === tipo ? 'todos' : tipo)
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 font-nunito">
      {/* CARD 1: OPERACIONAIS (Verde Conforme #54D362 → #31B44A) */}
      <div
        onClick={() => handleClick('operacional')}
        style={{
          fontFamily: "'Nunito', sans-serif",
          background: 'radial-gradient(130% 130% at 30% 20%, #54D362 0%, #31B44A 50%, #209935 100%)',
          boxShadow:
            'inset 0 4px 14px rgba(255, 255, 255, 0.95), inset 0 -4px 10px rgba(0, 0, 0, 0.1), inset 4px 0 12px rgba(255, 255, 255, 0.75), inset -4px 0 12px rgba(255, 255, 255, 0.75), 0 12px 32px rgba(49, 180, 74, 0.3)',
        }}
        className={`relative overflow-hidden rounded-[34px] px-6 py-5.5 transition-all duration-300 select-none flex flex-col justify-between min-h-[132px] border-0 font-nunito ${
          clicavel ? 'cursor-pointer hover:scale-[1.02] active:scale-[0.98]' : ''
        } ${filtroStatus === 'operacional' ? 'ring-4 ring-emerald-300 ring-offset-2' : ''}`}
      >
        {/* Camada de brilho e inner shadow superior intenso */}
        <div className="absolute top-0 inset-x-0 h-3/5 bg-gradient-to-b from-white/40 via-white/10 to-transparent rounded-t-[34px] pointer-events-none" />

        <div className="relative z-10 flex items-center gap-1.5">
          {/* Badge Conforme estilo translúcido com recorte */}
          <div className="w-5 h-5 flex items-center justify-center shrink-0">
            <svg className="w-4.5 h-4.5 drop-shadow-xs" viewBox="0 0 24 24" fill="rgba(255,255,255,0.4)">
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M8.603 3.799A4.49 4.49 0 0112 2.25c1.357 0 2.573.6 3.397 1.549a4.49 4.49 0 013.498 1.307 4.491 4.491 0 011.307 3.497A4.49 4.49 0 0121.75 12a4.49 4.49 0 01-1.549 3.397 4.491 4.491 0 01-1.307 3.497 4.491 4.491 0 01-3.497 1.307A4.49 4.49 0 0112 21.75a4.49 4.49 0 01-3.397-1.549 4.49 4.49 0 01-3.498-1.306 4.491 4.491 0 01-1.307-3.498A4.49 4.49 0 012.25 12c0-1.357.6-2.573 1.549-3.397a4.49 4.49 0 011.307-3.497 4.49 4.49 0 013.497-1.307zm7.007 6.387a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z"
              />
            </svg>
          </div>
          <span className="font-nunito text-[10.5px] font-black uppercase tracking-wider text-white/95 drop-shadow-xs">
            Operacionais
          </span>
        </div>

        <div className="relative z-10 my-1">
          <div className="flex items-baseline gap-1">
            <span
              style={{ fontFamily: "'Nunito', sans-serif" }}
              className="font-nunito text-[32px] sm:text-[36px] font-black tracking-tight leading-none text-white drop-shadow-sm"
            >
              {contadores.operacional}
            </span>
            <span className="font-nunito text-[11.5px] font-black text-white/70">/ {contadores.total}</span>
          </div>
        </div>

        <div className="font-nunito relative z-10 text-[11px] text-white/95">
          <span className="font-black drop-shadow-2xs">
            {contadores.taxaConformidade}% · Prontos
          </span>
        </div>
      </div>

      {/* CARD 2: RESTRIÇÕES (Laranja Importante #FF9E3D → #F78725) */}
      <div
        onClick={() => handleClick('operacional_com_restricoes')}
        style={{
          fontFamily: "'Nunito', sans-serif",
          background: 'radial-gradient(130% 130% at 30% 20%, #FF9E3D 0%, #F78725 50%, #DD6B10 100%)',
          boxShadow:
            'inset 0 4px 14px rgba(255, 255, 255, 0.95), inset 0 -4px 10px rgba(0, 0, 0, 0.1), inset 4px 0 12px rgba(255, 255, 255, 0.75), inset -4px 0 12px rgba(255, 255, 255, 0.75), 0 12px 32px rgba(247, 135, 37, 0.3)',
        }}
        className={`relative overflow-hidden rounded-[34px] px-6 py-5.5 transition-all duration-300 select-none flex flex-col justify-between min-h-[132px] border-0 font-nunito ${
          clicavel ? 'cursor-pointer hover:scale-[1.02] active:scale-[0.98]' : ''
        } ${filtroStatus === 'operacional_com_restricoes' ? 'ring-4 ring-orange-300 ring-offset-2' : ''}`}
      >
        <div className="absolute top-0 inset-x-0 h-3/5 bg-gradient-to-b from-white/40 via-white/10 to-transparent rounded-t-[34px] pointer-events-none" />

        <div className="relative z-10 flex items-center gap-1.5">
          {/* Triângulo de Alerta do Badge Importante */}
          <div className="w-5 h-5 flex items-center justify-center shrink-0">
            <svg className="w-4.5 h-4.5 drop-shadow-xs" viewBox="0 0 24 24" fill="rgba(255,255,255,0.4)">
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M10.788 3.21c.548-.96 1.876-.96 2.424 0l8.23 14.403c.532.931-.14 2.087-1.212 2.087H3.77c-1.072 0-1.744-1.156-1.212-2.087L10.788 3.21zM12 8a.75.75 0 00-.75.75v4.5a.75.75 0 001.5 0v-4.5A.75.75 0 0012 8zm0 8a1 1 0 100-2 1 1 0 000 2z"
              />
            </svg>
          </div>
          <span className="font-nunito text-[10.5px] font-black uppercase tracking-wider text-white/95 drop-shadow-xs">
            Restrições
          </span>
        </div>

        <div className="relative z-10 my-1">
          <span
            style={{ fontFamily: "'Nunito', sans-serif" }}
            className="font-nunito text-[32px] sm:text-[36px] font-black tracking-tight leading-none text-white drop-shadow-sm"
          >
            {contadores.operacional_com_restricoes}
          </span>
        </div>

        <div className="font-nunito relative z-10 text-[11px] text-white/95">
          <span className="font-black drop-shadow-2xs">Requer atenção</span>
        </div>
      </div>

      {/* CARD 3: INDISPONÍVEIS (Vermelho Crítico #F45F63 → #EA3A3A) */}
      <div
        onClick={() => handleClick('indisponivel')}
        style={{
          fontFamily: "'Nunito', sans-serif",
          background: 'radial-gradient(130% 130% at 30% 20%, #F45F63 0%, #EA3A3A 50%, #C82020 100%)',
          boxShadow:
            'inset 0 4px 14px rgba(255, 255, 255, 0.95), inset 0 -4px 10px rgba(0, 0, 0, 0.1), inset 4px 0 12px rgba(255, 255, 255, 0.75), inset -4px 0 12px rgba(255, 255, 255, 0.75), 0 12px 32px rgba(234, 58, 58, 0.3)',
        }}
        className={`relative overflow-hidden rounded-[34px] px-6 py-5.5 transition-all duration-300 select-none flex flex-col justify-between min-h-[132px] border-0 font-nunito ${
          clicavel ? 'cursor-pointer hover:scale-[1.02] active:scale-[0.98]' : ''
        } ${filtroStatus === 'indisponivel' ? 'ring-4 ring-rose-300 ring-offset-2' : ''}`}
      >
        <div className="absolute top-0 inset-x-0 h-3/5 bg-gradient-to-b from-white/40 via-white/10 to-transparent rounded-t-[34px] pointer-events-none" />

        <div className="relative z-10 flex items-center gap-1.5">
          {/* Círculo X Crítico estilo translúcido com recorte */}
          <div className="w-5 h-5 flex items-center justify-center shrink-0">
            <svg className="w-4.5 h-4.5 drop-shadow-xs" viewBox="0 0 24 24" fill="rgba(255,255,255,0.4)">
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zm-2.47 6.47a.75.75 0 011.06 0L12 10.19l2.47-2.47a.75.75 0 111.06 1.06L13.06 11.25l2.47 2.47a.75.75 0 11-1.06 1.06L12 12.31l-2.47 2.47a.75.75 0 11-1.06-1.06l2.47-2.47-2.47-2.47a.75.75 0 010-1.06z"
              />
            </svg>
          </div>
          <span className="font-nunito text-[10.5px] font-black uppercase tracking-wider text-white/95 drop-shadow-xs">
            Indisponíveis
          </span>
        </div>

        <div className="relative z-10 my-1">
          <span
            style={{ fontFamily: "'Nunito', sans-serif" }}
            className="font-nunito text-[32px] sm:text-[36px] font-black tracking-tight leading-none text-white drop-shadow-sm"
          >
            {contadores.indisponivelOuManutencao}
          </span>
        </div>

        <div className="font-nunito relative z-10 text-[11px] text-white/95">
          <span className="font-black drop-shadow-2xs">Em estado crítico</span>
        </div>
      </div>

      {/* CARD 4: SALAS (Azul Primário #528BFF → #246BFD) */}
      <div
        onClick={() => handleClick('salas')}
        style={{
          fontFamily: "'Nunito', sans-serif",
          background: 'radial-gradient(130% 130% at 30% 20%, #528BFF 0%, #246BFD 50%, #1253F6 100%)',
          boxShadow:
            'inset 0 4px 14px rgba(255, 255, 255, 0.95), inset 0 -4px 10px rgba(0, 0, 0, 0.1), inset 4px 0 12px rgba(255, 255, 255, 0.75), inset -4px 0 12px rgba(255, 255, 255, 0.75), 0 12px 32px rgba(36, 107, 253, 0.3)',
        }}
        className={`relative overflow-hidden rounded-[34px] px-6 py-5.5 transition-all duration-300 select-none flex flex-col justify-between min-h-[132px] border-0 font-nunito ${
          clicavel ? 'cursor-pointer hover:scale-[1.02] active:scale-[0.98]' : ''
        } ${filtroStatus === 'todos' && salaSelecionada === 'todas' ? 'ring-4 ring-blue-300 ring-offset-2' : ''}`}
      >
        <div className="absolute top-0 inset-x-0 h-3/5 bg-gradient-to-b from-white/40 via-white/10 to-transparent rounded-t-[34px] pointer-events-none" />

        <div className="relative z-10 flex items-center gap-1.5">
          {/* Ícone de Salas estilo translúcido com recorte */}
          <div className="w-5 h-5 flex items-center justify-center shrink-0">
            <svg className="w-4.5 h-4.5 drop-shadow-xs" viewBox="0 0 24 24" fill="rgba(255,255,255,0.4)">
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M3 2.25a.75.75 0 00-.75.75v18c0 .414.336.75.75.75h18a.75.75 0 00.75-.75V8.25a.75.75 0 00-.75-.75h-6V3a.75.75 0 00-.75-.75H3zm1.5 2.25h6.75V20.25H4.5V4.5zm8.25 4.5h6.75v11.25H12.75V9zm-6 1.5a.75.75 0 01.75-.75h1.5a.75.75 0 01.75.75v1.5a.75.75 0 01-.75.75h-1.5a.75.75 0 01-.75-.75v-1.5zm0 4.5a.75.75 0 01.75-.75h1.5a.75.75 0 01.75.75v1.5a.75.75 0 01-.75.75h-1.5a.75.75 0 01-.75-.75v-1.5zm8.25-1.5a.75.75 0 01.75-.75h1.5a.75.75 0 01.75.75v1.5a.75.75 0 01-.75.75h-1.5a.75.75 0 01-.75-.75v-1.5z"
              />
            </svg>
          </div>
          <span className="font-nunito text-[10.5px] font-black uppercase tracking-wider text-white/95 drop-shadow-xs">
            Salas
          </span>
        </div>

        <div className="relative z-10 my-1">
          <span
            style={{ fontFamily: "'Nunito', sans-serif" }}
            className="font-nunito text-[32px] sm:text-[36px] font-black tracking-tight leading-none text-white drop-shadow-sm"
          >
            {totalSalasExibidas}
          </span>
        </div>

        <div className="font-nunito relative z-10 text-[11px] text-white/95">
          <span className="font-black drop-shadow-2xs">Mapeadas</span>
        </div>
      </div>
    </div>
  )
}

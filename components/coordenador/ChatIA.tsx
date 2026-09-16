'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { OrbIA } from '@/components/ui/OrbIA'
import { AIChatInput } from '@/components/ui/ai-chat-input'
import { ResponseStream } from '@/components/ui/response-stream'
import { criarClienteSupabase } from '@/lib/supabase/client'

interface Mensagem {
  id: string
  role: 'user' | 'model'
  content: string
  timestamp: Date
  isStreaming?: boolean
}

const SUGESTOES_RAPIDAS = [
  'Quantas NCs tem abertas no hospital?',
  'Quais salas têm mais risco de atraso?',
  'Qual equipamento tem mais falhas recorrentes?',
  'Qual inspetor realizou mais rondas?',
  'Quais NCs críticas exigem validação hoje?',
]

function gerarId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`
}

function ThinkingState() {
  return (
    <div className="flex items-center gap-2.5 py-1 px-1 text-slate-500">
      <div className="relative flex items-center justify-center">
        <OrbIA tamanho={18} estado="thinking" />
        <span className="absolute inset-0 rounded-full bg-[#00C988]/30 animate-ping" />
      </div>
      <span className="text-[13px] font-normal text-slate-500 tracking-tight animate-pulse">
        Analisando dados do hospital...
      </span>
    </div>
  )
}

function formatarInline(texto: string): string {
  return texto
    // Bold
    .replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-slate-900">$1</strong>')
    // Italic
    .replace(/(?<!\*)\*(?!\*)(.*?)(?<!\*)\*(?!\*)/g, '<em class="italic text-slate-600">$1</em>')
    // NC Badges
    .replace(/(NC-\d{4}-[A-Z0-9]+)/g, '<span class="inline-flex items-center px-1.5 py-0.5 rounded-md bg-sky-50 text-sky-700 border border-sky-200/80 font-mono text-[11.5px] font-bold">$1</span>')
    // Criticidade Badges
    .replace(/\b(Crítico|Crítica|crítico|crítica)\b/g, '<span class="inline-flex items-center px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 font-semibold text-[11px] border border-rose-200">Crítica</span>')
    .replace(/\b(Importante|importante)\b/g, '<span class="inline-flex items-center px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 font-semibold text-[11px] border border-amber-200">Importante</span>')
    .replace(/\b(Informativo|Informativa|informativo|informativa)\b/g, '<span class="inline-flex items-center px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-semibold text-[11px] border border-blue-200">Informativa</span>')
}

function formatarMarkdown(texto: string): string {
  const raw = texto.trim()
  const linhas = raw.split('\n')
  const blocos: string[] = []
  let listaBuffer: string[] = []

  const flushLista = () => {
    if (listaBuffer.length > 0) {
      blocos.push(
        `<div class="my-2 pl-1 space-y-1.5">${listaBuffer.join('')}</div>`
      )
      listaBuffer = []
    }
  }

  for (let i = 0; i < linhas.length; i++) {
    const linha = linhas[i].trim()
    if (!linha) {
      flushLista()
      continue
    }

    // Heading 3
    if (linha.startsWith('### ')) {
      flushLista()
      const t = formatarInline(linha.slice(4))
      blocos.push(`<h4 class="text-[13.5px] font-bold text-slate-900 mt-3 mb-1 tracking-tight">${t}</h4>`)
      continue
    }

    // Heading 2
    if (linha.startsWith('## ')) {
      flushLista()
      const t = formatarInline(linha.slice(3))
      blocos.push(`<h3 class="text-[14.5px] font-bold text-slate-900 mt-3.5 mb-1.5 tracking-tight">${t}</h3>`)
      continue
    }

    // Bullet List (- or * or •)
    const bulletMatch = linha.match(/^[-*•]\s+(.*)$/)
    if (bulletMatch) {
      const itemContent = formatarInline(bulletMatch[1])
      listaBuffer.push(
        `<div class="flex items-start gap-2 text-[13.5px] text-slate-700 leading-relaxed"><span class="text-sky-500 font-bold shrink-0 mt-0.5">•</span><span>${itemContent}</span></div>`
      )
      continue
    }

    // Numbered List (1. or 2.)
    const numMatch = linha.match(/^(\d+)\.\s+(.*)$/)
    if (numMatch) {
      const num = numMatch[1]
      const itemContent = formatarInline(numMatch[2])
      listaBuffer.push(
        `<div class="flex items-start gap-2 text-[13.5px] text-slate-700 leading-relaxed"><span class="text-slate-500 font-mono font-bold text-xs shrink-0 mt-0.5">${num}.</span><span>${itemContent}</span></div>`
      )
      continue
    }

    // Regular paragraph
    flushLista()
    const pContent = formatarInline(linha)
    blocos.push(`<p class="text-[13.5px] text-slate-700 leading-relaxed my-1">${pContent}</p>`)
  }

  flushLista()
  return blocos.join('')
}

export function ChatIA() {
  const [aberto, setAberto] = useState(false)
  const [mensagens, setMensagens] = useState<Mensagem[]>([])
  const [enviando, setEnviando] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Escuta evento customizado para abrir o chat de qualquer botão da navbar
  useEffect(() => {
    function handleAbrirChat() {
      setAberto(true)
    }
    window.addEventListener('primus:abrir-chat-ia', handleAbrirChat)
    return () => window.removeEventListener('primus:abrir-chat-ia', handleAbrirChat)
  }, [])

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [mensagens, enviando])

  const obterAccessToken = useCallback(async (): Promise<string | null> => {
    try {
      const supabase = criarClienteSupabase() as any
      const { data } = await supabase.auth.getSession()
      return data?.session?.access_token || null
    } catch {
      return null
    }
  }, [])

  const enviarMensagem = useCallback(
    async (texto: string) => {
      if (!texto.trim() || enviando) return

      const mensagemUsuario: Mensagem = {
        id: gerarId(),
        role: 'user',
        content: texto.trim(),
        timestamp: new Date(),
      }

      setMensagens((prev) => [...prev, mensagemUsuario])
      setEnviando(true)

      const historicoParaAPI = [...mensagens, mensagemUsuario].map((m) => ({
        role: m.role,
        content: m.content,
      }))

      try {
        const token = await obterAccessToken()

        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        }
        if (token) {
          headers['Authorization'] = `Bearer ${token}`
        }

        const response = await fetch('/api/chat-ia', {
          method: 'POST',
          headers,
          body: JSON.stringify({ mensagens: historicoParaAPI }),
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.error || `Erro HTTP ${response.status}`)
        }

        const reader = response.body?.getReader()
        const decoder = new TextDecoder()

        if (!reader) throw new Error('Stream de dados indisponível')

        const mensagemIA: Mensagem = {
          id: gerarId(),
          role: 'model',
          content: '',
          timestamp: new Date(),
          isStreaming: true,
        }

        setMensagens((prev) => [...prev, mensagemIA])

        let buffer = ''
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const linhas = buffer.split('\n')
          buffer = linhas.pop() || ''

          for (const linha of linhas) {
            if (!linha.startsWith('data: ')) continue
            const payload = linha.slice(6).trim()

            if (payload === '[DONE]') break
            if (!payload) continue

            try {
              const parsed = JSON.parse(payload)
              if (parsed.error) {
                throw new Error(parsed.error)
              }
              if (parsed.text) {
                mensagemIA.content += parsed.text
                setMensagens((prev) =>
                  prev.map((m) =>
                    m.id === mensagemIA.id
                      ? { ...m, content: mensagemIA.content, isStreaming: true }
                      : m
                  )
                )
              }
            } catch {
              // Ignore partial json
            }
          }
        }

        // Fim do streaming
        setMensagens((prev) =>
          prev.map((m) =>
            m.id === mensagemIA.id ? { ...m, isStreaming: false } : m
          )
        )
      } catch (err: any) {
        console.error('Erro ao consultar IA:', err)
        const mensagemErro: Mensagem = {
          id: gerarId(),
          role: 'model',
          content: `⚠️ ${err.message || 'Erro ao processar consulta com a IA.'}`,
          timestamp: new Date(),
          isStreaming: false,
        }
        setMensagens((prev) => [...prev, mensagemErro])
      } finally {
        setEnviando(false)
      }
    },
    [mensagens, enviando, obterAccessToken]
  )

  return (
    <>
      {/* ════════════════════════════════════════════════════════════════
          PAINEL LATERAL (ChatGPT / Apple Minimalist Style)
         ════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {aberto && (
          <>
            {/* Backdrop com Blur */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setAberto(false)}
              className="fixed inset-0 bg-slate-950/30 backdrop-blur-xs z-[90]"
            />

            {/* Painel do Chat */}
            <motion.div
              initial={{ x: '100%', opacity: 0.9 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: '100%', opacity: 0.7 }}
              transition={{ type: 'spring', damping: 30, stiffness: 320 }}
              className="fixed top-0 right-0 bottom-0 z-[100] w-full sm:w-[440px] bg-white border-l border-slate-200/80 shadow-2xl flex flex-col overflow-hidden"
            >
              {/* Header Limpo & Elegante — Apple Style */}
              <div className="flex items-center justify-between px-5 py-3.5 bg-white border-b border-slate-100 shrink-0">
                <div className="flex items-center gap-2.5">
                  <OrbIA tamanho={26} estado={enviando ? 'thinking' : 'idle'} />
                  <h2 className="text-sm font-semibold text-slate-900 tracking-tight font-brand">
                    Primus IA
                  </h2>
                </div>

                <div className="flex items-center gap-1">
                  {mensagens.length > 0 && (
                    <button
                      onClick={() => setMensagens([])}
                      title="Nova conversa"
                      className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                      </svg>
                    </button>
                  )}
                  <button
                    onClick={() => setAberto(false)}
                    className="p-1.5 text-slate-400 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                    aria-label="Fechar painel"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Feed de Mensagens */}
              <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto px-5 py-5 space-y-4 scroll-smooth"
              >
                {/* Welcome State — Orb fluido e chips sutis de perguntas */}
                {mensagens.length === 0 && !enviando && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className="flex flex-col items-center text-center py-8 px-1 space-y-6"
                  >
                    {/* Orb Fluido com Sombra Suave e Discreta */}
                    <div
                      className="relative flex items-center justify-center p-1 rounded-full"
                      style={{
                        filter: 'drop-shadow(0 10px 28px rgba(0, 201, 136, 0.22)) drop-shadow(0 4px 14px rgba(92, 225, 230, 0.18))',
                      }}
                    >
                      <OrbIA tamanho={110} estado={enviando ? 'thinking' : 'idle'} />
                    </div>

                    <div>
                      <h3 className="text-base font-semibold text-slate-900 tracking-tight font-brand">
                        Como posso ajudar?
                      </h3>
                      <p className="text-xs text-slate-500 font-normal mt-1 leading-relaxed max-w-[260px]">
                        Pergunte sobre NCs, salas, equipamentos ou produtividade da equipe.
                      </p>
                    </div>

                    {/* Chips Apple Style de Perguntas Rápidas (Limpos, sem ícones) */}
                    <div className="w-full flex flex-wrap gap-2 justify-center pt-2">
                      {SUGESTOES_RAPIDAS.map((texto) => (
                        <button
                          key={texto}
                          onClick={() => enviarMensagem(texto)}
                          className="px-3.5 py-2 bg-slate-50 hover:bg-slate-100/90 text-slate-700 hover:text-slate-950 text-xs rounded-full border border-slate-200/70 transition-all duration-150 cursor-pointer text-center font-normal leading-snug active:scale-98 select-none"
                        >
                          {texto}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}

                {/* Mensagens do Histórico */}
                {mensagens.map((msg) => {
                  const ehUsuario = msg.role === 'user'
                  return (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.16 }}
                      className={`flex ${ehUsuario ? 'justify-end' : 'justify-start'}`}
                    >
                      {ehUsuario ? (
                        /* Bolha do Usuário — ChatGPT Style (Cinza claro refinado, bordas suaves) */
                        <div className="max-w-[85%] bg-[#F4F4F4] text-slate-900 rounded-[20px] px-4 py-2.5 text-[13.5px] font-normal leading-relaxed">
                          <p className="whitespace-pre-wrap">{msg.content}</p>
                        </div>
                      ) : (
                        /* Resposta da IA — Limpa, tipografia arejada e sofisticada sem orb lateral */
                        <div className="w-full text-[13.5px] text-slate-800 leading-relaxed font-normal">
                          {msg.isStreaming ? (
                            <ResponseStream
                              textStream={msg.content}
                              mode="typewriter"
                              speed={65}
                              className="text-[13.5px] text-slate-800"
                            />
                          ) : (
                            <div
                              className="space-y-1"
                              dangerouslySetInnerHTML={{
                                __html: formatarMarkdown(msg.content),
                              }}
                            />
                          )}
                        </div>
                      )}
                    </motion.div>
                  )
                })}

                {/* Estado de "Pensando" da IA */}
                {enviando &&
                  mensagens.length > 0 &&
                  mensagens[mensagens.length - 1]?.role === 'user' && (
                    <motion.div
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex justify-start pl-1"
                    >
                      <ThinkingState />
                    </motion.div>
                  )}
              </div>

              {/* Input Area — Rodapé elegante com safe-area mobile */}
              <div className="p-3.5 pb-[max(1.25rem,env(safe-area-inset-bottom))] bg-white border-t border-slate-100 shrink-0">
                <AIChatInput
                  onSend={enviarMensagem}
                  disabled={enviando}
                />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}

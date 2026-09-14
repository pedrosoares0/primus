'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter, usePathname } from 'next/navigation'
import CommandMenu from '@/components/ui/command-menu'
import { ChatIA } from '@/components/coordenador/ChatIA'
import { OrbIA } from '@/components/ui/OrbIA'
import { criarClienteSupabase } from '@/lib/supabase/client'

export default function LayoutCoordenador({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [usuario, setUsuario] = useState<{ nome: string; perfil: string; avatar_url?: string | null } | null>(null)

  useEffect(() => {
    async function carregarUsuario() {
      // 1. Limpa qualquer resquício de mock antigo ou nomes incorretos do cache
      const stored = (localStorage.getItem('primus_usuario_atual') || localStorage.getItem('argus_usuario_atual'))
      if (stored) {
        try {
          const parsed = JSON.parse(stored)
          if (parsed?.nome && !parsed.nome.toLowerCase().includes('ana beatriz')) {
            setUsuario({ nome: parsed.nome, perfil: parsed.perfil || 'coordenador', avatar_url: parsed.avatar_url || null })
          } else {
            localStorage.removeItem('primus_usuario_atual')
          }
        } catch (e) {
          console.error(e)
          localStorage.removeItem('primus_usuario_atual')
        }
      }

      // 2. Busca do Supabase Auth e tabela usuarios
      try {
        const supabase = criarClienteSupabase() as any
        const { data: { user } } = await supabase.auth.getUser()
        
        if (user) {
          const metaAvatar = user.user_metadata?.avatar_url || null
          // Busca perfil na tabela usuarios por auth_user_id ou id
          let { data: profiles, error: pErr } = await supabase
            .from('usuarios')
            .select('id, auth_user_id, nome, perfil, avatar_url')
            .or(`auth_user_id.eq.${user.id},id.eq.${user.id}`)
            .limit(1)

          if (pErr && pErr.code === '42703') {
            const { data: pFallback } = await supabase
              .from('usuarios')
              .select('id, auth_user_id, nome, perfil')
              .or(`auth_user_id.eq.${user.id},id.eq.${user.id}`)
              .limit(1)
            profiles = pFallback
          }

          const localAvatar = profiles?.[0]?.avatar_url || localStorage.getItem(`primus_avatar_${user.id}`) || metaAvatar
          const profile = profiles?.[0]
          
          if (profile?.nome) {
            const dadosUsuario = {
              nome: profile.nome,
              perfil: profile.perfil || 'coordenador',
              avatar_url: localAvatar
            }
            setUsuario(dadosUsuario)
            localStorage.setItem('primus_usuario_atual', JSON.stringify(dadosUsuario))
            return
          }

          // Fallback para metadados da autenticação do Supabase
          const metaNome = user.user_metadata?.nome || user.user_metadata?.full_name || user.user_metadata?.name
          if (metaNome) {
            const dadosUsuario = {
              nome: metaNome,
              perfil: user.user_metadata?.perfil || 'coordenador',
              avatar_url: localAvatar
            }
            setUsuario(dadosUsuario)
            localStorage.setItem('primus_usuario_atual', JSON.stringify(dadosUsuario))
            return
          }

          // Fallback com base no e-mail do usuário autenticado
          if (user.email) {
            const nomeEmail = user.email.split('@')[0]
            const nomeFormatado = nomeEmail.charAt(0).toUpperCase() + nomeEmail.slice(1)
            const dadosUsuario = {
              nome: `Coord. ${nomeFormatado}`,
              perfil: 'coordenador',
              avatar_url: metaAvatar
            }
            setUsuario(dadosUsuario)
            localStorage.setItem('primus_usuario_atual', JSON.stringify(dadosUsuario))
            return
          }
        }
      } catch (err) {
        console.error('Erro ao carregar usuário autenticado:', err)
      }
    }

    carregarUsuario()
  }, [router])

  const nomeExibido = usuario?.nome || 'Coord. Paulo Morais'
  
  // Extrai 2 iniciais limpas
  const iniciais = nomeExibido
    .replace(/^(Coord\.|Enf\.|Eng\.|Dr\.|Dra\.)\s*/i, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase() || 'PM'

  async function handleSair() {
    try {
      const supabase = criarClienteSupabase()
      await supabase.auth.signOut()
    } catch (e) {
      console.error(e)
    }
    localStorage.removeItem('primus_usuario_atual')
    router.push('/login')
  }

  return (
    <div className="min-h-[100dvh] flex flex-col bg-[#F4F6FA] w-full relative">
      {/* Header Responsivo */}
      <header className="relative z-50 bg-[#F4F6FA] border-b border-gray-200/50 px-4 sm:px-6 lg:px-8 py-3.5">
        <div className="max-w-7xl mx-auto w-full flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/coordenador" className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight hover:opacity-80 transition-opacity font-brand flex items-center gap-2.5">
              <div className="select-none">
                <Image
                  src="/idvisual/logo.webp?v=2"
                  alt="Primus"
                  width={155}
                  height={35}
                  unoptimized
                  priority
                  className="h-8 sm:h-9 w-auto object-contain"
                />
              </div>
              <span className="hidden sm:inline-flex text-[11px] font-extrabold text-[#17A592] bg-[#17A592]/10 px-2.5 py-0.5 rounded-full border border-[#17A592]/20 uppercase tracking-wider">
                Coordenação
              </span>
            </Link>
          </div>
          
          {/* CommandMenu Interativo Compacto */}
          <div className="flex items-center gap-2.5">
            <CommandMenu
              title={nomeExibido}
              perfil="coordenador"
              avatarUrl={usuario?.avatar_url}
              status={[
                'Coordenador(a)',
                'Hosp. Piem. Paraguaçu',
                <span key="online" className="flex items-center gap-1 text-[#17A592] font-semibold">
                  <span className="size-1.5 rounded-full bg-[#17A592] animate-pulse" />
                  Painel Ativo
                </span>
              ]}
              sections={[
                {
                  label: 'Navegação',
                  items: [
                    {
                      name: 'Central de Comando',
                      icon: (
                        <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                        </svg>
                      ),
                      active: pathname === '/coordenador',
                      onSelect: () => router.push('/coordenador'),
                    },
                    {
                      name: 'QR Codes & Ativos',
                      icon: (
                        <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h3.375c.621 0 1.125.504 1.125 1.125v3.375c0 .621-.504 1.125-1.125 1.125H4.875A1.125 1.125 0 013.75 8.25V4.875zM3.75 14.625c0-.621.504-1.125 1.125-1.125h3.375c.621 0 1.125.504 1.125 1.125V18c0 .621-.504 1.125-1.125 1.125H4.875A1.125 1.125 0 013.75 18v-3.375zM13.5 4.875c0-.621.504-1.125 1.125-1.125H18c.621 0 1.125.504 1.125 1.125v3.375c0 .621-.504 1.125-1.125 1.125h-3.375a1.125 1.125 0 01-1.125-1.125V4.875z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 14.625v3.375c0 .621.504 1.125 1.125 1.125h1.5m0-5.625v5.625m0 0H18c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125h-1.875m0 2.625V14.625" />
                        </svg>
                      ),
                      active: pathname === '/coordenador/ativos',
                      onSelect: () => router.push('/coordenador/ativos'),
                    },
                  ],
                },
                {
                  label: 'Conta',
                  items: [
                    {
                      name: 'Encerrar Sessão',
                      destructive: true,
                      icon: (
                        <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
                        </svg>
                      ),
                      onSelect: handleSair,
                    },
                  ],
                },
              ]}
            />
          </div>
        </div>
      </header>

      {/* Conteúdo principal */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 pb-28 md:pb-12">
        {children}
      </main>

      {/* Chat IA — Exclusivo do Coordenador */}
      <ChatIA />
    </div>
  )
}

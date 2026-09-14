'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter, usePathname } from 'next/navigation'
import CommandMenu from '@/components/ui/command-menu'
import { criarClienteSupabase } from '@/lib/supabase/client'

export default function LayoutEngenharia({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [usuario, setUsuario] = useState<{ nome: string; perfil: string; avatar_url?: string | null }>({ nome: 'Eng. Carlos Eduardo', perfil: 'engenharia_clinica', avatar_url: null })

  useEffect(() => {
    async function carregarUsuario() {
      const stored = (localStorage.getItem('primus_usuario_atual') || localStorage.getItem('argus_usuario_atual'))
      if (stored) {
        try {
          const parsed = JSON.parse(stored)
          if (parsed?.nome && !parsed.nome.toLowerCase().includes('ana beatriz')) {
            setUsuario(parsed)
          } else {
            localStorage.removeItem('primus_usuario_atual')
          }
        } catch (e) {
          console.error(e)
        }
      }

      try {
        const supabase = criarClienteSupabase() as any
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const metaAvatar = user.user_metadata?.avatar_url || null
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
            const u = { nome: profile.nome, perfil: profile.perfil || 'engenharia_clinica', avatar_url: localAvatar }
            setUsuario(u)
            localStorage.setItem('primus_usuario_atual', JSON.stringify(u))
            return
          }

          const metaNome = user.user_metadata?.nome || user.user_metadata?.full_name || user.user_metadata?.name
          if (metaNome) {
            const u = { nome: metaNome, perfil: user.user_metadata?.perfil || 'engenharia_clinica', avatar_url: localAvatar }
            setUsuario(u)
            localStorage.setItem('primus_usuario_atual', JSON.stringify(u))
            return
          }
        }
      } catch (err) {
        console.error('Erro ao obter usuário autenticado:', err)
      }
    }

    carregarUsuario()
  }, [])

  const nomeExibido = usuario?.nome || 'Eng. Carlos Eduardo'
  const iniciais = nomeExibido
    .replace(/^(Coord\.|Enf\.|Eng\.|Dr\.|Dra\.)\s*/i, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase() || 'CE'

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
    <div className="min-h-[100dvh] flex flex-col bg-[#F4F6FA] max-w-md mx-auto relative">
      {/* Header no tom do background cinza */}
      <header className="relative z-50 bg-[#F4F6FA] px-4 pt-4 pb-3 flex items-center justify-between border-b border-gray-200/50">
        <Link href="/engenharia" className="hover:opacity-80 transition-opacity flex items-center shrink-0">
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
        </Link>
        
        {/* CommandMenu Interativo Compacto */}
        <CommandMenu
          title={nomeExibido}
          perfil="engenharia_clinica"
          avatarUrl={usuario?.avatar_url}
          status={[
            'Engenharia Clínica',
            'Hosp. Piem. Paraguaçu',
            <span key="online" className="flex items-center gap-1 text-amber-600 font-semibold">
              <span className="size-1.5 rounded-full bg-amber-500 animate-pulse" />
              Ordens de Serviço
            </span>
          ]}
          sections={[
            {
              label: 'Navegação',
              items: [
                {
                  name: 'Fila de Não Conformidades',
                  icon: (
                    <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17l-5.29-3.52c-.58-.39-1.13.12-.8.78l3.06 6.13c.25.5.92.5 1.17 0l3.06-6.13c.33-.66-.22-1.17-.8-.78l-5.29 3.52zM9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15a2.25 2.25 0 012.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
                    </svg>
                  ),
                  active: pathname === '/engenharia',
                  onSelect: () => router.push('/engenharia'),
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
      </header>

      {/* Conteúdo principal */}
      <main className="flex-1 pb-10">
        {children}
      </main>
    </div>
  )
}

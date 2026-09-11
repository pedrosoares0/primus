'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import CommandMenu from '@/components/ui/command-menu'
import { criarClienteSupabase } from '@/lib/supabase/client'

export default function LayoutInspetor({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [usuario, setUsuario] = useState<{ nome: string; perfil: string; avatar_url?: string | null } | null>(null)

  useEffect(() => {
    // Pré-carregar rotas principais em background para navegação instantânea
    router.prefetch('/inspetor')
    router.prefetch('/inspetor/inspecoes')
    router.prefetch('/inspetor/scanner')
  }, [router])

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
            const u = { nome: profile.nome, perfil: profile.perfil || 'inspetor', avatar_url: localAvatar }
            setUsuario(u)
            localStorage.setItem('primus_usuario_atual', JSON.stringify(u))
            return
          }

          const metaNome = user.user_metadata?.nome || user.user_metadata?.full_name || user.user_metadata?.name
          if (metaNome) {
            const u = { nome: metaNome, perfil: user.user_metadata?.perfil || 'inspetor', avatar_url: localAvatar }
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
  }, [router])

  const nomeExibido = usuario?.nome || 'Enf. Pedro Soares'
  const iniciais = nomeExibido
    .replace(/^(Coord\.|Enf\.|Eng\.|Dr\.|Dra\.)\s*/i, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase() || 'PS'

  const itensNav = [
    {
      href: '/inspetor/inspecoes',
      label: 'Inspeções',
      icone: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15a2.25 2.25 0 012.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
        </svg>
      ),
    },
    {
      href: '/inspetor',
      label: 'Início',
      icone: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
        </svg>
      ),
    },
    {
      href: '/inspetor/scanner',
      label: 'Escanear',
      icone: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
        </svg>
      ),
    },
  ]

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

  const isGradientPage = pathname === '/inspetor'

  return (
    <div
      style={
        isGradientPage
          ? {
              background:
                'radial-gradient(135% 520px at 50% -30px, #C3FFE7 0%, rgba(195, 255, 231, 0.5) 45%, rgba(195, 255, 231, 0.08) 75%, transparent 100%), #F4F6FA',
            }
          : undefined
      }
      className={`min-h-[100dvh] flex flex-col ${!isGradientPage ? 'bg-[#F4F6FA]' : ''} max-w-md mx-auto relative`}
    >
      {/* Header no tom do background */}
      <header className={`relative z-50 px-4 pt-4 pb-3 flex items-center justify-between transition-all duration-200 ${isGradientPage ? 'bg-transparent' : 'bg-[#F4F6FA] border-b border-slate-200/70'}`}>
        <Link href="/inspetor" className="hover:opacity-80 transition-opacity flex items-center shrink-0">
          <div className="relative inline-flex items-center overflow-hidden rounded-xl p-0.5 select-none">
            <Image
              src="/idvisual/logo.webp?v=2"
              alt="Primus"
              width={155}
              height={35}
              unoptimized
              priority
              className="h-8 sm:h-9 w-auto object-contain relative z-10"
            />
            {/* Efeito com a cor do verde claro do gradiente correndo suave pela logo */}
            <div 
              className="pointer-events-none absolute inset-0 z-20 animate-logo-shimmer"
              style={{
                background: 'linear-gradient(105deg, transparent 20%, rgba(195, 255, 231, 0.25) 38%, rgba(195, 255, 231, 0.95) 50%, rgba(195, 255, 231, 0.25) 62%, transparent 80%)',
                mixBlendMode: 'screen',
              }}
            />
          </div>
        </Link>
        
        {/* CommandMenu Interativo Compacto */}
        <CommandMenu
          title={nomeExibido}
          perfil="inspetor"
          avatarUrl={usuario?.avatar_url}
          status={[
            'Inspetor(a)',
            'Hosp. Piem. Paraguaçu',
            <span key="online" className="flex items-center gap-1 text-[#17A592] font-semibold">
              <span className="size-1.5 rounded-full bg-[#17A592] animate-pulse" />
              Pronto para Ronda
            </span>
          ]}
          sections={[
            {
              label: 'Navegação',
              items: [
                {
                  name: 'Início / Scanner',
                  icon: (
                    <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
                    </svg>
                  ),
                  active: pathname === '/inspetor',
                  onSelect: () => router.push('/inspetor'),
                },
                {
                  name: 'Inspeções',
                  icon: (
                    <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15a2.25 2.25 0 012.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
                    </svg>
                  ),
                  active: pathname === '/inspetor/inspecoes',
                  onSelect: () => router.push('/inspetor/inspecoes'),
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
      <main className="flex-1 pb-28">
        {children}
      </main>

      {/* NAV INFERIOR */}
      <div className="fixed bottom-0 left-0 right-0 z-40 max-w-md mx-auto px-4 pb-[max(0.65rem,env(safe-area-inset-bottom))] pointer-events-none">
        <nav className="pointer-events-auto bg-white/40 backdrop-blur-[24px] saturate-[180%] rounded-full border border-white/50 shadow-[0_8px_32px_rgba(0,0,0,0.08),inset_0_1px_1px_rgba(255,255,255,0.7)] p-1.5">
          <div className="flex items-center justify-between gap-1">
            {itensNav.map((item) => {
              const ativo = item.href === '/inspetor'
                ? pathname === '/inspetor'
                : pathname.startsWith(item.href)

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  prefetch={true}
                  className={[
                    'flex-1 flex flex-col items-center justify-center py-1.5 px-3 rounded-full cursor-pointer',
                    'transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] active:scale-[0.92]',
                    ativo
                      ? 'bg-gradient-to-b from-[#17A592]/20 to-[#17A592]/10 text-[#17A592] shadow-[0_3px_10px_rgba(23,165,146,0.18),inset_0_1px_1.5px_rgba(255,255,255,0.8),inset_0_0_0_1px_rgba(23,165,146,0.22)] font-black'
                      : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100/30',
                  ].join(' ')}
                >
                  <div className="w-5 h-5 flex items-center justify-center shrink-0">
                    {item.icone}
                  </div>
                  <span className="text-[9.5px] font-bold tracking-wide mt-0.5">{item.label}</span>
                </Link>
              )
            })}
          </div>
        </nav>
      </div>
    </div>
  )
}

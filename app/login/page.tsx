'use client'

import { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter, useSearchParams } from 'next/navigation'
import { X, Eye, EyeOff } from 'lucide-react'
import { Botao } from '@/components/ui/Botao'
import { LiquidMetalButton } from '@/components/ui/liquid-metal-button'
import { criarClienteSupabase } from '@/lib/supabase/client'

import { Avatar } from '@/components/ui/Avatar'
import { traduzirErroAuth } from '@/lib/tratarErrosAuth'

type PerfilUsuario = 'inspetor' | 'coordenador' | 'engenharia'

const PERFIS: { valor: PerfilUsuario; label: string; desc: string; avatarUrl: string; fallback: string }[] = [
  { 
    valor: 'inspetor', 
    label: 'Inspetor', 
    desc: 'Enfermeiros e Técnicos em campo', 
    avatarUrl: 'https://heroui-assets.nyc3.cdn.digitaloceanspaces.com/avatars/blue.jpg',
    fallback: 'IN' 
  },
  { 
    valor: 'engenharia', 
    label: 'Engenharia Clínica', 
    desc: 'Manutenção e reparo de ativos', 
    avatarUrl: 'https://heroui-assets.nyc3.cdn.digitaloceanspaces.com/avatars/red.jpg',
    fallback: 'EN' 
  },
  { 
    valor: 'coordenador', 
    label: 'Coordenação', 
    desc: 'Visão setorial e validação de NCs', 
    avatarUrl: 'https://heroui-assets.nyc3.cdn.digitaloceanspaces.com/avatars/purple.jpg',
    fallback: 'CO' 
  },
]

function FormularioLogin() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [perfilSelecionado, setPerfilSelecionado] = useState<PerfilUsuario>('inspetor')
  const [carregando, setCarregando] = useState(false)
  const [mostrarCredenciais, setMostrarCredenciais] = useState(false)
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const [manterConectado, setManterConectado] = useState(true)

  const [erro, setErro] = useState<string | null>(null)

  // Recupera último login salvo se "Me manter conectado" estiver ativo
  useEffect(() => {
    try {
      const emailSalvo = localStorage.getItem('primus_lembrar_email')
      const manterSalvo = localStorage.getItem('primus_manter_conectado')
      if (emailSalvo) {
        setEmail(emailSalvo)
      }
      if (manterSalvo !== null) {
        setManterConectado(manterSalvo === 'true')
      }
    } catch {
      // ignore
    }
  }, [])

  async function handleEntrar(e: React.FormEvent) {
    e.preventDefault()
    setCarregando(true)
    setErro(null)

    try {
      const supabase = criarClienteSupabase() as any
      
      let res = await supabase.auth.signInWithPassword({
        email,
        password: senha,
      })

      // Se falhar o login (por exemplo, usuário não existe ou senha hash corrompida por inserções manuais anteriores)
      if (res.error) {
        // Tenta cadastrar o usuário de forma oficial via API (que preenche todas as tabelas e colunas com a estrutura exata exigida pelo GoTrue)
        const signUpRes = await supabase.auth.signUp({
          email,
          password: senha,
          options: {
            data: {
              hospital_id: 'e632822a-0000-0000-0000-000000000001',
              nome: email === 'inspetor@gmail.com' ? 'Enf. Pedro Soares' : email === 'engenharia@gmail.com' ? 'Eng. Carlos Eduardo' : 'Coord. Paulo Morais',
              perfil: email === 'inspetor@gmail.com' ? 'inspetor' : email === 'engenharia@gmail.com' ? 'engenharia_clinica' : 'coordenador'
            }
          }
        })

        if (!signUpRes.error) {
          res = await supabase.auth.signInWithPassword({
            email,
            password: senha,
          })
        } else {
          console.error('Erro de login original:', res.error)
          setErro(traduzirErroAuth(res.error))
          setCarregando(false)
          return
        }
      }

      if (res.error || !res.data.user) {
        setErro(traduzirErroAuth(res.error || 'Usuário nulo'))
        setCarregando(false)
        return
      }

      const metaAvatar = res.data.user.user_metadata?.avatar_url || null

      let profile = null
      for (let i = 0; i < 4; i++) {
        let { data: p, error: pErr } = await supabase
          .from('usuarios')
          .select('id, nome, perfil, avatar_url')
          .eq('id', res.data.user.id)
          .single()
        
        if (pErr && pErr.code === '42703') {
          const { data: pSemAvatar } = await supabase
            .from('usuarios')
            .select('id, nome, perfil')
            .eq('id', res.data.user.id)
            .single()
          p = pSemAvatar
        }

        if (p) {
          profile = p
          break
        }
        await new Promise((resolve) => setTimeout(resolve, 200))
      }

      if (!profile) {
        profile = {
          id: res.data.user.id,
          nome: res.data.user.user_metadata?.nome || email.split('@')[0],
          perfil: res.data.user.user_metadata?.perfil || perfilSelecionado,
          avatar_url: metaAvatar
        }
      }

      localStorage.setItem('primus_usuario_atual', JSON.stringify({
        id: res.data.user.id,
        nome: profile.nome,
        perfil: profile.perfil,
        avatar_url: profile.avatar_url || metaAvatar
      }))

      // Salva ou remove o último login conforme "Me manter conectado"
      try {
        if (manterConectado) {
          localStorage.setItem('primus_lembrar_email', email)
          localStorage.setItem('primus_manter_conectado', 'true')
        } else {
          localStorage.removeItem('primus_lembrar_email')
          localStorage.setItem('primus_manter_conectado', 'false')
        }
      } catch {
        // ignore
      }

      const rotas: Record<string, string> = {
        inspetor: '/inspetor',
        coordenador: '/coordenador',
        engenharia_clinica: '/engenharia',
        tecnico: '/engenharia',
        gestor: '/gestor',
        administrador: '/admin',
      }

      const nextParam = searchParams?.get('next')
      if (nextParam) {
        router.push(nextParam)
      } else {
        router.push(rotas[profile.perfil] || '/inspetor')
      }
    } catch (err: any) {
      console.error(err)
      setErro(traduzirErroAuth(err))
      setCarregando(false)
    }
  }

  return (
    <div 
      style={{
        background: 'radial-gradient(135% 520px at 50% -30px, #C3FFE7 0%, rgba(195, 255, 231, 0.5) 45%, rgba(195, 255, 231, 0.08) 75%, transparent 100%), #FAFAFC'
      }}
      className="min-h-[100dvh] flex flex-col items-center justify-center px-5 py-8 select-none"
    >
      <div className="w-full max-w-sm space-y-8 animate-[fadeIn_0.3s_ease-out]">
        
        {/* Cabeçalho de Identidade */}
        <div className="text-center flex flex-col items-center">
          <div className="relative inline-flex items-center justify-center overflow-hidden rounded-2xl p-1 select-none">
            <Image
              src="/idvisual/logo.webp?v=2"
              alt="Primus"
              width={200}
              height={45}
              unoptimized
              priority
              className="h-12 w-auto object-contain relative z-10"
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

          {/* Botão CREDENCIAIS */}
          <button
            type="button"
            onClick={() => setMostrarCredenciais(!mostrarCredenciais)}
            className="mt-3 inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-white border border-gray-200/50 shadow-[0_2px_6px_rgba(0,0,0,0.02)] text-[10px] font-bold uppercase tracking-widest text-gray-500 hover:text-gray-900 hover:border-gray-300 transition-all duration-200 cursor-pointer active:scale-95 select-none"
          >
            <span>CREDENCIAIS</span>
            <svg className={`w-2.5 h-2.5 text-gray-400 transition-transform duration-300 ${mostrarCredenciais ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
            </svg>
          </button>

          {/* Painel de Perfis Animado (Sleek Glassmorphism & Compact) */}
          <div
            className="overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]"
            style={{
              maxHeight: mostrarCredenciais ? '90px' : '0px',
              opacity: mostrarCredenciais ? 1 : 0,
              marginTop: mostrarCredenciais ? '14px' : '0px',
            }}
          >
            <div className="max-w-[290px] mx-auto bg-white/35 backdrop-blur-md rounded-[20px] p-2.5 border border-white/40 shadow-[0_8px_32px_0_rgba(0,0,0,0.04)]">
              <div className="flex justify-center gap-3">
                {PERFIS.map((p) => {
                  const ativo = perfilSelecionado === p.valor
                  const labelCurto: Record<string, string> = {
                    inspetor: 'Inspetor',
                    engenharia: 'Engenharia',
                    coordenador: 'Coordenação',
                  }
                  
                  return (
                    <button
                      key={p.valor}
                      type="button"
                      onClick={() => {
                        setPerfilSelecionado(p.valor)
                        const emails: Record<string, string> = {
                          inspetor: 'inspetor@gmail.com',
                          coordenador: 'coordenador@gmail.com',
                          engenharia: 'engenharia@gmail.com',
                        }
                        setEmail(emails[p.valor])
                        setSenha('123456')
                      }}
                      className="flex flex-col items-center gap-1.5 focus:outline-none group select-none cursor-pointer"
                    >
                      <div
                        className={`rounded-full p-0.5 aspect-square flex items-center justify-center transition-all duration-200 ${
                          ativo
                            ? 'ring-2 ring-[#17A592]/30 ring-offset-2 scale-105 shadow-[0_2px_8px_rgba(23,165,146,0.15)]'
                            : 'opacity-60 hover:opacity-100 hover:scale-105 active:scale-95'
                        }`}
                      >
                        <Avatar size="md">
                          <Avatar.Image
                            alt={p.label}
                            src={p.avatarUrl}
                          />
                          <Avatar.Fallback>{p.fallback}</Avatar.Fallback>
                        </Avatar>
                      </div>
                      <span
                        className={`text-[10px] font-bold tracking-tight text-center whitespace-nowrap transition-colors ${
                          ativo ? 'text-[#17A592]' : 'text-gray-400 group-hover:text-gray-600'
                        }`}
                      >
                        {labelCurto[p.valor]}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Card Principal do Login */}
        <div className="bg-white rounded-[28px] p-6 shadow-[0_2px_14px_rgba(0,0,0,0.03)] border border-gray-100/80 space-y-6">
          <form onSubmit={handleEntrar} className="space-y-4">
            
            {erro && (
              <p className="text-xs font-bold text-red-500 bg-red-50/50 border border-red-200/50 rounded-xl px-4 py-2.5 text-center">
                {erro}
              </p>
            )}
            
            {/* Input de Email */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-gray-400 tracking-wider uppercase ml-1">
                E-mail
              </label>
              <div className="relative flex items-center">
                <input
                  type="email"
                  required
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-[#F4F6FA] border border-gray-200/80 rounded-2xl pl-4 pr-11 py-3.5 text-[16px] text-gray-900 placeholder:text-gray-400 outline-none focus:border-[#17A592] focus:ring-1 focus:ring-[#17A592]/10 transition-all"
                />
                {email.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setEmail('')}
                    className="absolute right-3.5 w-6 h-6 rounded-full bg-gray-200/80 hover:bg-gray-300 active:scale-95 text-gray-500 hover:text-gray-700 flex items-center justify-center transition-all cursor-pointer"
                    aria-label="Limpar e-mail"
                    title="Limpar e-mail"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Input de Senha */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-gray-400 tracking-wider uppercase ml-1">
                Senha
              </label>
              <div className="relative flex items-center">
                <input
                  type={mostrarSenha ? 'text' : 'password'}
                  required
                  placeholder="••••••••"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  className="w-full bg-[#F4F6FA] border border-gray-200/80 rounded-2xl pl-4 pr-11 py-3.5 text-[16px] text-gray-900 placeholder:text-gray-400 outline-none focus:border-[#17A592] focus:ring-1 focus:ring-[#17A592]/10 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setMostrarSenha(!mostrarSenha)}
                  className="absolute right-3.5 w-7 h-7 rounded-full text-gray-400 hover:text-gray-700 flex items-center justify-center transition-colors cursor-pointer active:scale-95"
                  aria-label={mostrarSenha ? 'Ocultar senha' : 'Ver senha'}
                  title={mostrarSenha ? 'Ocultar senha' : 'Ver senha'}
                >
                  {mostrarSenha ? (
                    <EyeOff className="w-4 h-4 text-[#17A592]" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Opção Me manter conectado */}
            <div className="flex items-center justify-between px-1 pt-0.5">
              <label className="inline-flex items-center gap-2 cursor-pointer select-none group">
                <input
                  type="checkbox"
                  checked={manterConectado}
                  onChange={(e) => setManterConectado(e.target.checked)}
                  className="w-4 h-4 rounded-md border-gray-300 text-[#17A592] focus:ring-[#17A592]/20 accent-[#17A592] cursor-pointer"
                />
                <span className="text-xs font-semibold text-gray-500 group-hover:text-gray-800 transition-colors">
                  Me manter conectado
                </span>
              </label>
            </div>

            {/* Botão Entrar com Efeito Liquid Metal */}
            <div className="pt-2">
              <LiquidMetalButton
                type="submit"
                tamanho="lg"
                larguraTotal
                carregando={carregando}
                label="Entrar"
              />
            </div>

            {/* Link para Cadastro */}
            <div className="text-center pt-1.5">
              <Link
                href="/cadastro"
                className="text-xs font-bold text-[#17A592] hover:underline"
              >
                Não tem uma conta? Cadastre-se
              </Link>
            </div>

          </form>
        </div>

      </div>
    </div>
  )
}

export default function PaginaLogin() {
  return (
    <Suspense fallback={<div className="min-h-[100dvh] flex items-center justify-center bg-[#F4F6FA] text-sm text-gray-400">Carregando...</div>}>
      <FormularioLogin />
    </Suspense>
  )
}

'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronLeft, Camera, Image as ImageIcon, X, SwitchCamera, Zap, ZapOff } from 'lucide-react'
import { LiquidMetalButton } from '@/components/ui/liquid-metal-button'
import { Avatar, AvatarPerfil } from '@/components/ui/Avatar'
import { criarClienteSupabase } from '@/lib/supabase/client'
import { TODOS_SETORES, SETORES_LABELS } from '@/lib/roteamentoNC'
import { traduzirErroAuth } from '@/lib/tratarErrosAuth'

const ROLES = [
  { 
    valor: 'inspetor', 
    label: 'Inspetor', 
    desc: 'Checagem',
    avatarUrl: 'https://heroui-assets.nyc3.cdn.digitaloceanspaces.com/avatars/blue.jpg',
    fallback: 'IN' 
  },
  { 
    valor: 'tecnico', 
    label: 'Técnico', 
    desc: 'Setor especializado',
    avatarUrl: 'https://heroui-assets.nyc3.cdn.digitaloceanspaces.com/avatars/orange.jpg',
    fallback: 'TC' 
  },
  { 
    valor: 'coordenador', 
    label: 'Coordenador', 
    desc: 'Gestão CC & IA',
    avatarUrl: 'https://heroui-assets.nyc3.cdn.digitaloceanspaces.com/avatars/purple.jpg',
    fallback: 'CO' 
  },
]

function comprimirImagem(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new window.Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const maxDim = 120
        const width = img.width
        const height = img.height

        // Recorte 1:1 centralizado (quadrado perfeito para avatar)
        const size = Math.min(width, height)
        const sx = (width - size) / 2
        const sy = (height - size) / 2

        canvas.width = maxDim
        canvas.height = maxDim
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          resolve(e.target?.result as string)
          return
        }

        ctx.drawImage(img, sx, sy, size, size, 0, 0, maxDim, maxDim)
        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.8)
        resolve(compressedBase64)
      }
      img.onerror = () => resolve(e.target?.result as string)
      img.src = e.target?.result as string
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function base64ToBlob(base64: string): Blob {
  const parts = base64.split(',')
  const mime = parts[0].match(/:(.*?);/)?.[1] || 'image/jpeg'
  const bstr = atob(parts[1])
  let n = bstr.length
  const u8arr = new Uint8Array(n)
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n)
  }
  return new Blob([u8arr], { type: mime })
}

export default function PaginaCadastro() {
  const router = useRouter()
  
  // Controle de Etapa (1 = Identificação, 2 = Hospital & Perfil, 3 = Personalização)
  const [etapa, setEtapa] = useState<1 | 2 | 3>(1)

  // Etapa 1: Dados Profissionais e Cargo
  const [nomeCompleto, setNomeCompleto] = useState('')
  const [email, setEmail] = useState('')
  const [hospitalId, setHospitalId] = useState('e632822a-0000-0000-0000-000000000001')
  const [numeroConselho, setNumeroConselho] = useState('')
  const [perfilSelecionado, setPerfilSelecionado] = useState('inspetor')
  const [setorSelecionado, setSetorSelecionado] = useState('')

  // Etapa 2: Foto (Opcional) e Senha
  const [fotoPreview, setFotoPreview] = useState<string | null>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const galeriaInputRef = useRef<HTMLInputElement>(null)

  // Câmera ao vivo estilo iPhone (Webcam / Celular)
  const [modalCameraAberto, setModalCameraAberto] = useState(false)
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null)
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user')
  const [flashAtivo, setFlashAtivo] = useState(false)
  const [disparandoFlash, setDisparandoFlash] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)

  const [senha, setSenha] = useState('')
  const [confirmarSenha, setConfirmarSenha] = useState('')

  const [hospitais, setHospitais] = useState<any[]>([])
  const [carregandoHospitais, setCarregandoHospitais] = useState(true)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [sucesso, setSucesso] = useState<string | null>(null)

  // Carregar hospitais cadastrados em tempo real
  useEffect(() => {
    async function carregarHospitais() {
      try {
        const res = await fetch('/api/hospitais')
        const json = await res.json()
        if (json?.hospitais && json.hospitais.length > 0) {
          setHospitais(json.hospitais)
          setHospitalId(json.hospitais[0].id)
          setCarregandoHospitais(false)
          return
        }

        const supabase = criarClienteSupabase() as any
        const { data } = await supabase
          .from('hospitais')
          .select('id, nome')
        
        if (data && data.length > 0) {
          setHospitais(data)
          setHospitalId(data[0].id)
        } else {
          setHospitais([{ id: 'e632822a-0000-0000-0000-000000000001', nome: 'Hospital Geral' }])
        }
      } catch (err) {
        console.error('Erro ao carregar hospitais:', err)
        setHospitais([{ id: 'e632822a-0000-0000-0000-000000000001', nome: 'Hospital Geral' }])
      } finally {
        setCarregandoHospitais(false)
      }
    }
    carregarHospitais()
  }, [])

  // Limpeza de stream de câmera caso desmonte
  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach((t) => t.stop())
      }
    }
  }, [cameraStream])

  // Vincula stream ao elemento de vídeo quando o modal abre
  useEffect(() => {
    if (modalCameraAberto && videoRef.current && cameraStream) {
      videoRef.current.srcObject = cameraStream
      videoRef.current.play().catch((e) => console.error('Erro ao iniciar vídeo:', e))
    }
  }, [modalCameraAberto, cameraStream])

  // Iniciar Câmera ao vivo
  async function iniciarCamera(modo: 'user' | 'environment' = 'user') {
    if (cameraStream) {
      cameraStream.getTracks().forEach((t) => t.stop())
    }
    try {
      if (typeof navigator !== 'undefined' && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: modo,
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        })
        setCameraStream(stream)
        setFacingMode(modo)
        setModalCameraAberto(true)
        setErro(null)
      } else {
        cameraInputRef.current?.click()
      }
    } catch (err: any) {
      console.warn('Câmera direta com modo indisponível, tentando genérico:', err)
      try {
        const fallbackStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
        setCameraStream(fallbackStream)
        setFacingMode(modo)
        setModalCameraAberto(true)
      } catch {
        cameraInputRef.current?.click()
      }
    }
  }

  function abrirCamera() {
    iniciarCamera('user')
  }

  function fecharCamera() {
    if (cameraStream) {
      cameraStream.getTracks().forEach((t) => t.stop())
      setCameraStream(null)
    }
    setFlashAtivo(false)
    setModalCameraAberto(false)
  }

  function alternarCamera() {
    const proximoModo = facingMode === 'user' ? 'environment' : 'user'
    iniciarCamera(proximoModo)
  }

  async function alternarFlash() {
    const proximo = !flashAtivo
    setFlashAtivo(proximo)
    if (cameraStream) {
      const track = cameraStream.getVideoTracks()[0]
      try {
        const capabilities = track.getCapabilities?.() as any
        if (capabilities?.torch) {
          await (track as any).applyConstraints({
            advanced: [{ torch: proximo }]
          })
        }
      } catch (err) {
        console.warn('Torch não suportado neste aparelho/câmera:', err)
      }
    }
  }

  function capturarFotoCamera() {
    if (!videoRef.current) return
    const video = videoRef.current

    if (flashAtivo) {
      setDisparandoFlash(true)
      setTimeout(() => setDisparandoFlash(false), 140)
    }

    const canvas = document.createElement('canvas')
    const maxDim = 160
    const width = video.videoWidth || 1280
    const height = video.videoHeight || 720

    const size = Math.min(width, height)
    const sx = (width - size) / 2
    const sy = (height - size) / 2

    canvas.width = maxDim
    canvas.height = maxDim
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Se for frontal (user), espelha horizontalmente como espelho/selfie
    if (facingMode === 'user') {
      ctx.translate(maxDim, 0)
      ctx.scale(-1, 1)
    }
    ctx.drawImage(video, sx, sy, size, size, 0, 0, maxDim, maxDim)

    const base64 = canvas.toDataURL('image/jpeg', 0.82)
    setFotoPreview(base64)
    fecharCamera()
  }

  async function handleFotoSelecionada(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      const base64Comprimido = await comprimirImagem(file)
      setFotoPreview(base64Comprimido)
      setErro(null)
    } catch (err) {
      console.error('Erro ao processar imagem:', err)
      setErro('Não foi possível carregar a foto selecionada.')
    } finally {
      e.target.value = ''
    }
  }

  function removerFoto() {
    setFotoPreview(null)
  }

  // Avançar da Etapa 1 para a Etapa 2 (Identificação e Senha)
  function handleAvancarEtapa1(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)

    if (!nomeCompleto.trim()) {
      setErro('Por favor, informe seu nome completo.')
      return
    }

    if (!email.trim() || !email.includes('@')) {
      setErro('Por favor, informe um e-mail válido.')
      return
    }

    if (senha.length < 6) {
      setErro('A senha deve ter pelo menos 6 caracteres.')
      return
    }

    if (senha !== confirmarSenha) {
      setErro('As senhas não coincidem.')
      return
    }

    setEtapa(2)
  }

  // Avançar da Etapa 2 para a Etapa 3 (Hospital e Cargo)
  function handleAvancarEtapa2(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)

    if (!hospitalId) {
      setErro('Por favor, selecione seu hospital.')
      return
    }

    if (perfilSelecionado === 'tecnico' && !setorSelecionado) {
      setErro('Por favor, selecione o seu setor técnico.')
      return
    }

    setEtapa(3)
  }

  // Concluir cadastro na Etapa 3 (Personalização)
  async function handleCadastrar(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)
    setSucesso(null)

    if (senha.length < 6) {
      setErro('A senha deve ter pelo menos 6 caracteres.')
      return
    }

    if (senha !== confirmarSenha) {
      setErro('As senhas não coincidem.')
      return
    }

    setCarregando(true)

    try {
      const supabase = criarClienteSupabase() as any

      // Se o usuário subiu foto, ela já está em memória e comprimida para ~5KB.
      // Se NÃO subiu foto, avatarFinalUrl é estritamente null -> o sistema usará o avatar oficial do cargo
      const avatarFinalUrl: string | null = fotoPreview || null

      // 1. Registrar o usuário no Supabase Auth com metadados leves (sem base64 no token JWT para manter cookies pequenos e evitar HTTP 431)
      const { data, error } = await supabase.auth.signUp({
        email,
        password: senha,
        options: {
          data: {
            hospital_id: hospitalId,
            nome: nomeCompleto,
            perfil: perfilSelecionado,
            numero_conselho: numeroConselho,
            setor: perfilSelecionado === 'tecnico' ? (setorSelecionado || 'engenharia_clinica') : null,
            tem_foto: Boolean(fotoPreview),
          }
        }
      })

      if (error) {
        setErro(traduzirErroAuth(error))
        setCarregando(false)
        return
      }

      setSucesso('Conta criada com sucesso!')

      // Se o signUp não iniciou a sessão automaticamente, faz signIn para garantir cookie de sessão ativo
      if (!data.session) {
        await supabase.auth.signInWithPassword({
          email,
          password: senha,
        })
      }

      // 2. Se o usuário enviou foto, tenta persistir no Supabase Storage oficial (bucket avatars)
      let avatarPersistido: string | null = null
      if (fotoPreview) {
        try {
          const blob = base64ToBlob(fotoPreview)
          const fileName = `${data.user.id}.jpg`
          const { data: upData, error: upError } = await supabase.storage
            .from('avatars')
            .upload(fileName, blob, { contentType: 'image/jpeg', upsert: true })

          if (!upError && upData) {
            const { data: pUrl } = supabase.storage.from('avatars').getPublicUrl(fileName)
            if (pUrl?.publicUrl) {
              avatarPersistido = pUrl.publicUrl
            }
          }
        } catch (storageErr) {
          console.warn('Storage avatars não configurado ou indisponível:', storageErr)
        }

        // Se o bucket não existir ainda no Supabase, usa a imagem comprimida (~5KB) diretamente no banco
        if (!avatarPersistido) {
          avatarPersistido = fotoPreview
        }
      }

      // 3. Vincular dados na tabela public.usuarios (Banco de Dados PostgreSQL)
      if (data.user) {
        const payloadUsuario: any = {
          id: data.user.id,
          nome: nomeCompleto,
          email: email,
          perfil: perfilSelecionado,
          hospital_id: hospitalId,
          numero_conselho: numeroConselho || null,
          setor: perfilSelecionado === 'tecnico' ? (setorSelecionado || 'engenharia_clinica') : null,
          avatar_url: avatarPersistido,
        }

        try {
          const { error: upsertErr } = await supabase.from('usuarios').upsert(payloadUsuario)
          if (upsertErr) {
            // Se falhar no upsert direto por RLS, atualiza a linha já gerada pelo trigger do banco
            await supabase.from('usuarios').update({
              nome: nomeCompleto,
              perfil: perfilSelecionado,
              hospital_id: hospitalId,
              numero_conselho: numeroConselho || null,
              setor: perfilSelecionado === 'tecnico' ? (setorSelecionado || 'engenharia_clinica') : null,
              avatar_url: avatarPersistido,
            }).eq('id', data.user.id)
          }
        } catch (dbErr) {
          console.error('Erro ao sincronizar tabela usuarios:', dbErr)
        }

        // 4. Cache local para carregamento instantâneo da pill (0ms) no primeiro acesso
        try {
          localStorage.setItem('primus_usuario_atual', JSON.stringify({
            id: data.user.id,
            nome: nomeCompleto,
            perfil: perfilSelecionado,
            avatar_url: avatarPersistido
          }))
          if (avatarPersistido) {
            localStorage.setItem(`primus_avatar_${data.user.id}`, avatarPersistido)
          }
        } catch {
          // ignore
        }

        // Redirecionamento imediato para a tela respectiva
        const rotas: Record<string, string> = {
          inspetor: '/inspetor',
          engenharia_clinica: '/engenharia',
          coordenador: '/coordenador',
          tecnico: '/engenharia',
        }

        setTimeout(() => {
          router.push(rotas[perfilSelecionado] || '/inspetor')
        }, 500)
      } else {
        router.push('/login?mensagem=Cadastro realizado. Faça login para continuar.')
      }

    } catch (err: any) {
      console.error(err)
      setErro(traduzirErroAuth(err))
      setCarregando(false)
    }
  }

  const roleAtual = ROLES.find(r => r.valor === perfilSelecionado) || ROLES[0]
  const hospitalSelecionado = hospitais.find(h => h.id === hospitalId)
  const hospitalNome = hospitalSelecionado ? hospitalSelecionado.nome : 'Hospital Geral'

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center px-5 py-8 select-none bg-[#F2F4F7]">
      <div className="w-full max-w-sm space-y-5 animate-[fadeIn_0.3s_ease-out]">
        
        {/* Topo com Botão Voltar contextual e Título */}
        <div className="relative flex items-center justify-center">
          {etapa === 1 ? (
            <Link
              href="/login"
              className="absolute left-0 top-0.5 inline-flex items-center justify-center w-10 h-10 rounded-full bg-white border border-gray-200/80 shadow-[0_2px_8px_rgba(0,0,0,0.04)] text-gray-600 hover:text-gray-900 hover:bg-gray-50 active:scale-95 transition-all cursor-pointer"
              aria-label="Voltar para login"
              title="Voltar para Login"
            >
              <ChevronLeft className="w-5 h-5 text-gray-700" />
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => {
                setErro(null)
                setEtapa((prev) => (prev === 3 ? 2 : 1) as 1 | 2 | 3)
              }}
              className="absolute left-0 top-0.5 inline-flex items-center justify-center w-10 h-10 rounded-full bg-white border border-gray-200/80 shadow-[0_2px_8px_rgba(0,0,0,0.04)] text-gray-600 hover:text-gray-900 hover:bg-gray-50 active:scale-95 transition-all cursor-pointer"
              aria-label="Voltar para a etapa anterior"
              title="Voltar para a etapa anterior"
            >
              <ChevronLeft className="w-5 h-5 text-gray-700" />
            </button>
          )}

          <div className="text-center px-10">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
              Criar Conta
            </h1>
            <p className="text-xs sm:text-[13px] text-gray-500 font-medium mt-1 leading-relaxed max-w-[280px] mx-auto">
              Junte-se à prontidão cirúrgica. Suas checagens garantem equipamentos seguros e protegem vidas a cada procedimento.
            </p>
          </div>
        </div>

        {/* Indicador de Etapas / Progress Bar 3D */}
        <div className="space-y-1.5 px-1">
          <div className="flex items-center justify-between text-[11px] font-bold text-gray-500">
            <span className={etapa === 1 ? 'text-[#17A592]' : 'text-gray-400'}>
              1. Identificação
            </span>
            <span className={etapa === 2 ? 'text-[#17A592]' : 'text-gray-400'}>
              2. Hospital & Perfil
            </span>
            <span className={etapa === 3 ? 'text-[#17A592]' : 'text-gray-400'}>
              3. Personalização
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[1, 2, 3].map((num) => {
              const ativo = etapa >= num
              return (
                <div
                  key={num}
                  className={`h-2 rounded-full transition-all duration-400 ease-out relative overflow-hidden ${
                    ativo
                      ? 'bg-gradient-to-b from-[#2CD8BE] via-[#17A592] to-[#0E7769] shadow-[inset_0_1px_0_rgba(255,255,255,0.6),inset_0_-1px_1px_rgba(0,0,0,0.22),0_2px_4px_rgba(23,165,146,0.28)] border border-[#148e7e]/40'
                      : 'bg-[#E8ECF2] shadow-[inset_0_1.5px_2px_rgba(0,0,0,0.08),inset_0_-1px_0_rgba(255,255,255,0.9)] border border-slate-300/40'
                  }`}
                >
                  {ativo && (
                    <div className="absolute inset-x-1 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/75 to-transparent rounded-full pointer-events-none" />
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Inputs ocultos para Câmera (fallback) e Galeria */}
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="user"
          onChange={handleFotoSelecionada}
          className="hidden"
        />
        <input
          ref={galeriaInputRef}
          type="file"
          accept="image/*"
          onChange={handleFotoSelecionada}
          className="hidden"
        />

        {/* Card Principal */}
        <div className="bg-white rounded-[28px] p-6 shadow-[0_2px_14px_rgba(0,0,0,0.03)] border border-gray-100/80">
          
          {erro && (
            <p className="text-xs font-bold text-red-500 bg-red-50/50 border border-red-200/50 rounded-xl px-4 py-2.5 mb-4 text-center">
              {erro}
            </p>
          )}

          {sucesso && (
            <p className="text-xs font-bold text-emerald-600 bg-emerald-50/50 border border-emerald-200/50 rounded-xl px-4 py-2.5 mb-4 text-center">
              {sucesso}
            </p>
          )}

          {/* ═══════════════════════════════════════════════════════════════
              ETAPA 1: Identificação (Nome, E-mail, Senhas)
          ═══════════════════════════════════════════════════════════════ */}
          {etapa === 1 && (
            <form onSubmit={handleAvancarEtapa1} className="space-y-4 animate-[fadeIn_0.2s_ease-out]">
              
              {/* Nome Completo */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-gray-400 tracking-wider uppercase ml-1">
                  Nome Completo
                </label>
                <input
                  type="text"
                  required
                  placeholder="Seu nome completo"
                  value={nomeCompleto}
                  onChange={(e) => setNomeCompleto(e.target.value)}
                  className="w-full bg-[#F4F6FA] border border-gray-200/80 rounded-2xl px-4 py-3 text-[15px] text-gray-900 placeholder:text-gray-400 outline-none focus:border-[#17A592] focus:ring-1 focus:ring-[#17A592]/10 transition-all"
                />
              </div>

              {/* E-mail */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-gray-400 tracking-wider uppercase ml-1">
                  E-mail
                </label>
                <input
                  type="email"
                  required
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-[#F4F6FA] border border-gray-200/80 rounded-2xl px-4 py-3 text-[15px] text-gray-900 placeholder:text-gray-400 outline-none focus:border-[#17A592] focus:ring-1 focus:ring-[#17A592]/10 transition-all"
                />
              </div>

              {/* Senha */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-gray-400 tracking-wider uppercase ml-1">
                  Senha (mín. 6 caracteres)
                </label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  className="w-full bg-[#F4F6FA] border border-gray-200/80 rounded-2xl px-4 py-3 text-[15px] text-gray-900 placeholder:text-gray-400 outline-none focus:border-[#17A592] focus:ring-1 focus:ring-[#17A592]/10 transition-all"
                />
              </div>

              {/* Confirmar Senha */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-gray-400 tracking-wider uppercase ml-1">
                  Confirmar Senha
                </label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={confirmarSenha}
                  onChange={(e) => setConfirmarSenha(e.target.value)}
                  className="w-full bg-[#F4F6FA] border border-gray-200/80 rounded-2xl px-4 py-3 text-[15px] text-gray-900 placeholder:text-gray-400 outline-none focus:border-[#17A592] focus:ring-1 focus:ring-[#17A592]/10 transition-all"
                />
              </div>

              {/* Botão Avançar para Etapa 2 */}
              <div className="pt-2">
                <LiquidMetalButton
                  type="submit"
                  tamanho="lg"
                  larguraTotal
                  label="Avançar"
                />
              </div>

              {/* Link para Login */}
              <div className="text-center pt-1">
                <Link
                  href="/login"
                  className="text-xs font-bold text-gray-500 hover:text-gray-800 hover:underline"
                >
                  Já tem conta? Faça Login
                </Link>
              </div>

            </form>
          )}

          {/* ═══════════════════════════════════════════════════════════════
              ETAPA 2: Hospital & Tipo de Perfil
          ═══════════════════════════════════════════════════════════════ */}
          {etapa === 2 && (
            <form onSubmit={handleAvancarEtapa2} className="space-y-4 animate-[fadeIn_0.2s_ease-out]">
              
              {/* Hospital */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-gray-400 tracking-wider uppercase ml-1">
                  Hospital
                </label>
                <select
                  value={hospitalId}
                  onChange={(e) => setHospitalId(e.target.value)}
                  className="w-full bg-[#F4F6FA] border border-gray-200/80 rounded-2xl px-4 py-3 text-[15px] text-gray-900 outline-none focus:border-[#17A592] transition-all cursor-pointer"
                >
                  {hospitais.map(h => (
                    <option key={h.id} value={h.id}>
                      {h.nome}
                    </option>
                  ))}
                </select>
              </div>

              {/* Número do Conselho (Opcional) */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-gray-400 tracking-wider uppercase ml-1">
                  Número do Conselho (Opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ex: COREN-BA 123456 / CRM / CREA"
                  value={numeroConselho}
                  onChange={(e) => setNumeroConselho(e.target.value)}
                  className="w-full bg-[#F4F6FA] border border-gray-200/80 rounded-2xl px-4 py-3 text-[15px] text-gray-900 placeholder:text-gray-400 outline-none focus:border-[#17A592] focus:ring-1 focus:ring-[#17A592]/10 transition-all"
                />
              </div>

              {/* Tipo de Perfil — Seletor por Avatares */}
              <div className="space-y-2 pt-1">
                <label className="text-[11px] font-bold text-gray-400 tracking-wider uppercase ml-1 block">
                  Tipo de perfil
                </label>
                <div className="flex justify-around items-center bg-[#F4F6FA] border border-gray-200/80 rounded-2xl p-3">
                  {ROLES.map((r) => {
                    const ativo = perfilSelecionado === r.valor
                    return (
                      <button
                        key={r.valor}
                        type="button"
                        onClick={() => setPerfilSelecionado(r.valor)}
                        className="flex flex-col items-center gap-1.5 focus:outline-none group select-none cursor-pointer flex-1"
                      >
                        <div
                          className={`rounded-full p-0.5 aspect-square flex items-center justify-center transition-all duration-200 ${
                            ativo
                              ? 'ring-2 ring-[#17A592]/40 ring-offset-2 scale-105 shadow-[0_2px_8px_rgba(23,165,146,0.2)]'
                              : 'opacity-60 hover:opacity-100 hover:scale-105 active:scale-95'
                          }`}
                        >
                          <Avatar size="md">
                            <Avatar.Image
                              alt={r.label}
                              src={r.avatarUrl}
                            />
                            <Avatar.Fallback>{r.fallback}</Avatar.Fallback>
                          </Avatar>
                        </div>
                        <div className="text-center leading-tight">
                          <span
                            className={`text-[11px] font-bold tracking-tight block transition-colors ${
                              ativo ? 'text-[#17A592]' : 'text-gray-700 group-hover:text-gray-900'
                            }`}
                          >
                            {r.label}
                          </span>
                          <span className="text-[9.5px] font-medium text-gray-400 block mt-0.5">
                            {r.desc}
                          </span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Seletor de Setor Técnico (somente quando perfil for 'tecnico') */}
              <div
                className="overflow-hidden transition-all duration-400 ease-[cubic-bezier(0.16,1,0.3,1)]"
                style={{
                  maxHeight: perfilSelecionado === 'tecnico' ? '120px' : '0px',
                  opacity: perfilSelecionado === 'tecnico' ? 1 : 0,
                  marginTop: perfilSelecionado === 'tecnico' ? '0px' : '-8px',
                }}
              >
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-gray-400 tracking-wider uppercase ml-1">
                    Setor Técnico
                  </label>
                  <select
                    value={setorSelecionado}
                    onChange={(e) => setSetorSelecionado(e.target.value)}
                    required={perfilSelecionado === 'tecnico'}
                    className="w-full bg-[#F4F6FA] border border-gray-200/80 rounded-2xl px-4 py-3 text-[15px] text-gray-900 outline-none focus:border-[#17A592] transition-all cursor-pointer"
                  >
                    <option value="" disabled>Selecione o setor...</option>
                    {TODOS_SETORES.map(s => (
                      <option key={s} value={s}>
                        {SETORES_LABELS[s]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Botão Avançar para Etapa 3 */}
              <div className="pt-2">
                <LiquidMetalButton
                  type="submit"
                  tamanho="lg"
                  larguraTotal
                  label="Avançar"
                />
              </div>

              {/* Botão Voltar para a Etapa 1 */}
              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setErro(null)
                    setEtapa(1)
                  }}
                  className="text-xs font-bold text-gray-400 hover:text-gray-700 transition-colors cursor-pointer"
                >
                  ← Voltar para identificação
                </button>
              </div>

            </form>
          )}

          {/* ═══════════════════════════════════════════════════════════════
              ETAPA 3: Personalização (Foto & Prévia Ampliada)
          ═══════════════════════════════════════════════════════════════ */}
          {etapa === 3 && (
            <form onSubmit={handleCadastrar} className="space-y-4 animate-[fadeIn_0.2s_ease-out]">
              
              {/* SEÇÃO: Foto de Perfil (Opcional) */}
              <div className="bg-[#F4F6FA] border border-gray-200/70 rounded-2xl p-4 flex flex-col items-center gap-3">
                <div className="relative group">
                  {fotoPreview ? (
                    // Caso tenha enviado foto personalizada
                    <div className="relative">
                      <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-[#17A592] shadow-md">
                        <img
                          src={fotoPreview}
                          alt="Sua foto de perfil"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={removerFoto}
                        className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center shadow-md hover:bg-red-600 active:scale-95 transition-all cursor-pointer"
                        title="Remover foto e usar avatar do cargo"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    // Caso NÃO tenha foto -> mostra o avatar oficial do cargo escolhido
                    <div 
                      onClick={abrirCamera}
                      className="relative cursor-pointer group"
                      title="Toque para abrir a câmera ou use os botões abaixo"
                    >
                      <div className="w-20 h-20 rounded-full p-0.5 border-2 border-dashed border-gray-300 group-hover:border-[#17A592] transition-colors flex items-center justify-center overflow-hidden bg-white shadow-xs">
                        <img
                          src={roleAtual.avatarUrl}
                          alt={roleAtual.label}
                          className="w-full h-full object-cover rounded-full transition-transform group-hover:scale-105"
                        />
                      </div>
                      <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-[#17A592] text-white flex items-center justify-center shadow-md group-hover:scale-110 transition-transform">
                        <Camera className="w-3.5 h-3.5" />
                      </div>
                    </div>
                  )}
                </div>

                {/* Textos explicativos da foto */}
                <div className="text-center w-full">
                  <div className="flex items-center justify-center gap-1.5 text-[11.5px] font-bold text-gray-800">
                    <span>{fotoPreview ? 'Ficou muito bom!' : 'Foto de Perfil (Opcional)'}</span>
                    {fotoPreview ? (
                      <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
                    ) : (
                      <span className="text-[10px] font-semibold text-gray-400">
                        • {roleAtual.label}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-gray-500 mt-1 leading-relaxed max-w-[260px] mx-auto">
                    {fotoPreview 
                      ? 'Essa foto será exibida como seu avatar para os outros usuários na plataforma.' 
                      : `A foto ajuda sua equipe a identificar você. Se preferir não enviar agora, seu avatar será o ícone de ${roleAtual.label}.`}
                  </p>

                  {/* Botões Câmera e Galeria */}
                  <div className="flex items-center justify-center gap-2 mt-3">
                    <button
                      type="button"
                      onClick={abrirCamera}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white border border-gray-200 text-[11px] font-bold text-gray-700 hover:text-[#17A592] hover:border-[#17A592]/40 shadow-xs active:scale-95 transition-all cursor-pointer"
                    >
                      <Camera className="w-3.5 h-3.5 text-[#17A592]" />
                      <span>Câmera</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => galeriaInputRef.current?.click()}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white border border-gray-200 text-[11px] font-bold text-gray-700 hover:text-[#17A592] hover:border-[#17A592]/40 shadow-xs active:scale-95 transition-all cursor-pointer"
                    >
                      <ImageIcon className="w-3.5 h-3.5 text-[#17A592]" />
                      <span>Galeria</span>
                    </button>

                    {fotoPreview && (
                      <button
                        type="button"
                        onClick={removerFoto}
                        className="px-2.5 py-1.5 rounded-full text-[11px] font-semibold text-gray-400 hover:text-red-500 transition-colors cursor-pointer"
                      >
                        Remover
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* ── PRÉVIA DA PILL DO USUÁRIO (AMPLIADA & INTUITIVA) ── */}
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between px-1">
                  <label className="text-[11px] font-bold text-gray-400 tracking-wider uppercase">
                    Seu Crachá Digital no Sistema
                  </label>
                  <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/70 px-2 py-0.5 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Prévia ao vivo
                  </span>
                </div>

                <div className="bg-[#F4F6FA] border border-gray-200/80 rounded-3xl p-5 flex flex-col items-center gap-4 shadow-[inset_0_1px_3px_rgba(0,0,0,0.02)]">
                  {/* Cartão de Identificação em Destaque (Estilo Crachá / Header Mockup) */}
                  <div className="w-full bg-white rounded-2xl p-4 border border-slate-200/90 shadow-[0_4px_16px_rgba(0,0,0,0.05)] flex items-center gap-4 transition-all">
                    <AvatarPerfil
                      perfil={perfilSelecionado}
                      avatarUrl={fotoPreview}
                      nome={nomeCompleto || 'Seu Nome'}
                      tamanho="xl"
                      className="ring-3 ring-[#17A592]/20 shadow-md"
                    />
                    <div className="flex flex-col items-start leading-snug min-w-0 flex-1">
                      <div className="flex items-center gap-2 w-full">
                        <span className="text-[15px] font-extrabold text-slate-900 tracking-tight truncate">
                          {nomeCompleto || 'Seu Nome Completo'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span
                          className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                            perfilSelecionado === 'coordenador'
                              ? 'text-purple-700 bg-purple-100 border border-purple-200/70'
                              : perfilSelecionado === 'tecnico'
                              ? 'text-amber-800 bg-amber-100 border border-amber-200/70'
                              : 'text-[#17A592] bg-[#17A592]/10 border border-[#17A592]/30'
                          }`}
                        >
                          {roleAtual.label}
                        </span>
                        {numeroConselho && (
                          <span className="text-[11px] font-bold text-gray-500 truncate">
                            • {numeroConselho}
                          </span>
                        )}
                      </div>
                      <span className="text-xs font-semibold text-slate-500 truncate mt-1">
                        {hospitalNome}
                      </span>
                    </div>
                  </div>

                  {/* Simulação no Cabeçalho Superior da Tela */}
                  <div className="w-full bg-slate-50/80 rounded-2xl p-3 border border-slate-200/60 flex flex-col items-center gap-2">
                    <div className="flex items-center justify-between w-full px-1">
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                        Como aparecerá no menu superior:
                      </span>
                      <span className="text-[10px] font-extrabold text-slate-600 font-brand">
                        Primus
                      </span>
                    </div>
                    
                    {/* A Pill em tamanho real no cabeçalho */}
                    <div className="inline-flex items-center gap-2 pl-1.5 pr-3.5 py-1 rounded-full bg-white border border-slate-200/90 shadow-xs">
                      <AvatarPerfil
                        perfil={perfilSelecionado}
                        avatarUrl={fotoPreview}
                        nome={nomeCompleto || 'Seu Nome'}
                        tamanho="sm"
                      />
                      <div className="flex flex-col items-start leading-tight text-left pr-0.5 min-w-0 max-w-[180px]">
                        <span className="w-full block text-[11.5px] font-extrabold text-slate-900 tracking-tight truncate">
                          {nomeCompleto || 'Seu Nome'}
                        </span>
                        <span className="w-full block text-[9.5px] font-semibold text-slate-500 truncate">
                          {roleAtual.label} • {hospitalNome}
                        </span>
                      </div>
                    </div>
                  </div>

                  <p className="text-[11px] text-gray-500 font-medium text-center leading-relaxed max-w-[300px]">
                    Este crachá acompanhará você em todas as telas, registrando suas checagens e assinando relatórios em tempo real.
                  </p>
                </div>
              </div>

              {/* Botão Cadastrar (Liquid Metal) */}
              <div className="pt-2">
                <LiquidMetalButton
                  type="submit"
                  tamanho="lg"
                  larguraTotal
                  carregando={carregando}
                  label="Concluir Cadastro"
                />
              </div>

              {/* Botão Voltar para a Etapa 2 */}
              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setErro(null)
                    setEtapa(2)
                  }}
                  className="text-xs font-bold text-gray-400 hover:text-gray-700 transition-colors cursor-pointer"
                >
                  ← Voltar para hospital e perfil
                </button>
              </div>

            </form>
          )}

        </div>

      </div>

      {/* ── INTERFACE DE CÂMERA TOTALMENTE FULLSCREEN (EDGE-TO-EDGE) ESTILO IPHONE ── */}
      {modalCameraAberto && (
        <div className="fixed inset-0 z-[100] w-screen h-[100dvh] bg-black select-none overflow-hidden touch-none animate-[fadeIn_0.15s_ease-out]">
          
          {/* Efeito de Flash na tela ao disparar */}
          {disparandoFlash && (
            <div className="absolute inset-0 z-[110] bg-white pointer-events-none" />
          )}

          {/* O Vídeo da Câmera ocupa 100% da tela física (Edge-to-Edge sem tarjas) */}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={`absolute inset-0 w-full h-full object-cover z-10 ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`}
          />

          {/* Top Bar Flutuante sobre o Vídeo */}
          <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-5 pt-8 pb-4 bg-gradient-to-b from-black/60 via-black/20 to-transparent pointer-events-auto">
            <button
              type="button"
              onClick={fecharCamera}
              className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-md border border-white/20 text-white flex items-center justify-center active:scale-90 transition-all cursor-pointer shadow-md"
              title="Fechar câmera"
            >
              <X className="w-5 h-5" />
            </button>
            <span className="text-[11px] font-bold tracking-widest uppercase text-white/90 drop-shadow-md">
              Foto de Perfil
            </span>
            <div className="w-10 h-10" />
          </div>

          {/* Barra de Controles Inferior Flutuante sobre o Vídeo */}
          <div className="absolute bottom-0 left-0 right-0 z-20 pb-10 pt-10 px-8 flex items-center justify-around bg-gradient-to-t from-black/70 via-black/30 to-transparent pointer-events-auto">
            
            {/* Esquerda: Botão Flash */}
            <button
              type="button"
              onClick={alternarFlash}
              className="w-13 h-13 rounded-full bg-black/40 backdrop-blur-md border border-white/20 active:bg-black/60 flex items-center justify-center active:scale-95 transition-all cursor-pointer shadow-md"
              title={flashAtivo ? 'Desativar Flash' : 'Ativar Flash'}
            >
              {flashAtivo ? (
                <Zap className="w-5 h-5 text-amber-300 fill-amber-300" />
              ) : (
                <ZapOff className="w-5 h-5 text-white/90" />
              )}
            </button>

            {/* Centro: Botão de Disparo do iPhone */}
            <button
              type="button"
              onClick={capturarFotoCamera}
              className="w-20 h-20 rounded-full border-[4px] border-white p-1 flex items-center justify-center active:scale-95 transition-transform cursor-pointer shadow-2xl backdrop-blur-xs"
              title="Tirar Foto"
            >
              <div className="w-full h-full rounded-full bg-white active:scale-90 transition-transform" />
            </button>

            {/* Direita: Botão Virar Câmera */}
            <button
              type="button"
              onClick={alternarCamera}
              className="w-13 h-13 rounded-full bg-black/40 backdrop-blur-md border border-white/20 active:bg-black/60 flex items-center justify-center active:scale-95 transition-all cursor-pointer shadow-md"
              title="Virar Câmera"
            >
              <SwitchCamera className="w-5 h-5 text-white/90" />
            </button>

          </div>

        </div>
      )}

    </div>
  )
}

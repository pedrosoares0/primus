# 📖 PRIMUS — Documento de Referência Completo ("A Bíblia")

> **Última atualização**: 14 de Setembro de 2026  
> **Versão do projeto**: 0.3.0  
> **Stack**: Next.js 16 · React 19 · Supabase · Tailwind CSS 4 · TypeScript 5 · Google Gemini IA · WebGL Fluid Shader

---

## 1. O que é o Primus

Primus é uma **plataforma web mobile-first de Prontidão Operacional do Centro Cirúrgico** para hospitais. Seu propósito central é:

- Garantir que **salas cirúrgicas, equipamentos e materiais** estejam prontos e seguros antes de procedimentos.
- Permitir que **inspetores** (enfermeiros/técnicos) realizem **rondas de verificação** (checklists) nos equipamentos de cada sala.
- Registrar **Não Conformidades (NCs)** quando um item não está conforme, com foto, criticidade e setor responsável.
- Encaminhar NCs automaticamente para setores técnicos (Engenharia Clínica, Manutenção, Farmácia, Almoxarifado).
- Fornecer visão gerencial para **Coordenadores** validarem correções, gerirem equipe e ativos.
- Disponibilizar a **Primus IA**: assistente inteligente em tempo real alimentada com dados do banco para análise de prontidão, produtividade e resolução de NCs.
- Notificar a equipe por **e-mail** quando NCs críticas são abertas.

### Contexto Hospitalar

- Hospital piloto: **Hospital Piemonte Paraguaçu** (Bahia).
- Foco: Centro Cirúrgico Principal (salas 01, 03 e 04 visíveis para inspetor).
- Equipamentos: Carrinho de Parada, Carrinho de Anestesia, Monitor Multiparamétrico, Mesa Cirúrgica, Bisturi Elétrico, Aspirador Cirúrgico, Foco Cirúrgico, Bombas de Infusão, Gases Medicinais.

---

## 2. Perfis de Usuário e Permissões

O sistema possui **6 perfis** definidos no enum `PerfilUsuario`:

| Perfil | Descrição | Rota principal | Funcionalidades |
|---|---|---|---|
| `inspetor` | Enfermeiros e Técnicos em campo | `/inspetor` | Ronda de verificação, scanner QR, execução de checklist, registro de NCs, histórico de inspeções |
| `tecnico` | Profissional de setor técnico especializado | `/engenharia` | Mesma fila de NCs da Engenharia, filtrada por setor do técnico |
| `engenharia_clinica` | Engenheiros clínicos | `/engenharia` | Fila de NCs, assumir responsabilidade, registrar manutenção, finalizar reparo |
| `coordenador` | Coordenação do setor | `/coordenador` | Dashboard, validação de NCs, gestão de equipe, gestão de ativos, QR codes, **Primus IA (Assistente Operacional)** |
| `gestor` | Gestor hospitalar | `/gestor` *(não implementado)* | Visão macro *(futuro)* |
| `administrador` | Admin do sistema | `/admin` *(não implementado)* | Configuração global *(futuro)* |

### Setores Técnicos (`SetorTecnico`)

| Setor | Label | Cor do badge |
|---|---|---|
| `engenharia_clinica` | Engenharia Clínica | Vermelho |
| `manutencao` | Manutenção | Âmbar |
| `farmacia` | Farmácia | Esmeralda |
| `almoxarifado` | Almoxarifado | Azul claro |

### Roteamento Automático de NCs

Definido em `lib/roteamentoNC.ts`:

| Tipo da NC | Setor Responsável |
|---|---|
| `equipamento` | Engenharia Clínica |
| `infraestrutura` | Manutenção |
| `medicamento` | Farmácia |
| `material_insumo` | Almoxarifado |
| `outro` | `null` (atribuição manual) |

---

## 3. Arquitetura Técnica

### 3.1 Stack

| Camada | Tecnologia | Versão |
|---|---|---|
| Framework | Next.js (App Router) | 16.3.0 |
| UI | React | 19.2.8 |
| Linguagem | TypeScript | ^5 |
| Estilização | Tailwind CSS | ^4 |
| Backend/Auth/DB | Supabase (SSR + JS Client) | ^2.112 / ^0.12 |
| IA Generativa | Google Gemini Flash | gemini-3.5-flash / latest |
| Shaders / Gráficos | WebGPU (WGSL) / WebGL | Nativo + Custom Shaders |
| Animações | Motion (Framer Motion) | ^13 |
| QR Code | qrcode.react | ^4.2 |
| E-mail | Nodemailer / Resend | ^9 |
| Icons | Lucide React | ^1.31 |
| Scroll | Lenis | ^1.3 |

### 3.2 Estrutura de Diretórios

```
primus/
├── app/
│   ├── layout.tsx              # Layout raiz (fontes, meta, LenisProvider)
│   ├── page.tsx                # Redirect → /login
│   ├── template.tsx            # Template wrapper
│   ├── globals.css             # Design system (cores, sombras, tipografia)
│   ├── login/page.tsx          # Tela de login (Supabase Auth)
│   ├── cadastro/page.tsx       # Tela de cadastro (Inspetor ou Técnico)
│   ├── inspetor/               # ══ MÓDULO INSPETOR ══
│   │   ├── layout.tsx          # Layout com nav inferior (Início, Inspeções, Escanear)
│   │   ├── template.tsx        # Template wrapper
│   │   ├── page.tsx            # Dashboard: lista de salas, scan rápido
│   │   ├── scanner/page.tsx    # Scanner QR via câmera do dispositivo
│   │   ├── inspecoes/page.tsx  # Histórico de inspeções realizadas
│   │   ├── local/[id]/page.tsx # Detalhe da sala: ativos vinculados + NCs abertas
│   │   ├── ativo/[id]/page.tsx # Detalhe do ativo: QR code, status, ações
│   │   ├── checklist/[id]/page.tsx # Execução do checklist (principal!)
│   │   └── nc/nova/page.tsx    # Registro de NC avulsa (fora do checklist)
│   ├── engenharia/             # ══ MÓDULO ENGENHARIA CLÍNICA ══
│   │   ├── layout.tsx          # Layout com header e CommandMenu
│   │   └── page.tsx            # Fila de NCs com filtros e ordenação
│   ├── coordenador/            # ══ MÓDULO COORDENAÇÃO ══
│   │   ├── layout.tsx          # Layout com header, CommandMenu, nav inferior
│   │   ├── page.tsx            # Central de Comando (abas: Painel, NCs, Equipe, Ativos)
│   │   └── ativos/page.tsx     # Gestão de ativos com QR Codes
│   ├── nao-conformidades/      # ══ MÓDULO NC (COMPARTILHADO) ══
│   │   └── [id]/page.tsx       # Detalhe da NC: timeline, ações por perfil, manutenção
│   └── api/
│       ├── chat-ia/route.ts    # API Route: streaming SSE com Google Gemini Flash e dados reais
│       ├── seed-plantao/       # (vazio — reservado)
│       └── send-email/route.ts # API Route: envio de e-mail SMTP via Nodemailer
├── components/
│   ├── ui/                     # Componentes reutilizáveis
│   │   ├── Avatar.tsx          # Compound component Avatar
│   │   ├── BarraBusca.tsx      # Input de busca com ícone
│   │   ├── Botao.tsx           # Botão com variantes (primário, secundário, perigo)
│   │   ├── Card.tsx            # Card genérico
│   │   ├── IconeMascote.tsx    # Ícone mascote "blop" do Primus
│   │   ├── ItemLista.tsx       # Item de lista com seta
│   │   ├── LenisProvider.tsx   # Provider de smooth scroll
│   │   ├── OrbIA.tsx           # Liquid Glass Orb WebGPU com WGSL, refração óptica e transição idle/thinking
│   │   ├── ai-chat-input.tsx   # Input de chat em formato de cápsula redonda e botão circular
│   │   ├── response-stream.tsx # Streaming typewriter para respostas da IA
│   │   ├── PillTag.tsx         # Badge/pill colorido (verde, laranja, vermelho, azul, cinza)
│   │   ├── PillUsuario.tsx     # Pill com avatar + nome do usuário
│   │   ├── QRCodeAtivo.tsx     # Gerador de QR Code com download
│   │   ├── command-menu.tsx    # Menu de comando estilo Apple (perfil + navegação)
│   │   └── liquid-metal-button.tsx # Botão com efeito liquid-metal shader
│   └── coordenador/            # Componentes do módulo Coordenador
│       ├── ChatIA.tsx           # Drawer lateral com Glassmorphism para interação com Primus IA
│       ├── PainelDashboard.tsx  # Dashboard com métricas, gráficos, timeline
│       ├── FilaValidacaoNCs.tsx # Fila de validação de NCs pela coordenação
│       ├── GestaoEquipe.tsx     # Gestão de inspetores e técnicos
│       └── GestaoAtivos.tsx     # Gestão de ativos com status e QR
├── lib/
│   ├── ia/
│   │   └── coletarDadosHospital.ts # Agregador de snapshot do hospital em tempo real para IA
│   ├── tratarErrosAuth.ts      # Tradutor e blindagem humanizada de erros de autenticação
│   ├── roteamentoNC.ts         # Mapa tipo NC → setor, labels, cores
│   ├── cache/
│   │   └── dadosCache.ts       # Cache SWR em memória (Map) com TTL de 3min
│   └── supabase/
│       ├── client.ts           # Supabase browser client (singleton)
│       ├── server.ts           # Supabase server client (cookies)
│       ├── types.ts            # Tipos TypeScript do schema (manual)
│       ├── mockDb.ts           # Mock database local (localStorage) — legado
│       ├── seed.sql            # Seed do Hospital Piemonte Paraguaçu + ativos iniciais
│       ├── seed_carrinho_anestesia.sql  # Seed do Carrinho de Anestesia
│       ├── migration_salas_ativos.sql   # Migration: sala_ativos M:N, categorias, itens
│       ├── migration_perfil_tecnico.sql # Migration: perfil de técnico
│       └── limpar_inspecoes.sql         # Script utilitário para limpar dados
├── public/                     # Assets estáticos (ícones de equipamentos, favicon)
├── docs/                       # Documentação
└── .env.local                  # Variáveis de ambiente (Supabase + SMTP)
```

### 3.3 Variáveis de Ambiente (`.env.local`)

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SMTP_HOST=...
SMTP_PORT=587
SMTP_USER=...
SMTP_PASS=...
SMTP_FROM=Primus <alertas@primusclinica.com.br>
```

---

## 4. Modelo de Dados (Supabase / PostgreSQL)

### 4.1 Hierarquia Organizacional

```
Hospital
  └── Unidade
       └── Centro Cirúrgico
            └── Local (Sala) ──M:N via sala_ativos──> Ativo
                                                        └── pertence a Categoria
```

### 4.2 Relacionamentos (ER)

```
hospitais 1──N unidades
unidades 1──N centros_cirurgicos
centros_cirurgicos 1──N locais
locais 1──N sala_ativos N──1 ativos
hospitais 1──N categorias_ativos
categorias_ativos 1──N ativos
categorias_ativos 1──N modelos_checklist
modelos_checklist 1──N itens_modelo_checklist
modelos_checklist 1──N execucoes_checklist
ativos 1──N execucoes_checklist
execucoes_checklist 1──N itens_execucao_checklist
itens_execucao_checklist 1──N nao_conformidades
hospitais 1──N usuarios
usuarios 1──N execucoes_checklist
```

### 4.3 Detalhamento das Tabelas

#### `hospitais`
| Coluna | Tipo | Descrição |
|---|---|---|
| id | UUID PK | |
| nome | TEXT | |
| cnpj | TEXT? | |
| ativo | BOOL | |
| criado_em | TIMESTAMPTZ | |

#### `unidades`
| Coluna | Tipo | Descrição |
|---|---|---|
| id | UUID PK | |
| hospital_id | UUID FK | Referência ao hospital |
| nome | TEXT | |

#### `centros_cirurgicos`
| Coluna | Tipo | Descrição |
|---|---|---|
| id | UUID PK | |
| unidade_id | UUID FK | |
| nome | TEXT | |

#### `locais` (Salas)
| Coluna | Tipo | Descrição |
|---|---|---|
| id | UUID PK | |
| centro_cirurgico_id | UUID FK | |
| nome | TEXT | Ex: "Sala 01" |
| tipo | ENUM `tipo_local` | `sala` ou `area_comum` |
| status | ENUM `status_local` | `pronta`, `pronta_com_ressalvas`, `nao_pronta`, `liberada_manualmente` |
| codigo_qr | TEXT | Código para scanner |
| liberada_manualmente | BOOL | |

#### `categorias_ativos`
| Coluna | Tipo | Descrição |
|---|---|---|
| id | UUID PK | |
| nome | TEXT | Ex: "Monitor multiparamétrico" |

Categorias existentes: Carrinho de parada, Carrinho de anestesia, Monitor multiparamétrico, Mesa cirúrgica, Bisturi elétrico, Aspirador cirúrgico, Foco cirúrgico, Bombas de infusão, Gases medicinais.

#### `ativos` (Equipamentos)
| Coluna | Tipo | Descrição |
|---|---|---|
| id | UUID PK | |
| hospital_id | UUID FK | |
| local_id | UUID FK | Local principal |
| categoria_id | UUID FK | |
| nome | TEXT | Ex: "Monitor Multiparamétrico #1 - Sala 01" |
| patrimonio | TEXT? | Código patrimonial |
| codigo_qr | TEXT | Código para leitura |
| status | ENUM `status_ativo` | `operacional`, `operacional_com_restricoes`, `indisponivel`, `em_manutencao` |

#### `sala_ativos` (Relação M:N Sala ↔ Ativo)
| Coluna | Tipo | Descrição |
|---|---|---|
| id | UUID PK | |
| local_id | UUID FK | Sala |
| ativo_id | UUID FK | Equipamento |
| compartilhado | BOOL | Se o ativo é compartilhado entre salas |

#### `usuarios`
| Coluna | Tipo | Descrição |
|---|---|---|
| id | UUID PK | Mesmo ID do auth.users |
| hospital_id | UUID FK | |
| auth_user_id | UUID? | Referência alternativa ao auth.users.id |
| nome | TEXT | |
| email | TEXT | |
| perfil | ENUM `perfil_usuario` | Ver tabela de perfis acima |
| setor | ENUM `setor_tecnico`? | Apenas para perfil `tecnico` |
| numero_conselho | TEXT? | COREN/CRM/CREA |
| ativo | BOOL | |

#### `modelos_checklist`
| Coluna | Tipo | Descrição |
|---|---|---|
| id | UUID PK | |
| categoria_id | UUID FK | Categoria de ativo que este modelo cobre |
| nome_variante | TEXT? | Ex: "Completo", "Por plantão", "Padrão" |
| versao | INT | Versionamento dentro da categoria |
| vigente | BOOL | Se está ativo e em uso |
| frequencia | ENUM `frequencia_checklist` | `diaria`, `semanal`, `mensal`, `sob_demanda` |
| horarios_do_dia | JSONB? | Ex: `["07:00", "19:00"]` |

**Constraint**: `UNIQUE(categoria_id, versao)`

#### `itens_modelo_checklist`
| Coluna | Tipo | Descrição |
|---|---|---|
| id | UUID PK | |
| modelo_id | UUID FK | |
| ordem | INT | Ordem de apresentação |
| descricao | TEXT | Formato: `"Nome da seção — itens_esperados: item1; item2"` |
| criticidade | ENUM `criticidade_item` | `critico`, `importante`, `informativo` |
| obrigatorio | BOOL | |
| evidencia_obrigatoria | BOOL | |
| tipo_evidencia | TEXT? | |

#### `execucoes_checklist`
| Coluna | Tipo | Descrição |
|---|---|---|
| id | UUID PK | |
| hospital_id | UUID FK | |
| modelo_id | UUID FK | |
| ativo_id | UUID FK? | |
| usuario_id | UUID FK | Quem realizou |
| status | ENUM `status_execucao` | `em_andamento`, `concluida`, `cancelada` |
| iniciado_em | TIMESTAMPTZ | |
| finalizado_em | TIMESTAMPTZ? | |

#### `itens_execucao_checklist`
| Coluna | Tipo | Descrição |
|---|---|---|
| id | UUID PK | |
| execucao_id | UUID FK | |
| item_congelado | JSONB | Snapshot: `{ ordem, descricao }` |
| criticidade | ENUM | |
| resposta | ENUM `resposta_item` | `conforme`, `nao_conforme`, `nao_se_aplica` |
| evidencia_url | TEXT? | URL do Supabase Storage ou base64 |
| evidencia_texto | TEXT? | Descrição da NC |

#### `nao_conformidades`
| Coluna | Tipo | Descrição |
|---|---|---|
| id | UUID PK | |
| hospital_id | UUID FK | |
| numero_unico | TEXT | Ex: "NC-2026-XXXX" |
| item_execucao_id | UUID FK | Item que gerou a NC |
| ativo_id | UUID FK? | |
| criticidade | ENUM `criticidade_item` | |
| status | ENUM `status_nao_conformidade` | Ver ciclo de vida abaixo |
| tipo | ENUM `tipo_nao_conformidade` | `equipamento`, `infraestrutura`, `medicamento`, `material_insumo`, `outro` |
| setor_responsavel | ENUM `setor_tecnico`? | |
| responsavel_id | UUID FK? | Técnico/engenheiro que assumiu |
| prazo | TIMESTAMPTZ? | |
| evidencia_url | TEXT? | |
| criado_em | TIMESTAMPTZ | |

---

## 5. Ciclo de Vida da Não Conformidade (NC)

### Diagrama de Estados

```
[Inspetor registra NC]
        │
        ▼
    ┌────────┐
    │ ABERTA │──────────────────────────────┐
    └───┬────┘                              │
        │ Engenheiro assume                 │ Coordenador resolve
        ▼                                   │ diretamente
  ┌────────────┐                            │
  │ EM_ANALISE │────────────────────────────┤
  └─────┬──────┘                            │
        │ Eng. registra manutenção          │
        ▼                                   │
  ┌─────────────┐                           │
  │ EM_CORRECAO │◄──────────────┐           │
  └──────┬──────┘               │           │
         │ Eng. finaliza reparo │           │
         ▼                      │           │
┌─────────────────────┐         │           │
│ AGUARDANDO_VALIDACAO│         │           │
└────┬──────────┬─────┘         │           │
     │          │               │           │
     │ Coord.   │ Coord.        │           │
     │ valida   │ rejeita       │           │
     ▼          ▼               │           │
┌──────────┐ ┌──────────────────┘           │
│ENCERRADA │ │ CORRECAO_RECUSADA            │
└──────────┘ └──────────────────            │
     ▲                                      │
     └──────────────────────────────────────┘
```

### Status e Significados

| Status | Label na UI | Cor | Quem pode agir |
|---|---|---|---|
| `aberta` | Aberta | Vermelho | Engenheiro (assumir) ou Coordenador (resolver direto) |
| `em_analise` | Em Resolução | Azul | Engenheiro (registrar manutenção) |
| `em_correcao` | Em Correção | Laranja | Engenheiro (finalizar reparo) |
| `aguardando_validacao` | Aguardando Validação | Verde | Coordenador (validar ou rejeitar) |
| `encerrada` | Encerrada | Cinza | Ninguém (fim do ciclo) |
| `correcao_recusada` | Correção Recusada | Vermelho | Engenheiro (retomar correção) |

### Fluxo Detalhado

1. **Inspetor** marca item como "Não Conforme" no checklist → NC criada automaticamente com status `aberta`
2. **Engenheiro** vê a NC na sua fila → assume → status vira `em_analise`
3. **Engenheiro** registra descrição do reparo → status vira `em_correcao`, ativo vira `em_manutencao`
4. **Engenheiro** finaliza reparo → status vira `aguardando_validacao`
5. **Coordenador** valida → status vira `encerrada`, ativo volta a `operacional`
6. **Coordenador** rejeita → status vira `correcao_recusada` (volta para engenheiro)
7. **Coordenador** pode resolver diretamente (sem técnico) → pula direto para `encerrada`

### Efeitos Colaterais nas Mudanças de Status

- **NC Crítica criada** → `ativo.status = 'indisponivel'`, `local.status = 'nao_pronta'`
- **NC Importante criada** → `ativo.status = 'operacional_com_restricoes'`, `local.status = 'pronta_com_ressalvas'`
- **Manutenção registrada** → `ativo.status = 'em_manutencao'`
- **NC encerrada** → `ativo.status = 'operacional'`
- **Checklist 100% conforme** → `ativo.status = 'operacional'`, `local.status = 'pronta'`

---

## 6. Fluxos Principais por Módulo

### 6.1 Módulo Inspetor (`/inspetor`)

#### Dashboard (`/inspetor`)
- Lista de salas cirúrgicas (Sala 01, 03, 04) com status de prontidão.
- Card de "Conferência Rápida" (QR Scanner ou digitar código manual).
- Barra de busca por nome de sala.
- Cada card de sala mostra: progresso da ronda do dia, última inspeção, NCs abertas.
- Dados vêm do Supabase: tabelas `locais`, `sala_ativos`, `execucoes_checklist`, `nao_conformidades`.

#### Scanner QR (`/inspetor/scanner`)
- Usa `getUserMedia` do navegador para acessar câmera traseira.
- Decodifica QR Code usando `BarcodeDetector` API nativa do browser.
- Busca o ativo no Supabase por `codigo_qr` ou `patrimonio`.
- Redireciona para `/inspetor/checklist/{ativoId}`.

#### Detalhe da Sala (`/inspetor/local/[id]`)
- Lista todos os ativos vinculados via `sala_ativos`.
- Mostra status de cada ativo (operacional, em manutenção, etc.).
- Indica se foi inspecionado hoje.
- Mostra NCs abertas nesta sala com fotos e criticidade.
- Botão "Ronda Completa" para começar checklist de cada ativo.

#### Execução de Checklist (`/inspetor/checklist/[id]`) — **TELA MAIS COMPLEXA**
- Carrega o ativo e seus modelos de checklist da categoria.
- Lista itens do modelo como seções expandíveis/colapsáveis (accordion).
- Cada seção mostra materiais de referência e 3 botões: Conforme, Não Conforme, N/A.
- Ao marcar "Não Conforme": abre formulário inline com campos de criticidade, setor, descrição e foto.
- Upload de foto vai para Supabase Storage (bucket `evidencias`), com fallback para Base64.
- Ao concluir: cria `execucoes_checklist` + `itens_execucao_checklist` + `nao_conformidades` (se houver NC).
- Envia e-mail SMTP para os destinatários configurados.
- Suporta modo **somente leitura** (`?execId=xxx`) para visualizar inspeções passadas.
- Após sucesso, redireciona de volta para a sala após 3 segundos.

#### Histórico de Inspeções (`/inspetor/inspecoes`)
- Lista inspeções realizadas pelo inspetor logado.
- Filtros: Todas, Conforme, Com NC.
- Cada card mostra ativo, data/hora, resultado.
- Clique abre o checklist em modo leitura.

#### Registro de NC Avulsa (`/inspetor/nc/nova`)
- Formulário para registrar NC fora do contexto de um checklist.
- Campos: descrição, criticidade, setor, foto.

#### Detalhe do Ativo (`/inspetor/ativo/[id]`)
- Mostra QR Code do ativo com opção de download.
- Status atual, patrimônio, categoria, localização.
- Botão para iniciar checklist.

### 6.2 Módulo Engenharia Clínica (`/engenharia`)

#### Fila de NCs (`/engenharia`)
- Lista todas as NCs do hospital do usuário logado.
- **5 abas de filtro**: Pendentes, Minhas, Sem Responsável, Validando, Todas.
- Ordenação: Criticidade (Crítico primeiro) → Prazo mais próximo.
- Cards mostram: número NC, criticidade, ativo, localização, responsável, status.
- Clique navega para `/nao-conformidades/[id]`.

### 6.3 Módulo Coordenação (`/coordenador`)

#### Central de Comando (`/coordenador`)
4 abas em **keep-alive** (componentes montados em paralelo, visibilidade via CSS):

1. **Painel** (`PainelDashboard.tsx`): Métricas de NCs, gráficos, timeline de atividade recente.
2. **NCs** (`FilaValidacaoNCs.tsx`): Fila de Não Conformidades simplificada e intuitiva:
   - **Filtros diretos**: Apenas **Abertas** e **Encerradas** (eliminando redundâncias).
   - **Layout dos Cards**:
     - Miniatura da foto da NC à esquerda (tamanho ampliado, centralizada com fallback do ícone do ativo).
     - Tempo decorrido em dias à esquerda.
     - Hierarquia de badges à direita: linha superior para **Tipo de NC** e linha inferior para **Encaminhado para: [Setor]**.
     - Cores dos badges de setor 100% alinhadas ao padrão do Inspetor (Engenharia Clínica = Vermelho, Manutenção = Âmbar, Farmácia = Esmeralda, Almoxarifado = Azul).
     - Remoção de ruídos e dados irrelevantes (códigos técnicos internos de QR, redundância de local/ativo).
   - **Confirmação Visual de Encerramento**: Modal de encerramento exibe preview card da NC para conferência antes da finalização.
3. **Equipe** (`GestaoEquipe.tsx`): Lista de inspetores e técnicos, status de cada um.
4. **Ativos** (`GestaoAtivos.tsx`): Lista de equipamentos com status, QR codes, patrimônio.

#### Gestão de Ativos QR (`/coordenador/ativos`)
- Lista de ativos com filtros e busca.
- Geração e download de QR Codes individuais.

### 6.4 Detalhe da NC (`/nao-conformidades/[id]`)

Tela compartilhada entre todos os perfis. Adapta os botões de ação ao perfil do usuário logado:

- **Timeline completa** de histórico de status.
- **Engenheiro pode**: Assumir NC, Iniciar Análise, Registrar Manutenção, Finalizar Reparo.
- **Coordenador pode**: Validar e Encerrar, Rejeitar Correção, Resolver Diretamente (sem técnico).
- QR Code do ativo quando disponível.
- Foto de evidência com lightbox para zoom.
- Verificação se existe técnico ativo no setor (via `verificarTecnicoAtivo` — atualmente mock).

---

## 7. Autenticação e Sessão

### Fluxo de Login

1. Usuário entra com email + senha.
2. `supabase.auth.signInWithPassword()` autentica no Supabase Auth.
3. Se falhar, tenta `signUp()` automático (auto-cadastro para credenciais de teste).
4. Busca perfil na tabela `public.usuarios` (por `id` ou `auth_user_id`) com retry de até 4 tentativas (delay 200ms para trigger assíncrono).
5. Grava no `localStorage` como `primus_usuario_atual` para acesso rápido client-side.
6. Redireciona para a rota do perfil.

### Rotas por Perfil

| Perfil | Rota |
|---|---|
| `inspetor` | `/inspetor` |
| `coordenador` | `/coordenador` |
| `engenharia_clinica` | `/engenharia` |
| `tecnico` | `/engenharia` |
| `gestor` | `/gestor` |
| `administrador` | `/admin` |

### Credenciais de Teste

| Perfil | E-mail | Senha |
|---|---|---|
| Inspetor | inspetor@gmail.com | 123456 |
| Engenharia | engenharia@gmail.com | 123456 |
| Coordenação | coordenador@gmail.com | 123456 |

### Sessão Mista (Importante!)

O sistema mantém **dois mecanismos paralelos** de sessão:
1. **Supabase Auth** (cookies + JWT) — autenticação real e queries ao banco.
2. **localStorage** (`primus_usuario_atual`) — bridge para componentes client-side que precisam do nome/perfil do usuário sem fazer fetch assíncrono.

Cada layout (`inspetor`, `coordenador`, `engenharia`) carrega o usuário no `useEffect`:
1. Primeiro lê do localStorage (renderização instantânea).
2. Depois busca do Supabase Auth para garantir dados atualizados.
3. Atualiza localStorage com os dados frescos.

### Logout

Todos os layouts têm `handleSair()`:
1. `supabase.auth.signOut()`
2. `localStorage.removeItem('primus_usuario_atual')`
3. Redireciona para `/login`

---

## 8. Cadastro de Usuários

Tela em `/cadastro`. Permite criar contas com os perfis:
- **Inspetor**: Enfermagem / Campo
- **Técnico**: Setor especializado (com seletor de setor)
- **Coordenador**: Gestão do Centro Cirúrgico & IA

Campos: Nome, E-mail, Hospital (select), Número do Conselho (COREN/CRM/CREA), Perfil, Setor (se técnico), Senha + Confirmação.

Fluxo:
1. `supabase.auth.signUp()` com metadados (`hospital_id`, `nome`, `perfil`, `setor`, `numero_conselho`).
2. Trigger `handle_new_user()` no Postgres sincroniza automaticamente com a tabela `public.usuarios` (`id, hospital_id, nome, email, perfil, setor, numero_conselho, criado_em`).
3. Tratamento centralizado de erros via `lib/tratarErrosAuth.ts` para garantir mensagens amigáveis em português sem erros `{}` ou termos técnicos em inglês.
4. Grava na sessão local e redireciona para a rota do perfil (`/inspetor`, `/engenharia`, `/coordenador`).

---

## 9. Notificações por E-mail

### Rota de API (`/api/send-email`)

- **Método**: POST
- **Transporte**: SMTP via Nodemailer / Resend (configurável por `.env.local`)
- **Template**: HTML responsivo com branding Primus (Space Grotesk, cards arredondados, badge de criticidade)
- **Destinatários fixos**: `pedrosoaress365@gmail.com`, `p.moraisneto@outlook.com` + e-mail do inspetor
- **Conteúdo**: Nome do ativo, problema relatado, criticidade, botão CTA para Primus
- **Anexo**: Se a foto de evidência vier como Base64, é convertida e anexada
- **Trigger**: Chamado automaticamente pela tela de checklist após conclusão com itens não conformes (fire-and-forget, não bloqueia a UI)

---

## 10. Cache Client-Side

`lib/cache/dadosCache.ts` implementa um cache SWR (Stale-While-Revalidate) leve:

- **Armazenamento**: `Map` em memória JavaScript (perde dados no reload da página).
- **TTL padrão**: 3 minutos.
- **API**:
  - `dadosCache.get<T>(key)` — retorna dados ou `null`
  - `dadosCache.set<T>(key, data)` — grava com timestamp
  - `dadosCache.isFresh(key, ttl?)` — verifica se não expirou
  - `dadosCache.invalidate(prefix?)` — limpa tudo ou por prefixo
- **Uso**: Todas as telas fazem `useState(() => dadosCache.get(key))` para renderizar instantaneamente, e `dadosCache.set()` após fetch.
- **Invalidação**: Após concluir checklist, invalida `inspetor_` para forçar refresh das salas.

Chaves principais:
- `inspetor_salas_lista`
- `inspetor_local_{localId}`
- `inspetor_checklist_ativo_{ativoId}`
- `inspetor_checklist_exec_{execId}`
- `inspetor_historico_inspecoes`
- `inspetor_ativo_{ativoId}`
- `engenharia_ncs_lista`

---

## 11. Design System

### Cores (definidas em `globals.css` via `@theme`)

| Token | Hex | Uso |
|---|---|---|
| `--color-fundo` | `#FAFAFC` | Background geral |
| `--color-superficie` | `#FFFFFF` | Cards |
| `--color-primaria` | `#246BFD` | Botões, links, badges ativos |
| `--color-texto` | `#111827` | Texto principal |
| `--color-texto-secundario` | `#6B7280` | Texto secundário |
| `--color-texto-terciario` | `#9CA3AF` | Texto terciário |
| `--color-perigo` | `#FF4D4D` | Erros, NC crítica |
| `--color-alerta` | `#FF9500` | Avisos, NC importante |
| `--color-sucesso` | `#10B981` | Sucesso, conforme |

### Cores por Perfil (accent color das nav bars)

| Perfil | Cor primária | Uso |
|---|---|---|
| Inspetor | `#246BFD` (azul) | Nav inferior, badges |
| Coordenador | `#17A592` / `#2ED29E` (verde da marca) | Nav inferior, badges, seletores, destaques (unificado com a logo) |
| Engenharia | `#F59E0B` (âmbar) | Header status |

### Tipografia

O sistema utiliza estritamente **2 fontes** para manter clareza e hierarquia limpa sem poluição visual:
- **Corpo & Interface**: `SF Pro Display` (pesos calibrados — regular, medium e semibold moderado para evitar títulos pesados ou extra bold agressivo)
- **Destaques & Brand**: `Nunito` (weight 700-900) — headers amigáveis e números em destaque
*(A fonte `Space Grotesk` foi eliminada para sanar inconsistências visuais e unificar a identidade).*

### Sombras

- `--shadow-card`: `0 2px 10px rgba(0,0,0,0.025)`
- `--shadow-card-hover`: `0 4px 16px rgba(0,0,0,0.04)`
- `--shadow-elevado`: `0 4px 20px rgba(0,0,0,0.03)`

### Raios de Borda

| Uso | Valor |
|---|---|
| Cards grandes | `28px` |
| Cards médios | `24px` |
| Inputs/modais | `20px` - `24px` |
| Botões/pills/inputs chat | `9999px` (full) |
| Mini cards | `12px` - `16px` |

### Estilo Visual Geral

- **Mobile-first**: `max-w-md mx-auto` em todos os layouts
- **Glassmorphism**: Nav inferior e Chat IA com `bg-white/70 backdrop-blur-[24px] saturate-[180%]`
- **Apple-style**: Tab bars, cards, seletores segmentados, chat input minimalista
- **Micro-animações**: `fadeIn` (opacity + translateY), `scale` em hover/active
- **Feedback tátil**: `active:scale-[0.92]` em botões, `active:scale-[0.98]` em links
- **Gradient header** (inspetor): `from-[#79C7FF] via-[#79C7FF]/5 to-[#FAFAFC]`

---

## 12. Componentes UI Reutilizáveis

| Componente | Arquivo | Descrição |
|---|---|---|
| `Botao` | `components/ui/Botao.tsx` | Botão com variantes `primario`, `secundario`, `perigo`, `fantasma` |
| `LiquidMetalButton` | `components/ui/liquid-metal-button.tsx` | Botão premium com shader WebGL de liquid metal |
| `OrbIA` | `components/ui/OrbIA.tsx` | Fluid Orb orgânico com shader WebGL (gradiente `#FFFFFF` → `#0F766E`, FBM domain warping) |
| `AIChatInput` | `components/ui/ai-chat-input.tsx` | Input de chat em formato de cápsula redonda (`rounded-full`) e botão circular de envio (`ArrowUp`) |
| `ResponseStream` | `components/ui/response-stream.tsx` | Componente de typewriter streaming para respostas da IA |
| `PillTag` | `components/ui/PillTag.tsx` | Badge colorido: `verde`, `laranja`, `vermelho`, `azul`, `cinza` |
| `BarraBusca` | `components/ui/BarraBusca.tsx` | Input de busca com ícone de lupa |
| `Avatar` | `components/ui/Avatar.tsx` | Compound component (Avatar.Image + Avatar.Fallback) |
| `QRCodeAtivo` | `components/ui/QRCodeAtivo.tsx` | Gera QR Code com opção de download como imagem |
| `CommandMenu` | `components/ui/command-menu.tsx` | Menu dropdown do header com perfil, navegação e logout |
| `PillUsuario` | `components/ui/PillUsuario.tsx` | Pill com avatar e nome do usuário |
| `Card` | `components/ui/Card.tsx` | Card wrapper genérico |
| `IconeMascote` | `components/ui/IconeMascote.tsx` | Ícone mascote "blop" animado |
| `ItemLista` | `components/ui/ItemLista.tsx` | Item de lista com seta de navegação |
| `LenisProvider` | `components/ui/LenisProvider.tsx` | Provider de smooth scroll global |

---

## 13. Módulo Primus IA (Assistente de Prontidão Operacional)

### 13.1 Visão Geral

O **Primus IA** é o copiloto inteligente em tempo real exclusivo para o perfil de **Coordenador** (e Administrador). Ele permite que o gestor faça perguntas em linguagem natural e receba diagnósticos operacionais imediatos sobre:
- Quantidade e criticidade de Não Conformidades abertas.
- Salas cirúrgicas com risco de atraso ou itens pendentes.
- Produtividade e volume de rondas realizadas por cada inspetor.
- Histórico de resoluções de equipamentos pela equipe de Engenharia Clínica e Manutenção.

### 13.2 Arquitetura de Dados (Sem Alucinações)

1. **Coleta em Tempo Real (`lib/ia/coletarDadosHospital.ts`)**:
   - A cada pergunta, o backend consulta o Supabase e compila um snapshot atualizado do hospital:
     - Todos os ativos e seus status (`disponivel`, `em_manutencao`, `inativo`).
     - Todas as NCs ativas com número único (`NC-2026-XXXX`), criticidade, tipo e setor responsável.
     - Últimas 30 execuções de checklist concluídas e o nome do inspetor executor.
     - Lista de usuários da equipe de campo.
2. **Injeção no System Prompt**:
   - O snapshot é anexado ao prompt de sistema do modelo **Google Gemini Flash** (`gemini-3.5-flash` / `gemini-3.6-flash`).
   - A IA responde estritamente baseada nos dados reais injetados, sem inventar informações.
3. **Personalização Natural**:
   - O backend extrai o primeiro nome do coordenador logado e instrui a IA a se dirigir a ele de forma natural e pontual (sem repetições mecânicas).

### 13.3 Streaming SSE (`/api/chat-ia`)

- Rota HTTP POST com suporte a Server-Sent Events (SSE).
- Respostas transmitidas caractere a caractere diretamente para o componente `ResponseStream`.
- Parser de Markdown com formatação estruturada de listas identadas (`•`), badges coloridos para NCs (`NC-2026-E009`) e pills de criticidade (*Crítica*, *Importante*, *Informativa*).

### 13.4 Interface & Liquid Glass Orb WebGPU

- **Botão de Ativação**: Posicionado organicamente fora da barra de abas, ao lado direito de "Ativos" no Desktop e Mobile.
- **Shader WebGPU Liquid Glass Orb**: Shader WGSL procedural com refração óptica física, perfil de dispersão espectral assimétrica, interpolação sRGB linearizada e transições orgânicas de estado (`idle` e `thinking`).
- **Chat Drawer**: Painel deslizante com fundo em Glassmorphism translúcido (`backdrop-blur-[24px]`).

---

## 14. Estado Atual do Projeto

### ✅ Implementado e Funcional

- Login e cadastro com Supabase Auth real e tradução humanizada de erros
- **Módulo Primus IA** completo com streaming SSE, contexto em tempo real e Liquid Glass Orb WebGPU orgânico
- Dashboard do Inspetor com lista de salas (dados reais do Supabase)
- Scanner QR via câmera do dispositivo (BarcodeDetector API)
- Execução completa de checklist com persistência no Supabase
- Registro de NCs com foto (Supabase Storage), criticidade e setor
- Envio de e-mail SMTP quando NC é criada
- Fila de NCs para Engenharia Clínica (dados reais)
- Detalhe da NC com ações por perfil (assumir, manutenção, finalizar, validar, rejeitar)
- Resolução direta de NCs pelo coordenador (sem técnico)
- Dashboard do Coordenador com 4 abas (Painel, NCs, Equipe, Ativos) + Acesso à Primus IA
- Histórico de inspeções com modo somente-leitura
- Cache SWR para navegação instantânea
- Design mobile-first premium (glassmorphism, liquid-metal, micro-animações)

### ⚠️ Dívida Técnica Conhecida

- `verificarTecnicoAtivo()` em `mockDb.ts` ainda usa mock em vez de query real no Supabase
- Tela de NC (`/nao-conformidades/[id]`) importa `mockDb.ts` para essa função
- `numero_unico` de NCs é gerado client-side (deveria ser sequencial no banco via trigger)
- Status de `locais` não é recalculado automaticamente por trigger no Postgres
- API `seed-plantao` está vazia (diretório reservado sem route.ts)
- Tipos em `types.ts` são manuais (não gerados pelo `supabase gen types`)

### 🔲 Não Implementado (Futuro)

- Rotas `/gestor` e `/admin`
- Middleware de proteção de rotas por perfil (qualquer user pode acessar qualquer rota hoje)
- RLS (Row Level Security) no Supabase
- Push notifications / notificações real-time (Supabase Realtime)
- Relatórios e exportações (PDF, CSV)
- Agendamento automático de tarefas de checklist (cron)
- Gestão de múltiplos hospitais
- Offline-first / PWA com service worker
- Testes automatizados (unit, integration, e2e)

---

## 14. Convenções de Código

### Nomenclatura

- **Páginas e componentes**: `PascalCase` em português (`PaginaLogin`, `PainelDashboard`)
- **Funções**: `camelCase` em português (`carregarDados`, `handleEntrar`, `handleSair`)
- **Variáveis de estado**: `camelCase` em português (`carregando`, `termoBusca`, `abaAtiva`)
- **Tipos/Enums**: `PascalCase` em português (`PerfilUsuario`, `StatusAtivo`)
- **Constantes**: `SCREAMING_SNAKE_CASE` (`CRITICIDADE_ORDEM`, `STATUS_CORES`, `SETORES_LABELS`)
- **Chaves de cache**: `snake_case` com prefixo do módulo (`inspetor_salas_lista`)

### Padrões Técnicos

- **Client Components**: Toda página que usa estado, efeitos ou interação é `'use client'`.
- **Server Components**: Apenas `layout.tsx` raiz e `page.tsx` raiz (redirect).
- **Supabase Client**: Sempre via `criarClienteSupabase()` (browser) ou `criarClienteServidor()` (server).
- **Tratamento de erros**: `try/catch` com `console.error` + state de erro para feedback na UI.
- **Fetch paralelo**: Usa `Promise.all()` extensivamente.
- **Cache-first**: Toda tela inicializa estado com `useState(() => dadosCache.get(key))`.
- **Tailwind**: Classes inline, sem CSS modules. Uso extensivo de valores arbitrários `[]`.
- **Tipagem**: `as any` usado em queries Supabase para contornar limitações de tipo (dívida técnica).

### Idioma

- **Código (domínio)**: Português (variáveis, funções, tipos, comentários).
- **Código (técnico)**: Inglês (APIs, métodos nativos).
- **UI**: Todo em português brasileiro.

---

## 15. Dados de Seed

O hospital de teste está populado com:

- **1 Hospital**: "Hospital Piemonte Paraguaçu"
- **1 Unidade**: "Unidade de Internação"
- **1 Centro Cirúrgico**: "Centro Cirúrgico Principal"
- **4 Salas**: 01, 02, 03, 04 — apenas 01, 03, 04 aparecem no dashboard do inspetor
- **9 Categorias de ativo** (Carrinho de parada, Carrinho de anestesia, Monitor, Mesa, Bisturi, Aspirador, Foco, Bombas, Gases)
- **24+ ativos** distribuídos nas salas via tabela `sala_ativos`
- **9+ modelos de checklist** (um por categoria, com variantes "Completo"/"Por plantão"/"Padrão")
- **51+ itens de checklist** com criticidade real e descrições clínicas
- **3 usuários de teste**: inspetor, engenharia, coordenador

Scripts SQL relevantes:
- `lib/supabase/seed.sql` — Estrutura base + Carrinho de Parada
- `lib/supabase/seed_carrinho_anestesia.sql` — Carrinho de Anestesia
- `lib/supabase/migration_salas_ativos.sql` — Salas 03/04, 7 novas categorias, 24 ativos, 51 itens, vínculos M:N
- `lib/supabase/migration_perfil_tecnico.sql` — Perfil de técnico com setor

---

## 16. Como Rodar o Projeto

```bash
# 1. Instalar dependências
npm install

# 2. Configurar variáveis de ambiente
# Preencher .env.local com Supabase URL, Key e SMTP

# 3. Rodar em desenvolvimento
npm run dev

# 4. Acessar
# http://localhost:3000
# Credenciais: inspetor@gmail.com / 123456
```

---

## 17. Glossário

| Termo | Significado |
|---|---|
| **NC** | Não Conformidade — registro de que algo não está conforme com o esperado |
| **Ativo** | Equipamento médico/hospitalar rastreado pelo sistema |
| **Local** | Sala cirúrgica ou área comum onde os ativos estão |
| **Ronda** | Inspeção completa de todos os ativos de uma sala |
| **Checklist** | Formulário de verificação baseado em modelo pré-definido |
| **Modelo** | Template de checklist associado a uma categoria de ativo |
| **Seção/Item** | Cada item do checklist que pode ser Conforme/Não Conforme/N/A |
| **Categoria** | Tipo de equipamento (ex: "Monitor multiparamétrico") |
| **Centro Cirúrgico** | Unidade física que agrupa salas |
| **Patrimônio** | Código patrimonial do equipamento no hospital |
| **SWR** | Stale-While-Revalidate — padrão de cache do `dadosCache` |
| **Liquid Metal** | Efeito visual WebGL usado no botão principal |
| **CommandMenu** | Menu dropdown compacto no header com perfil e navegação |
| **Bridge de sessão** | Ponte entre Supabase Auth e localStorage para acesso rápido ao perfil |
| **Keep-alive** | Técnica de manter componentes montados mesmo quando invisíveis (abas do coordenador) |

# Cockpit de Pivôs — Arquitetura de Software e Infraestrutura On-Premises

## 1. Visão Geral da Arquitetura

O sistema **Cockpit de Pivôs** foi concebido para atender às demandas corporativas do setor agroindustrial, operando tanto na web para gestão estratégica e planejamento quanto em dispositivos móveis no campo, com suporte a operação offline e sincronização resiliente. Toda a infraestrutura é desenhada para implantação em servidores próprios (**on-premises**), garantindo total soberania de dados e sem dependência de nuvens públicas de terceiros.

```mermaid
flowchart TB
    subgraph Clients["Camada de Apresentação (Clientes)"]
        WEB["Frontend Web (PC / Gestão)\nReact 19 + TanStack Start\nTailwind CSS v4 + shadcn/ui"]
        MOB["Aplicativo Mobile (Campo)\nReact Native + Expo\nSQLite Local + Sync Engine"]
    end

    subgraph Edge["Borda / Rede Corporativa (On-Premises)"]
        PROXY["Reverse Proxy (Nginx)\nHTTPS / SSL Terminação\nCompressão / Rate Limit / Roteamento"]
    end

    subgraph AppServer["Servidor de Aplicação Central"]
        API["Django 5.x + Django REST Framework\nAPI v1 (/api/v1/)\nAutenticação JWT / RBAC\nIdempotency & Sync Engine\nOpenAPI / Swagger"]
    end

    subgraph DataLayer["Camada de Dados Corporativa"]
        MSSQL[("Microsoft SQL Server\nProdução On-Premises\n(mssql-django / pyodbc)")]
        SQLITE[("SQLite de Desenvolvimento\nFallback Local Seguro")]
    end

    WEB -->|REST / HTTPS| PROXY
    MOB -->|REST / HTTPS (Online/Reconexão)| PROXY
    PROXY -->|Proxy reverso HTTP| API
    API -->|Conexão Primária| MSSQL
    API -.->|Dev Fallback| SQLITE
```

---

## 2. Tecnologias Adotadas

| Camada | Tecnologia | Justificativa Técnica |
| :--- | :--- | :--- |
| **Web Frontend (PC)** | React 19, TanStack Start, TypeScript, Tailwind CSS v4, shadcn/ui, Lucide, Recharts | Preserva 100% da identidade visual existente (Lovable), excelente performance, SSR/SPA híbrido e tipagem estrita. |
| **API Backend** | Python 3.13, Django 5.x, Django REST Framework, drf-spectacular | Alta maturidade no ecossistema corporativo, ORM robusto, documentação OpenAPI nativa, flexibilidade de banco de dados e auditoria nativa. |
| **Banco de Dados** | Microsoft SQL Server (Corporativo) / SQLite (Dev) | Conectividade via driver oficial `mssql-django` e `pyodbc`. Suporte configurável por variáveis de ambiente. |
| **Mobile (Campo)** | React Native, Expo SDK, TypeScript, Expo SQLite, NetInfo | Desenvolvimento multiplataforma (Android/iOS), armazenamento local relacional via SQLite, gerenciamento de conectividade e sincronização em segundo plano. |
| **Infraestrutura On-Premises** | Docker Compose, Nginx, Gunicorn/Uvicorn | Isolamento de processos, fácil manutenção pela equipe de TI interna e automação de deploy. |

---

## 3. Segurança e Governança

1. **Autenticação e Sessão:**
   - Autenticação stateless via tokens JWT (`djangorestframework-simplejwt`), permitindo expiração curta de tokens de acesso e renovação via Refresh Token.
   - Suporte preparado para autenticação corporativa Single Sign-On (Microsoft Entra ID / 365) via OAuth2/OIDC.

2. **Autorização Granular (RBAC):**
   - Papéis definidos: Administrador (`Admin`), Gestor Agrícola (`Manager`), Operador de Campo (`Operator`), Consulta/Auditor (`Viewer`).
   - Escopo de acesso segregado por Unidade/Fazenda.

3. **Proteção de Dados & Idempotência:**
   - O banco de dados SQL Server permanece na rede interna protegida por firewall, sem exposição direta à Internet.
   - Toda comunicação externa passa por Nginx com TLS 1.3.
   - As mutações originadas do aplicativo móvel possuem cabeçalho e campo `client_op_id` (UUID v4) para garantir idempotência contra reenvios e oscilações de rede.

---

## 4. Estrutura de Diretórios Unificada

```
Cockpit_de_Pivos/
├── AGENTS.md                  # Regras operacionais e diretrizes Lovable
├── README.md                  # Documentação principal
├── docs/                      # Documentação de arquitetura, domínio e deploy
│   ├── ARQUITETURA.md
│   ├── MODELO_DE_DOMINIO.md
│   ├── OFFLINE_SYNC.md
│   └── IMPLANTACAO_ON_PREMISES.md
├── .env.example               # Modelo de variáveis de ambiente
├── src/                       # Frontend Web TanStack Start (Preservado e evoluído)
│   ├── components/            # UI shadcn e componentes corporativos
│   ├── config/                # Navegação e temas
│   ├── services/              # Camada de comunicação com a API REST
│   └── routes/                # Rotas do sistema
├── backend/                   # Backend Django REST Framework
│   ├── manage.py
│   ├── pyproject.toml / requirements.txt
│   ├── cockpit_backend/       # Configuração principal do Django (settings, urls, wsgi)
│   ├── apps/
│   │   ├── core/              # Autenticação, usuários, auditoria e idempotência
│   │   ├── pivots/            # Pivôs, fazendas, talhões e geolocalização
│   │   ├── operations/        # Planejamento, irrigações, alertas e janelas
│   │   └── sync/              # Sincronização offline e resolução de conflitos
│   └── tests/                 # Testes unitários e de integração da API
├── mobile/                    # Aplicativo Mobile React Native Expo
│   ├── App.tsx / src/
│   ├── package.json
│   ├── src/
│   │   ├── database/          # SQLite local schema e migrations
│   │   ├── services/          # Cliente API com fila de sincronização
│   │   ├── screens/           # Telas de Pivôs, Irrigação, Alertas e Sync
│   │   └── components/        # Componentes visuais de campo
│   └── tsconfig.json
└── deploy/                    # Arquivos de implantação On-Premises
    ├── docker-compose.yml
    ├── Dockerfile.backend
    └── nginx.conf
```

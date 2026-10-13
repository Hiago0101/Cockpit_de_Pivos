# Cockpit de Pivôs — Sistema Integrado de Gestão de Irrigação

Cockpit operacional e gerencial para monitoramento, planejamento de safras, janelas de oportunidade e irrigação de pivôs centrais agrícolas.

A solução integra três camadas arquiteturais:
1. **Frontend Web (PC / Cockpit):** Interface web rica desenvolvida em TanStack Start, React 18, Tailwind CSS e Lucide Icons.
2. **Backend Central (API REST):** Desenvolvido em Python 3.13 e Django 5.1 REST Framework, operando com **SQLite local** no ambiente de desenvolvimento pessoal e preparado para Microsoft SQL Server na homologação corporativa.
3. **Aplicativo Mobile (Campo / Offline-First):** Desenvolvido em React Native e Expo SDK 52, com banco local **expo-sqlite** para cache e fila de operações pendentes com sincronização idempotente.

---

## 1. Arquitetura de Ambientes e Banco de Dados

### Ambiente de Desenvolvimento Local (Atual)
* **Banco de Dados Oficial:** SQLite em arquivo local (`backend/db.sqlite3`).
* **Seleção Explícita:** `DB_ENGINE=sqlite` definida no `.env` (padrão automático).
* **Persistência Segura:** O arquivo `db.sqlite3` é preservado entre reinicializações e ignorado no `.gitignore`. Nenhuma operação de inicialização recria ou apaga o banco silenciosamente.
* **Sem Fallback Oculto:** A escolha do motor é estrita — o sistema não tenta conectar ao SQL Server corporativo durante o desenvolvimento local.

### Homologação e Produção Corporativa On-Premises (Futuro)
* O sistema está arquitetado para conectar ao Microsoft SQL Server on-premises quando a infraestrutura corporativa for liberada.
* A ativação futura será explícita alterando:
  ```env
  DB_ENGINE=mssql
  DB_HOST=servidor_sql_corporativo
  DB_NAME=CockpitPivosDB
  DB_USER=usuario_sql
  DB_PASSWORD=senha_segura
  ```

---

## 2. Como Rodar no Windows (PowerShell)

### Pré-requisitos
* **Python 3.13** instalado e disponível no PATH.
* **Node.js 20+** e `npm` instalados.
* Rede Wi-Fi compartilhada caso deseje testar no aplicativo mobile físico.

---

### Passo 1: Inicialização do Backend (Django REST)

Abra um terminal PowerShell na raiz do projeto:

```powershell
# 1. Navegue até o backend
cd backend

# 2. Crie e ative o ambiente virtual
python -m venv venv
.\venv\Scripts\activate

# 3. Instale as dependências homologadas
pip install -r requirements.txt

# 4. Aplique as migrações no banco SQLite local (backend/db.sqlite3)
python manage.py migrate

# 5. Crie a conta do administrador (procedimento manual e seguro)
python manage.py createsuperuser

# 6. Carregue o catálogo agrícola de demonstração (idempotente)
python manage.py seed_cockpit

# 7. Inicie a API Central
python manage.py runserver 0.0.0.0:8000
```

> **Acesso à API:**
> * Documentação Swagger OpenAPI: `http://localhost:8000/api/docs/`
> * Health Check: `http://localhost:8000/api/v1/health/`
> * Painel Administrativo: `http://localhost:8000/admin/`

---

### Passo 2: Inicialização do Frontend Web (PC / Cockpit)

Em um segundo terminal PowerShell na raiz do projeto:

```powershell
# 1. Instale as dependências (caso não tenha instalado)
npm install

# 2. Inicie o servidor de desenvolvimento
npm run dev
```

> **Acesso ao Cockpit Web:**
> Abra no navegador: `http://localhost:8080` (ou a porta informada pelo Vite).

---

### Passo 3: Inicialização do Aplicativo Mobile (Expo / SQLite Offline)

Em um terceiro terminal PowerShell:

```powershell
# 1. Navegue até a pasta do aplicativo mobile
cd Mobile

# 2. Instale as dependências
npm install

# 3. Inicie o ambiente Expo
npx expo start
```

---

## 3. Testes em Celular Físico (App Mobile de Campo)

Quando testar em um smartphone físico com o aplicativo **Expo Go**:
1. Conecte o celular na **mesma rede Wi-Fi** do computador de desenvolvimento.
2. Descubra o IP local do seu computador no PowerShell executando `ipconfig` (observe o campo *Endereço IPv4*, por exemplo: `192.168.1.15`).
3. No aplicativo mobile (na aba **Sincronização**), informe o endereço da sua máquina:
   ```
   http://192.168.1.15:8000/api/v1
   ```
   *Nota: Nunca use `localhost` no celular físico, pois `localhost` aponta para o próprio smartphone e não conseguirá alcançar a API no seu computador.*
4. O backend já está configurado com `runserver 0.0.0.0:8000` e `ALLOWED_HOSTS=*` para aceitar conexões vindas do smartphone na mesma rede local.

---

## 4. Funcionamento Offline e Sincronização

1. **Online:** O app consulta fazendas, pivôs e janelas diretamente da API central e salva em cache no SQLite local do celular.
2. **Offline (Falta de sinal no campo):**
   * Apontamentos de irrigação e alterações de estado são gravados instantaneamente no SQLite local (`expo-sqlite`).
   * A operação recebe um UUID exclusivo (`client_op_id`) e entra na fila local `sync_queue` com status `PENDING`.
3. **Reconexão:**
   * O app detecta conexão com a rede e despacha o lote pendente para `/api/v1/sync/push/`.
   * O backend valida a **idempotência** de cada operação — retransmissões por oscilação de sinal no campo não geram duplicidade no banco central.

---

## 5. Testes Automatizados

* **Backend:**
  ```powershell
  cd backend
  python manage.py test tests
  ```
  *(11 testes cobrindo autenticação, bloqueio de anônimos, permissões RBAC, simulação de comandos e idempotência)*

* **Frontend Web:**
  ```powershell
  npm test
  ```
  *(12 testes de roteamento e integridade das páginas)*

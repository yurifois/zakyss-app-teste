# Plano de Implementação - Backend API REST

## 📋 Visão Geral

Sistema backend para o Zakys usando **Node.js + Express**, com persistência inicial em **arquivos JSON** e preparado para migração futura para **PostgreSQL/MongoDB**.

---

## 🏗️ Arquitetura

```
┌─────────────────────────────────────────────────────────────┐
│                        FRONTEND (React)                      │
│                     http://localhost:5173                    │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ HTTP/REST
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     BACKEND (Express.js)                     │
│                     http://localhost:3001                    │
├─────────────────────────────────────────────────────────────┤
│  Routes → Controllers → Services → Repository               │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    DATA LAYER                                │
├─────────────────────────────────────────────────────────────┤
│  FASE 1: JSON Files        │  FASE 2: Database Real         │
│  /server/data/*.json       │  PostgreSQL ou MongoDB         │
└─────────────────────────────────────────────────────────────┘
```

---

## 📁 Estrutura de Pastas

```
agendamento/
├── src/                    # Frontend React (existente)
├── server/                 # ⭐ NOVO - Backend
│   ├── index.js           # Entry point
│   ├── config/
│   │   └── database.js    # Configuração de conexão
│   ├── routes/
│   │   ├── index.js       # Agregador de rotas
│   │   ├── auth.routes.js
│   │   ├── users.routes.js
│   │   ├── establishments.routes.js
│   │   ├── services.routes.js
│   │   ├── appointments.routes.js
│   │   └── categories.routes.js
│   ├── controllers/
│   │   ├── auth.controller.js
│   │   ├── users.controller.js
│   │   ├── establishments.controller.js
│   │   ├── services.controller.js
│   │   ├── appointments.controller.js
│   │   └── categories.controller.js
│   ├── services/
│   │   ├── auth.service.js
│   │   ├── users.service.js
│   │   ├── establishments.service.js
│   │   └── appointments.service.js
│   ├── repositories/
│   │   ├── base.repository.js      # CRUD genérico
│   │   ├── json.repository.js      # FASE 1: JSON
│   │   └── database.repository.js  # FASE 2: DB real
│   ├── middleware/
│   │   ├── auth.middleware.js      # JWT verification
│   │   ├── error.middleware.js     # Error handling
│   │   └── cors.middleware.js
│   ├── utils/
│   │   ├── jwt.js
│   │   ├── bcrypt.js
│   │   └── validators.js
│   └── data/               # ⭐ JSON como "banco"
│       ├── categories.json
│       ├── services.json
│       ├── establishments.json
│       ├── appointments.json
│       ├── users.json
│       └── admins.json
└── package.json
```

---

## 🔌 API Endpoints

### Autenticação
| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/api/auth/login` | Login de usuário |
| POST | `/api/auth/register` | Cadastro de usuário |
| POST | `/api/auth/admin/login` | Login de admin |
| POST | `/api/auth/logout` | Logout |
| GET | `/api/auth/me` | Dados do usuário logado |

### Usuários
| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/users/:id` | Buscar usuário |
| PUT | `/api/users/:id` | Atualizar perfil |
| GET | `/api/users/:id/appointments` | Agendamentos do usuário |
| GET | `/api/users/:id/favorites` | Favoritos |

### Estabelecimentos
| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/establishments` | Listar todos (com filtros) |
| GET | `/api/establishments/:id` | Detalhes |
| POST | `/api/establishments` | Criar (admin) |
| PUT | `/api/establishments/:id` | Atualizar (admin) |
| GET | `/api/establishments/:id/services` | Serviços do estabelecimento |
| GET | `/api/establishments/:id/appointments` | Agendamentos |
| GET | `/api/establishments/nearby?lat=&lng=` | Por geolocalização |

### Serviços
| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/services` | Listar todos |
| GET | `/api/services/:id` | Detalhes |
| GET | `/api/categories` | Listar categorias |
| GET | `/api/categories/:id/services` | Serviços por categoria |

### Agendamentos
| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/api/appointments` | Criar agendamento |
| GET | `/api/appointments/:id` | Detalhes |
| PATCH | `/api/appointments/:id/status` | Atualizar status |
| GET | `/api/appointments/:id/available-slots?date=` | Horários disponíveis |

---

## 🔐 Autenticação JWT

```javascript
// Fluxo de autenticação
1. Cliente envia POST /api/auth/login {email, password}
2. Backend valida credenciais
3. Backend gera JWT token (expira em 7 dias)
4. Cliente armazena token no localStorage
5. Requisições incluem header: Authorization: Bearer <token>
6. Middleware valida token em rotas protegidas
```

**Estrutura do Token:**
```json
{
  "id": 1,
  "email": "user@email.com",
  "type": "customer", // ou "admin"
  "establishmentId": null, // se admin, ID do estabelecimento
  "iat": 1702656000,
  "exp": 1703260800
}
```

---

## 📦 Dependências do Backend

```json
{
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "dotenv": "^16.3.1",
    "jsonwebtoken": "^9.0.2",
    "bcryptjs": "^2.4.3",
    "uuid": "^9.0.0",
    "express-validator": "^7.0.1"
  },
  "devDependencies": {
    "nodemon": "^3.0.2"
  }
}
```

---

## 📝 Modelo de Dados (JSON)

### users.json
```json
[
  {
    "id": "uuid",
    "name": "Maria Costa",
    "email": "maria@email.com",
    "password": "$2a$10$hash...",
    "phone": "(61) 99999-0001",
    "avatar": null,
    "favorites": [1, 3],
    "createdAt": "2025-12-15T00:00:00Z",
    "updatedAt": "2025-12-15T00:00:00Z"
  }
]
```

### establishments.json
```json
[
  {
    "id": 1,
    "name": "Studio Beleza Asa Sul",
    "cnpj": "12.345.678/0001-90",
    "email": "contato@studio.com",
    "phone": "(61) 99999-1234",
    "address": "CLS 408 Bloco A",
    "city": "Brasília",
    "state": "DF",
    "zipCode": "70257-510",
    "lat": -15.8267,
    "lng": -47.9218,
    "rating": 4.8,
    "reviewCount": 245,
    "image": "url",
    "images": ["url1", "url2"],
    "categories": ["cabelo", "unhas"],
    "services": [1, 2, 3],
    "workingHours": {
      "monday": {"open": "09:00", "close": "19:00"},
      "sunday": null
    },
    "createdAt": "2025-12-15T00:00:00Z"
  }
]
```

### appointments.json
```json
[
  {
    "id": 1,
    "establishmentId": 1,
    "userId": "uuid",
    "services": [1, 9],
    "date": "2025-12-16",
    "time": "10:00",
    "status": "confirmed",
    "totalPrice": 115,
    "totalDuration": 105,
    "customerName": "Maria Costa",
    "customerPhone": "(61) 99999-0001",
    "customerEmail": "maria@email.com",
    "notes": "Observações opcionais",
    "createdAt": "2025-12-15T10:30:00Z",
    "updatedAt": "2025-12-15T10:30:00Z"
  }
]
```

---

## 🚀 Fases de Implementação

### FASE 1: Backend com JSON (1-2 dias)
- [x] Estrutura de pastas
- [ ] Server Express básico
- [ ] CRUD com arquivos JSON
- [ ] Rotas de autenticação (JWT)
- [ ] Rotas de estabelecimentos
- [ ] Rotas de agendamentos
- [ ] Integrar frontend com API

### FASE 2: Melhorias (1 dia)
- [ ] Validação de dados (express-validator)
- [ ] Tratamento de erros centralizado
- [ ] Logs de requisições
- [ ] Rate limiting
- [ ] Upload de imagens

### FASE 3: Banco de Dados Real (2-3 dias)
- [ ] Escolher banco (PostgreSQL ou MongoDB)
- [ ] Criar schema/models
- [ ] Migrar repository para usar ORM (Prisma/Mongoose)
- [ ] Migrações de dados
- [ ] Backup automático

---

## 🔄 Padrão Repository (Para fácil migração)

```javascript
// repositories/base.repository.js
class BaseRepository {
  async findAll() { throw new Error('Not implemented') }
  async findById(id) { throw new Error('Not implemented') }
  async create(data) { throw new Error('Not implemented') }
  async update(id, data) { throw new Error('Not implemented') }
  async delete(id) { throw new Error('Not implemented') }
}

// repositories/json.repository.js (FASE 1)
class JsonRepository extends BaseRepository {
  constructor(filePath) {
    this.filePath = filePath
  }
  // Implementação com fs.readFile/writeFile
}

// repositories/prisma.repository.js (FASE 3)
class PrismaRepository extends BaseRepository {
  constructor(model) {
    this.model = model
  }
  // Implementação com Prisma ORM
}
```

---

## ✅ Próximos Passos

1. **Aprovar este plano**
2. **Iniciar FASE 1**: Criar estrutura backend com Express + JSON
3. **Migrar frontend**: Substituir localStorage por chamadas API
4. **Testar integração**
5. **Documentar API** (Swagger/OpenAPI)

---

## 📊 Estimativa de Tempo

| Fase | Descrição | Tempo |
|------|-----------|-------|
| 1 | Backend JSON + Rotas | 4-6 horas |
| 2 | Melhorias e validações | 2-3 horas |
| 3 | Banco de dados real | 6-8 horas |
| **Total** | | **12-17 horas** |

---

**Deseja que eu inicie a implementação da FASE 1?**

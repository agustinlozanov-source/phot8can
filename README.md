# Photocan OS

Sistema operativo para agencias creativas. Construido sobre Next.js 14, Supabase y TypeScript.

## Setup inicial

### 1. Instalar dependencias

```bash
npm install
```

### 2. Configurar variables de entorno

Copia `.env.example` a `.env.local` y llena los valores:

```bash
cp .env.example .env.local
```

Edita `.env.local` con tus credenciales de Supabase:

- `NEXT_PUBLIC_SUPABASE_URL`: URL del proyecto Supabase (Settings > API)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Anon/public key (Settings > API)
- `SUPABASE_SERVICE_ROLE_KEY`: Service role key (Settings > API) — **NUNCA exponer al cliente**

### 3. Correr en desarrollo

```bash
npm run dev
```

Abrir [http://localhost:3000](http://localhost:3000) en el navegador.

## Estructura

```
photocan-os/
├── app/                          # Next.js App Router
│   ├── (auth)/                   # Rutas públicas (login)
│   │   └── login/
│   ├── (admin)/                  # Super admin panel
│   │   └── admin/
│   ├── (app)/                    # App principal (agencias)
│   │   └── dashboard/
│   ├── api/                      # API routes (webhooks)
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx                  # Redirige según rol
│
├── components/
│   ├── ui/                       # shadcn primitives
│   ├── forms/                    # Forms reutilizables
│   └── shared/                   # Componentes transversales
│
├── lib/
│   ├── supabase/                 # Clientes Supabase
│   │   ├── client.ts             # Browser
│   │   ├── server.ts             # Server components
│   │   └── middleware.ts         # Middleware
│   ├── utils.ts                  # Utilities (cn, etc.)
│   └── types/                    # Tipos TypeScript
│       └── database.ts
│
├── middleware.ts                 # Next.js middleware (auth)
└── ...
```

## Estado actual

- ✅ Módulo 01 (Identidad y acceso) — SQL completo en Supabase
- ⏳ Módulo 01 — Frontend (Login, Super Admin panel)
- ⏸️ Resto de módulos según roadmap del DOC_MAESTRO

## Notas

- **Trabajamos en `main` directamente** (sin staging por ahora)
- **NPM** como gestor de paquetes
- **Server Actions** para mutaciones (no tRPC por ahora)
- **shadcn/ui** para componentes
- **Tailwind** con paleta Photocan (negro + ámbar)

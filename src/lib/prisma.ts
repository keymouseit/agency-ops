import { PrismaClient } from '@prisma/client'

const PRISMA_SCHEMA_VERSION = 18

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  prismaSchemaVersion?: number
}

/** Cap pool size so Neon / local don't exhaust connections under Next.js hot reload. */
function datasourceUrl() {
  const url = process.env.DATABASE_URL
  if (!url || url.startsWith('file:')) return url
  try {
    const parsed = new URL(url)
    if (!parsed.searchParams.has('connection_limit')) {
      parsed.searchParams.set('connection_limit', process.env.PRISMA_CONNECTION_LIMIT || '5')
    }
    if (!parsed.searchParams.has('pool_timeout')) {
      parsed.searchParams.set('pool_timeout', '20')
    }
    return parsed.toString()
  } catch {
    return url
  }
}

function createPrismaClient() {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error'] : [],
    datasources: { db: { url: datasourceUrl() } },
  })
}

function getPrismaClient() {
  const cached = globalForPrisma.prisma
  const versionOk = globalForPrisma.prismaSchemaVersion === PRISMA_SCHEMA_VERSION
  if (cached && versionOk) return cached

  if (cached) {
    void cached.$disconnect().catch(() => {})
  }

  const client = createPrismaClient()
  // Always cache in globalThis — Next.js HMR otherwise spawns many pools
  globalForPrisma.prisma = client
  globalForPrisma.prismaSchemaVersion = PRISMA_SCHEMA_VERSION
  return client
}

export const prisma = getPrismaClient()

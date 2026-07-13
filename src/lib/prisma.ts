import { PrismaClient } from '@prisma/client'

const PRISMA_SCHEMA_VERSION = 4

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  prismaSchemaVersion?: number
}

function createPrismaClient() {
  return new PrismaClient({ log: process.env.NODE_ENV === 'development' ? ['error'] : [] })
}

function getPrismaClient() {
  const cached = globalForPrisma.prisma
  const versionOk = globalForPrisma.prismaSchemaVersion === PRISMA_SCHEMA_VERSION
  if (cached && versionOk) return cached

  const client = createPrismaClient()
  if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = client
    globalForPrisma.prismaSchemaVersion = PRISMA_SCHEMA_VERSION
  }
  return client
}

export const prisma = getPrismaClient()

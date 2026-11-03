import { Prisma } from "@/lib/generated/prisma/client";

// True when a unique index (by its database name) rejected the write. Prisma 7 with the pg
// adapter reports the index under driverAdapterError, not meta.target.
export function isUniqueViolation(error: unknown, index?: string): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
    return false;
  }
  if (index === undefined) return true;
  const meta = error.meta as
    { driverAdapterError?: { cause?: { constraint?: { index?: string } } } } | undefined;
  return meta?.driverAdapterError?.cause?.constraint?.index === index;
}

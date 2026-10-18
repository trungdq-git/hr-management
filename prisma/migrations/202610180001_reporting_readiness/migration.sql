ALTER TABLE "User" ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0 CHECK ("sessionVersion" >= 0);
CREATE TABLE "ImportBatch" (
  "id" TEXT PRIMARY KEY,
  "actorId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "kind" TEXT NOT NULL CHECK ("kind" IN ('employees','projects','planned','actual')),
  "rowCount" INTEGER NOT NULL CHECK ("rowCount" BETWEEN 1 AND 200),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE "LoginThrottle" (
  "key" TEXT PRIMARY KEY,
  "attempts" INTEGER NOT NULL CHECK ("attempts" > 0),
  "expiresAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "LoginThrottle_expiresAt_idx" ON "LoginThrottle"("expiresAt");
CREATE INDEX "AuditLog_createdAt_id_idx" ON "AuditLog"("createdAt", "id");
CREATE INDEX "AuditLog_actorId_createdAt_idx" ON "AuditLog"("actorId", "createdAt");

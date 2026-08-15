-- CreateIndex
CREATE INDEX "AuditLog_actionType_createdAt_idx" ON "AuditLog"("actionType", "createdAt");

-- CreateIndex
CREATE INDEX "Form_createdByUserId_idx" ON "Form"("createdByUserId");

-- CreateIndex
CREATE INDEX "FormAccessGrant_grantedToUserId_idx" ON "FormAccessGrant"("grantedToUserId");

-- CreateIndex
CREATE INDEX "FormSubmission_formId_submittedAt_idx" ON "FormSubmission"("formId", "submittedAt");

-- CreateIndex
CREATE INDEX "Session_userId_revokedAt_idx" ON "Session"("userId", "revokedAt");

-- CreateIndex
CREATE INDEX "User_role_deletedAt_idx" ON "User"("role", "deletedAt");

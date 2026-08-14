-- CreateIndex
CREATE INDEX "FormFileUpload_fieldId_idx" ON "FormFileUpload"("fieldId");

-- AddForeignKey
ALTER TABLE "FormFileUpload" ADD CONSTRAINT "FormFileUpload_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "FormField"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

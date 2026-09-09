import "server-only";

import {
  createServiceRoleClient,
  getStorageBucket,
} from "@/lib/supabase/server";
import { documentTypeLabel } from "@/lib/validation/claim";
import type { ClaimDetailView } from "@/types/database";
import { safeErrorDetails } from "@/lib/ai/debug";

export type PreparedDocumentKind = "image" | "pdf" | "unsupported" | "inaccessible";

export interface PreparedClaimDocument {
  id: string;
  documentType: string;
  fileName: string;
  kind: PreparedDocumentKind;
  mimeType: string | null;
  note: string;
  dataUrl?: string;
}

const IMAGE_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_ATTACHED_IMAGES = 8;
const MAX_ATTACHED_PDFS = 4;

function mimeFromFileName(fileName: string): string | null {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  return null;
}

function kindFromMime(mimeType: string | null): PreparedDocumentKind {
  if (!mimeType) return "unsupported";
  if (IMAGE_MIME.has(mimeType)) return "image";
  if (mimeType === "application/pdf") return "pdf";
  return "unsupported";
}

export async function prepareClaimDocuments(
  claim: ClaimDetailView,
): Promise<PreparedClaimDocument[]> {
  const supabase = createServiceRoleClient();
  const bucket = getStorageBucket();
  let attachedImages = 0;
  let attachedPdfs = 0;

  const prepared: PreparedClaimDocument[] = [];

  for (const doc of claim.documents) {
    const guessedMime = mimeFromFileName(doc.fileName);
    const { data, error } = await supabase.storage
      .from(bucket)
      .download(doc.storagePath);

    if (error || !data) {
      console.error("[claim-analysis] document download failed:", {
        documentId: doc.id,
        fileName: doc.fileName,
        error: error ? safeErrorDetails(error) : { message: "No data returned" },
      });
      prepared.push({
        id: doc.id,
        documentType: doc.documentType,
        fileName: doc.fileName,
        kind: "inaccessible",
        mimeType: guessedMime,
        note: `${documentTypeLabel(doc.documentType)} (${doc.fileName}) could not be accessed for analysis.`,
      });
      continue;
    }

    const mimeType = data.type || guessedMime;
    const kind = kindFromMime(mimeType);

    if (kind === "unsupported") {
      prepared.push({
        id: doc.id,
        documentType: doc.documentType,
        fileName: doc.fileName,
        kind,
        mimeType,
        note: `${documentTypeLabel(doc.documentType)} (${doc.fileName}) uses an unsupported format and was not sent to the model.`,
      });
      continue;
    }

    if (kind === "image" && attachedImages >= MAX_ATTACHED_IMAGES) {
      prepared.push({
        id: doc.id,
        documentType: doc.documentType,
        fileName: doc.fileName,
        kind: "unsupported",
        mimeType,
        note: `${documentTypeLabel(doc.documentType)} (${doc.fileName}) was not attached because the image limit was reached.`,
      });
      continue;
    }

    if (kind === "pdf" && attachedPdfs >= MAX_ATTACHED_PDFS) {
      prepared.push({
        id: doc.id,
        documentType: doc.documentType,
        fileName: doc.fileName,
        kind: "unsupported",
        mimeType,
        note: `${documentTypeLabel(doc.documentType)} (${doc.fileName}) was not attached because the PDF limit was reached.`,
      });
      continue;
    }

    const buffer = Buffer.from(await data.arrayBuffer());
    const dataUrl = `data:${mimeType};base64,${buffer.toString("base64")}`;

    if (kind === "image") attachedImages += 1;
    if (kind === "pdf") attachedPdfs += 1;

    prepared.push({
      id: doc.id,
      documentType: doc.documentType,
      fileName: doc.fileName,
      kind,
      mimeType,
      dataUrl,
      note: `${documentTypeLabel(doc.documentType)} (${doc.fileName}) is attached for review.`,
    });
  }

  return prepared;
}

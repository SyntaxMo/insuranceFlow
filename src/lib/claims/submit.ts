import "server-only";

import {
  isAccidentFormValid,
  validateDocuments,
  validateFile,
  type AccidentFormInput,
} from "@/lib/validation/claim";
import { createUniqueClaimNumber } from "@/lib/claims/numbers";
import { verifyPolicyByNumber } from "@/lib/claims/policy";
import {
  createServiceRoleClient,
  getStorageBucket,
} from "@/lib/supabase/server";
import type { DocumentType } from "@/types/database";

export interface SubmitClaimResult {
  ok: boolean;
  claimNumber?: string;
  error?: string;
}

interface PreparedDocument {
  file: File;
  documentType: DocumentType;
}

function collectDocuments(formData: FormData): {
  documents: PreparedDocument[];
  error?: string;
} {
  const policeReport = formData.get("policeReport");
  const repairEstimate = formData.get("repairEstimate");
  const accidentPhotos = formData.getAll("accidentPhotos");

  const policeFile =
    policeReport instanceof File && policeReport.size > 0 ? policeReport : null;
  const repairFile =
    repairEstimate instanceof File && repairEstimate.size > 0
      ? repairEstimate
      : null;
  const photoFiles = accidentPhotos.filter(
    (item): item is File => item instanceof File && item.size > 0,
  );

  const docErrors = validateDocuments({
    policeReport: policeFile,
    repairEstimate: repairFile,
    accidentPhotos: photoFiles,
  });

  if (docErrors.repairEstimate) {
    return { documents: [], error: docErrors.repairEstimate };
  }
  if (docErrors.policeReport) {
    return { documents: [], error: docErrors.policeReport };
  }
  if (docErrors.accidentPhotos) {
    return { documents: [], error: docErrors.accidentPhotos };
  }

  const documents: PreparedDocument[] = [];

  if (policeFile) {
    const err = validateFile(policeFile);
    if (err) return { documents: [], error: err };
    documents.push({ file: policeFile, documentType: "POLICE_REPORT" });
  }

  if (repairFile) {
    documents.push({ file: repairFile, documentType: "REPAIR_ESTIMATE" });
  }

  for (const photo of photoFiles) {
    documents.push({ file: photo, documentType: "ACCIDENT_PHOTO" });
  }

  return { documents };
}

async function uploadDocument(params: {
  claimNumber: string;
  document: PreparedDocument;
}): Promise<{ filePath: string } | { error: string }> {
  const supabase = createServiceRoleClient();
  const bucket = getStorageBucket();
  const safeName = params.document.file.name.replace(/[^\w.\-()+ ]+/g, "_");
  const filePath = `${params.claimNumber}/${params.document.documentType.toLowerCase()}-${Date.now()}-${safeName}`;

  const buffer = Buffer.from(await params.document.file.arrayBuffer());

  const { error } = await supabase.storage.from(bucket).upload(filePath, buffer, {
    contentType: params.document.file.type || "application/octet-stream",
    upsert: false,
  });

  if (error) {
    console.error("Storage upload failed:", error.message);
    return {
      error: "We could not upload one of your documents. Please try again.",
    };
  }

  return { filePath };
}

export async function submitClaim(
  formData: FormData,
): Promise<SubmitClaimResult> {
  const policyNumber = String(formData.get("policyNumber") || "").trim();
  const accident: AccidentFormInput = {
    accidentDate: String(formData.get("accidentDate") || "").trim(),
    accidentLocation: String(formData.get("accidentLocation") || "").trim(),
    description: String(formData.get("description") || "").trim(),
    email: String(formData.get("email") || "").trim(),
    phone: String(formData.get("phone") || "").trim(),
  };

  if (!policyNumber) {
    return { ok: false, error: "Policy number is required." };
  }

  if (!isAccidentFormValid(accident)) {
    return {
      ok: false,
      error: "Please complete all required accident details correctly.",
    };
  }

  const { documents, error: documentError } = collectDocuments(formData);
  if (documentError) {
    return { ok: false, error: documentError };
  }

  const verification = await verifyPolicyByNumber(policyNumber);
  if (!verification.ok) {
    return { ok: false, error: verification.error };
  }

  const supabase = createServiceRoleClient();
  const claimNumber = await createUniqueClaimNumber();

  const { data: claim, error: claimError } = await supabase
    .from("claims")
    .insert({
      policy_id: verification.policy.policyId,
      claim_number: claimNumber,
      accident_date: accident.accidentDate,
      accident_location: accident.accidentLocation,
      description: accident.description,
      contact_email: accident.email,
      contact_phone: accident.phone,
      status: "SUBMITTED",
    })
    .select("id, claim_number")
    .single();

  if (claimError || !claim) {
    console.error("Claim insert failed:", claimError?.message);
    return {
      ok: false,
      error:
        "We could not submit your claim right now. Please try again shortly.",
    };
  }

  const uploadedPaths: string[] = [];

  try {
    for (const document of documents) {
      const uploaded = await uploadDocument({
        claimNumber: claim.claim_number,
        document,
      });

      if ("error" in uploaded) {
        throw new Error(uploaded.error);
      }

      uploadedPaths.push(uploaded.filePath);

      const { error: docError } = await supabase.from("claim_documents").insert({
        claim_id: claim.id,
        document_type: document.documentType,
        file_name: document.file.name,
        file_path: uploaded.filePath,
      });

      if (docError) {
        console.error("claim_documents insert failed:", docError.message);
        throw new Error(
          "We could not save your document details. Please try again.",
        );
      }
    }
  } catch (err) {
    console.error("Claim document pipeline failed:", err);

    if (uploadedPaths.length > 0) {
      await supabase.storage.from(getStorageBucket()).remove(uploadedPaths);
    }
    await supabase.from("claims").delete().eq("id", claim.id);

    return {
      ok: false,
      error:
        err instanceof Error
          ? err.message
          : "We could not finish uploading your documents. Please try again.",
    };
  }

  return { ok: true, claimNumber: claim.claim_number };
}

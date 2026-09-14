import { z } from "zod";
import { getCustomerForApi } from "@/lib/auth/session";
import { getCustomerPolicyDetails } from "@/lib/claims/customer";
import {
  getPolicyDocumentMetadata,
  POLICY_DOCUMENT_BUCKET,
  POLICY_DOCUMENT_SIGNED_URL_SECONDS,
} from "@/lib/policies/policy-document-delivery";
import { createServiceRoleClient } from "@/lib/supabase/server";

const policyIdSchema = z.string().uuid();

function message(status: number, value: string) {
  return Response.json({ message: value }, { status });
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const customer = await getCustomerForApi();
  if (!customer) return message(401, "Sign in to download this policy document.");

  const parsedPolicyId = policyIdSchema.safeParse((await context.params).id);
  if (!parsedPolicyId.success) return message(404, "Policy document unavailable.");

  const authorization = await getCustomerPolicyDetails(customer.id, parsedPolicyId.data);
  if (authorization.error) return message(503, "Policy document unavailable right now.");
  if (!authorization.policy) return message(404, "Policy document unavailable.");

  const metadata = await getPolicyDocumentMetadata(parsedPolicyId.data);
  if (!metadata) return message(404, "Policy document unavailable.");

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.storage
    .from(POLICY_DOCUMENT_BUCKET)
    .createSignedUrl(metadata.file_path, POLICY_DOCUMENT_SIGNED_URL_SECONDS, {
      download: metadata.file_name,
    });

  if (error || !data?.signedUrl) {
    console.error("Policy document signed URL creation failed:", {
      policyId: parsedPolicyId.data,
      stage: "signed_url",
    });
    return message(503, "Policy document unavailable right now.");
  }

  return Response.redirect(data.signedUrl, 302);
}

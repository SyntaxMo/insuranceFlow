export type PolicyStatus = "ACTIVE" | "INACTIVE" | "EXPIRED" | "CANCELLED";
export type ClaimStatus =
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "MORE_INFO_REQUIRED"
  | "APPROVED"
  | "REJECTED"
  | "CLOSED";

export type UserRole = "CUSTOMER" | "CLAIMS_OFFICER" | "ADMIN";

export type DocumentType =
  | "POLICE_REPORT"
  | "REPAIR_ESTIMATE"
  | "ACCIDENT_PHOTO"
  | "ADDITIONAL_INFORMATION";

export type ClaimHistoryAction =
  | "CLAIM_SUBMITTED"
  | "STATUS_IMPORTED"
  | "REVIEW_STARTED"
  | "REVIEW_RETURNED"
  | "MORE_INFO_REQUESTED"
  | "CUSTOMER_INFO_SUBMITTED"
  | "CLAIM_APPROVED"
  | "CLAIM_REJECTED"
  | "CLAIM_CLOSED";

export interface User {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  role: UserRole;
  auth_user_id: string | null;
  created_at?: string;
}

export interface Vehicle {
  id: string;
  owner_id: string;
  make: string;
  model: string;
  year: number;
  plate_number: string;
  vin?: string | null;
  created_at?: string;
}

export interface Policy {
  id: string;
  user_id: string;
  vehicle_id: string;
  policy_number: string;
  status: PolicyStatus | string;
  start_date: string;
  end_date: string;
  coverage_type: string;
  excess_amount: number;
  coverage_limit: number;
  annual_premium?: number | null;
  purchase_request_id?: string | null;
  created_at?: string;
  vehicles?: Vehicle | Vehicle[] | null;
}

export interface PolicyDocument {
  id: string;
  policy_id: string;
  document_type: "POLICY_DOCUMENT" | string;
  file_path: string;
  file_name: string;
  mime_type: string;
  file_size_bytes: number | null;
  created_at: string;
}

export interface Claim {
  id: string;
  policy_id: string;
  claim_number: string;
  accident_date: string;
  accident_location: string;
  description: string;
  contact_email: string | null;
  contact_phone: string | null;
  status: ClaimStatus | string;
  created_at: string;
  updated_at?: string;
  policies?: Policy | Policy[] | null;
}

export interface ClaimDocument {
  id: string;
  claim_id: string;
  document_type: DocumentType | string;
  file_name: string;
  file_path: string;
  created_at?: string;
}

export interface ClaimStatusHistory {
  id: string;
  claim_id: string;
  from_status: ClaimStatus | string | null;
  to_status: ClaimStatus | string;
  action: ClaimHistoryAction | string;
  note: string | null;
  actor_user_id: string | null;
  actor_role: UserRole | "SYSTEM" | string;
  created_at: string;
}

export interface VerifiedPolicySummary {
  policyId: string;
  policyNumber: string;
  coverageType: string;
  excessAmount: number;
  coverageLimit: number;
  startDate: string;
  endDate: string;
  vehicle: {
    id: string;
    make: string;
    model: string;
    year: number;
    plateNumber: string;
    vin?: string | null;
  };
}

export interface ClaimListItem {
  id: string;
  claimNumber: string;
  policyNumber: string;
  vehicleLabel: string;
  accidentDate: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  customerName: string;
  hasAiAnalysis: boolean;
  customerResponded: boolean;
}

export interface ClaimDetailView {
  id: string;
  claimNumber: string;
  status: string;
  createdAt: string;
  accidentDate: string;
  accidentLocation: string;
  description: string;
  email: string;
  phone: string;
  customerName: string;
  policyStatus: string;
  annualPremium: number | null;
  policy: VerifiedPolicySummary;
  documents: Array<{
    id: string;
    documentType: string;
    fileName: string;
    storagePath: string;
    mimeType: string | null;
    signedUrl: string | null;
  }>;
  history: Array<ClaimStatusHistory & { actorName: string | null }>;
}

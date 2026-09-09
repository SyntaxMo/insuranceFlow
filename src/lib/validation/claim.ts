import type { DocumentType } from "@/types/database";

export const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export const ALLOWED_EXTENSIONS = [".pdf", ".jpg", ".jpeg", ".png", ".webp"];

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export interface AccidentFormInput {
  accidentDate: string;
  accidentLocation: string;
  description: string;
  email: string;
  phone: string;
}

export interface AccidentFormErrors {
  accidentDate?: string;
  accidentLocation?: string;
  description?: string;
  email?: string;
  phone?: string;
}

export function validateAccidentForm(
  input: AccidentFormInput,
): AccidentFormErrors {
  const errors: AccidentFormErrors = {};
  const today = new Date();
  today.setHours(23, 59, 59, 999);

  if (!input.accidentDate) {
    errors.accidentDate = "Accident date is required.";
  } else {
    const date = new Date(input.accidentDate);
    if (Number.isNaN(date.getTime())) {
      errors.accidentDate = "Enter a valid accident date.";
    } else if (date > today) {
      errors.accidentDate = "Accident date cannot be in the future.";
    }
  }

  if (!input.accidentLocation.trim()) {
    errors.accidentLocation = "Accident location is required.";
  } else if (input.accidentLocation.trim().length < 3) {
    errors.accidentLocation = "Enter a more specific location.";
  }

  if (!input.description.trim()) {
    errors.description = "Please describe what happened.";
  } else if (input.description.trim().length < 10) {
    errors.description = "Description must be at least 10 characters.";
  }

  if (!input.email.trim()) {
    errors.email = "Email is required.";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())) {
    errors.email = "Enter a valid email address.";
  }

  const phone = input.phone.trim();
  if (!phone) {
    errors.phone = "Phone number is required.";
  } else if (!/^[+\d][\d\s()-]{6,}$/.test(phone)) {
    errors.phone = "Enter a valid phone number.";
  }

  return errors;
}

export function isAccidentFormValid(input: AccidentFormInput): boolean {
  return Object.keys(validateAccidentForm(input)).length === 0;
}

export function validateFile(file: File): string | null {
  if (!ALLOWED_MIME_TYPES.includes(file.type as (typeof ALLOWED_MIME_TYPES)[number])) {
    return "Unsupported file type. Use PDF, JPEG, PNG, or WEBP.";
  }

  if (file.size <= 0) {
    return "The selected file is empty.";
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return "File is too large. Maximum size is 10 MB.";
  }

  const lower = file.name.toLowerCase();
  if (!ALLOWED_EXTENSIONS.some((ext) => lower.endsWith(ext))) {
    return "Unsupported file extension.";
  }

  return null;
}

export function validateDocuments(input: {
  policeReport: File | null;
  repairEstimate: File | null;
  accidentPhotos: File[];
}): { repairEstimate?: string; accidentPhotos?: string; policeReport?: string } {
  const errors: {
    repairEstimate?: string;
    accidentPhotos?: string;
    policeReport?: string;
  } = {};

  if (!input.repairEstimate) {
    errors.repairEstimate = "A repair estimate is required.";
  } else {
    const err = validateFile(input.repairEstimate);
    if (err) errors.repairEstimate = err;
  }

  if (input.policeReport) {
    const err = validateFile(input.policeReport);
    if (err) errors.policeReport = err;
  }

  if (input.accidentPhotos.length === 0) {
    errors.accidentPhotos = "Add at least one accident photo.";
  } else {
    for (const photo of input.accidentPhotos) {
      const err = validateFile(photo);
      if (err) {
        errors.accidentPhotos = err;
        break;
      }
    }
  }

  return errors;
}

export function documentTypeLabel(type: DocumentType | string): string {
  switch (type) {
    case "POLICE_REPORT":
      return "Police Report";
    case "REPAIR_ESTIMATE":
      return "Repair Estimate";
    case "ACCIDENT_PHOTO":
      return "Accident Photo";
    default:
      return type;
  }
}

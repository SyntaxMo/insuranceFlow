"use server";

import {
  requestPasswordChangeCode,
  updatePassword,
  type PasswordChangeState,
  type PasswordCodeRequestState,
} from "@/lib/auth/password-change";

export async function requestPasswordChangeCodeAction(
  previous: PasswordCodeRequestState,
  formData: FormData,
): Promise<PasswordCodeRequestState> {
  return requestPasswordChangeCode("staff", previous, formData);
}

export async function updatePasswordAction(
  previous: PasswordChangeState,
  formData: FormData,
): Promise<PasswordChangeState> {
  return updatePassword("staff", previous, formData);
}

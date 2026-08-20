/**
 * Malawi mobile money operator auto-detection from phone number prefix.
 * 08x = TNM Mpamba, 09x = Airtel Money. Applied silently — no user-facing selector.
 */
export const TNM_OPERATOR_ID = "27494cb5-ba9e-437f-a114-4e7a7686bcca";
export const AIRTEL_OPERATOR_ID = "20be6c20-adeb-4b5b-a7ba-0769820df4fb";

export function detectOperator(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  // Normalize to local format starting with 0 (strip leading 265 / +265 country code)
  const local = digits.startsWith("265") ? "0" + digits.slice(3) : digits;

  if (local.startsWith("08")) return TNM_OPERATOR_ID;
  if (local.startsWith("09")) return AIRTEL_OPERATOR_ID;

  // Default to Airtel if undetectable (shouldn't normally happen with valid MW numbers)
  return AIRTEL_OPERATOR_ID;
}

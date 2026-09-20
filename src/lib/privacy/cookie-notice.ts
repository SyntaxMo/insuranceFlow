export const COOKIE_NOTICE_STORAGE_KEY = "insureflow_cookie_notice";
export const COOKIE_NOTICE_VERSION = 1;

export type CookieNoticeAcknowledgement = {
  acknowledged: true;
  version: number;
};

export function hasCurrentCookieNoticeAcknowledgement(
  storage: Pick<Storage, "getItem">,
): boolean {
  try {
    const stored = storage.getItem(COOKIE_NOTICE_STORAGE_KEY);
    if (!stored) return false;
    const parsed = JSON.parse(stored) as Partial<CookieNoticeAcknowledgement>;
    return parsed.acknowledged === true && parsed.version === COOKIE_NOTICE_VERSION;
  } catch {
    return false;
  }
}

export function storeCookieNoticeAcknowledgement(
  storage: Pick<Storage, "setItem">,
): void {
  const acknowledgement: CookieNoticeAcknowledgement = {
    acknowledged: true,
    version: COOKIE_NOTICE_VERSION,
  };
  storage.setItem(COOKIE_NOTICE_STORAGE_KEY, JSON.stringify(acknowledgement));
}

import { PublicCookieNotice } from "@/components/privacy/PublicCookieNotice";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <PublicCookieNotice />
    </>
  );
}

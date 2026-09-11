import Image from "next/image";
import { AuthHeader } from "@/components/auth-header";
import { AuthSkylineFooter } from "@/components/auth-skyline-footer";
import { Icon, type IconName } from "@/components/ui/icon";
import { PhoneForm } from "./phone-form";

const TRUST_ROW: { icon: IconName; label: string }[] = [
  { icon: "user", label: "Verified professionals" },
  { icon: "wallet", label: "Protected payments" },
  { icon: "star", label: "Real reviews" },
];

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <div className="flex flex-col min-h-dvh">
      {/* Hero: nairobi-skyline-hero.jpg per design-references/mobile/01-login.png —
          tall enough to still show behind the phone-entry card below, not just
          behind the header/tagline, so the image reads as one continuous scene
          rather than a banner that hands off to plain white. */}
      <div className="relative w-full h-[620px] flex-shrink-0 overflow-hidden">
        <Image
          src="/images/photos/nairobi-skyline-hero.jpg"
          alt="The Nairobi skyline at golden hour"
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(to bottom, rgba(255,255,255,0) 55%, var(--background) 92%)" }}
        />
        <div className="relative z-10 px-4 pt-5 flex flex-col items-center">
          <AuthHeader showHelp />
          <div
            className="mt-2 rounded-2xl px-4 py-3 backdrop-blur-sm"
            style={{ background: "rgba(255,255,255,0.78)" }}
          >
            <h1 className="text-2xl font-extrabold text-center leading-tight text-[var(--foreground)]">
              A more convenient Kenya.
            </h1>
            <p className="text-sm text-center mt-2 max-w-xs mx-auto text-[var(--muted)]">
              Find trusted professionals for home, property, personal and business services.
            </p>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-sm w-full px-4 -mt-40 relative z-10 pb-4 flex flex-col flex-1">
        <div className="card p-5 shadow-lg">
          <h2 className="text-lg font-bold text-center">Enter your phone number</h2>
          <p className="text-sm text-[var(--muted)] mt-1 text-center">
            We&apos;ll send you a one-time passcode (OTP) to verify your number.
          </p>
          <div className="mt-5">
            <PhoneForm next={next} />
          </div>
        </div>

        <div className="mt-6 grid grid-cols-3 gap-2 text-center">
          {TRUST_ROW.map((t) => (
            <div key={t.label} className="flex flex-col items-center gap-1.5">
              <span
                className="w-11 h-11 rounded-full flex items-center justify-center"
                style={{ background: "var(--trust-tint)", color: "var(--trust)" }}
              >
                <Icon name={t.icon} size={20} />
              </span>
              <span className="text-xs font-medium leading-tight">{t.label}</span>
            </div>
          ))}
        </div>

        <AuthSkylineFooter activeDot={0} />
      </div>
    </div>
  );
}

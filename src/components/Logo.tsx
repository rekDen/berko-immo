// Berko KI Logo – icon (public/berko-ki-icon.webp) + "Berko KI" wordmark.

type LogoProps = { className?: string; title?: string };

const ICON_SRC = "/berko-ki-icon.webp";

/** The icon-only mark. Size via className (e.g. `h-9 w-9`). */
export function LogoMark({ className, title = "Berko KI" }: LogoProps) {
  return <img src={ICON_SRC} alt={title} className={className} />;
}

/** The full horizontal logo: icon + "Berko KI" wordmark.
 *  Size the whole thing via className on the wrapper (e.g. `h-12 w-auto`);
 *  text color follows the ancestor `color` (e.g. `text-gray-900 dark:text-white`). */
export default function Logo({ className, title = "Berko KI" }: LogoProps) {
  return (
    <span className={`inline-flex items-center gap-2 ${className ?? ""}`}>
      <img src={ICON_SRC} alt={title} className="h-full w-auto shrink-0" />
      <span className="text-lg font-semibold tracking-tight text-foreground">
        Berko{" "}
        <span className="bg-gradient-to-r from-brand-cyan to-accent-strong bg-clip-text text-transparent">
          KI
        </span>
      </span>
    </span>
  );
}

import Image from "next/image";

export default function Logo({ className }: { className?: string }) {
  return (
    <div className={className}>
      <Image
        src="/atoreum-logo.svg"
        alt="Atoreum MV logo"
        width={64}
        height={64}
        className="h-auto w-auto"
      />
    </div>
  );
}

import Image from "next/image";

export default function Logo({ className }: { className?: string }) {
  return (
    <Image
      src="/atoreum-icon.svg"
      alt="Atoreum MV icon"
      width={40}
      height={40}
      className={className}
    />
  );
}

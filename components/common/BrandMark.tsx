import Image from "next/image";

export function BrandMark({ size = 32 }: { size?: number }) {
  return (
    <Image
      src="/icons/bunoraa-admin.svg"
      alt="Bunoraa"
      width={size}
      height={size}
      aria-hidden="true"
      priority
      style={{ display: "block", flexShrink: 0, objectFit: "contain" }}
    />
  );
}

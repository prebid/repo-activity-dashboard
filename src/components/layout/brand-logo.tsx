import Image from 'next/image';

export const brandLogoSource = '/images/prebid-logo.svg';
/** The official lockup's viewBox; display sizes keep its ratio. */
export const brandLogoViewBox = { width: 140, height: 25 } as const;
export const brandLogoSizes = {
  header: { width: 143, height: 26 },
  signIn: { width: 171, height: 31 },
} as const;

export function BrandLogo({ size }: { size: keyof typeof brandLogoSizes }) {
  return <Image src={brandLogoSource} alt="Prebid" {...brandLogoSizes[size]} priority />;
}

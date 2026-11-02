import Image from 'next/image';

export const brandLogoSource = '/images/prebid-logo.svg';
/** The lockup with a white wordmark, for the navy masthead. */
export const brandLogoKnockoutSource = '/images/prebid-logo-knockout.svg';
/** The official lockup's viewBox; display sizes keep its ratio. */
export const brandLogoViewBox = { width: 140, height: 25 } as const;
export const brandLogoSizes = {
  header: { width: 143, height: 26 },
  signIn: { width: 171, height: 31 },
} as const;
/** The masthead is navy in both themes; the sign-in and edge pages sit on the canvas. */
export const brandLogoSources = {
  header: brandLogoKnockoutSource,
  signIn: brandLogoSource,
} as const satisfies Record<keyof typeof brandLogoSizes, string>;

export function BrandLogo({ size }: { size: keyof typeof brandLogoSizes }) {
  return <Image src={brandLogoSources[size]} alt="Prebid" {...brandLogoSizes[size]} priority />;
}

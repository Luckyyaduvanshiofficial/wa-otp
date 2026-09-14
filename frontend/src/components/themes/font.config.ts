import {
  Architects_Daughter,
  DM_Sans,
  Fira_Code,
  Geist,
  Geist_Mono,
  Google_Sans_Flex,
  Instrument_Sans,
  Instrument_Serif,
  Inter,
  JetBrains_Mono,
  Merriweather,
  Mulish,
  Playfair_Display,
  Noto_Sans_Mono,
  Outfit,
  Source_Code_Pro,
  Space_Mono
} from 'next/font/google';

import { cn } from '@/lib/utils';

const fontSans = Geist({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sans'
});

const fontMono = Geist_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-mono'
});

const fontGoogleSansFlex = Google_Sans_Flex({
  subsets: ['latin'],
  display: 'swap',
  preload: false,
  variable: '--font-google-sans-flex'
});

const fontSourceCodePro = Source_Code_Pro({
  subsets: ['latin'],
  display: 'swap',
  preload: false,
  variable: '--font-source-code-pro'
});

const fontInstrument = Instrument_Sans({
  subsets: ['latin'],
  display: 'swap',
  preload: false,
  variable: '--font-instrument'
});

// Display face for the public surfaces. Instrument Serif ships a single
// weight, so it must be declared explicitly — there is no variable axis.
const fontInstrumentSerif = Instrument_Serif({
  subsets: ['latin'],
  weight: '400',
  display: 'swap',
  variable: '--font-instrument-serif'
});

const fontNotoMono = Noto_Sans_Mono({
  subsets: ['latin'],
  display: 'swap',
  preload: false,
  variable: '--font-noto-mono'
});

const fontMullish = Mulish({
  subsets: ['latin'],
  display: 'swap',
  preload: false,
  variable: '--font-mullish'
});

const fontInter = Inter({
  subsets: ['latin'],
  display: 'swap',
  preload: false,
  variable: '--font-inter'
});

const fontArchitectsDaughter = Architects_Daughter({
  subsets: ['latin'],
  weight: '400',
  display: 'swap',
  preload: false,
  variable: '--font-architects-daughter'
});

const fontDMSans = DM_Sans({
  subsets: ['latin'],
  display: 'swap',
  preload: false,
  variable: '--font-dm-sans'
});

const fontFiraCode = Fira_Code({
  subsets: ['latin'],
  display: 'swap',
  preload: false,
  variable: '--font-fira-code'
});

const fontOutfit = Outfit({
  subsets: ['latin'],
  display: 'swap',
  preload: false,
  variable: '--font-outfit'
});

const fontSpaceMono = Space_Mono({
  subsets: ['latin'],
  weight: ['400', '700'],
  display: 'swap',
  preload: false,
  variable: '--font-space-mono'
});

const fontJetBrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-jetbrains-mono'
});

const fontMerriweather = Merriweather({
  subsets: ['latin'],
  weight: ['300', '400', '700'],
  display: 'swap',
  preload: false,
  variable: '--font-merriweather'
});

const fontPlayfairDisplay = Playfair_Display({
  subsets: ['latin'],
  display: 'swap',
  preload: false,
  variable: '--font-playfair-display'
});

export const fontVariables = cn(
  fontSans.variable,
  fontMono.variable,
  fontGoogleSansFlex.variable,
  fontSourceCodePro.variable,
  fontInstrument.variable,
  fontInstrumentSerif.variable,
  fontNotoMono.variable,
  fontMullish.variable,
  fontInter.variable,
  fontArchitectsDaughter.variable,
  fontDMSans.variable,
  fontFiraCode.variable,
  fontOutfit.variable,
  fontSpaceMono.variable,
  fontJetBrainsMono.variable,
  fontMerriweather.variable,
  fontPlayfairDisplay.variable
);

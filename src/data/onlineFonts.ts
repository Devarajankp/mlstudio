/**
 * Open-licence Malayalam fonts you can install with one click.
 * Every file is downloaded straight from its public source (the Google Fonts repository on GitHub) by the user's own
 * browser / app when they press Install — Malayalam Studio does not host or re-distribute them.
 * All are SIL Open Font License 1.1. More open fonts: https://smc.org.in/fonts and https://rachana.org.in/downloads.html
 */
export interface OnlineFont {
  family: string;
  label: string;
  note: string;
  license: 'OFL-1.1';
  author: string;
  url: string;
}
const G = 'https://raw.githubusercontent.com/google/fonts/main/ofl/';
export const ONLINE_FONTS: OnlineFont[] = [
  { family: 'Chilanka', label: 'Chilanka', note: 'Casual handwriting style', license: 'OFL-1.1', author: 'Santhosh Thottingal / SMC', url: G + 'chilanka/Chilanka-Regular.ttf' },
  { family: 'Gayathri', label: 'Gayathri', note: 'Clean, modern sans', license: 'OFL-1.1', author: 'Binoy Dominic / SMC', url: G + 'gayathri/Gayathri-Regular.ttf' },
  { family: 'Manjari', label: 'Manjari', note: 'Friendly, rounded text font', license: 'OFL-1.1', author: 'Santhosh Thottingal / SMC', url: G + 'manjari/Manjari-Regular.ttf' },
  { family: 'Anek Malayalam', label: 'Anek Malayalam', note: 'Variable-width modern sans', license: 'OFL-1.1', author: 'Ek Type', url: G + 'anekmalayalam/AnekMalayalam%5Bwdth%2Cwght%5D.ttf' },
  { family: 'Baloo Chettan 2', label: 'Baloo Chettan 2', note: 'Bold, friendly display style', license: 'OFL-1.1', author: 'Ek Type', url: G + 'baloochettan2/BalooChettan2%5Bwght%5D.ttf' },
  { family: 'Noto Sans Malayalam', label: 'Noto Sans Malayalam', note: 'Google Noto, sans', license: 'OFL-1.1', author: 'Google / Noto Project', url: G + 'notosansmalayalam/NotoSansMalayalam%5Bwdth%2Cwght%5D.ttf' },
  { family: 'Noto Serif Malayalam', label: 'Noto Serif Malayalam', note: 'Google Noto, serif', license: 'OFL-1.1', author: 'Google / Noto Project', url: G + 'notoserifmalayalam/NotoSerifMalayalam%5Bwght%5D.ttf' },
  { family: 'Arima', label: 'Arima', note: 'Soft display style', license: 'OFL-1.1', author: 'Ek Type', url: G + 'arima/Arima%5Bwght%5D.ttf' },
];
export const MORE_FONT_SITES = [
  { label: 'SMC font collection', url: 'https://smc.org.in/fonts' },
  { label: 'Rachana Institute (RIT) fonts', url: 'https://rachana.org.in/downloads.html' },
];

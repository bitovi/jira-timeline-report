import { sRGBtoY, APCAcontrast } from "apca-w3";

export function getTextColorUsingAPCA(backgroundColor: string): string {
  const bgRgb = hexToRgb(backgroundColor);
  const whiteRgb = hexToRgb("#ffffff");
  const blackRgb = hexToRgb("#000000");

  // Calculate the luminance (Y) for both the background and text colors
  const bgLuminance = sRGBtoY(bgRgb);
  const whiteTextLuminance = sRGBtoY(whiteRgb);
  const blackTextLuminance = sRGBtoY(blackRgb);

  const whiteContrast = APCAcontrast(whiteTextLuminance, bgLuminance);
  const blackContrast = APCAcontrast(blackTextLuminance, bgLuminance);

  const betterContrast = Math.abs(+whiteContrast) > Math.abs(+blackContrast);

  return betterContrast ? "white" : "black";
}

function hexToRgb(hex: string): [number, number, number] {
  const cleanedHex = hex.replace("#", "");
  const r = parseInt(cleanedHex.slice(0, 2), 16);
  const g = parseInt(cleanedHex.slice(2, 4), 16);
  const b = parseInt(cleanedHex.slice(4, 6), 16);

  return [r, g, b];
}

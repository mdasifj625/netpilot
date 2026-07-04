/**
 * Curated offline MAC OUI Vendor database.
 * Maps the first 3 octets (6 hex characters) of a BSSID or MAC address to its manufacturer.
 */
export const macVendors: Record<string, string> = {
  // Apple
  "0017F2": "Apple",
  "001C42": "Parallels / Apple",
  "002500": "Apple",
  "3C0754": "Apple",
  A470D6: "Apple",
  FCFC48: "Apple",
  D4A33D: "Apple",

  // Samsung
  "001247": "Samsung",
  "1868CB": "Samsung",
  F47B5E: "Samsung",
  BC72B1: "Samsung",
  AC5A14: "Samsung",

  // Google
  "001A11": "Google",
  "2C5A0F": "Google",
  "3C5A37": "Google",
  F80F41: "Google",

  // Cisco / Linksys
  "00000C": "Cisco",
  "001370": "Cisco / Linksys",
  "001839": "Cisco",
  "0023EB": "Cisco",

  // Intel
  "0013E8": "Intel",
  "001CBF": "Intel",
  A434D9: "Intel",
  "48A917": "Intel",

  // TP-Link
  "002719": "TP-Link",
  "503EAA": "TP-Link",
  EC086B: "TP-Link",
  C025E9: "TP-Link",

  // D-Link
  "000D88": "D-Link",
  "18622C": "D-Link",
  "9094E4": "D-Link",

  // Netgear
  "000FB5": "Netgear",
  "00146C": "Netgear",
  C03F0E: "Netgear",

  // HP / Compaq
  "000802": "Hewlett-Packard",
  "000F20": "Hewlett-Packard",

  // Huawei
  "001882": "Huawei",
  "00E0FC": "Huawei",
  "24DF6A": "Huawei",

  // Miscellaneous / Common Chips
  "080027": "PCS Systemtechnik (VirtualBox)",
  "000569": "VMware",
  "005056": "VMware",
};

/**
 * Resolves the manufacturer vendor name for a given MAC address or BSSID.
 * @param mac String representation of MAC address (e.g., "aa:bb:cc:dd:ee:ff")
 */
export function resolveMacVendor(mac: string | null | undefined): string | null {
  if (!mac) return null;

  // Normalize MAC: remove colons, dashes, and make uppercase
  const clean = mac.replace(/[^a-fA-F0-9]/g, "").toUpperCase();
  if (clean.length < 6) return null;

  // Take first 6 characters (3 octets)
  const oui = clean.substring(0, 6);
  return macVendors[oui] || null;
}

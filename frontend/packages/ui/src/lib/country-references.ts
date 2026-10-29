import type { EntityReference } from "./entity-rich-text"

const flags: Readonly<Record<string, string>> = {
  VN: new URL("../assets/reference-flags/vn.svg", import.meta.url).href,
  TH: new URL("../assets/reference-flags/th.svg", import.meta.url).href,
  TW: new URL("../assets/reference-flags/tw.svg", import.meta.url).href,
  HK: new URL("../assets/reference-flags/hk.svg", import.meta.url).href,
  MO: new URL("../assets/reference-flags/mo.svg", import.meta.url).href,
  ID: new URL("../assets/reference-flags/id.svg", import.meta.url).href,
  SG: new URL("../assets/reference-flags/sg.svg", import.meta.url).href,
  MY: new URL("../assets/reference-flags/my.svg", import.meta.url).href,
  PH: new URL("../assets/reference-flags/ph.svg", import.meta.url).href,
  US: new URL("../assets/reference-flags/us.svg", import.meta.url).href,
  GB: new URL("../assets/reference-flags/gb.svg", import.meta.url).href,
  CN: new URL("../assets/reference-flags/cn.svg", import.meta.url).href,
  JP: new URL("../assets/reference-flags/jp.svg", import.meta.url).href,
  KR: new URL("../assets/reference-flags/kr.svg", import.meta.url).href,
}

/** Only bundled flag assets can bypass the untrusted image URL policy. */
export function countryReferenceFlag(code: string) {
  return Object.hasOwn(flags, code) ? flags[code] : undefined
}

const countries: [string, string, string[]][] = [
  ["VN", "Việt Nam", ["Vietnam", "Viet Nam", "VN"]],
  ["TH", "Thái Lan", ["Thailand", "Thai Lan", "TH"]],
  ["TW", "Đài Loan", ["Taiwan", "Dai Loan", "TW"]],
  ["HK", "Hồng Kông", ["Hong Kong", "Hongkong", "HK"]],
  ["MO", "Ma Cao", ["Macau", "Macao", "MO"]],
  ["ID", "Indonesia", ["In-đô-nê-xi-a", "ID"]],
  ["SG", "Singapore", ["Xin-ga-po", "SG"]],
  ["MY", "Malaysia", ["Ma-lai-xi-a", "MY"]],
  ["PH", "Philippines", ["Phi-líp-pin", "PH"]],
  ["JP", "Nhật Bản", ["Japan", "Nhat Ban", "JP"]],
  ["KR", "Hàn Quốc", ["South Korea", "Han Quoc", "KR"]],
  ["CN", "Trung Quốc", ["China", "Trung Quoc", "CN"]],
  ["US", "Hoa Kỳ", ["United States", "Mỹ", "USA", "US"]],
  ["GB", "Vương quốc Anh", ["United Kingdom", "Anh", "UK", "GB"]],
  ["GLOBAL", "Quốc tế", ["Toàn cầu", "Global", "International", "Quoc te"]],
]

export const countryReferences: EntityReference[] = countries.map(([code, name, aliases]) => ({
  id: code,
  kind: "country",
  autoMatch: false,
  translations: [
    {
      locale: "vi-VN",
      name,
      aliases,
      description: name === "Quốc tế" ? "Phạm vi quốc tế." : `Quốc gia / khu vực: ${name}.`,
    },
  ],
  display: { showIcon: true, underline: true },
}))

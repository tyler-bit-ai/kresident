const COUNTRY_GROUPS = [
  "중국",
  "일본",
  "타이완",
  "미국",
  "홍콩",
  "싱가포르",
  "베트남",
  "필리핀",
  "말레이시아",
  "타이",
  "오스트레일리아",
  "캐나다",
  "인도네시아",
  "프랑스",
  "독일",
  "러시아(연방)",
  "영국",
  "몽골",
  "기타",
] as const;

export type SupportedCountryGroup = (typeof COUNTRY_GROUPS)[number];

const COUNTRY_ALIASES: Array<{
  key: Exclude<SupportedCountryGroup, "기타">;
  aliases: string[];
}> = [
  { key: "중국", aliases: ["중국", "중 국"] },
  { key: "일본", aliases: ["일본", "일 본"] },
  { key: "타이완", aliases: ["타이완", "대만"] },
  { key: "미국", aliases: ["미국", "미 국"] },
  { key: "홍콩", aliases: ["홍콩", "홍 콩"] },
  { key: "싱가포르", aliases: ["싱가포르", "싱 가 포 르"] },
  { key: "베트남", aliases: ["베트남", "베 트 남"] },
  { key: "필리핀", aliases: ["필리핀", "필 리 핀"] },
  { key: "말레이시아", aliases: ["말레이시아"] },
  { key: "타이", aliases: ["타이"] },
  { key: "오스트레일리아", aliases: ["오스트레일리아"] },
  { key: "캐나다", aliases: ["캐나다"] },
  { key: "인도네시아", aliases: ["인도네시아"] },
  { key: "프랑스", aliases: ["프랑스"] },
  { key: "독일", aliases: ["독일", "독 일"] },
  { key: "러시아(연방)", aliases: ["러시아(연방)", "러시아"] },
  {
    key: "영국",
    aliases: [
      "영국",
      "영 국",
      "영국 외지민",
      "영국보호민",
      "영국속령지시민",
      "영국외지민",
      "영국외지시민",
      "영국해외영토시민",
    ],
  },
  { key: "몽골", aliases: ["몽골"] },
] as const;

export function getSupportedCountryGroups(): SupportedCountryGroup[] {
  return [...COUNTRY_GROUPS];
}

export function normalizeCountryGroup(countryName: string): {
  normalizedCountryKey: string;
  normalizedCountryLabel: SupportedCountryGroup;
} {
  for (const group of COUNTRY_ALIASES) {
    if (group.aliases.includes(countryName)) {
      return {
        normalizedCountryKey: group.key,
        normalizedCountryLabel: group.key,
      };
    }
  }

  return {
    normalizedCountryKey: "기타",
    normalizedCountryLabel: "기타",
  };
}

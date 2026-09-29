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

/**
 * 장기 입국자 전용 추가 국가군. 장기는 우즈베키스탄·네팔·한국계중국인 등 비중이 큰 나라가 단기와 달라
 * 공용 목록(단기 기준 18개국)만 쓰면 전체의 약 26%가 `기타`로 묶여, 최근 12개월 기준 0.7% 이상인 국가를 추가한다.
 * 단기 대시보드에는 영향을 주지 않는다.
 */
const LONG_TERM_EXTRA_GROUPS: Array<{ key: string; aliases: string[] }> = [
  { key: "한국계중국인", aliases: ["한국계중국인"] },
  { key: "우즈베키스탄", aliases: ["우즈베키스탄"] },
  { key: "캄보디아", aliases: ["캄보디아"] },
  { key: "네팔", aliases: ["네팔"] },
  { key: "라오스", aliases: ["라오스"] },
  { key: "미얀마", aliases: ["미얀마"] },
  { key: "방글라데시", aliases: ["방글라데시"] },
  { key: "카자흐스탄", aliases: ["카자흐스탄"] },
  { key: "스리랑카", aliases: ["스리랑카"] },
  { key: "인도", aliases: ["인도"] },
];

export type CountryProfile = "short" | "long";
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

const SHORT_ALIAS_ENTRIES = COUNTRY_ALIASES.flatMap((group) =>
  group.aliases.map((alias) => [canonicalizeCountryName(alias), group.key as string] as const),
);

const CANONICAL_ALIAS_TO_GROUP: Record<CountryProfile, Map<string, string>> = {
  short: new Map(SHORT_ALIAS_ENTRIES),
  long: new Map([
    ...SHORT_ALIAS_ENTRIES,
    ...LONG_TERM_EXTRA_GROUPS.flatMap((group) =>
      group.aliases.map((alias) => [canonicalizeCountryName(alias), group.key] as const),
    ),
  ]),
};

function canonicalizeCountryName(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/\s+/g, "")
    .replace(/[().,·∙_/-]/g, "")
    .trim();
}

export function getSupportedCountryGroups(profile: CountryProfile = "short"): string[] {
  if (profile === "short") {
    return [...COUNTRY_GROUPS];
  }
  const withoutOther = COUNTRY_GROUPS.filter((group) => group !== "기타");
  return [...withoutOther, ...LONG_TERM_EXTRA_GROUPS.map((group) => group.key), "기타"];
}

export function normalizeCountryGroup(
  countryName: string,
  profile: CountryProfile = "short",
): {
  normalizedCountryKey: string;
  normalizedCountryLabel: string;
} {
  const canonicalCountryName = canonicalizeCountryName(countryName);
  const normalizedGroup = CANONICAL_ALIAS_TO_GROUP[profile].get(canonicalCountryName);
  if (normalizedGroup) {
    return {
      normalizedCountryKey: normalizedGroup,
      normalizedCountryLabel: normalizedGroup,
    };
  }

  return {
    normalizedCountryKey: "기타",
    normalizedCountryLabel: "기타",
  };
}

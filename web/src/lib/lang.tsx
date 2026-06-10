"use client";

import { createContext, useContext, useEffect, useState } from "react";

// Lightweight EN/Tagalog toggle for the civic-facing copy (hero, disclaimers,
// tier labels, map panel). Deliberately not an i18n framework: the static
// export has four pages, and the audience that most needs the plain-language
// reading is Filipino. Preference persists in localStorage.

export type Lang = "en" | "tl";

const LangContext = createContext<{ lang: Lang; setLang: (l: Lang) => void }>({
  lang: "en",
  setLang: () => {},
});

export function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    if (window.localStorage.getItem("tp-lang") === "tl") setLangState("tl");
  }, []);

  const setLang = (l: Lang) => {
    setLangState(l);
    window.localStorage.setItem("tp-lang", l);
    document.documentElement.lang = l === "tl" ? "fil" : "en";
  };

  return <LangContext.Provider value={{ lang, setLang }}>{children}</LangContext.Provider>;
}

export function useLang() {
  return useContext(LangContext);
}

export const STRINGS = {
  en: {
    heroKicker: "Open source · DPWH infrastructure · Sentinel-2",
    heroLine1: "Construction,",
    heroLine2: "from space.",
    heroSub:
      "Completed DPWH projects across the Philippines, mapped from public data and checked against free Sentinel-2 imagery for visible construction. Where the satellite sees it the map says so; where it does not, it says that too, a record of what is visible from space, never a claim about any project. Open source: clone it, point it at any country.",
    exploreMap: "Explore the map",
    browseChecks: "Browse satellite checks",
    disclaimer:
      "Satellite reads are automated change-detection on free 10m Sentinel-2 imagery and can be wrong: small or narrow structures, projects completed outside the imagery window, and persistent cloud cover are common reasons a genuinely built project shows little visible change. A flagged project is a prompt for review, never proof of wrongdoing. Every case needs ground-truth investigation before any conclusion is drawn. All figures are from the public DPWH record.",
    tierAll: "All mapped",
    tierNotVisible: "No construction visible",
    tierVerified: "Construction visible",
    tierPartial: "Partial signal",
    tierInconclusive: "Inconclusive",
    tierUnverified: "Not yet checked",
    mapPanelTitle: "Construction from space · Philippines",
    mapWithNoConstruction: "with no construction visible",
    mapAcross: (value: string, count: string) => `${value} across ${count} mapped projects`,
    mapPanelNote:
      "Red marks completed projects where 10m satellite shows no visible construction. A prompt to look, not proof: many were genuinely built but sit below clean optical detection. Figures from the public DPWH record.",
    modalFlagTitle: "No construction visible",
    modalFlagBody: (delta: string) =>
      `Reported complete, but 10m Sentinel-2 shows no new built-up here${delta}. That is a prompt to look closer, not proof the project is missing: narrow or small structures can be genuinely built yet sit below optical resolution.`,
    searchPlaceholder: "Search title, contractor, place…",
    searchLoading: "Search projects… (loading full record)",
  },
  tl: {
    heroKicker: "Open source · Imprastraktura ng DPWH · Sentinel-2",
    heroLine1: "Konstruksiyon,",
    heroLine2: "mula sa kalawakan.",
    heroSub:
      "Mga natapos na proyekto ng DPWH sa buong Pilipinas, minapa mula sa pampublikong datos at sinuri gamit ang libreng Sentinel-2 imagery kung may nakikitang konstruksiyon. Kapag nakikita ito ng satellite, sinasabi ng mapa; kapag hindi, sinasabi rin. Talaan ito ng kung ano ang nakikita mula sa kalawakan, hindi paratang sa anumang proyekto. Open source: maaari itong gamitin sa kahit anong bansa.",
    exploreMap: "Tingnan ang mapa",
    browseChecks: "Mga satellite check",
    disclaimer:
      "Ang mga basa ng satellite ay awtomatikong pagsusuri ng libreng 10m Sentinel-2 imagery at maaaring magkamali: ang maliliit o makikitid na istruktura, mga proyektong natapos sa labas ng saklaw ng imahe, at makapal na ulap ay karaniwang dahilan kung bakit hindi nakikita ang tunay na naitayong proyekto. Ang markadong proyekto ay paanyaya na suriin pa, hindi katibayan ng maling gawain. Bawat kaso ay nangangailangan ng aktwal na pagsisiyasat bago makapagbuo ng konklusyon. Lahat ng datos ay mula sa pampublikong talaan ng DPWH.",
    tierAll: "Lahat ng namapa",
    tierNotVisible: "Walang nakikitang konstruksiyon",
    tierVerified: "May nakikitang konstruksiyon",
    tierPartial: "Bahagyang senyales",
    tierInconclusive: "Walang malinaw na basa",
    tierUnverified: "Hindi pa nasusuri",
    mapPanelTitle: "Konstruksiyon mula sa kalawakan · Pilipinas",
    mapWithNoConstruction: "na walang nakikitang konstruksiyon",
    mapAcross: (value: string, count: string) => `${value} sa ${count} na namapang proyekto`,
    mapPanelNote:
      "Pula ang mga natapos na proyekto kung saan walang nakikitang konstruksiyon sa 10m na satellite. Paanyaya itong tumingin, hindi patunay: marami ang tunay na naitayo ngunit masyadong maliit para makita ng satellite. Mga datos mula sa pampublikong talaan ng DPWH.",
    modalFlagTitle: "Walang nakikitang konstruksiyon",
    modalFlagBody: (delta: string) =>
      `Naiulat na tapos, ngunit walang bagong built-up na nakikita ang 10m Sentinel-2 dito${delta}. Paanyaya itong suriin pa, hindi patunay na nawawala ang proyekto: ang makikitid o maliliit na istruktura ay maaaring tunay na naitayo ngunit hindi makita sa resolusyon ng satellite.`,
    searchPlaceholder: "Hanapin: pangalan, kontratista, lugar…",
    searchLoading: "Maghanap… (nilo-load ang buong talaan)",
  },
} as const;

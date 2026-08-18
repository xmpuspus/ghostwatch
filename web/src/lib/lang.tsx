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

// The dictionary is `as const`, so STRINGS.en and STRINGS.tl carry different
// literal types. A component that takes the active dictionary as a prop needs
// this union, never STRINGS["en"] alone.
export type Strings = (typeof STRINGS)[Lang];

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

    contractorsNav: "Contractors",
    contractorsKicker: "PCAB Resolution 075, s. 2025 · public record",
    contractorsTitle: "Nine firms lost their licences. Their sites are still on the map.",
    contractorsSub:
      "On 1 September 2025 the Philippine Contractors Accreditation Board revoked the contractor licences of nine firms. This page holds every DPWH contract in the public record that those firms won, and what free Sentinel-2 imagery shows at their completed flood-control sites.",
    contractorsStatFirms: "firms struck off",
    contractorsStatContracts: "DPWH contracts",
    contractorsStatValue: "contract value",
    contractorsStatNotVisible: "no construction visible",
    contractorsColContracts: "Contracts",
    contractorsColValue: "Value",
    contractorsColFlood: "Flood control",
    contractorsColChecked: "Checked from space",
    contractorsNoMarker: "DPWH does not stamp this firm as revoked in the record",
    contractorsMatchNote:
      "Contracts are matched on the PCAB registration number in the DPWH record, so a joint venture counts for both partners. The record's own revoked marker is a current status applied backward, and it is missing on some rows, so this page never relies on it.",
    contractorsDisclaimer:
      "A revoked licence is an administrative act about a firm. It is not a finding about any project on this page. The satellite reads mean what they mean on the map: no construction visible is a prompt to look closer, never proof a project is missing.",
    contractorsSitesTitle: "Completed flood-control sites, checked from space",
    contractorsOpenMap: "Open on the map",

    floodsNav: "Floods",
    floodsKicker: "Habagat, 06 to 13 August 2026 · PAGASA and PhilSA",
    floodsTitle: "The districts that flooded this month, and the flood control built there",
    floodsSub:
      "PAGASA put the southwest monsoon over Ilocos, Cagayan Valley, Abra, Benguet and Zambales from 6 to 13 August 2026, and PhilSA mapped the flood extent from Sentinel-1 radar. These are the DPWH engineering districts inside that area, with what the satellite shows at each completed flood-control site.",
    floodsStatDistricts: "districts in the flood area",
    floodsStatProjects: "flood-control sites",
    floodsStatNotVisible: "no construction visible",
    floodsStatValue: "value, no construction visible",
    floodsColDistrict: "District",
    floodsColProjects: "Sites",
    floodsColNotVisible: "No construction visible",
    floodsColValue: "Value",
    floodsMeasuredNote:
      "These sites were checked for visible construction, never for flood performance. No number on this page says a project failed.",
    floodsDisclaimer:
      "The overlap is geographic. It is not a claim that any project failed. Engineers build flood control to a return-period standard, a 200 mm day beats most of them by design, and a dike moves water downstream on purpose. These reads answer whether construction is visible, never whether it worked.",
    dataAsOf: "DPWH record as of",
    builtOn: "checked and baked on",
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

    contractorsNav: "Kontratista",
    contractorsKicker: "PCAB Resolution 075, s. 2025 · pampublikong talaan",
    contractorsTitle: "Siyam na kompanya ang nawalan ng lisensiya. Nasa mapa pa rin ang mga sityo nila.",
    contractorsSub:
      "Noong 1 Setyembre 2025, binawi ng Philippine Contractors Accreditation Board ang lisensiya ng siyam na kompanya. Nasa pahinang ito ang bawat kontrata ng DPWH sa pampublikong talaan na napanalunan ng mga kompanyang iyon, at kung ano ang ipinapakita ng libreng Sentinel-2 imagery sa kanilang mga natapos na proyekto sa flood control.",
    contractorsStatFirms: "kompanyang binawian",
    contractorsStatContracts: "kontrata sa DPWH",
    contractorsStatValue: "halaga ng kontrata",
    contractorsStatNotVisible: "walang nakikitang konstruksiyon",
    contractorsColContracts: "Kontrata",
    contractorsColValue: "Halaga",
    contractorsColFlood: "Flood control",
    contractorsColChecked: "Sinuri mula sa kalawakan",
    contractorsNoMarker: "Hindi minarkahan ng DPWH bilang binawian ang kompanyang ito sa talaan",
    contractorsMatchNote:
      "Ang mga kontrata ay tinutugma sa numero ng rehistro sa PCAB na nasa talaan ng DPWH, kaya ang isang joint venture ay binibilang para sa dalawang partner. Ang marka ng talaan mismo ay kasalukuyang katayuan na inilapat pabalik, at wala ito sa ilang tala, kaya hindi ito pinagkakatiwalaan ng pahinang ito.",
    contractorsDisclaimer:
      "Ang pagbawi ng lisensiya ay hakbang administratibo tungkol sa kompanya. Hindi ito hatol sa anumang proyekto sa pahinang ito. Ang basa ng satellite ay may parehong kahulugan tulad sa mapa: ang walang nakikitang konstruksiyon ay paanyaya na tumingin, hindi patunay na nawawala ang proyekto.",
    contractorsSitesTitle: "Mga natapos na proyekto sa flood control, sinuri mula sa kalawakan",
    contractorsOpenMap: "Buksan sa mapa",

    floodsNav: "Baha",
    floodsKicker: "Habagat, 06 hanggang 13 Agosto 2026 · PAGASA at PhilSA",
    floodsTitle: "Ang mga distritong binaha ngayong buwan, at ang flood control na itinayo doon",
    floodsSub:
      "Ayon sa PAGASA, tumama ang habagat sa Ilocos, Cagayan Valley, Abra, Benguet at Zambales mula 6 hanggang 13 Agosto 2026, at minapa ng PhilSA ang lawak ng baha gamit ang Sentinel-1 radar. Ito ang mga distrito ng inhinyeriya ng DPWH sa loob ng lugar na iyon, kasama ang ipinapakita ng satellite sa bawat natapos na proyekto sa flood control.",
    floodsStatDistricts: "distrito sa lugar ng baha",
    floodsStatProjects: "sityo ng flood control",
    floodsStatNotVisible: "walang nakikitang konstruksiyon",
    floodsStatValue: "halaga, walang nakikitang konstruksiyon",
    floodsColDistrict: "Distrito",
    floodsColProjects: "Sityo",
    floodsColNotVisible: "Walang nakikitang konstruksiyon",
    floodsColValue: "Halaga",
    floodsMeasuredNote:
      "Ang mga sityong ito ay sinuri kung may nakikitang konstruksiyon, hindi kung gumana laban sa baha. Walang numero rito na nagsasabing bumagsak ang isang proyekto.",
    floodsDisclaimer:
      "Heograpiko lamang ang pagkakapatong. Hindi ito paratang na bumagsak ang anumang proyekto. Ang flood control ay itinatayo ayon sa pamantayan ng return period, ang 200 mm na ulan sa isang araw ay lampas na sa disenyo ng karamihan, at ang dike ay talagang naglilipat ng tubig pababa. Ang basang ito ay tungkol sa kung nakikita ang konstruksiyon, hindi kung gumana ito.",
    dataAsOf: "Talaan ng DPWH noong",
    builtOn: "sinuri at inihanda noong",
  },
} as const;

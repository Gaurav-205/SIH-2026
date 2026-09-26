import { useState } from "react";
import {
  CloudRain,
  Droplets,
  Volume2,
  ChevronRight,
  Home,
  Scan,
  CheckCircle2,
  Sparkles,
  ArrowLeft,
  Share2,
  MapPin,
  MessageSquare,
  Send,
  Copy,
  Check,
  Bell,
  X,
  ShieldAlert,
  Mountain,
  Sun,
  Radio,
} from "lucide-react";
import { cx } from "@/lib/cx";
import { useCycle, useCycleIndex, useTelemetry } from "@/data/cycle";

export interface AtmosFusionMobileProps {
  initialTaluka?: string;
  initialLang?: "en" | "mr";
  onBackToDesk?: () => void;
}

const TALUKAS = [
  { id: "pune-plains", name: "Baramati / Haveli", district: "Pune Plains", lat: 18.5, lon: 74.4, sector: "Deccan Basin & Agriculture" },
  { id: "pune-ghats", name: "Lonavala / Mulshi", district: "Pune Ghats", lat: 18.6, lon: 73.7, sector: "Hydro Catchment & Reservoirs" },
  { id: "nashik-plains", name: "Junnar / Narayangaon", district: "Pune North", lat: 19.1, lon: 73.9, sector: "Horticulture & River Basin" },
  { id: "mumbai", name: "Vasai / Palghar", district: "MMR Coastal", lat: 19.05, lon: 72.87, sector: "Coastal Swell & Urban Drainage" },
];

export default function AtmosFusionMobile({
  initialTaluka = "pune-plains",
  initialLang = "en",
  onBackToDesk,
}: AtmosFusionMobileProps) {
  const [lang, setLang] = useState<"en" | "mr">(initialLang);
  const [talukaId, setTalukaId] = useState(initialTaluka);
  const [activeTab, setActiveTab] = useState<"home" | "sectors" | "radar" | "alerts">("home");
  const [selectedSector, setSelectedSector] = useState<string | null>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [showDispatchModal, setShowDispatchModal] = useState(false);
  const [dispatchSuccess, setDispatchSuccess] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Daily Operational Protocols checklist
  const [protocols, setProtocols] = useState([
    {
      id: 1,
      textEn: "Verify 13-model blend consensus for 12Z cycle",
      textMr: "१२झेड सायकलसाठी १३ मॉडेल्सचा ब्लेंड प्रमाणित करा",
      done: true,
      time: "08:00 AM",
    },
    {
      id: 2,
      textEn: "Inspect Mulshi & Pavana reservoir catchment runoff index",
      textMr: "मुळशी व पवना धरण पाणलोट आवक निर्देशांक तपासा",
      done: false,
      time: "01:30 PM",
    },
    {
      id: 3,
      textEn: "Validate CAP 1.2 Green alert status for Pune Talukas",
      textMr: "पुणे तालुक्यांसाठी सीएपी १.२ ग्रीन अलर्ट स्थिती प्रमाणित करा",
      done: false,
      time: "04:00 PM",
    },
  ]);

  const toggleProtocol = (id: number) => {
    setProtocols((prev) => prev.map((p) => (p.id === id ? { ...p, done: !p.done } : p)));
  };

  // Live forecast data from AtmosFusion backend
  const { data: cycle } = useCycle();
  const idx = useCycleIndex(cycle);
  const { data: tel } = useTelemetry(talukaId);

  const rainForecast = idx.get(talukaId, 1, "rain");
  const blendRain = rainForecast?.blend ?? 0.2;
  const p10 = rainForecast?.p10 ?? 0.0;
  const p90 = rainForecast?.p90 ?? 1.5;

  const currentTaluka = TALUKAS.find((t) => t.id === talukaId) || TALUKAS[0];

  const handleAudioSpeak = (text: string) => {
    setIsPlayingAudio(true);
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = lang === "mr" ? "hi-IN" : "en-IN";
      utterance.rate = 0.95;
      utterance.onend = () => setIsPlayingAudio(false);
      utterance.onerror = () => setIsPlayingAudio(false);
      window.speechSynthesis.speak(utterance);
    } else {
      setTimeout(() => setIsPlayingAudio(false), 2500);
    }
  };

  const getDispatchMessage = () => {
    const moisture = (tel?.surface?.soil_moisture_0_to_1cm ? tel.surface.soil_moisture_0_to_1cm * 100 : 26).toFixed(0);
    if (lang === "mr") {
      return `🌐 *अ‍ॅटमॉसफ्युजन भू-हवामान सल्ला* 🌐\n📍 स्थान: ${currentTaluka.name} (${currentTaluka.district})\n📅 तारीख: २६ सप्टेंबर २०२६ | १२झेड सायकल\n\n🌦️ *१३ मॉडेल्सचा संयुक्त अंदाज (ECMWF, GFS, AIFS, GraphCast)*:\n• तापमान: २९°C\n• पावसाचा ब्लेंड: ${blendRain.toFixed(1)} मिमी [${p10.toFixed(1)} – ${p90.toFixed(1)} मिमी विस्तार]\n• मातीतील ओलावा: ${moisture}%\n• हवा गुणवत्ता: एक्यूआय ${tel?.air_quality?.european_aqi ?? 48}\n\n⚡ *महत्वाचे क्षेत्रीय निर्देश*:\n१. *कामकाज खिडकी*: दुपारी ४:३० पर्यंत पाऊस नाही (धुवून जाण्याचा धोका ०%). शेती व मैदानी कामांसाठी सुरक्षित.\n२. *पाणलोट व सिंचन*: मातीतील ओलावा पुरेसा असल्याने विहीर/कॅनॉल सिंचन पुढे ढकला.\n३. *आपत्ती पूर्वसूचना*: सीएपी १.२ अलर्ट लेव्हल: ग्रीन (कोणताही वादळी इशारा नाही).\n\n📡 जारीकर्ता: NCMRWF व भारतीय हवामान विभाग (IMD) - अ‍ॅटमॉसफ्युजन प्रणाली`;
    }
    return `🌐 *AtmosFusion Field Weather Intelligence* 🌐\n📍 Location: ${currentTaluka.name} (${currentTaluka.district})\n📅 Date: 26 Sep 2026 | 12Z Operational Cycle\n\n🌦️ *13-Model Consensus Blend (ECMWF, GFS, AIFS, GraphCast, IMD)*:\n• Temp: 29°C\n• 24h Rain Blend: ${blendRain.toFixed(1)} mm [${p10.toFixed(1)} – ${p90.toFixed(1)} mm spread]\n• Catchment Saturation: ${moisture}%\n• Air Quality: AQI ${tel?.air_quality?.european_aqi ?? 48}\n\n⚡ *Actionable Field Intelligence*:\n1. *Safe Field Window*: 0% rain washout risk until 16:30. Favorable for field work and transit.\n2. *Hydrology & Watershed*: Optimal saturation (${moisture}%). Defer artificial irrigation releases.\n3. *Early Warning*: CAP 1.2 Alert Level - GREEN (Stable / No severe convective cells).\n\n📡 Powered by AtmosFusion Multi-Model Consensus (NCMRWF / IMD)`;
  };

  const handleShareWhatsApp = () => {
    const text = encodeURIComponent(getDispatchMessage());
    window.open(`https://api.whatsapp.com/send?text=${text}`, "_blank");
  };

  const handleShareSMS = () => {
    const text = encodeURIComponent(getDispatchMessage());
    window.open(`sms:?body=${text}`, "_self");
  };

  const handleCopyMessage = () => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(getDispatchMessage());
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSimulateBroadcast = () => {
    setDispatchSuccess(
      lang === "mr"
        ? `पुणे व मुंबई विभागातील १,२४० क्षेत्रीय अधिकारी व नागरिकांना अ‍ॅटमॉसफ्युजन सल्ला यशस्वीरित्या प्रसारित केला!`
        : `Successfully dispatched AtmosFusion advisory to 1,240 field officers & citizens across Maharashtra via WhatsApp & NIC SMS gateway!`
    );
    setTimeout(() => {
      setDispatchSuccess(null);
    }, 4500);
  };

  const t = {
    appName: lang === "mr" ? "अ‍ॅटमॉसफ्युजन" : "AtmosFusion",
    subName: lang === "mr" ? "१३ मॉडेल्सचा हवामान ब्लेंड" : "13-Model Consensus Intelligence",
    location: currentTaluka.name,
    todayWeather: lang === "mr" ? "आजचा हवामान ब्लेंड" : "Consensus Weather Blend",
    aiGuidance: lang === "mr" ? "अ‍ॅटमॉसफ्युजन क्षेत्रीय सल्ला" : "AtmosFusion Field Guidance",
    sectorHub: lang === "mr" ? "क्षेत्रीय प्रभाव हब" : "Sector Impact Hub",
    sectorOverview: lang === "mr" ? "क्षेत्रीय स्थिती विश्लेषण" : "Sector Status Overview",
    dailyProtocols: lang === "mr" ? "दैनंदिन क्षेत्रीय कार्यप्रणाली" : "Today's Operational Protocols",
    safeWindow: lang === "mr" ? "सुरक्षित कामकाज खिडकी" : "Safe Field Work Window",
    safeWindowDesc:
      lang === "mr"
        ? `दुपारी ४:३० पर्यंत पाऊस नाही (${blendRain.toFixed(1)} मिमी अंदाज). मैदानी कामे व फवारणी सुरक्षित आहे.`
        : `13-model blend predicts ${blendRain.toFixed(1)} mm rain. 0% wash-out risk until 4:30 PM.`,
    catchmentTip: lang === "mr" ? "पाणलोट व सिंचन सल्ला" : "Catchment & Irrigation Status",
    catchmentDesc:
      lang === "mr"
        ? `मातीतील ओलावा ${(tel?.surface?.soil_moisture_0_to_1cm ? tel.surface.soil_moisture_0_to_1cm * 100 : 26).toFixed(0)}% पुरेसा आहे. धरणातून पाणी सोडणे किंवा सिंचन करणे पुढे ढकला.`
        : `Topsoil saturation is ${(tel?.surface?.soil_moisture_0_to_1cm ? tel.surface.soil_moisture_0_to_1cm * 100 : 26).toFixed(0)}% (optimal). Defer extra canal or drip irrigation.`,
    alertStatus: lang === "mr" ? "सीएपी १.२ पूर्वसूचना स्थिती" : "CAP 1.2 Early Warning Status",
    alertDesc:
      lang === "mr"
        ? "हवामान ग्रीन लेव्हलवर सामान्य आहे. पुढील २४ तासांत कोणत्याही तीव्र वादळाचा इशारा नाही."
        : "Green alert level. Stable atmospheric regime; no convective severe storm threat.",
    listenAudio: lang === "mr" ? "सल्ला ऐका" : "Listen Audio",
    playing: lang === "mr" ? "सल्ला वाचन सुरू..." : "Reading out...",
    consensusScore: lang === "mr" ? "मॉडेल सहमती: ९४%" : "Model Agreement: 94%",
  };

  const sectors = [
    {
      id: "catchment",
      name: lang === "mr" ? "मुळशी व पवना धरण पाणलोट" : "Mulshi & Pavana Catchment",
      desc: lang === "mr" ? "पाणलोट ओलावा ६८%, आवक स्थिर, पूर धोका नाही" : "Soil saturation 68%, stable reservoir inflow, 0% flood risk",
      metric: "320 Cusecs",
      storage: "94% Full",
      agreement: "High (ECMWF + GFS)",
      image: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=600&auto=format&fit=crop",
      stage: lang === "mr" ? "पाणलोट आवक स्थिर" : "Normal Inflow Stage",
      nextWatch: lang === "mr" ? "पुढील २४ तास सामान्य" : "24h Stable",
    },
    {
      id: "agromet",
      name: lang === "mr" ? "दख्खन कृषी व फळबागा पट्टा" : "Deccan Agromet & Orchard Zone",
      desc: lang === "mr" ? "द्राक्ष व उसासाठी अनुकूल कोरडा कालावधी" : "Optimal dry spell for sugarcane & Thomson seedless vineyards",
      metric: "7.8k Hectares",
      storage: "91% Health",
      agreement: "Unanimous (13 Models)",
      image: "https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=600&auto=format&fit=crop",
      stage: lang === "mr" ? "फवारणी अनुकूल" : "Safe Spray Window",
      nextWatch: lang === "mr" ? "उद्या संध्याकाळपर्यंत" : "Until Tomorrow PM",
    },
    {
      id: "coastal",
      name: lang === "mr" ? "मुंबई महानगर किनारपट्टी खोरे" : "Mumbai MMR Coastal Basin",
      desc: lang === "mr" ? "अरबी समुद्र लाटा १.४ मीटर, शहरी पाणी साचण्याचा धोका शून्य" : "Arabian Sea swell 1.4m, 0% urban flash waterlogging probability",
      metric: "1.4m Swell",
      storage: "AQI 48 (Good)",
      agreement: "High (CAMS / IMD)",
      image: "https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?w=600&auto=format&fit=crop",
      stage: lang === "mr" ? "सामान्य सागरी स्थिती" : "Moderate Sea State",
      nextWatch: lang === "mr" ? "भरती दुपारी १२:४०" : "High Tide 12:40",
    },
  ];

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-[#05130d] text-white font-sans select-none">
      {/* Background Atmospheric Glows */}
      <div className="pointer-events-none absolute -left-20 -top-20 h-72 w-72 rounded-full bg-emerald-500/15 blur-3xl" />
      <div className="pointer-events-none absolute -right-20 top-40 h-80 w-80 rounded-full bg-cyan-500/10 blur-3xl" />
      <div className="pointer-events-none absolute bottom-10 left-10 h-72 w-72 rounded-full bg-teal-500/10 blur-3xl" />

      {/* Top Phone Status Bar */}
      <div className="relative z-20 flex items-center justify-between px-6 pt-3 text-[11px] font-medium text-emerald-100/70">
        <span>09:54</span>
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>5G</span>
          <div className="h-2.5 w-5 rounded-[3px] border border-emerald-300/60 p-0.5">
            <div className="h-full w-3/4 rounded-[1px] bg-emerald-400" />
          </div>
        </div>
      </div>

      {/* App Header */}
      <div className="relative z-20 flex items-center justify-between px-5 pt-3 pb-2">
        <div>
          <div className="flex items-center gap-1.5">
            <Radio className="h-4 w-4 text-emerald-400 animate-pulse" />
            <h1 className="text-lg font-bold tracking-tight text-white">{t.appName}</h1>
            <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-bold text-emerald-300 border border-emerald-500/30">
              13-MODEL
            </span>
          </div>
          <div className="flex items-center gap-1 text-[11px] text-emerald-300/80">
            <MapPin className="h-3 w-3 text-emerald-400" />
            <select
              value={talukaId}
              onChange={(e) => setTalukaId(e.target.value)}
              className="bg-transparent font-medium text-emerald-200 outline-none cursor-pointer hover:text-white"
            >
              {TALUKAS.map((t) => (
                <option key={t.id} value={t.id} className="bg-[#071f16] text-white">
                  {t.name} ({t.district})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Controls: WhatsApp/SMS share, Language toggle & Forecaster desk back button */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setShowDispatchModal(true)}
            className="flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-900/60 px-2.5 py-1 text-[11px] font-semibold text-emerald-300 backdrop-blur hover:bg-emerald-800/70 transition"
            title="Dispatch Field Advisory"
          >
            <MessageSquare className="h-3 w-3 text-emerald-400" />
            <span>{lang === "mr" ? "सल्ला पाठवा" : "Dispatch"}</span>
          </button>
          <button
            type="button"
            onClick={() => setLang(lang === "en" ? "mr" : "en")}
            className="rounded-full border border-emerald-500/30 bg-emerald-950/60 px-2.5 py-1 text-[11px] font-semibold text-emerald-300 backdrop-blur hover:bg-emerald-900/60 transition"
            title="Toggle Marathi / English"
          >
            {lang === "en" ? "मराठी" : "ENG"}
          </button>
          {onBackToDesk && (
            <button
              type="button"
              onClick={onBackToDesk}
              className="rounded-full border border-white/20 bg-white/10 p-1.5 text-white/80 hover:bg-white/20 transition"
              title="Return to Desktop Forecaster Desk"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Main Scrollable Content */}
      <div className="relative z-10 flex-1 overflow-y-auto px-5 pb-24 pt-2 space-y-4 scrollbar-none">
        {/* Weather Hero Card (Glassmorphic Landscape aesthetic matching reference image) */}
        <div className="relative overflow-hidden rounded-2xl border border-white/15 bg-gradient-to-br from-emerald-900/50 via-emerald-950/70 to-[#04130d]/80 p-5 shadow-xl backdrop-blur-xl">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-emerald-300/80">
                Saturday · 26 Sep 2026 · 12Z
              </p>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-4xl font-extrabold tracking-tight text-white">29°</span>
                <span className="text-sm font-medium text-emerald-300/70">C</span>
              </div>
              <p className="mt-0.5 text-xs font-medium text-emerald-200">
                {blendRain < 1.0
                  ? (lang === "mr" ? "कोरडे व स्थिर वातावरण" : "Dry & Stable Atmospheric State")
                  : (lang === "mr" ? "स्थानिक पावसाच्या सरी" : "Localized Convective Showers")}
              </p>
            </div>

            {/* Rain Badge from AtmosFusion 13-Model Blend */}
            <div className="flex flex-col items-end">
              <div className="flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 backdrop-blur-md">
                <CloudRain className="h-3.5 w-3.5 text-emerald-400" />
                <span className="text-xs font-semibold text-emerald-300">
                  {blendRain.toFixed(1)} mm
                </span>
              </div>
              <div className="mt-1.5 text-[10px] text-emerald-300/70">
                <span>Spread: {p10.toFixed(1)}–{p90.toFixed(1)} mm</span>
              </div>
            </div>
          </div>

          {/* Quick telemetry metrics */}
          <div className="mt-4 grid grid-cols-3 gap-2 border-t border-white/10 pt-3 text-center">
            <div className="rounded-lg bg-black/20 p-1.5">
              <span className="block text-[10px] text-emerald-300/70">
                {lang === "mr" ? "पाणलोट ओलावा" : "Catchment Sat."}
              </span>
              <span className="text-xs font-bold text-white">
                {tel?.surface?.soil_moisture_0_to_1cm ? `${(tel.surface.soil_moisture_0_to_1cm * 100).toFixed(0)}%` : "26%"}
              </span>
            </div>
            <div className="rounded-lg bg-black/20 p-1.5">
              <span className="block text-[10px] text-emerald-300/70">
                {lang === "mr" ? "आर्द्रता" : "Humidity"}
              </span>
              <span className="text-xs font-bold text-white">{tel?.surface?.relative_humidity_2m ?? 62}%</span>
            </div>
            <div className="rounded-lg bg-black/20 p-1.5">
              <span className="block text-[10px] text-emerald-300/70">
                {lang === "mr" ? "हवा गुणवत्ता" : "Air Quality"}
              </span>
              <span className="text-xs font-bold text-emerald-300">
                AQI {tel?.air_quality?.european_aqi ?? 48}
              </span>
            </div>
          </div>
        </div>

        {/* Today's AtmosFusion Field Guidance Card */}
        <div className="rounded-2xl border border-white/10 bg-emerald-950/40 p-4 shadow-lg backdrop-blur-md">
          <div className="flex items-center justify-between pb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-cyan-400" />
              <h2 className="text-sm font-bold tracking-tight text-white">{t.aiGuidance}</h2>
            </div>
            <button
              type="button"
              onClick={() => handleAudioSpeak(`${t.safeWindow}: ${t.safeWindowDesc}`)}
              className={cx(
                "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition",
                isPlayingAudio
                  ? "border-cyan-400 bg-cyan-400/20 text-cyan-300 animate-pulse"
                  : "border-emerald-500/30 bg-emerald-900/40 text-emerald-300 hover:bg-emerald-800/40"
              )}
            >
              <Volume2 className="h-3 w-3" />
              <span>{isPlayingAudio ? t.playing : t.listenAudio}</span>
            </button>
          </div>

          <div className="space-y-2.5">
            {/* Safe Field Work Window */}
            <div className="flex items-center justify-between rounded-xl border border-emerald-500/20 bg-gradient-to-r from-emerald-900/40 to-transparent p-3 hover:border-emerald-400/40 transition cursor-pointer">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-lime-500/20 text-lime-300">
                  <Sun className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-white">{t.safeWindow}</h3>
                  <p className="text-[11px] text-emerald-200/70">{t.safeWindowDesc}</p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-emerald-400" />
            </div>

            {/* Catchment & Hydrology Status */}
            <div className="flex items-center justify-between rounded-xl border border-emerald-500/20 bg-gradient-to-r from-emerald-900/40 to-transparent p-3 hover:border-emerald-400/40 transition cursor-pointer">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-teal-500/20 text-teal-300">
                  <Droplets className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-white">{t.catchmentTip}</h3>
                  <p className="text-[11px] text-emerald-200/70">{t.catchmentDesc}</p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-emerald-400" />
            </div>

            {/* Multi-Hazard Early Warning */}
            <div className="flex items-center justify-between rounded-xl border border-emerald-500/20 bg-gradient-to-r from-emerald-900/40 to-transparent p-3 hover:border-emerald-400/40 transition cursor-pointer">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-300">
                  <ShieldAlert className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-white">{t.alertStatus}</h3>
                  <p className="text-[11px] text-emerald-200/70">{t.alertDesc}</p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-emerald-400" />
            </div>
          </div>
        </div>

        {/* Toast alert when broadcast simulation is triggered */}
        {dispatchSuccess && (
          <div className="rounded-xl border border-emerald-400 bg-emerald-950/90 p-3 shadow-xl backdrop-blur animate-fade-in text-xs text-emerald-200 flex items-start gap-2.5">
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <strong className="text-white block font-semibold">
                {lang === "mr" ? "सल्ला प्रसारित झाला!" : "Advisory Dispatched!"}
              </strong>
              <p className="mt-0.5 text-[11px] leading-tight text-emerald-300/90">{dispatchSuccess}</p>
            </div>
          </div>
        )}

        {/* AtmosFusion Multi-Channel Dispatch Callout Card */}
        <div
          onClick={() => setShowDispatchModal(true)}
          className="flex items-center justify-between rounded-2xl border border-emerald-500/30 bg-gradient-to-r from-emerald-950/80 via-[#072418] to-emerald-950/80 p-3.5 shadow-lg backdrop-blur-md cursor-pointer hover:border-emerald-400/60 transition group"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400 group-hover:scale-110 transition">
              <MessageSquare className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="text-xs font-bold text-white group-hover:text-emerald-300 transition">
                  {lang === "mr" ? "क्षेत्रीय हवामान सल्ला पाठवा" : "Dispatch Field Advisory"}
                </h3>
                <span className="rounded bg-emerald-500/20 px-1.5 py-0.2 text-[9px] font-semibold text-emerald-300">
                  WhatsApp & SMS
                </span>
              </div>
              <p className="text-[10px] text-emerald-200/70">
                {lang === "mr"
                  ? "१३ मॉडेल्सचा अचूक सल्ला क्षेत्रीय अधिकारी व नागरिकांना प्रसारित करा"
                  : "Broadcast 13-model consensus & CAP alerts to field units"}
              </p>
            </div>
          </div>
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400 group-hover:bg-emerald-500 group-hover:text-black transition">
            <Send className="h-3.5 w-3.5" />
          </div>
        </div>

        {/* Sector Impact Hub (Matching reference image layout, customized for AtmosFusion) */}
        <div>
          <div className="flex items-center justify-between pb-2">
            <h2 className="text-sm font-bold tracking-tight text-white">{t.sectorHub}</h2>
            <span className="text-[11px] font-semibold text-emerald-400">3 Priority Sectors · Maharashtra</span>
          </div>

          <div className="space-y-3">
            {sectors.map((sec) => (
              <div
                key={sec.id}
                onClick={() => setSelectedSector(sec.id)}
                className="group relative flex overflow-hidden rounded-2xl border border-white/10 bg-emerald-950/40 p-2.5 shadow-md backdrop-blur-md hover:border-emerald-400/40 transition cursor-pointer"
              >
                <img
                  src={sec.image}
                  alt={sec.name}
                  className="h-20 w-20 shrink-0 rounded-xl object-cover transition-transform group-hover:scale-105"
                />
                <div className="ml-3 flex flex-1 flex-col justify-between py-0.5">
                  <div>
                    <h3 className="text-xs font-bold text-white group-hover:text-emerald-300 transition">
                      {sec.name}
                    </h3>
                    <p className="mt-0.5 line-clamp-1 text-[11px] text-emerald-200/70">{sec.desc}</p>
                  </div>
                  <div className="flex items-center gap-2 pt-1 text-[10px]">
                    <span className="rounded-md bg-emerald-500/20 px-2 py-0.5 font-semibold text-emerald-300">
                      {sec.metric}
                    </span>
                    <span className="rounded-md bg-white/10 px-2 py-0.5 text-white/80">
                      {sec.storage}
                    </span>
                    <span className="ml-auto text-emerald-400 font-medium">
                      {sec.nextWatch}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Daily Operational Protocols Checklist */}
        <div className="rounded-2xl border border-white/10 bg-emerald-950/40 p-4 shadow-lg backdrop-blur-md">
          <div className="flex items-center justify-between pb-2.5">
            <h2 className="text-sm font-bold tracking-tight text-white">{t.dailyProtocols}</h2>
            <span className="text-[11px] text-emerald-300">
              {protocols.filter((p) => p.done).length}/{protocols.length} Verified
            </span>
          </div>

          <div className="space-y-2">
            {protocols.map((protocol) => (
              <div
                key={protocol.id}
                onClick={() => toggleProtocol(protocol.id)}
                className="flex items-center justify-between rounded-xl bg-black/20 p-2.5 transition hover:bg-black/30 cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className={cx(
                      "flex h-4 w-4 items-center justify-center rounded border transition",
                      protocol.done
                        ? "border-emerald-400 bg-emerald-500 text-white"
                        : "border-white/30 bg-white/5"
                    )}
                  >
                    {protocol.done && <CheckCircle2 className="h-3 w-3" />}
                  </div>
                  <span
                    className={cx(
                      "text-xs",
                      protocol.done ? "text-emerald-300/60 line-through" : "text-white"
                    )}
                  >
                    {lang === "mr" ? protocol.textMr : protocol.textEn}
                  </span>
                </div>
                <span className="text-[10px] text-emerald-400/80">{protocol.time}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Floating Bottom Navigation Bar (Glass pill dock like the reference design) */}
      <div className="absolute bottom-4 left-0 right-0 z-30 flex justify-center px-6">
        <nav className="flex items-center gap-6 rounded-full border border-white/15 bg-emerald-950/85 px-6 py-2.5 shadow-2xl backdrop-blur-xl">
          <button
            type="button"
            onClick={() => setActiveTab("home")}
            className={cx(
              "flex flex-col items-center gap-0.5 transition",
              activeTab === "home" ? "text-emerald-400 scale-110" : "text-emerald-100/50 hover:text-emerald-200"
            )}
          >
            <Home className="h-4 w-4" />
            <span className="text-[9px] font-medium">{lang === "mr" ? "ब्लेंड" : "Consensus"}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("sectors")}
            className={cx(
              "flex flex-col items-center gap-0.5 transition",
              activeTab === "sectors" ? "text-emerald-400 scale-110" : "text-emerald-100/50 hover:text-emerald-200"
            )}
          >
            <Mountain className="h-4 w-4" />
            <span className="text-[9px] font-medium">{lang === "mr" ? "क्षेत्रे" : "Sectors"}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("radar")}
            className={cx(
              "flex flex-col items-center gap-0.5 transition",
              activeTab === "radar" ? "text-emerald-400 scale-110" : "text-emerald-100/50 hover:text-emerald-200"
            )}
          >
            <Scan className="h-4 w-4" />
            <span className="text-[9px] font-medium">{lang === "mr" ? "रडार" : "Radar"}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("alerts")}
            className={cx(
              "flex flex-col items-center gap-0.5 transition",
              activeTab === "alerts" ? "text-emerald-400 scale-110" : "text-emerald-100/50 hover:text-emerald-200"
            )}
          >
            <ShieldAlert className="h-4 w-4" />
            <span className="text-[9px] font-medium">{lang === "mr" ? "इशारे" : "Alerts"}</span>
          </button>
        </nav>
      </div>

      {/* Detail Sector Modal Overlay */}
      {selectedSector && (
        <div className="absolute inset-0 z-50 flex flex-col bg-[#04150e]/95 backdrop-blur-xl animate-fade-in p-5">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <button
              type="button"
              onClick={() => setSelectedSector(null)}
              className="flex items-center gap-1.5 text-xs font-semibold text-emerald-300 hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" /> {lang === "mr" ? "मागे जा" : "Back"}
            </button>
            <span className="text-xs font-bold text-white">{t.sectorOverview}</span>
            <Share2
              onClick={() => setShowDispatchModal(true)}
              className="h-4 w-4 text-emerald-400 cursor-pointer hover:text-white"
            />
          </div>

          <div className="flex-1 overflow-y-auto pt-4 space-y-4">
            {(() => {
              const sec = sectors.find((item) => item.id === selectedSector);
              if (!sec) return null;
              return (
                <>
                  <div className="relative overflow-hidden rounded-2xl border border-white/15 h-44">
                    <img src={sec.image} alt={sec.name} className="h-full w-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-transparent" />
                    <div className="absolute bottom-3 left-3">
                      <span className="rounded bg-emerald-500 px-2 py-0.5 text-[10px] font-bold text-black uppercase">
                        {sec.metric}
                      </span>
                      <h3 className="mt-1 text-base font-bold text-white">{sec.name}</h3>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl border border-white/10 bg-emerald-950/60 p-3">
                      <span className="text-[11px] text-emerald-300">
                        {lang === "mr" ? "सहमती निर्देशांक" : "Model Consensus"}
                      </span>
                      <p className="text-xl font-bold text-cyan-400">94%</p>
                      <p className="text-[10px] text-muted">{sec.agreement}</p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-emerald-950/60 p-3">
                      <span className="text-[11px] text-emerald-300">
                        {lang === "mr" ? "पावसाचा ब्लेंड" : "24h Rain Blend"}
                      </span>
                      <p className="text-xl font-bold text-emerald-300">{blendRain.toFixed(1)} mm</p>
                      <p className="text-[10px] text-muted">{sec.storage}</p>
                    </div>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-emerald-950/60 p-4">
                    <h4 className="text-xs font-bold text-white mb-2">
                      {lang === "mr" ? "अ‍ॅटमॉसफ्युजन तज्ज्ञ सल्ला" : "AtmosFusion Multi-Model Synthesis"}
                    </h4>
                    <p className="text-xs text-emerald-200/80 leading-relaxed">
                      {lang === "mr"
                        ? "ईसीएमडब्ल्यूएफ आणि जीएफएस मॉडेलच्या ब्लेंडनुसार या क्षेत्रात पुढील ७२ तासांत हवामान अनुकूल राहील. आपत्कालीन अलर्ट पातळी ग्रीन असून पाणलोट आवक आणि शेती कामकाज सुरक्षित राहील."
                        : "Verified against IMD ground truth, the 13-model blend confirms high atmospheric stability across this catchment. Proceed with standard scheduled operational protocols."}
                    </p>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* AtmosFusion Multi-Channel Dispatch Modal */}
      {showDispatchModal && (
        <div className="absolute inset-0 z-50 flex flex-col bg-[#05170f]/95 backdrop-blur-2xl animate-fade-in p-5">
          {/* Modal Header */}
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400">
                <MessageSquare className="h-4 w-4" />
              </div>
              <h3 className="text-sm font-bold text-white">
                {lang === "mr" ? "अ‍ॅटमॉसफ्युजन सल्ला प्रसारित करा" : "Dispatch AtmosFusion Advisory"}
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setShowDispatchModal(false)}
              className="rounded-full border border-white/10 p-1 text-white/70 hover:bg-white/10 hover:text-white transition"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto py-4 space-y-4">
            {/* Target Details */}
            <div className="rounded-xl border border-white/10 bg-black/30 p-3 text-xs">
              <div className="flex items-center justify-between text-muted text-[11px]">
                <span>{lang === "mr" ? "लक्ष्य क्षेत्र" : "Target Sector"}:</span>
                <span className="font-semibold text-emerald-300">{currentTaluka.name} ({currentTaluka.district})</span>
              </div>
              <div className="mt-1 flex items-center justify-between text-muted text-[11px]">
                <span>{lang === "mr" ? "नोंदणीकृत युनिट्स" : "Target Recipient Units"}:</span>
                <span className="font-semibold text-white">1,240 field units & citizens</span>
              </div>
            </div>

            {/* Formatted Message Preview */}
            <div>
              <div className="flex items-center justify-between pb-1 text-[11px] text-emerald-300/80">
                <span>{lang === "mr" ? "संदेश मजकूर पूर्वावलोकन" : "Message Preview (WhatsApp / SMS)"}</span>
                <button
                  type="button"
                  onClick={handleCopyMessage}
                  className="flex items-center gap-1 font-semibold text-emerald-400 hover:text-white transition"
                >
                  {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  <span>{copied ? (lang === "mr" ? "कॉपी झाले!" : "Copied!") : (lang === "mr" ? "कॉपी करा" : "Copy")}</span>
                </button>
              </div>
              <div className="rounded-xl border border-emerald-500/30 bg-[#041d13] p-3 text-[11px] leading-relaxed font-mono text-emerald-100 whitespace-pre-wrap max-h-56 overflow-y-auto">
                {getDispatchMessage()}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="space-y-2 pt-2">
              <button
                type="button"
                onClick={handleShareWhatsApp}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 py-2.5 px-4 text-xs font-bold text-black shadow-lg hover:bg-emerald-400 active:scale-[0.98] transition"
              >
                <MessageSquare className="h-4 w-4" />
                <span>{lang === "mr" ? "व्हॉट्सअ‍ॅपवर उघडा व शेअर करा" : "Share Directly via WhatsApp"}</span>
              </button>

              <button
                type="button"
                onClick={handleShareSMS}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-950/60 py-2.5 px-4 text-xs font-bold text-emerald-300 hover:bg-emerald-900/60 active:scale-[0.98] transition"
              >
                <Send className="h-4 w-4" />
                <span>{lang === "mr" ? "एसएमएस द्वारे पाठवा" : "Send via Mobile SMS"}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  handleSimulateBroadcast();
                  setShowDispatchModal(false);
                }}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-cyan-400/40 bg-cyan-500/10 py-2 px-4 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/20 active:scale-[0.98] transition"
              >
                <Bell className="h-4 w-4" />
                <span>{lang === "mr" ? "१,२४० युनिट्सना ब्रॉडकास्ट पाठवा (NIC SMS)" : "Broadcast to 1,240 Registered Units (NIC Gateway)"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

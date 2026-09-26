import { useState } from "react";
import {
  CloudRain,
  Volume2,
  ChevronRight,
  Home,
  Scan,
  ArrowLeft,
  MapPin,
  MessageSquare,
  Send,
  Copy,
  Check,
  Bell,
  X,
  SlidersHorizontal,
  MoreHorizontal,
  BarChart3,
  Crosshair,
  Sprout,
  Droplets,
  Bug,
  LayoutGrid,
} from "lucide-react";
import { cx } from "@/lib/cx";
import { useCycle, useCycleIndex, useTelemetry } from "@/data/cycle";

export type MobileScreen = "home" | "hub" | "overview" | "distribution" | "activities";

export interface AtmosFusionMobileProps {
  initialScreen?: MobileScreen;
  initialTaluka?: string;
  initialLang?: "en" | "mr";
  onBackToDesk?: () => void;
  onScreenChange?: (screen: MobileScreen) => void;
}

const TALUKAS = [
  { id: "pune-plains", name: "Baramati / Haveli", district: "Pune Plains", lat: 18.5, lon: 74.4, sector: "Deccan Basin & Agromet" },
  { id: "pune-ghats", name: "Lonavala / Mulshi", district: "Pune Ghats", lat: 18.6, lon: 73.7, sector: "Hydro Catchment & Reservoirs" },
  { id: "nashik-plains", name: "Junnar / Narayangaon", district: "Pune North", lat: 19.1, lon: 73.9, sector: "Horticulture & River Basin" },
  { id: "mumbai", name: "Vasai / Palghar", district: "MMR Coastal", lat: 19.05, lon: 72.87, sector: "Coastal Swell & Urban Drainage" },
];

export default function AtmosFusionMobile({
  initialScreen = "home",
  initialTaluka = "pune-plains",
  initialLang = "en",
  onBackToDesk,
  onScreenChange,
}: AtmosFusionMobileProps) {
  const [screen, setScreenState] = useState<MobileScreen>(initialScreen);
  const [lang, setLang] = useState<"en" | "mr">(initialLang);
  const [talukaId, setTalukaId] = useState(initialTaluka);
  const [selectedHub, setSelectedHub] = useState<string>("potato");
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [showDispatchModal, setShowDispatchModal] = useState(false);
  const [dispatchSuccess, setDispatchSuccess] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [overviewTab, setOverviewTab] = useState<"stats" | "scan">("stats");

  const setScreen = (newScreen: MobileScreen) => {
    setScreenState(newScreen);
    onScreenChange?.(newScreen);
  };

  // Today Activities interactive checklist state (Matching Screen 5 in reference image)
  const [activities, setActivities] = useState([
    {
      id: 1,
      textEn: "Give water to Tomato at 8:00 AM",
      textMr: "टोमॅटो पिकास सकाळी ८:०० वा. पाणी द्या",
      done: true,
      time: "8:00 AM",
    },
    {
      id: 2,
      textEn: "Spray Neem oil at 10 AM",
      textMr: "सकाळी १०:०० वा. कडुनिंब तेल फवारणी करा",
      done: false,
      time: "10:00 AM",
    },
    {
      id: 3,
      textEn: "Check soil moisture at 11 AM",
      textMr: "सकाळी ११:०० वा. मातीतील ओलावा तपासा",
      done: false,
      time: "11:00 AM",
    },
  ]);

  const toggleActivity = (id: number) => {
    setActivities((prev) => prev.map((a) => (a.id === id ? { ...a, done: !a.done } : a)));
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
        : `Successfully dispatched AtmosFusion advisory to 1,240 field units & citizens across Maharashtra via WhatsApp & NIC SMS gateway!`
    );
    setTimeout(() => {
      setDispatchSuccess(null);
    }, 4500);
  };

  // Translations dictionary
  const t = {
    appName: "AtmosFusion",
    location: currentTaluka.name,
    todayWeather: lang === "mr" ? "आजचे हवामान" : "Today's Weather",
    aiSuggestion: lang === "mr" ? "आजचा एआय सल्ला" : "Today's AI Suggestion",
    myCultivationHub: lang === "mr" ? "माझे कृषी हब" : "My Cultivation Hub",
    cropOverview: lang === "mr" ? "बटाटा पीक विहंगावलोकन" : "Potato Crop Overview",
    overviewStats: lang === "mr" ? "आकडेवारी" : "Overview Stats",
    scanOverview: lang === "mr" ? "स्कॅन विश्लेषण" : "Scan Overview",
    cropHarvest: lang === "mr" ? "पीक काढणी अंदाज" : "Crop Harvest",
    cropHarvestAnalysis: lang === "mr" ? "पीक काढणी विश्लेषण" : "Crop Harvest Analysis",
    cropDistribution: lang === "mr" ? "पीक वितरण" : "Crop Distribution",
    totalFarmingLand: lang === "mr" ? "एकूण शेती क्षेत्र" : "Total Farming Land",
    totalWorker: lang === "mr" ? "एकूण कामगार" : "Total Worker",
    todayActivities: lang === "mr" ? "आजची कामे" : "Today Activities",
    addHub: lang === "mr" ? "नवीन हब जोडा" : "ADD CULTIVATION HUB",
    seeDetails: lang === "mr" ? "तपशील पहा" : "See Details",
    plantSeeds: lang === "mr" ? "बियाणे पेरा" : "Plant Seeds",
    plantSeedsDesc: lang === "mr" ? "पेरणीसाठी अनुकूल हवामान" : "Perfect weather for sowing",
    fertilizePlant: lang === "mr" ? "खते द्या" : "Fertilize Plant",
    fertilizePlantDesc: lang === "mr" ? "एनपीके-१९ ची शिफारस" : "NPK-19 recommended",
    checkPest: lang === "mr" ? "कीड तपासा" : "Check Pest",
    checkPestDesc: lang === "mr" ? "कीड धोका आढळला" : "Pest risk detected",
  };

  // 3 Cultivation Hub items (Screen 2 matching reference image)
  const hubItems = [
    {
      id: "paddy",
      name: lang === "mr" ? "भात लागवड प्लॉट" : "Paddy Seeding Plot",
      desc: lang === "mr" ? "पेरणीची अपेक्षित तारीख २० एप्रिल, २०२६." : "Expected sowing date is april 20, 2026.",
      area: "3.6 ha",
      activities: "13 Activity",
      image: "https://images.unsplash.com/photo-1592982537447-7440770cbfc9?w=600&auto=format&fit=crop",
    },
    {
      id: "potato",
      name: lang === "mr" ? "बटाटा शेती क्षेत्र" : "Potato Field Zone",
      desc: lang === "mr" ? "उत्तम वाढीसाठी सिंचन शिफारसीय आहे." : "Irrigation is recommended to ensure optimal growth.",
      area: "1.6 ha",
      activities: "13 Activity",
      image: "https://images.unsplash.com/photo-1590682680695-43b964a3ae17?w=600&auto=format&fit=crop",
    },
    {
      id: "apple",
      name: lang === "mr" ? "सफरचंद बाग" : "Highland Apple Grove",
      desc: lang === "mr" ? "सफरचंद तोडणी सुरू करण्यासाठी योग्य वेळ." : "Ideal time to begin harvesting your apples",
      area: "3.6 ha",
      activities: "13 Activity",
      image: "https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?w=600&auto=format&fit=crop",
    },
  ];

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-[#071710] text-white font-sans select-none">
      {/* Dynamic Ambient Background Gradients */}
      <div className="pointer-events-none absolute -left-20 -top-20 h-80 w-80 rounded-full bg-emerald-500/15 blur-3xl" />
      <div className="pointer-events-none absolute -right-20 top-40 h-80 w-80 rounded-full bg-lime-500/10 blur-3xl" />
      <div className="pointer-events-none absolute bottom-10 left-10 h-72 w-72 rounded-full bg-teal-500/10 blur-3xl" />

      {/* Screen 1: Beautiful Landscape Photo Background when on 'home' screen */}
      {screen === "home" && (
        <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
          <img
            src="https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=1200&auto=format&fit=crop"
            alt="Misty Mountain Background"
            className="h-full w-full object-cover object-center opacity-65 scale-105 transition-all duration-700"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#071710]/40 via-[#071710]/60 to-[#071710] pointer-events-none" />
        </div>
      )}

      {/* Top Phone Status Bar */}
      <div className="relative z-20 flex items-center justify-between px-6 pt-3 text-[11px] font-medium text-emerald-100/80">
        <span>9:54</span>
        <div className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <div className="flex gap-0.5 items-end h-2.5">
            <span className="w-0.5 h-1 bg-emerald-300 rounded-sm" />
            <span className="w-0.5 h-1.5 bg-emerald-300 rounded-sm" />
            <span className="w-0.5 h-2 bg-emerald-300 rounded-sm" />
            <span className="w-0.5 h-2.5 bg-emerald-300 rounded-sm" />
          </div>
          <div className="h-2.5 w-5 rounded-[3px] border border-emerald-300/70 p-0.5 ml-1">
            <div className="h-full w-3/4 rounded-[1px] bg-emerald-400" />
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* SCREEN 1: HOME / WEATHER HERO & TODAY'S AI SUGGESTION    */}
      {/* ======================================================== */}
      {screen === "home" && (
        <div className="relative z-10 flex-1 flex flex-col overflow-y-auto px-5 pb-24 pt-1 space-y-4 scrollbar-none animate-fade-in">
          {/* Top Bar: Brand, Location, Bell & Profile Avatar */}
          <div className="flex items-center justify-between pt-1">
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white drop-shadow-md">
                {t.appName}.
              </h1>
              <div className="flex items-center gap-1 text-[11px] text-emerald-200/90 font-medium">
                <MapPin className="h-3 w-3 text-emerald-300" />
                <select
                  value={talukaId}
                  onChange={(e) => setTalukaId(e.target.value)}
                  className="bg-transparent font-medium text-emerald-200 outline-none cursor-pointer hover:text-white"
                >
                  {TALUKAS.map((t) => (
                    <option key={t.id} value={t.id} className="bg-[#071f16] text-white">
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setLang(lang === "en" ? "mr" : "en")}
                className="rounded-full border border-emerald-400/30 bg-emerald-950/60 px-2 py-0.5 text-[10px] font-bold text-emerald-300 backdrop-blur hover:bg-emerald-900/60 transition"
              >
                {lang === "en" ? "मराठी" : "ENG"}
              </button>
              {onBackToDesk && (
                <button
                  type="button"
                  onClick={onBackToDesk}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white backdrop-blur hover:bg-white/20 transition"
                  title="Forecaster Desk"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowDispatchModal(true)}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white backdrop-blur hover:bg-white/20 transition shadow-sm"
                title="Notifications & Alerts"
              >
                <Bell className="h-4 w-4 text-emerald-200" />
              </button>
              <div className="relative h-8 w-8 rounded-full ring-2 ring-emerald-400/40 overflow-hidden shadow-sm">
                <img
                  src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop"
                  alt="User Profile"
                  className="h-full w-full object-cover"
                />
              </div>
            </div>
          </div>

          {/* Toast Notification when simulated dispatch occurs */}
          {dispatchSuccess && (
            <div className="rounded-2xl border border-emerald-400 bg-emerald-950/90 p-3 shadow-xl backdrop-blur animate-fade-in text-xs text-emerald-200 flex items-start gap-2.5">
              <Check className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-white block font-semibold">
                  {lang === "mr" ? "सल्ला प्रसारित झाला!" : "Broadcast Dispatched!"}
                </strong>
                <p className="mt-0.5 text-[11px] leading-tight text-emerald-300/90">{dispatchSuccess}</p>
              </div>
            </div>
          )}

          {/* Hero Weather Section (Matching left phone in reference image) */}
          <div className="pt-6 pb-2">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-xs font-semibold text-emerald-100/90 tracking-wide drop-shadow-sm">
                  Saturday 4 Nov 2025
                </p>
                <div className="mt-0.5 flex items-baseline">
                  <span className="text-5xl font-light tracking-tight text-white drop-shadow-lg">
                    32
                  </span>
                  <span className="text-3xl font-light text-white ml-0.5 drop-shadow-lg">°C</span>
                </div>
              </div>

              {/* Rain Showers Badge Card (Glassmorphic pill on right) */}
              <div className="rounded-2xl border border-white/20 bg-emerald-950/40 p-2.5 shadow-lg backdrop-blur-xl flex flex-col items-center">
                <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-200">
                  <CloudRain className="h-4 w-4 text-emerald-300" />
                  <span>Rain Showers 10%</span>
                </div>
                <div className="mt-1 flex items-center gap-2 text-[10px] text-emerald-300/80 font-mono">
                  <span>↑ 21°</span>
                  <span>↓ 18°</span>
                </div>
              </div>
            </div>
          </div>

          {/* Card: Today's AI Suggestion (Matching reference image) */}
          <div className="rounded-3xl border border-white/15 bg-gradient-to-b from-[#0e2a1f]/85 to-[#081b13]/90 p-4 shadow-xl backdrop-blur-xl">
            {/* Header with audio waveform button */}
            <div className="flex items-center justify-between pb-3">
              <h2 className="text-sm font-bold tracking-tight text-white">{t.aiSuggestion}</h2>
              <button
                type="button"
                onClick={() => handleAudioSpeak(`${t.plantSeeds}: ${t.plantSeedsDesc}. ${t.fertilizePlant}: ${t.fertilizePlantDesc}. ${t.checkPest}: ${t.checkPestDesc}.`)}
                className={cx(
                  "flex h-7 w-7 items-center justify-center rounded-full border transition",
                  isPlayingAudio
                    ? "border-lime-400 bg-lime-400/20 text-lime-300 animate-pulse"
                    : "border-emerald-400/30 bg-white/10 text-emerald-300 hover:bg-white/20"
                )}
                title="Listen Voice Readout"
              >
                <Volume2 className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* 3 Suggestion Rows */}
            <div className="space-y-2.5">
              {/* Row 1: Plant Seeds */}
              <div
                onClick={() => setScreen("hub")}
                className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-3 hover:border-emerald-400/40 hover:bg-white/10 transition cursor-pointer group"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-emerald-300 group-hover:scale-105 transition">
                    <Sprout className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-white group-hover:text-emerald-300 transition">
                      {t.plantSeeds}
                    </h3>
                    <p className="text-[11px] text-emerald-200/70">{t.plantSeedsDesc}</p>
                  </div>
                </div>
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-white/70 group-hover:bg-emerald-500 group-hover:text-black transition">
                  <ChevronRight className="h-3.5 w-3.5" />
                </div>
              </div>

              {/* Row 2: Fertilize Plant */}
              <div
                onClick={() => setScreen("overview")}
                className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-3 hover:border-emerald-400/40 hover:bg-white/10 transition cursor-pointer group"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-emerald-300 group-hover:scale-105 transition">
                    <Droplets className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-white group-hover:text-emerald-300 transition">
                      {t.fertilizePlant}
                    </h3>
                    <p className="text-[11px] text-emerald-200/70">{t.fertilizePlantDesc}</p>
                  </div>
                </div>
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-white/70 group-hover:bg-emerald-500 group-hover:text-black transition">
                  <ChevronRight className="h-3.5 w-3.5" />
                </div>
              </div>

              {/* Row 3: Check Pest */}
              <div
                onClick={() => setScreen("activities")}
                className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-3 hover:border-emerald-400/40 hover:bg-white/10 transition cursor-pointer group"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-emerald-300 group-hover:scale-105 transition">
                    <Bug className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-white group-hover:text-emerald-300 transition">
                      {t.checkPest}
                    </h3>
                    <p className="text-[11px] text-emerald-200/70">{t.checkPestDesc}</p>
                  </div>
                </div>
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-white/70 group-hover:bg-emerald-500 group-hover:text-black transition">
                  <ChevronRight className="h-3.5 w-3.5" />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* SCREEN 2: MY CULTIVATION HUB (Top Center in image)       */}
      {/* ======================================================== */}
      {screen === "hub" && (
        <div className="relative z-10 flex-1 flex flex-col overflow-y-auto px-5 pb-24 pt-2 space-y-4 scrollbar-none animate-fade-in">
          {/* Header */}
          <div className="flex items-center justify-between pt-1">
            <h1 className="text-lg font-bold tracking-tight text-white">{t.myCultivationHub}</h1>
            <button
              type="button"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white backdrop-blur-md hover:bg-white/20 transition"
            >
              <SlidersHorizontal className="h-4 w-4 text-emerald-300" />
            </button>
          </div>

          {/* 3 Hub Cards (Matching reference image) */}
          <div className="space-y-3.5 pt-1">
            {hubItems.map((item) => (
              <div
                key={item.id}
                onClick={() => {
                  setSelectedHub(item.id);
                  setScreen("overview");
                }}
                className="group relative flex overflow-hidden rounded-3xl border border-white/15 bg-gradient-to-r from-[#0d2a1f]/85 to-[#081912]/80 p-3 shadow-lg backdrop-blur-xl hover:border-emerald-400/50 transition cursor-pointer"
              >
                <img
                  src={item.image}
                  alt={item.name}
                  className="h-22 w-22 shrink-0 rounded-2xl object-cover transition-transform group-hover:scale-105"
                />
                <div className="ml-3.5 flex flex-1 flex-col justify-between py-0.5">
                  <div>
                    <h3 className="text-sm font-bold text-white group-hover:text-emerald-300 transition">
                      {item.name}
                    </h3>
                    <p className="mt-1 text-[11px] text-emerald-200/70 line-clamp-2 leading-relaxed">
                      {item.desc}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 pt-2 text-[10px]">
                    <span className="flex items-center gap-1 rounded-full bg-white/10 border border-white/10 px-2.5 py-0.5 text-emerald-300 font-medium">
                      📐 {item.area}
                    </span>
                    <span className="flex items-center gap-1 rounded-full bg-white/10 border border-white/10 px-2.5 py-0.5 text-white/80 font-medium">
                      📋 {item.activities}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Add Cultivation Hub Button (Matching wide button at bottom of Screen 2) */}
          <div className="pt-2">
            <button
              type="button"
              onClick={() => setScreen("overview")}
              className="w-full rounded-2xl border border-emerald-500/40 bg-emerald-950/60 py-3.5 text-center text-xs font-bold tracking-wider text-emerald-300 uppercase shadow-lg backdrop-blur-md hover:bg-emerald-900/60 active:scale-[0.98] transition"
            >
              {t.addHub}
            </button>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* SCREEN 3: CROP OVERVIEW / HARVEST STATS (Bottom Center)  */}
      {/* ======================================================== */}
      {screen === "overview" && (
        <div className="relative z-10 flex-1 flex flex-col overflow-y-auto px-5 pb-24 pt-2 space-y-4 scrollbar-none animate-fade-in">
          {/* Header with Back, Title & Options */}
          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              onClick={() => setScreen("hub")}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white backdrop-blur hover:bg-white/20 transition"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <h1 className="text-sm font-bold text-white tracking-tight">
              {hubItems.find((h) => h.id === selectedHub)?.name ?? t.cropOverview}
            </h1>
            <button
              type="button"
              className="flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white backdrop-blur hover:bg-white/20 transition"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </div>

          {/* Segmented Control: Overview Stats | Scan Overview */}
          <div className="flex rounded-full border border-white/15 bg-black/40 p-1 backdrop-blur-xl">
            <button
              type="button"
              onClick={() => setOverviewTab("stats")}
              className={cx(
                "flex-1 flex items-center justify-center gap-1.5 rounded-full py-1.5 text-xs font-semibold transition",
                overviewTab === "stats"
                  ? "bg-emerald-500/30 text-white border border-emerald-400/40 shadow-sm"
                  : "text-emerald-200/60 hover:text-white"
              )}
            >
              <BarChart3 className="h-3.5 w-3.5" />
              <span>{t.overviewStats}</span>
            </button>
            <button
              type="button"
              onClick={() => setOverviewTab("scan")}
              className={cx(
                "flex-1 flex items-center justify-center gap-1.5 rounded-full py-1.5 text-xs font-semibold transition",
                overviewTab === "scan"
                  ? "bg-emerald-500/30 text-white border border-emerald-400/40 shadow-sm"
                  : "text-emerald-200/60 hover:text-white"
              )}
            >
              <Crosshair className="h-3.5 w-3.5" />
              <span>{t.scanOverview}</span>
            </button>
          </div>

          {/* Card: Crop Harvest with Background Texture (Matching Bottom Center Screen) */}
          <div className="relative overflow-hidden rounded-3xl border border-white/15 bg-gradient-to-br from-[#123627]/90 via-[#0d2a1e]/90 to-[#071710]/95 p-5 shadow-2xl backdrop-blur-xl">
            {/* Top row */}
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-sm font-bold text-white">{t.cropHarvest}</h2>
                <div className="mt-3 flex items-baseline">
                  <span className="text-4xl font-extrabold tracking-tight text-white">326</span>
                  <span className="text-sm font-medium text-emerald-300 ml-1.5">Tonnes</span>
                </div>
              </div>

              <div className="text-right">
                <span className="text-[11px] font-medium text-emerald-200/80">
                  Harvesting After
                </span>
                <p className="text-xs font-bold text-white">83 Days</p>
                <div className="mt-2 flex items-center justify-end gap-1.5 text-[10px] text-amber-300">
                  <span className="h-2 w-2 rounded-full bg-amber-400" />
                  <span>Expected Harvest</span>
                </div>
              </div>
            </div>

            {/* Pattern graph simulation */}
            <div className="mt-5 pt-3 border-t border-white/10 flex items-center justify-between text-xs text-emerald-200/80">
              <span>Model Blend Rain: {blendRain.toFixed(1)} mm</span>
              <button
                type="button"
                onClick={() => setScreen("distribution")}
                className="flex items-center gap-1 text-emerald-400 font-semibold hover:underline"
              >
                <span>View Distribution</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* SCREEN 4: CROP DISTRIBUTION & MATRIX (Top Right in image)*/}
      {/* ======================================================== */}
      {screen === "distribution" && (
        <div className="relative z-10 flex-1 flex flex-col overflow-y-auto px-5 pb-24 pt-2 space-y-4 scrollbar-none animate-fade-in">
          {/* Top Card: Crop Harvest Analysis hatched chart */}
          <div className="rounded-3xl border border-white/15 bg-gradient-to-b from-[#0e2a1f]/85 to-[#081b13]/90 p-4 shadow-xl backdrop-blur-xl">
            <h2 className="text-xs font-semibold text-emerald-200/80 mb-2">
              {t.cropHarvestAnalysis}
            </h2>
            {/* Striped diagonal canvas simulation */}
            <div className="h-20 w-full rounded-2xl border border-white/10 bg-[repeating-linear-gradient(45deg,#0a1f16,#0a1f16_6px,#123828_6px,#123828_12px)] flex items-center justify-center">
              <span className="text-[11px] font-semibold text-emerald-300/80">
                13-Model Harvest Growth Curve
              </span>
            </div>
          </div>

          {/* Bottom Card: Crop Distribution with Dot Matrix (Matching Top Right Screen) */}
          <div className="rounded-3xl border border-white/15 bg-gradient-to-b from-[#0e2a1f]/85 to-[#081b13]/90 p-5 shadow-xl backdrop-blur-xl">
            <div className="flex items-center justify-between pb-4">
              <h2 className="text-sm font-bold text-white">{t.cropDistribution}</h2>
              <div className="text-right">
                <span className="block text-[10px] text-emerald-300/70 uppercase">Total Hectares</span>
                <span className="text-xs font-bold text-white">65.04</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 items-center">
              {/* Left: Dot Legend */}
              <div className="space-y-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                  <span className="text-emerald-100/90 font-medium">Cherries</span>
                  <span className="text-[10px] text-emerald-300/70 ml-auto">07.20 Ha</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-lime-400" />
                  <span className="text-emerald-100/90 font-medium">Apples</span>
                  <span className="text-[10px] text-emerald-300/70 ml-auto">22.64 Ha</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-200" />
                  <span className="text-emerald-100/90 font-medium">Mushroom</span>
                  <span className="text-[10px] text-emerald-300/70 ml-auto">35.20 Ha</span>
                </div>
              </div>

              {/* Right: Dot Grid Matrix (Exact 4x10 grid matching reference image) */}
              <div className="grid grid-cols-8 gap-1.5 p-2 rounded-2xl bg-black/30 border border-white/10">
                {/* Row 1 */}
                <span className="h-2 w-2 rounded-full bg-lime-400" />
                <span className="h-2 w-2 rounded-full bg-lime-400" />
                <span className="h-2 w-2 rounded-full bg-lime-400" />
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                <span className="h-2 w-2 rounded-full bg-emerald-200" />
                <span className="h-2 w-2 rounded-full bg-emerald-200" />
                {/* Row 2 */}
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                <span className="h-2 w-2 rounded-full bg-lime-400" />
                <span className="h-2 w-2 rounded-full bg-lime-400" />
                <span className="h-2 w-2 rounded-full bg-lime-400" />
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                <span className="h-2 w-2 rounded-full bg-emerald-200" />
                <span className="h-2 w-2 rounded-full bg-emerald-200" />
                {/* Row 3 */}
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                <span className="h-2 w-2 rounded-full bg-lime-400" />
                <span className="h-2 w-2 rounded-full bg-lime-400" />
                <span className="h-2 w-2 rounded-full bg-emerald-200" />
                <span className="h-2 w-2 rounded-full bg-emerald-200" />
                <span className="h-2 w-2 rounded-full bg-emerald-200" />
                <span className="h-2 w-2 rounded-full bg-emerald-200" />
                {/* Row 4 */}
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                <span className="h-2 w-2 rounded-full bg-lime-400" />
                <span className="h-2 w-2 rounded-full bg-emerald-200" />
                <span className="h-2 w-2 rounded-full bg-emerald-200" />
                <span className="h-2 w-2 rounded-full bg-emerald-200" />
                <span className="h-2 w-2 rounded-full bg-emerald-200" />
                <span className="h-2 w-2 rounded-full bg-emerald-200" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* SCREEN 5: LAND, WORKERS & TODAY ACTIVITIES (Bottom Right)*/}
      {/* ======================================================== */}
      {screen === "activities" && (
        <div className="relative z-10 flex-1 flex flex-col overflow-y-auto px-5 pb-24 pt-2 space-y-4 scrollbar-none animate-fade-in">
          {/* Header with back and bell button */}
          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              onClick={() => setScreen("home")}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white backdrop-blur hover:bg-white/20 transition"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setShowDispatchModal(true)}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white backdrop-blur hover:bg-white/20 transition"
            >
              <Bell className="h-4 w-4 text-emerald-300" />
            </button>
          </div>

          {/* Hero Banner: Total Farming Land 26 Ha. & Total Worker */}
          <div className="flex items-end justify-between pt-2">
            <div>
              <p className="text-xs font-medium text-emerald-200/80">{t.totalFarmingLand}</p>
              <div className="mt-0.5 flex items-baseline">
                <span className="text-5xl font-extralight tracking-tight text-white">26</span>
                <span className="text-2xl font-light text-emerald-300 ml-1">Ha.</span>
              </div>
            </div>

            {/* Total Worker Card (Matching reference image) */}
            <div className="rounded-2xl border border-white/15 bg-emerald-950/50 p-2.5 shadow-md backdrop-blur-xl">
              <span className="block text-[11px] font-medium text-emerald-200/90 mb-1">
                {t.totalWorker}
              </span>
              <div className="flex items-center gap-2 text-[10px]">
                <span className="flex items-center gap-1 rounded bg-white/10 px-2 py-0.5 text-white/90">
                  ♀ 39%
                </span>
                <span className="flex items-center gap-1 rounded bg-white/10 px-2 py-0.5 text-white/90">
                  ♂ 61%
                </span>
              </div>
            </div>
          </div>

          {/* Two Side-by-Side Status Cards (ORGANIC APPLE PLANT & POTATO FIELD ZONE) */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            {/* Card 1: ORGANIC APPLE PLANT */}
            <div
              onClick={() => setScreen("overview")}
              className="rounded-3xl border border-white/15 bg-gradient-to-b from-[#0e2a1f]/85 to-[#081b13]/90 p-3.5 shadow-lg backdrop-blur-xl hover:border-emerald-400/40 transition cursor-pointer"
            >
              <h3 className="text-[11px] font-bold text-white uppercase tracking-wider">
                ORGANIC APPLE PLANT
              </h3>
              <div className="mt-3 flex items-center gap-2 rounded-xl bg-black/30 p-2 border border-white/10">
                <span className="h-2.5 w-2.5 rounded-full border-2 border-emerald-400" />
                <span className="text-[10px] text-emerald-200 font-medium">Harvest 80% Completed</span>
              </div>
              <div className="mt-3 flex items-center justify-between text-[10px] text-emerald-300 font-semibold">
                <span>{t.seeDetails}</span>
                <ChevronRight className="h-3 w-3" />
              </div>
            </div>

            {/* Card 2: POTATO FIELD ZONE */}
            <div
              onClick={() => setScreen("overview")}
              className="rounded-3xl border border-white/15 bg-gradient-to-b from-[#0e2a1f]/85 to-[#081b13]/90 p-3.5 shadow-lg backdrop-blur-xl hover:border-emerald-400/40 transition cursor-pointer"
            >
              <h3 className="text-[11px] font-bold text-white uppercase tracking-wider">
                POTATO FIELD ZONE
              </h3>
              <div className="mt-3 flex items-center gap-2 rounded-xl bg-black/30 p-2 border border-white/10">
                <span className="h-2.5 w-2.5 rounded-full border-2 border-lime-400" />
                <span className="text-[10px] text-emerald-200 font-medium">Sowing 90% Completed</span>
              </div>
              <div className="mt-3 flex items-center justify-between text-[10px] text-emerald-300 font-semibold">
                <span>{t.seeDetails}</span>
                <ChevronRight className="h-3 w-3" />
              </div>
            </div>
          </div>

          {/* Today Activities Checklist (Matching Bottom Right Screen) */}
          <div className="rounded-3xl border border-white/15 bg-gradient-to-b from-[#0e2a1f]/85 to-[#081b13]/90 p-4 shadow-xl backdrop-blur-xl">
            <h2 className="text-sm font-bold text-white mb-3">{t.todayActivities}</h2>
            <div className="space-y-2.5">
              {activities.map((act) => (
                <div
                  key={act.id}
                  onClick={() => toggleActivity(act.id)}
                  className="flex items-center gap-3 rounded-2xl bg-black/25 p-2.5 transition hover:bg-black/40 cursor-pointer"
                >
                  <div
                    className={cx(
                      "flex h-4 w-4 items-center justify-center rounded border transition",
                      act.done
                        ? "border-emerald-400 bg-emerald-500 text-white"
                        : "border-white/40 bg-white/5"
                    )}
                  >
                    {act.done && <Check className="h-3 w-3" />}
                  </div>
                  <span
                    className={cx(
                      "text-xs transition",
                      act.done ? "text-emerald-300/60 line-through" : "text-white"
                    )}
                  >
                    {lang === "mr" ? act.textMr : act.textEn}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* FLOATING GLASS PILL DOCK NAVIGATION (Present on all views)*/}
      {/* ======================================================== */}
      <div className="absolute bottom-4 left-0 right-0 z-30 flex justify-center px-6">
        <nav className="flex items-center gap-6 rounded-full border border-white/20 bg-emerald-950/85 px-6 py-2.5 shadow-2xl backdrop-blur-2xl">
          {/* Dock Icon 1: Home */}
          <button
            type="button"
            onClick={() => setScreen("home")}
            className={cx(
              "flex flex-col items-center gap-0.5 transition",
              screen === "home" ? "text-emerald-400 scale-110 drop-shadow" : "text-white/60 hover:text-white"
            )}
            title="Home / Weather Hero"
          >
            <Home className="h-4 w-4" />
          </button>

          {/* Dock Icon 2: Sprout / Hub */}
          <button
            type="button"
            onClick={() => setScreen("hub")}
            className={cx(
              "flex flex-col items-center gap-0.5 transition",
              screen === "hub" ? "text-emerald-400 scale-110 drop-shadow" : "text-white/60 hover:text-white"
            )}
            title="My Cultivation Hub"
          >
            <Sprout className="h-4 w-4" />
          </button>

          {/* Dock Icon 3: Scan / Overview & Distribution */}
          <button
            type="button"
            onClick={() => setScreen(screen === "overview" ? "distribution" : "overview")}
            className={cx(
              "flex flex-col items-center gap-0.5 transition",
              screen === "overview" || screen === "distribution"
                ? "text-emerald-400 scale-110 drop-shadow"
                : "text-white/60 hover:text-white"
            )}
            title="Crop Overview & Distribution Matrix"
          >
            <Scan className="h-4 w-4" />
          </button>

          {/* Dock Icon 4: Grid / Activities */}
          <button
            type="button"
            onClick={() => setScreen("activities")}
            className={cx(
              "flex flex-col items-center gap-0.5 transition",
              screen === "activities"
                ? "text-emerald-400 scale-110 drop-shadow"
                : "text-white/60 hover:text-white"
            )}
            title="Land & Today Activities"
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
        </nav>
      </div>

      {/* ======================================================== */}
      {/* ATMOSFUSION MULTI-CHANNEL DISPATCH MODAL                */}
      {/* ======================================================== */}
      {showDispatchModal && (
        <div className="absolute inset-0 z-50 flex flex-col bg-[#05170f]/95 backdrop-blur-2xl animate-fade-in p-5">
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

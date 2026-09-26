import { useState } from "react";
import {
  CloudRain,
  Sprout,
  Droplets,
  Bug,
  Volume2,
  ChevronRight,
  Home,
  Scan,
  Grid,
  CheckCircle2,
  Sparkles,
  ArrowLeft,
  Share2,
  MapPin,
} from "lucide-react";
import { cx } from "@/lib/cx";
import { useCycle, useCycleIndex, useTelemetry } from "@/data/cycle";

export interface KisanAppProps {
  initialTaluka?: string;
  initialLang?: "en" | "mr";
  onBackToDesk?: () => void;
}

const TALUKAS = [
  { id: "pune-plains", name: "Baramati / Haveli", district: "Pune Plains", lat: 18.5, lon: 74.4, cropMain: "Sugarcane & Onion" },
  { id: "pune-ghats", name: "Lonavala / Mulshi", district: "Pune Ghats", lat: 18.6, lon: 73.7, cropMain: "Paddy & Horticulture" },
  { id: "nashik-plains", name: "Junnar / Narayangaon", district: "Pune North", lat: 19.1, lon: 73.9, cropMain: "Grapes & Vegetables" },
  { id: "mumbai", name: "Vasai / Palghar", district: "MMR Coastal", lat: 19.05, lon: 72.87, cropMain: "Floriculture & Paddy" },
];

export default function KisanMobileApp({
  initialTaluka = "pune-plains",
  initialLang = "en",
  onBackToDesk,
}: KisanAppProps) {
  const [lang, setLang] = useState<"en" | "mr">(initialLang);
  const [talukaId, setTalukaId] = useState(initialTaluka);
  const [activeTab, setActiveTab] = useState<"home" | "crops" | "radar" | "tasks">("home");
  const [selectedCrop, setSelectedCrop] = useState<string | null>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  // Activities checklist state
  const [tasks, setTasks] = useState([
    { id: 1, textEn: "Apply NPK fertilizer before 10:00 AM", textMr: "सकाळी १०:०० पूर्वी एनपीके खत द्या", done: true, time: "8:00 AM" },
    { id: 2, textEn: "Spray bio-fungicide (No rain wash-out risk)", textMr: "बुरशीनाशक फवारणी करा (पावसाचा धोका नाही)", done: false, time: "1:30 PM" },
    { id: 3, textEn: "Check drip irrigation pressure in Plot B", textMr: "प्लॉट बी मध्ये ठिबक सिंचन दाब तपासा", done: false, time: "4:00 PM" },
  ]);

  const toggleTask = (id: number) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
  };

  // Live forecast data from AtmosFusion backend
  const { data: cycle } = useCycle();
  const idx = useCycleIndex(cycle);
  const { data: tel } = useTelemetry(talukaId);

  const rainForecast = idx.get(talukaId, 1, "rain");
  const blendRain = rainForecast?.blend ?? 0.2;

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

  const t = {
    appName: lang === "mr" ? "अ‍ॅटमॉस किसान" : "AtmosKisan",
    subName: lang === "mr" ? "स्मार्ट कृषी सल्ला" : "AI Multi-Model Agromet",
    location: currentTaluka.name,
    todayWeather: lang === "mr" ? "आजचे हवामान" : "Today's Weather",
    aiSuggestion: lang === "mr" ? "आजचा एआय कृषी सल्ला" : "Today's AI Suggestion",
    myCrops: lang === "mr" ? "माझी पिके व शेती" : "My Cultivation Hub",
    cropOverview: lang === "mr" ? "पीक आरोग्य विश्लेषण" : "Crop Health Overview",
    todayActivities: lang === "mr" ? "आजची शेती कामे" : "Today's Activities",
    safeSpray: lang === "mr" ? "फवारणी सुरक्षित खिडकी" : "Safe Spray Window",
    safeSprayDesc:
      lang === "mr"
        ? `दुपारी ४:३० पर्यंत पाऊस नाही (${blendRain.toFixed(1)} मिमी अंदाज). कीटकनाशक फवारणी सुरक्षित आहे.`
        : `AtmosFusion blend predicts ${blendRain.toFixed(1)} mm rain. 0% wash-out risk until 4:30 PM.`,
    irrigationTip: lang === "mr" ? "सिंचन मार्गदर्शन" : "Irrigation Advisory",
    irrigationDesc:
      lang === "mr"
        ? `मातीतील ओलावा ${(tel?.surface?.soil_moisture_0_to_1cm ? tel.surface.soil_moisture_0_to_1cm * 100 : 26).toFixed(0)}% पुरेसा आहे. आज पाणी देणे टाळा.`
        : `Topsoil moisture is ${(tel?.surface?.soil_moisture_0_to_1cm ? tel.surface.soil_moisture_0_to_1cm * 100 : 26).toFixed(0)}% (optimal). Defer canal irrigation.`,
    pestAlert: lang === "mr" ? "कीड व बुरशी पूर्वसूचना" : "Fungal & Pest Warning",
    pestDesc:
      lang === "mr"
        ? "रात्री हवेतील आर्द्रता ६६% राहण्याची शक्यता. द्राक्ष व कांदा पिकांवर डाऊनी मिल्ड्यू तपासा."
        : "Night humidity near 66%. Favorable for downy mildew in grape orchards.",
    listenAudio: lang === "mr" ? "सल्ला ऐका" : "Listen Advice",
    playing: lang === "mr" ? "सल्ला वाचन सुरू..." : "Reading out...",
    noWashout: lang === "mr" ? "धुवून जाण्याचा धोका: ०%" : "Wash-out Risk: 0%",
    totalArea: lang === "mr" ? "एकूण शेती क्षेत्र" : "Total Farming Land",
    workers: lang === "mr" ? "कामावर कामगार" : "Active Workers",
  };

  const crops = [
    {
      id: "sugarcane",
      name: lang === "mr" ? "ऊस लागवड (को-८६०३२)" : "Sugarcane Plot (Co-86032)",
      desc: lang === "mr" ? "उसाची वाढ उत्तम, ठिबक सिंचन पुरेसे" : "Irrigation is optimal, grand growth stage",
      area: "3.6 Ha",
      activities: 13,
      health: 94,
      image: "https://images.unsplash.com/photo-1592982537447-7440770cbfc9?w=600&auto=format&fit=crop",
      stage: lang === "mr" ? "वाढ अवस्था" : "Tillering Stage",
      nextWater: lang === "mr" ? "२ दिवसांनी" : "In 2 days",
    },
    {
      id: "grapes",
      name: lang === "mr" ? "द्राक्ष बाग (थॉमसन सीडलेस)" : "Highland Vineyard (Thompson Seedless)",
      desc: lang === "mr" ? "छाटणीनंतर नवीन फुटवा, फवारणी अनुकूल" : "Ideal dry spell for preventive bio-spray",
      area: "2.4 Ha",
      activities: 8,
      health: 91,
      image: "https://images.unsplash.com/photo-1506377247377-2a5b3b417ebb?w=600&auto=format&fit=crop",
      stage: lang === "mr" ? "फुटवा अवस्था" : "Sprouting Stage",
      nextWater: lang === "mr" ? "उद्या सकाळी" : "Tomorrow AM",
    },
    {
      id: "onion",
      name: lang === "mr" ? "कांदा शेती (भीमा सुपर)" : "Rabi Onion Zone (Bhima Super)",
      desc: lang === "mr" ? "पुढील ३ दिवस कोरडे, पुनर्लागवड योग्य" : "Next 3 days dry. Perfect for transplantation",
      area: "1.8 Ha",
      activities: 6,
      health: 88,
      image: "https://images.unsplash.com/photo-1590682680695-43b964a3ae17?w=600&auto=format&fit=crop",
      stage: lang === "mr" ? "रोपांची लागवड" : "Transplanting",
      nextWater: lang === "mr" ? "३ दिवसांनी" : "In 3 days",
    },
  ];

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-[#061a12] text-white font-sans select-none">
      {/* Background Glows & Ambience */}
      <div className="pointer-events-none absolute -left-20 -top-20 h-72 w-72 rounded-full bg-emerald-500/15 blur-3xl" />
      <div className="pointer-events-none absolute -right-20 top-40 h-80 w-80 rounded-full bg-lime-500/10 blur-3xl" />
      <div className="pointer-events-none absolute bottom-10 left-10 h-72 w-72 rounded-full bg-teal-500/10 blur-3xl" />

      {/* Top Phone Status Bar */}
      <div className="relative z-20 flex items-center justify-between px-6 pt-3 text-[11px] font-medium text-emerald-100/70">
        <span>9:54</span>
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
            <Sprout className="h-4 w-4 text-emerald-400" />
            <h1 className="text-lg font-bold tracking-tight text-white">{t.appName}</h1>
          </div>
          <div className="flex items-center gap-1 text-[11px] text-emerald-300/80">
            <MapPin className="h-3 w-3 text-emerald-400" />
            <select
              value={talukaId}
              onChange={(e) => setTalukaId(e.target.value)}
              className="bg-transparent font-medium text-emerald-200 outline-none cursor-pointer hover:text-white"
            >
              {TALUKAS.map((t) => (
                <option key={t.id} value={t.id} className="bg-[#0b2419] text-white">
                  {t.name} ({t.district})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Controls: Language toggle & Forecaster desk back button */}
        <div className="flex items-center gap-1.5">
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
              title="Return to Desktop Command Desk"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Main Scrollable Content */}
      <div className="relative z-10 flex-1 overflow-y-auto px-5 pb-24 pt-2 space-y-4 scrollbar-none">
        {/* Weather Hero Card (Glassmorphic Landscape aesthetic) */}
        <div className="relative overflow-hidden rounded-2xl border border-white/15 bg-gradient-to-br from-emerald-900/50 via-emerald-950/70 to-[#04130d]/80 p-5 shadow-xl backdrop-blur-xl">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-emerald-300/80">
                Saturday · 26 Sep 2026
              </p>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-4xl font-extrabold tracking-tight text-white">29°</span>
                <span className="text-sm font-medium text-emerald-300/70">C</span>
              </div>
              <p className="mt-0.5 text-xs font-medium text-emerald-200">
                {blendRain < 1.0 ? (lang === "mr" ? "कोरडे व स्वच्छ हवामान" : "Dry & Clear Sky") : (lang === "mr" ? "हलक्या सरी" : "Scattered Showers")}
              </p>
            </div>

            {/* Rain Badge from AtmosFusion Blend */}
            <div className="flex flex-col items-end">
              <div className="flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 backdrop-blur-md">
                <CloudRain className="h-3.5 w-3.5 text-emerald-400" />
                <span className="text-xs font-semibold text-emerald-300">
                  {blendRain.toFixed(1)} mm
                </span>
              </div>
              <div className="mt-1.5 text-[10px] text-emerald-300/70">
                <span>↑ 31°</span> <span className="ml-1">↓ 21°</span>
              </div>
            </div>
          </div>

          {/* Quick telemetry metrics */}
          <div className="mt-4 grid grid-cols-3 gap-2 border-t border-white/10 pt-3 text-center">
            <div className="rounded-lg bg-black/20 p-1.5">
              <span className="block text-[10px] text-emerald-300/70">{lang === "mr" ? "ओलावा" : "Soil Moisture"}</span>
              <span className="text-xs font-bold text-white">
                {tel?.surface?.soil_moisture_0_to_1cm ? `${(tel.surface.soil_moisture_0_to_1cm * 100).toFixed(0)}%` : "26%"}
              </span>
            </div>
            <div className="rounded-lg bg-black/20 p-1.5">
              <span className="block text-[10px] text-emerald-300/70">{lang === "mr" ? "आर्द्रता" : "Humidity"}</span>
              <span className="text-xs font-bold text-white">{tel?.surface?.relative_humidity_2m ?? 62}%</span>
            </div>
            <div className="rounded-lg bg-black/20 p-1.5">
              <span className="block text-[10px] text-emerald-300/70">{lang === "mr" ? "हवा गुणवत्ता" : "Air Quality"}</span>
              <span className="text-xs font-bold text-emerald-300">AQI {tel?.air_quality?.european_aqi ?? 50}</span>
            </div>
          </div>
        </div>

        {/* Today's AI Agromet Suggestion Card */}
        <div className="rounded-2xl border border-white/10 bg-emerald-950/40 p-4 shadow-lg backdrop-blur-md">
          <div className="flex items-center justify-between pb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-lime-400" />
              <h2 className="text-sm font-bold tracking-tight text-white">{t.aiSuggestion}</h2>
            </div>
            <button
              type="button"
              onClick={() => handleAudioSpeak(`${t.safeSpray}: ${t.safeSprayDesc}`)}
              className={cx(
                "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition",
                isPlayingAudio
                  ? "border-lime-400 bg-lime-400/20 text-lime-300 animate-pulse"
                  : "border-emerald-500/30 bg-emerald-900/40 text-emerald-300 hover:bg-emerald-800/40"
              )}
            >
              <Volume2 className="h-3 w-3" />
              <span>{isPlayingAudio ? t.playing : t.listenAudio}</span>
            </button>
          </div>

          <div className="space-y-2.5">
            {/* Safe Spray Window */}
            <div className="flex items-center justify-between rounded-xl border border-emerald-500/20 bg-gradient-to-r from-emerald-900/40 to-transparent p-3 hover:border-emerald-400/40 transition cursor-pointer">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-lime-500/20 text-lime-300">
                  <Sprout className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-white">{t.safeSpray}</h3>
                  <p className="text-[11px] text-emerald-200/70">{t.safeSprayDesc}</p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-emerald-400" />
            </div>

            {/* Irrigation Advisory */}
            <div className="flex items-center justify-between rounded-xl border border-emerald-500/20 bg-gradient-to-r from-emerald-900/40 to-transparent p-3 hover:border-emerald-400/40 transition cursor-pointer">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-teal-500/20 text-teal-300">
                  <Droplets className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-white">{t.irrigationTip}</h3>
                  <p className="text-[11px] text-emerald-200/70">{t.irrigationDesc}</p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-emerald-400" />
            </div>

            {/* Pest & Fungal Risk */}
            <div className="flex items-center justify-between rounded-xl border border-emerald-500/20 bg-gradient-to-r from-emerald-900/40 to-transparent p-3 hover:border-emerald-400/40 transition cursor-pointer">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 text-amber-300">
                  <Bug className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-white">{t.pestAlert}</h3>
                  <p className="text-[11px] text-emerald-200/70">{t.pestDesc}</p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-emerald-400" />
            </div>
          </div>
        </div>

        {/* My Cultivation Hub (Cards matching reference image) */}
        <div>
          <div className="flex items-center justify-between pb-2">
            <h2 className="text-sm font-bold tracking-tight text-white">{t.myCrops}</h2>
            <span className="text-[11px] font-semibold text-emerald-400">3 Plots · 7.8 Ha</span>
          </div>

          <div className="space-y-3">
            {crops.map((crop) => (
              <div
                key={crop.id}
                onClick={() => setSelectedCrop(crop.id)}
                className="group relative flex overflow-hidden rounded-2xl border border-white/10 bg-emerald-950/40 p-2.5 shadow-md backdrop-blur-md hover:border-emerald-400/40 transition cursor-pointer"
              >
                <img
                  src={crop.image}
                  alt={crop.name}
                  className="h-20 w-20 shrink-0 rounded-xl object-cover transition-transform group-hover:scale-105"
                />
                <div className="ml-3 flex flex-1 flex-col justify-between py-0.5">
                  <div>
                    <h3 className="text-xs font-bold text-white group-hover:text-emerald-300 transition">
                      {crop.name}
                    </h3>
                    <p className="mt-0.5 line-clamp-1 text-[11px] text-emerald-200/70">{crop.desc}</p>
                  </div>
                  <div className="flex items-center gap-2 pt-1 text-[10px]">
                    <span className="rounded-md bg-emerald-500/20 px-2 py-0.5 font-semibold text-emerald-300">
                      {crop.area}
                    </span>
                    <span className="rounded-md bg-white/10 px-2 py-0.5 text-white/80">
                      {crop.stage}
                    </span>
                    <span className="ml-auto text-emerald-400 font-medium">
                      {crop.nextWater}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Today Activities Checklist */}
        <div className="rounded-2xl border border-white/10 bg-emerald-950/40 p-4 shadow-lg backdrop-blur-md">
          <div className="flex items-center justify-between pb-2.5">
            <h2 className="text-sm font-bold tracking-tight text-white">{t.todayActivities}</h2>
            <span className="text-[11px] text-emerald-300">
              {tasks.filter((t) => t.done).length}/{tasks.length} Completed
            </span>
          </div>

          <div className="space-y-2">
            {tasks.map((task) => (
              <div
                key={task.id}
                onClick={() => toggleTask(task.id)}
                className="flex items-center justify-between rounded-xl bg-black/20 p-2.5 transition hover:bg-black/30 cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className={cx(
                      "flex h-4 w-4 items-center justify-center rounded border transition",
                      task.done
                        ? "border-emerald-400 bg-emerald-500 text-white"
                        : "border-white/30 bg-white/5"
                    )}
                  >
                    {task.done && <CheckCircle2 className="h-3 w-3" />}
                  </div>
                  <span
                    className={cx(
                      "text-xs",
                      task.done ? "text-emerald-300/60 line-through" : "text-white"
                    )}
                  >
                    {lang === "mr" ? task.textMr : task.textEn}
                  </span>
                </div>
                <span className="text-[10px] text-emerald-400/80">{task.time}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Floating Bottom Navigation Bar (Glass pill dock like the screenshot) */}
      <div className="absolute bottom-4 left-0 right-0 z-30 flex justify-center px-6">
        <nav className="flex items-center gap-6 rounded-full border border-white/15 bg-emerald-950/80 px-6 py-2.5 shadow-2xl backdrop-blur-xl">
          <button
            type="button"
            onClick={() => setActiveTab("home")}
            className={cx(
              "flex flex-col items-center gap-0.5 transition",
              activeTab === "home" ? "text-emerald-400 scale-110" : "text-emerald-100/50 hover:text-emerald-200"
            )}
          >
            <Home className="h-4 w-4" />
            <span className="text-[9px] font-medium">{lang === "mr" ? "मुख्य" : "Home"}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("crops")}
            className={cx(
              "flex flex-col items-center gap-0.5 transition",
              activeTab === "crops" ? "text-emerald-400 scale-110" : "text-emerald-100/50 hover:text-emerald-200"
            )}
          >
            <Sprout className="h-4 w-4" />
            <span className="text-[9px] font-medium">{lang === "mr" ? "पिके" : "Crops"}</span>
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
            onClick={() => setActiveTab("tasks")}
            className={cx(
              "flex flex-col items-center gap-0.5 transition",
              activeTab === "tasks" ? "text-emerald-400 scale-110" : "text-emerald-100/50 hover:text-emerald-200"
            )}
          >
            <Grid className="h-4 w-4" />
            <span className="text-[9px] font-medium">{lang === "mr" ? "अधिक" : "More"}</span>
          </button>
        </nav>
      </div>

      {/* Detail Crop Modal Overlay */}
      {selectedCrop && (
        <div className="absolute inset-0 z-50 flex flex-col bg-[#05160f]/95 backdrop-blur-xl animate-fade-in p-5">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <button
              type="button"
              onClick={() => setSelectedCrop(null)}
              className="flex items-center gap-1.5 text-xs font-semibold text-emerald-300 hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" /> {lang === "mr" ? "मागे जा" : "Back"}
            </button>
            <span className="text-xs font-bold text-white">{t.cropOverview}</span>
            <Share2 className="h-4 w-4 text-emerald-400 cursor-pointer" />
          </div>

          <div className="flex-1 overflow-y-auto pt-4 space-y-4">
            {(() => {
              const c = crops.find((item) => item.id === selectedCrop);
              if (!c) return null;
              return (
                <>
                  <div className="relative overflow-hidden rounded-2xl border border-white/15 h-44">
                    <img src={c.image} alt={c.name} className="h-full w-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                    <div className="absolute bottom-3 left-3">
                      <span className="rounded bg-emerald-500 px-2 py-0.5 text-[10px] font-bold text-black uppercase">
                        {c.area}
                      </span>
                      <h3 className="mt-1 text-base font-bold text-white">{c.name}</h3>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl border border-white/10 bg-emerald-950/60 p-3">
                      <span className="text-[11px] text-emerald-300">{lang === "mr" ? "आरोग्य निर्देशांक" : "Crop Health"}</span>
                      <p className="text-xl font-bold text-lime-400">{c.health}%</p>
                      <p className="text-[10px] text-muted">Optimal biomass NDVI</p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-emerald-950/60 p-3">
                      <span className="text-[11px] text-emerald-300">{lang === "mr" ? "पावसाचा धोका" : "Rain Risk (Blend)"}</span>
                      <p className="text-xl font-bold text-emerald-300">{blendRain.toFixed(1)} mm</p>
                      <p className="text-[10px] text-muted">0% washout threshold</p>
                    </div>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-emerald-950/60 p-4">
                    <h4 className="text-xs font-bold text-white mb-2">{lang === "mr" ? "तज्ज्ञ सल्ला" : "Field Agronomist Advisory"}</h4>
                    <p className="text-xs text-emerald-200/80 leading-relaxed">
                      {lang === "mr"
                        ? "अ‍ॅटमॉसफ्युजन मॉडेलच्या अंदाजानुसार पुढील ३ दिवस हवामान कोरडे राहील. कीटकनाशक फवारणीसाठी ही उत्तम वेळ आहे. खतांचा डोस संध्याकाळी द्यावा."
                        : "According to AtmosFusion 13-model blend, atmospheric stability will remain high over the next 72 hours. Proceed with planned intercultural operations and fertilizer dosing."}
                    </p>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}

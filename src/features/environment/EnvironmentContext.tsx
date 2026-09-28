import { Card } from "@/components/ui";
import { useTelemetry, type Product } from "./api";
const value = (n: number | null | undefined, digits = 1) => n == null || !Number.isFinite(n) ? "—" : n.toFixed(digits);
function Provenance({ product }: { product: Product | undefined }) {
  return <p className="mt-3 text-[11px] leading-relaxed text-muted">{product?.source ?? "Source unavailable"} · modelled<br />{product?.status === "available" ? `Valid ${product.valid_at?.replace("T", " ")} UTC` : "Temporarily unavailable"}</p>;
}
export default function EnvironmentContext({ pointId }: { pointId: string }) {
  const { data: tel, isLoading, error, refetch } = useTelemetry(pointId);
  return <Card title="Environmental context" description="Optional modelled products, separate from the Bharosa rainfall blend.">
    {isLoading ? <p role="status" className="text-sm text-muted">Retrieving environmental context…</p> : error || !tel ? <div><p className="text-sm text-muted">Environmental context is temporarily unavailable. Your rainfall forecast is independent of this service.</p><button type="button" className="spatial-toggle mt-3" onClick={() => refetch()}>Retry context</button></div> : <>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-line bg-subtle/40 p-4"><h3 className="text-xs font-semibold">Air quality · European AQI</h3><p className="num mt-3 text-2xl font-semibold">{value(tel.air_quality?.european_aqi, 0)}</p><p className="mt-2 text-xs text-muted">PM2.5 {value(tel.air_quality?.pm2_5)} µg/m³ · PM10 {value(tel.air_quality?.pm10)} µg/m³</p><p className="mt-1 text-xs text-muted">UV index {value(tel.air_quality?.uv_index)}</p><Provenance product={tel.products.air_quality} /></div>
        <div className="rounded-xl border border-line bg-subtle/40 p-4"><h3 className="text-xs font-semibold">Surface conditions</h3><p className="num mt-3 text-2xl font-semibold">{value(tel.surface?.relative_humidity_2m, 0)}<small className="text-xs font-normal">% humidity</small></p><p className="mt-2 text-xs text-muted">Pressure {value(tel.surface?.surface_pressure)} hPa</p><p className="mt-1 text-xs text-muted">Soil water (0–1 cm) {value(tel.surface?.soil_moisture_0_to_1cm, 3)} m³/m³</p><Provenance product={tel.products.surface} /></div>
        {tel.is_coastal && <div className="rounded-xl border border-line bg-subtle/40 p-4 sm:col-span-2"><h3 className="text-xs font-semibold">Offshore wave context</h3><p className="num mt-3 text-2xl font-semibold">{value(tel.marine?.wave_height, 2)}<small className="text-xs font-normal"> m wave height</small></p><p className="mt-2 text-xs text-muted">Period {value(tel.marine?.wave_period)} s · direction {value(tel.marine?.wave_direction, 0)}°</p><Provenance product={tel.products.marine} /><a href="https://incois.gov.in/" target="_blank" rel="noreferrer" className="mt-3 inline-block text-xs font-semibold text-accent">Check official INCOIS advisories ↗</a></div>}
      </div>
      <p className="mt-4 text-xs leading-relaxed text-muted">Air quality: <a href="https://open-meteo.com/en/docs/air-quality-api" target="_blank" rel="noreferrer" className="underline">CAMS via Open-Meteo</a>. Surface and marine: <a href="https://open-meteo.com/" target="_blank" rel="noreferrer" className="underline">Open-Meteo</a>. Model grid values can differ from local observations. Soil water is volumetric content; wave height does not measure storm surge.</p>
    </>}
  </Card>;
}

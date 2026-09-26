"""Markdown + figure reports from the validation/test JSON (numbers are copied, never recomputed here)."""

from __future__ import annotations

import pandas as pd

from ml.common import path


def _fmt(v, nd=2):
    if v is None or (isinstance(v, float) and v != v):
        return "–"
    return f"{v:.{nd}f}" if isinstance(v, float) else str(v)


def md_table(df: pd.DataFrame, cols: list[str], nd: int = 2) -> str:
    head = "| " + " | ".join(cols) + " |\n|" + "|".join([":---"] + ["---:"] * (len(cols) - 1)) + "|\n"
    body = "".join("| " + " | ".join(_fmt(r[c], nd) for c in cols) + " |\n" for _, r in df.iterrows())
    return head + body


def figures(result: dict, out_dir=None) -> list[str]:
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    fig_dir = (out_dir or path("reports_dir")) / "figures"
    fig_dir.mkdir(parents=True, exist_ok=True)
    made = []
    s = pd.DataFrame(result["scores"])

    # RMSE by lead
    fig, ax = plt.subplots(figsize=(7, 4))
    for m in ["E1 equal mean", "E2 static MME", "E3 Stage A", result["chosen_stage_b"], "B-alt stacking (mean)"]:
        g = s[s["method"] == m].sort_values("lead")
        if len(g):
            ax.plot(g["lead"], g["rmse"], marker="o", label=m)
    src = s[s["kind"] == "source"]
    best = src.loc[src.groupby("lead")["rmse"].idxmin()].sort_values("lead")
    ax.plot(best["lead"], best["rmse"], "k--", marker="x", label="best single source (per lead)")
    ax.set(xlabel="lead day", ylabel="RMSE (mm/day)", title="Validation RMSE vs IMD rain (lower is better)")
    ax.grid(alpha=0.3)
    ax.legend(fontsize=8)
    fig.tight_layout()
    fig.savefig(fig_dir / "validation_rmse_by_lead.png", dpi=130)
    plt.close(fig)
    made.append("figures/validation_rmse_by_lead.png")

    # reliability at 64.5 mm
    fig, ax = plt.subplots(figsize=(5, 5))
    ax.plot([0, 1], [0, 1], color="grey", lw=1)
    for key, table in result["reliability"].items():
        thr, method = key.split("|")
        if thr != "64_5" or "climatology" in method:
            continue
        t = pd.DataFrame(table)
        ax.plot(t["mean_p"], t["obs_freq"], marker="o", label=method)
    ax.set(xlabel="forecast probability", ylabel="observed frequency", title="Reliability, P(rain ≥ 64.5 mm)")
    ax.legend(fontsize=7)
    ax.grid(alpha=0.3)
    fig.tight_layout()
    fig.savefig(fig_dir / "validation_reliability_64_5.png", dpi=130)
    plt.close(fig)
    made.append("figures/validation_reliability_64_5.png")

    # feature importance
    imp = pd.DataFrame(result["importance"]).head(20)[::-1]
    fig, ax = plt.subplots(figsize=(6, 6))
    ax.barh(imp["feature"], imp["gain_share"])
    ax.set(xlabel="share of total gain", title="Stage B feature importance (gain)")
    fig.tight_layout()
    fig.savefig(fig_dir / "stage_b_importance.png", dpi=130)
    plt.close(fig)
    made.append("figures/stage_b_importance.png")

    # regime calendar
    reg_file = path("data_dir", "static") / "regimes.parquet"
    if reg_file.exists():
        reg = pd.read_parquet(reg_file)
        reg = reg[reg["date"] >= "2024-01-01"]
        fig, ax = plt.subplots(figsize=(10, 3))
        ax.plot(reg["date"], reg["z"], lw=0.7, color="black")
        colors = {"active": "tab:blue", "break": "tab:orange"}
        for lab, c in colors.items():
            r = reg[reg["regime"] == lab]
            ax.scatter(r["date"], r["z"], s=8, color=c, label=lab)
        ax.axhline(1, ls=":", color="grey")
        ax.axhline(-1, ls=":", color="grey")
        ax.set(ylabel="core-zone rain anomaly (z)", title="Monsoon regime calendar (IMD grids, 1991-2020 normal)")
        ax.legend(fontsize=8)
        fig.tight_layout()
        fig.savefig(fig_dir / "regime_calendar.png", dpi=130)
        plt.close(fig)
        made.append("figures/regime_calendar.png")
    return made


def write_validation(result: dict, out_dir=None) -> None:
    out_dir = out_dir or path("reports_dir")
    figs = figures(result, out_dir)
    s = pd.DataFrame(result["scores"])
    b = result["chosen_stage_b"]
    lines = [
        "# Validation report (training period, blocked cross-validation)",
        "",
        f"Generated {result['generated_at'][:16]} UTC · commit `{(result.get('git_commit') or 'uncommitted')[:10]}` · "
        f"{result['period']['start']} to {result['period']['end']} · {result['points']} districts · truth: {result['truth']}",
        "",
        "Every number below is out-of-fold: each month is predicted by models fitted without it and without the "
        "10 days either side. Stage B's tau/lambda and the sigma scale are cross-fitted. The frozen test "
        "season (June-September 2025) is not used.",
        "",
        f"Chosen Stage B variant (lowest validation RMSE): **{b}**.",
        "",
        "## Rain, all methods, by lead",
        "",
    ]
    for lead, g in s.groupby("lead"):
        g = g.sort_values(["kind", "rmse"])
        lines += [f"### Lead day {lead}", "",
                  md_table(g, ["method", "n", "rmse", "mae", "bias", "corr", "ets_64_5", "pod_64_5", "far_64_5",
                               "ets_115_6", "sedi_115_6"]), ""]
    lines += ["## Stage B vs references: paired 5-day block bootstrap (RMSE difference, mm)", "",
              "Negative = Stage B better. An interval that crosses zero is not a demonstrated gain.", "",
              md_table(pd.DataFrame(result["bootstrap"]), ["lead", "b", "diff", "lo", "hi"]), ""]
    lines += ["## Probabilistic scores", "", md_table(pd.DataFrame(result["probabilistic"]),
              ["lead", "method", "crps_normal", "quantile_score", "coverage_10_90"]), "",
              "Coverage of the 10-90% range should be close to 0.80.", "",
              "## Exceedance probabilities: Brier skill vs IMD 1991-2020 climatology", "",
              md_table(pd.DataFrame(result["brier"]),
                       ["threshold", "method", "n", "events", "brier", "bss_vs_climatology", "reliability", "resolution"], 3), "",
              "## Stratified RMSE (all leads)", "",
              md_table(pd.DataFrame(result["strata"]), ["by", "group", "n", "E3 Stage A", b, "E2 static MME", "E1 equal mean"]), "",
              "## Stage B feature importance (gain share, top 15)", "",
              md_table(pd.DataFrame(result["importance"]).head(15), ["feature", "gain_share"], 3), "",
              "## Figures", ""] + [f"![{f}]({f})" for f in figs]
    (out_dir / "validation.md").write_text("\n".join(lines) + "\n", encoding="utf-8")


def export_for_web(result: dict) -> dict:
    """Slim copy of the validation results for the website (served by /api/v1/validation)."""
    keep = ("lead", "method", "kind", "n", "rmse", "mae", "bias", "ets_64_5", "pod_64_5", "far_64_5", "ets_115_6")
    web = {
        "generated_at": result["generated_at"], "git_commit": result.get("git_commit"), "period": result["period"],
        "truth": result["truth"], "points": result["points"], "sources": result["sources"],
        "chosen_stage_b": result["chosen_stage_b"],
        "scores": [{k: r.get(k) for k in keep} for r in result["scores"]],
        "bootstrap": [{k: r[k] for k in ("lead", "b", "diff", "lo", "hi")} for r in result["bootstrap"]],
        "brier": [{k: r[k] for k in ("threshold", "method", "n", "events", "bss_vs_climatology")} for r in result["brier"]],
        "probabilistic": result["probabilistic"],
        "importance": result["importance"][:12],
    }
    return web

import { FABRIC_TABLES, TABLE_DESCRIPTIONS } from "@/lib/export/fabric";
import { Panel } from "./ui";

export function ExportPanel() {
  return (
    <Panel title="Fabric analytics">
      <p className="text-sm leading-relaxed text-mist">
        Download the full match as Lakehouse-ready tables, load them into Microsoft Fabric, and build Power BI reports on top.
      </p>
      <ul className="mt-4 divide-y divide-rail/60">
        {FABRIC_TABLES.map((t) => (
          <li key={t} className="flex items-center justify-between gap-3 py-2.5">
            <div className="min-w-0">
              <p className="font-display text-base font-semibold">{t}</p>
              <p className="text-xs text-mist">{TABLE_DESCRIPTIONS[t]}</p>
            </div>
            <a
              href={`/api/export/${t}`}
              download
              className="shrink-0 rounded-md border border-rail px-3 py-1.5 text-xs font-semibold hover:border-chalk"
            >
              Download CSV
            </a>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs leading-relaxed text-mist">
        Or upload straight to your Lakehouse with <code className="text-chalk">npm run upload:onelake</code>. Steps are in fabric/README.md.
      </p>
    </Panel>
  );
}
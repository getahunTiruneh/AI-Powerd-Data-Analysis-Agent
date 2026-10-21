import { useMemo, useRef, useCallback, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, Legend } from "recharts";
import { Download, Camera, Eye, Table2 } from "lucide-react";
import html2canvas from "html2canvas";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const BRAND_COLORS = [
  "hsl(213, 62%, 35%)",
  "hsl(174, 70%, 34%)",
  "hsl(210, 16%, 30%)",
  "hsl(192, 55%, 42%)",
  "hsl(42, 70%, 42%)",
  "hsl(160, 42%, 48%)",
  "hsl(198, 42%, 52%)",
  "hsl(25, 55%, 42%)",
];

const PIE_COLORS = BRAND_COLORS;

function ChartBlock({ json, title }: { json: string; title?: string }) {
  const chartRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);

  const chartData = useMemo(() => {
    try {
      const parsed = JSON.parse(json);
      if ((parsed.type === "bar" || parsed.type === "line" || parsed.type === "pie") && Array.isArray(parsed.data)) {
        return parsed;
      }
      return null;
    } catch {
      return null;
    }
  }, [json]);

  const exportAsPNG = useCallback(async () => {
    if (!chartRef.current) return;
    setExporting(true);
    try {
      const canvas = await html2canvas(chartRef.current, {
        backgroundColor: "#ffffff",
        scale: 2,
        useCORS: true,
      });
      const link = document.createElement("a");
      link.download = `${title || "chart"}_${Date.now()}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch (err) {
      console.error("Failed to export chart:", err);
    } finally {
      setExporting(false);
    }
  }, [title]);

  if (!chartData) {
    return (
      <pre className="bg-muted p-3 rounded-lg overflow-x-auto text-xs my-2 font-mono">
        {json}
      </pre>
    );
  }

  const dataSample = chartData.data[0] || {};
  const nameKey = Object.keys(dataSample).find(k => k === "name" || k === "label" || k === "category" || k === "month" || k === "year" || k === "quarter") || Object.keys(dataSample)[0];
  const valueKeys = Object.keys(dataSample).filter(k => k !== nameKey);

  if (valueKeys.length === 0) return null;

  const cleanData = chartData.data.map(item => {
    const cleaned: Record<string, any> = { ...item };
    valueKeys.forEach(key => {
      if (typeof cleaned[key] === 'string') {
        cleaned[key] = parseFloat(cleaned[key]) || 0;
      }
    });
    return cleaned;
  });

  const dataLen = chartData.data.length;
  const chartHeight = chartData.type === "pie" ? 400 : Math.min(Math.max(dataLen * 70, 220), 400);
  const chartMaxWidth = chartData.type !== "pie" && dataLen <= 4
    ? Math.min(Math.max(dataLen * 220, 280), 600)
    : undefined;

  // Pie chart
  if (chartData.type === "pie") {
    return (
      <div ref={chartRef} className="w-full bg-card border rounded-xl my-3 shadow-sm group">
        <div className="flex items-center justify-between px-4 pt-4 pb-1">
          {title && <p className="text-sm font-semibold text-foreground">{title}</p>}
          <button
            onClick={exportAsPNG}
            disabled={exporting}
            className="flex items-center gap-1 px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground rounded-md hover:bg-muted transition-colors opacity-0 group-hover:opacity-100"
          >
            {exporting ? (
              <span className="flex items-center gap-1"><Download className="h-3 w-3 animate-spin" /> Exporting...</span>
            ) : (
              <span className="flex items-center gap-1"><Camera className="h-3 w-3" /> Export PNG</span>
            )}
          </button>
        </div>
        <div className="w-full px-2" style={{ height: chartHeight }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={cleanData}
                dataKey={valueKeys[0]}
                nameKey={nameKey}
                cx="50%"
                cy="50%"
                outerRadius={130}
                innerRadius={65}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                labelLine={false}
              >
                {cleanData.map((_, idx) => (
                  <Cell key={`cell-${idx}`} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}
                labelStyle={{ color: "hsl(var(--foreground))", fontWeight: 600 }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  }

  // Bar or Line chart
  const ChartComponent = chartData.type === "line" ? LineChart : BarChart;
  const DataComponent = chartData.type === "line" ? Line : Bar;

  return (
    <div ref={chartRef} className="bg-card border rounded-xl my-3 shadow-sm group" style={{ maxWidth: chartMaxWidth }}>
      <div className="flex items-center justify-between px-4 pt-4 pb-1">
        {title && <p className="text-sm font-semibold text-foreground">{title}</p>}
        <button
          onClick={exportAsPNG}
          disabled={exporting}
          className="flex items-center gap-1 px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground rounded-md hover:bg-muted transition-colors opacity-0 group-hover:opacity-100"
        >
          {exporting ? (
            <span className="flex items-center gap-1"><Download className="h-3 w-3 animate-spin" /> Exporting...</span>
          ) : (
            <span className="flex items-center gap-1"><Camera className="h-3 w-3" /> Export PNG</span>
          )}
        </button>
      </div>
      <div className="w-full px-2" style={{ height: chartHeight }}>
        <ResponsiveContainer width="100%" height="100%">
          <ChartComponent
            data={cleanData}
            {...(chartData.type === "bar" ? { barCategoryGap: "20%" } : {})}
          >
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted/50" />
            <XAxis dataKey={nameKey} tick={{ fontSize: 12 }} className="fill-muted-foreground" />
            <YAxis tick={{ fontSize: 12 }} className="fill-muted-foreground" />
            <Tooltip
              contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}
              labelStyle={{ color: "hsl(var(--foreground))", fontWeight: 600 }}
            />
            {valueKeys.map((key, idx) => {
              const isBar = chartData.type === "bar";
              return (
              <DataComponent
                key={key}
                type="monotone"
                dataKey={key}
                fill={BRAND_COLORS[idx % BRAND_COLORS.length]}
                stroke={BRAND_COLORS[idx % BRAND_COLORS.length]}
                {...(isBar ? { maxBarSize: 120 } : {})}
                radius={isBar ? [4, 4, 0, 0] : undefined}
              />
              );
            })}
          </ChartComponent>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function parseMarkdownTables(md: string): Array<{ headers: string[]; rows: string[][] }> {
  const tables: Array<{ headers: string[]; rows: string[][] }> = [];
  const lines = md.split("\n");
  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();
    if (line.startsWith("|") && line.endsWith("|")) {
      const headerCells = line.slice(1, -1).split("|").map(c => c.trim());
      if (i + 1 < lines.length) {
        const sepLine = lines[i + 1].trim();
        if (sepLine.startsWith("|") && /^[\s|:\-]+$/.test(sepLine)) {
          const sepCells = sepLine.slice(1, -1).split("|").map(c => c.trim());
          if (sepCells.every(c => /^[-:\s]+$/.test(c))) {
            const rows: string[][] = [];
            let j = i + 2;
            while (j < lines.length) {
              const rl = lines[j].trim();
              if (rl.startsWith("|") && rl.endsWith("|")) {
                rows.push(rl.slice(1, -1).split("|").map(c => c.trim()));
                j++;
              } else break;
            }
            tables.push({ headers: headerCells, rows });
            i = j;
            continue;
          }
        }
      }
    }
    i++;
  }
  return tables;
}

function exportTableCSV(headers: string[], rows: string[][]) {
  const csv = [headers, ...rows].map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `table_${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

async function exportTableXLSX(headers: string[], rows: string[][]) {
  const XLSX = await import("xlsx");
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Data");
  XLSX.writeFile(wb, `table_${Date.now()}.xlsx`);
}

function TableBlock({ headers, rows, children }: { headers: string[]; rows: string[][]; children: React.ReactNode }) {
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <>
      <div className="relative group my-4">
        <div className="absolute top-2 right-2 z-20 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <button className="flex items-center gap-1 px-2 py-1 text-[11px] bg-white border rounded-md shadow-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                <Eye className="h-3.5 w-3.5" /> View full data
              </button>
            </DialogTrigger>
            <DialogContent className="max-w-5xl max-h-[85vh]">
              <DialogHeader>
                <DialogTitle>Full Table Data</DialogTitle>
              </DialogHeader>
              <div className="overflow-auto max-h-[65vh] rounded border">
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="bg-muted/80 sticky top-0 z-10">
                      {headers.map((h, i) => (
                        <th key={i} className="border-b px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, ri) => (
                      <tr key={ri} className="hover:bg-muted/30 odd:bg-background even:bg-muted/10">
                        {row.map((cell, ci) => (
                          <td key={ci} className="border-b border-border/30 px-3 py-2 whitespace-nowrap">{cell}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </DialogContent>
          </Dialog>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-1 px-2 py-1 text-[11px] bg-white border rounded-md shadow-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                <Download className="h-3.5 w-3.5" /> Export
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => exportTableCSV(headers, rows)}>
                <Table2 className="h-3.5 w-3.5 mr-2" /> .csv
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportTableXLSX(headers, rows)}>
                <Table2 className="h-3.5 w-3.5 mr-2" /> .xlsx
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="overflow-x-auto max-h-[600px] rounded-lg border border-border">
          <table className="w-full border-collapse text-xs rounded-lg">
            {children}
          </table>
        </div>
      </div>
    </>
  );
}

function ContentSegments({ content }: { content: string }) {
  const segments = useMemo(() => {
    const parts: Array<{ type: "text" | "chart"; content: string }> = [];
    const jsonRegex = /```json\s*\n([\s\S]*?)\n\s*```/g;
    let lastIndex = 0;
    let match;

    while ((match = jsonRegex.exec(content)) !== null) {
      if (match.index > lastIndex) {
        const textBefore = content.slice(lastIndex, match.index).trim();
        if (textBefore) {
          // Check if there's a heading right before the JSON
          const headingMatch = textBefore.match(/(#{1,3}\s+.+)$/s);
          if (headingMatch) {
            const headingEnd = match.index - headingMatch[1].length;
            if (headingEnd > lastIndex) {
              parts.push({ type: "text", content: content.slice(lastIndex, headingEnd).trim() });
            }
            parts.push({ type: "text", content: headingMatch[1] });
          } else {
            parts.push({ type: "text", content: textBefore });
          }
        }
      }
      parts.push({ type: "chart", content: match[1] });
      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < content.length) {
      const remaining = content.slice(lastIndex).trim();
      if (remaining) {
        parts.push({ type: "text", content: remaining });
      }
    }

    return parts;
  }, [content]);

  return (
    <>
      {segments.map((seg, i) => {
        if (seg.type === "chart") {
          // Find previous heading for chart title
          let title: string | undefined;
          if (i > 0) {
            const prev = segments[i - 1];
            if (prev.type === "text") {
              const heading = prev.content.match(/#{1,3}\s+(.+)/);
              if (heading) title = heading[1];
            }
          }
          return <ChartBlock key={`chart-${i}`} json={seg.content} title={title} />;
        }
        const tables = parseMarkdownTables(seg.content);
        let tableIdx = 0;
        return (
          <ReactMarkdown
            key={`text-${i}`}
            remarkPlugins={[remarkGfm]}
            components={{
              table: ({ children }) => {
                const data = tableIdx < tables.length ? tables[tableIdx++] : null;
                if (data) {
                  return <TableBlock headers={data.headers} rows={data.rows}>{children}</TableBlock>;
                }
                return (
                  <div className="overflow-x-auto my-4 rounded-lg border border-border">
                    <table className="w-full border-collapse text-xs">{children}</table>
                  </div>
                );
              },
              thead: ({ children }) => (
                <thead className="bg-muted/80 sticky top-0 z-10">{children}</thead>
              ),
              th: ({ children }) => (
                <th className="border-b border-border px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground bg-muted/60 whitespace-nowrap sticky top-0">{children}</th>
              ),
              td: ({ children }) => (
                <td className="border-b border-border/30 px-3 py-2 text-xs whitespace-nowrap">{children}</td>
              ),
              tr: ({ children }) => (
                <tr className="hover:bg-muted/30 transition-colors last:border-b-0 odd:bg-background even:bg-muted/10">{children}</tr>
              ),
              code: ({ className, children, ...props }) => {
                const match = /language-(\w+)/.exec(className || "");
                const isInline = !match;
                if (isInline) {
                  return <code className="bg-muted/60 px-1.5 py-0.5 rounded text-xs font-mono">{children}</code>;
                }
                return (
                  <pre className="bg-muted/40 p-3 rounded-lg overflow-x-auto text-xs my-2 font-mono">
                    <code {...props}>{children}</code>
                  </pre>
                );
              },
              h1: ({ children }) => <h1 className="text-xl font-bold mt-6 mb-3 text-foreground">{children}</h1>,
              h2: ({ children }) => <h2 className="text-lg font-semibold mt-5 mb-2 text-foreground">{children}</h2>,
              h3: ({ children }) => <h3 className="text-base font-medium mt-4 mb-2 text-foreground">{children}</h3>,
              ul: ({ children }) => <ul className="list-disc pl-5 my-2 space-y-1">{children}</ul>,
              ol: ({ children }) => <ol className="list-decimal pl-5 my-2 space-y-1">{children}</ol>,
              li: ({ children }) => <li className="text-sm">{children}</li>,
              p: ({ children }) => <p className="my-2 text-sm leading-relaxed">{children}</p>,
              a: ({ href, children }) => <a href={href} className="text-primary hover:underline">{children}</a>,
            }}
          >
            {seg.content}
          </ReactMarkdown>
        );
      })}
    </>
  );
}

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none">
      <ContentSegments content={content} />
    </div>
  );
}

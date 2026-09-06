import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.cwd(), "src");
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

describe("dashboard intelligence phases 174-175", () => {
  it("surfaces the live priority queue before deeper dashboard analysis", () => {
    const source = read("features/dashboard/pages/Dashboard.tsx");
    const attention = source.indexOf('title="Needs attention"');
    const cashFlow = source.indexOf('title="Collections performance"');
    const propertyDetail = source.indexOf('title="Property performance"');

    expect(attention).toBeGreaterThan(-1);
    expect(cashFlow).toBeGreaterThan(attention);
    expect(propertyDetail).toBeGreaterThan(cashFlow);
  });

  it("keeps priority rendering derived from existing attention items", () => {
    const dashboard = read("features/dashboard/pages/Dashboard.tsx");
    const strip = read("features/dashboard/components/AttentionStrip.tsx");

    expect(dashboard).toContain("buildAttentionItems(stats, formatCurrency)");
    expect(dashboard).toContain("<AttentionStrip items={attentionItems} loading={loading} />");
    expect(strip).toContain("items.reduce((sum, item) => sum + item.count, 0)");
    expect(strip).not.toContain("useQuery");
    expect(strip).not.toContain("supabase");
  });
});

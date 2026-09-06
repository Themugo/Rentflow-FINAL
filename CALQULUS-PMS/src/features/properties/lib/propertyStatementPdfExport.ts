// @ts-nocheck — Phase 12: remaining local types until live supabase gen types
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { getAutoTableFinalY } from "@/shared/lib/pdf/companyPdfHeader";
import { formatDate } from "@/shared/lib/dateFormat";
import { CurrencyCode } from "@/shared/hooks/useCurrency";

interface UnitRow {
  unit_number: string;
  tenant_name: string;
  rent_payable: number;
  rent_paid: number;
  deposit: number;
  water_bill: number;
  water_paid: number;
  water_balance: number;
  garbage: number;
  total: number;
  balance: number;
  ref_no: string;
  paid_date: string;
}

interface DeductionRow {
  name: string;
  amount: number;
}

interface StatementData {
  property_name: string;
  property_address: string;
  month_label: string;
  units: UnitRow[];
  deductions: DeductionRow[];
  total_rent_collected: number;
  total_deposits: number;
  total_water_fees: number;
  grand_total: number;
  total_deductions: number;
  net_amount: number;
}

interface CompanySettings {
  company_name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  email: string | null;
  phone: string | null;
  logo_url: string | null;
}

const fmt = (amount: number, currency: CurrencyCode = "KES") => {
  const locale = currency === "KES" ? "en-KE" : "en-US";
  return new Intl.NumberFormat(locale, { style: "currency", currency, minimumFractionDigits: 0 }).format(amount);
};

export const generatePropertyStatementData = async (
  propertyId: string,
  monthDate: Date // any date within the target month
): Promise<StatementData | null> => {
  const startOfMonth = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const endOfMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
  const startStr = startOfMonth.toISOString().split("T")[0];
  const endStr = endOfMonth.toISOString().split("T")[0];
  const monthLabel = format(startOfMonth, 'MMMM yyyy');

  // Fetch property
  const { data: property } = await supabase
    .from("properties")
    .select("id, name, address, manager_id")
    .eq("id", propertyId)
    .single();

  if (!property) return null;

  // Fetch units, tenants, invoices, water readings, deductions, amenity charges in parallel
  const [unitsRes, tenantsRes, invoicesRes, waterRes, deductionsRes, amenityRes, leasesRes] = await Promise.all([
    supabase.from("units").select("id, unit_number, status, monthly_rent").eq("property_id", propertyId).order("unit_number"),
    supabase.from("tenants").select("id, name, email, unit, unit_id, monthly_rent, status").eq("property_id", propertyId),
    supabase.from("invoices").select("*").gte("due_date", startStr).lte("due_date", endStr),
    supabase.from('water_meter_readings').select("*").eq("property_id", propertyId).gte("reading_date", startStr).lte("reading_date", endStr),
    supabase.from('property_deductions').select("*").eq("property_id", propertyId).eq("is_active", true),
    supabase.from('property_amenity_charges').select("*").eq("property_id", propertyId).eq("is_active", true),
    supabase.from("leases").select("id, tenant_id, deposit, unit_id").eq("property_id", propertyId),
  ]);

  const units = (unitsRes.data || []) as Array<{id: string; unit_number: string; status: string; monthly_rent: number}>;
  const tenants = (tenantsRes.data || []) as Array<{id: string; name: string; email: string; unit: string; unit_id: string; monthly_rent: number; status: string}>;
  const allInvoices = (invoicesRes.data || []) as Array<{tenant_id: string; amount: number; status: string; description?: string; invoice_number?: string; paid_date?: string}>;
  const waterReadings = (waterRes.data || []) as Array<{unit_id: string; total_amount: number; status: string}>;
  const deductions = (deductionsRes.data || []) as Array<{deduction_name: string; deduction_type: string; amount: number}>;
  const amenityCharges = (amenityRes.data || []) as Array<{unit_id?: string; charge_type: string; amount: number}>;
  const leases = (leasesRes.data || []) as Array<{tenant_id: string; deposit: number; unit_id: string}>;

  // Filter invoices for tenants in this property
  const tenantIds = tenants.map((t) => t.id);
  const propertyInvoices = allInvoices.filter((inv) => tenantIds.includes(inv.tenant_id));

  let totalRentCollected = 0;
  const totalDeposits = 0;
  let totalWaterFees = 0;

  const unitRows: UnitRow[] = units.map((unit) => {
    const tenant = tenants.find((t) => t.unit_id === unit.id && t.status === "active");
    const lease = leases.find((l) => l.unit_id === unit.id);
    const rentPayable = tenant?.monthly_rent || unit.monthly_rent || 0;

    // Rent invoices for this tenant this month
    const tenantInvoices = tenant
      ? propertyInvoices.filter((inv) => inv.tenant_id === tenant.id && !inv.description?.toLowerCase().includes("water"))
      : [];
    const rentPaid = tenantInvoices
      .filter((inv) => inv.status === "paid")
      .reduce((s: number, inv) => s + Number(inv.amount), 0);

    const deposit = lease?.deposit || 0;

    // Water readings for this unit
    const unitWater = waterReadings.filter((r) => r.unit_id === unit.id);
    const waterBill = unitWater.reduce((s: number, r) => s + Number(r.total_amount || 0), 0);
    const waterPaid = unitWater.filter((r) => r.status === "paid").reduce((s: number, r) => s + Number(r.total_amount || 0), 0);

    // Amenity charges for this unit (or property-wide with no unit_id)
    const unitAmenities = amenityCharges.filter((a) => a.unit_id === unit.id || !a.unit_id);
    const garbage = unitAmenities
      .filter((a) => a.charge_type === "garbage")
      .reduce((s: number, a) => s + Number(a.amount), 0);

    const total = rentPayable + waterBill + garbage;
    const balance = total - rentPaid - waterPaid;

    totalRentCollected += rentPaid;
    totalWaterFees += waterBill;

    // Get payment reference
    const paidInvoice = tenantInvoices.find((inv) => inv.status === "paid");
    const refNo = paidInvoice?.invoice_number || "";
    const paidDate = paidInvoice?.paid_date || "";

    return {
      unit_number: unit.unit_number,
      tenant_name: tenant?.name || "-",
      rent_payable: rentPayable,
      rent_paid: rentPaid,
      deposit,
      water_bill: waterBill,
      water_paid: waterPaid,
      water_balance: waterBill - waterPaid,
      garbage,
      total,
      balance,
      ref_no: refNo,
      paid_date: paidDate ? formatDate(paidDate) : "",
    };
  });

  // Calculate deductions
  const grandTotal = totalRentCollected + totalDeposits + totalWaterFees;
  const deductionRows: DeductionRow[] = deductions.map((d) => ({
    name: d.deduction_name,
    amount: d.deduction_type === "percentage" ? grandTotal * (Number(d.amount) / 100) : Number(d.amount),
  }));
  const totalDeductionAmount = deductionRows.reduce((s, d) => s + d.amount, 0);

  return {
    property_name: property.name,
    property_address: property.address,
    month_label: monthLabel,
    units: unitRows,
    deductions: deductionRows,
    total_rent_collected: totalRentCollected,
    total_deposits: totalDeposits,
    total_water_fees: totalWaterFees,
    grand_total: grandTotal,
    total_deductions: totalDeductionAmount,
    net_amount: grandTotal - totalDeductionAmount,
  };
};

export const generatePropertyStatementPDF = async (
  data: StatementData,
  currency: CurrencyCode = "KES"
): Promise<jsPDF> => {
  // Landscape A4 to fit all columns — matches the uploaded Kenyan property statement format
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();   // 297mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 210mm

  // Number formatter — no currency symbol in cells (keeps table compact like the uploaded sheet)
  const n = (v: number) => v === 0 ? "-" : Number(v).toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const f = (v: number) => fmt(v, currency);

  // Fetch company settings
  const { data: cs } = await supabase.from("company_settings").select("*").maybeSingle();
  const company = cs as CompanySettings | null;

  // ── Header ─────────────────────────────────────────────────────────────────
  doc.setFillColor(26, 86, 219);
  doc.rect(0, 0, pageWidth, 18, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text(company?.company_name || "Property Management", 10, 8);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("MONTHLY COLLECTION STATEMENT", 10, 14);

  // Property name + month on right
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text(`${data.property_name}  ·  ${data.month_label}`, pageWidth - 10, 8, { align: "right" });
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  if (data.property_address) {
    doc.text(data.property_address, pageWidth - 10, 14, { align: "right" });
  }

  doc.setTextColor(0, 0, 0);
  const yPos = 22;

  // ── Per-unit table ──────────────────────────────────────────────────────────
  // Columns match the uploaded sheet exactly:
  // HSE NO | Rent Payable | Name | Rent (paid) | Hse Deposit | H2O dep | H2O Paid | H2O Bal | Total | BAL | Ref No | Date | Garbage

  const totals = data.units.reduce(
    (acc, u) => ({
      rent_payable: acc.rent_payable + u.rent_payable,
      rent_paid:    acc.rent_paid    + u.rent_paid,
      deposit:      acc.deposit      + u.deposit,
      water_bill:   acc.water_bill   + u.water_bill,
      water_paid:   acc.water_paid   + u.water_paid,
      water_balance:acc.water_balance+ u.water_balance,
      garbage:      acc.garbage      + u.garbage,
      total:        acc.total        + u.total,
      balance:      acc.balance      + u.balance,
    }),
    { rent_payable:0, rent_paid:0, deposit:0, water_bill:0, water_paid:0, water_balance:0, garbage:0, total:0, balance:0 }
  );

  const tableBody: (string | number)[][] = data.units.map((u) => [
    u.unit_number,
    n(u.rent_payable),
    u.tenant_name,
    u.rent_paid > 0 ? n(u.rent_paid) : "-",
    u.deposit     > 0 ? n(u.deposit)     : "-",
    u.water_bill  > 0 ? n(u.water_bill)  : "-",   // H2O dep (billed)
    u.water_paid  > 0 ? n(u.water_paid)  : "-",
    u.water_balance !== 0 ? n(u.water_balance) : "-",
    n(u.total),
    u.balance !== 0 ? n(u.balance) : "-",
    u.ref_no   || "-",
    u.paid_date|| "-",
    u.garbage  > 0 ? n(u.garbage) : "-",
  ]);

  // Totals row
  tableBody.push([
    "TOTAL",
    n(totals.rent_payable),
    "",
    n(totals.rent_paid),
    totals.deposit      > 0 ? n(totals.deposit)      : "-",
    totals.water_bill   > 0 ? n(totals.water_bill)   : "-",
    totals.water_paid   > 0 ? n(totals.water_paid)   : "-",
    totals.water_balance!== 0 ? n(totals.water_balance): "-",
    n(totals.total),
    totals.balance !== 0 ? n(totals.balance) : "-",
    "", "",
    totals.garbage > 0 ? n(totals.garbage) : "-",
  ]);

  autoTable(doc, {
    startY: yPos,
    head: [[
      "HSE NO",
      "Rent\nPayable",
      "Name",
      "Rent\nPaid",
      "Hse\nDeposit",
      "H2O\nDep",
      "H2O\nPaid",
      "H2O\nBal",
      "Total",
      "BAL",
      "Ref No",
      "Date",
      "Garbage",
    ]],
    body: tableBody,
    theme: "grid",
    headStyles: {
      fillColor: [173, 216, 230],   // light blue — matches the uploaded sheet header colour
      textColor: [0, 0, 0],
      fontSize: 7,
      fontStyle: "bold",
      halign: "center",
      valign: "middle",
      lineColor: [0, 0, 0],
      lineWidth: 0.3,
    },
    styles: {
      fontSize: 7,
      cellPadding: { top: 1.5, right: 2, bottom: 1.5, left: 2 },
      lineColor: [0, 0, 0],
      lineWidth: 0.2,
      textColor: [0, 0, 0],
    },
    alternateRowStyles: {
      fillColor: [235, 245, 255],  // alternating light blue rows like the uploaded sheet
    },
    columnStyles: {
      0:  { cellWidth: 15, halign: "center", fontStyle: "bold" },   // HSE NO
      1:  { cellWidth: 22, halign: "right" },                        // Rent Payable
      2:  { cellWidth: 30, halign: "left"  },                        // Name
      3:  { cellWidth: 22, halign: "right" },                        // Rent Paid
      4:  { cellWidth: 18, halign: "right" },                        // Hse Deposit
      5:  { cellWidth: 16, halign: "right" },                        // H2O dep
      6:  { cellWidth: 16, halign: "right" },                        // H2O Paid
      7:  { cellWidth: 16, halign: "right" },                        // H2O Bal
      8:  { cellWidth: 22, halign: "right", fontStyle: "bold" },     // Total
      9:  { cellWidth: 20, halign: "right", fontStyle: "bold" },     // BAL
      10: { cellWidth: 26, halign: "center" },                       // Ref No
      11: { cellWidth: 18, halign: "center" },                       // Date
      12: { cellWidth: 16, halign: "right" },                        // Garbage
    },
    didParseCell: (d: {row: {index: number}}) => {
      const isLastRow = d.row.index === tableBody.length - 1;

      // TOTALS row — bold, slightly darker fill
      if (isLastRow) {
        d.cell.styles.fontStyle = "bold";
        d.cell.styles.fillColor = [200, 230, 255];
        d.cell.styles.fontSize  = 7.5;
      }

      // Highlight unpaid units yellow (balance > 0 and rent_paid === 0)
      // Col index 9 = BAL, col index 3 = Rent Paid
      if (!isLastRow && d.column.index === 9) {
        const balStr = String(d.cell.raw || "");
        if (balStr !== "-" && balStr !== "0.00" && balStr !== "") {
          // Entire row for unpaid unit gets yellow highlight (col 0 triggers row colour)
          d.cell.styles.fillColor = [255, 255, 153];  // yellow like R19 in uploaded sheet
          d.cell.styles.fontStyle = "bold";
        }
      }

      // Also yellow-highlight HSE NO cell if that row has a balance
      if (!isLastRow && d.column.index === 0) {
        const rowData = tableBody[d.row.index];
        if (rowData && rowData[9] !== "-" && rowData[9] !== "") {
          d.cell.styles.fillColor = [255, 255, 153];
        }
      }

      // Red text for non-zero BAL values (outstanding)
      if (!isLastRow && d.column.index === 9) {
        const balStr = String(d.cell.raw || "");
        if (balStr !== "-" && balStr !== "") {
          d.cell.styles.textColor = [185, 28, 28];
        }
      }
    },
  });

  const tableEndY = getAutoTableFinalY(doc);

  // ── Summary box (bottom-left) ───────────────────────────────────────────────
  const summaryX = 10;
  const summaryY = tableEndY + 8;
  const rowH = 7;

  const summaryRows = [
    { label: "Rent Payable",    value: totals.rent_payable,   bold: false },
    { label: "Rent Collected",  value: totals.rent_paid,      bold: false },
    { label: "Water Collected", value: totals.water_paid,     bold: false },
    { label: "Total Collected", value: totals.total,          bold: true  },
    { label: "Total Balance",   value: totals.balance,        bold: true, red: totals.balance > 0 },
  ];

  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("COLLECTION SUMMARY", summaryX, summaryY - 2);

  summaryRows.forEach((row, i) => {
    const y = summaryY + i * rowH;
    doc.setFillColor(i % 2 === 0 ? 235 : 248, i % 2 === 0 ? 245 : 250, i % 2 === 0 ? 255 : 255);
    doc.rect(summaryX, y, 70, rowH, "F");
    doc.setDrawColor(180, 180, 180);
    doc.rect(summaryX, y, 70, rowH, "S");

    doc.setFont("helvetica", row.bold ? "bold" : "normal");
    doc.setFontSize(8);
    doc.setTextColor(0, 0, 0);
    doc.text(row.label, summaryX + 2, y + 4.5);
    doc.setFont("helvetica", "bold");
    if (row.red) doc.setTextColor(185, 28, 28);
    doc.text(f(row.value), summaryX + 68, y + 4.5, { align: "right" });
    doc.setTextColor(0, 0, 0);
  });

  // ── Deductions box (bottom-center) ─────────────────────────────────────────
  if (data.deductions.length > 0) {
    const dedX = 90;
    const dedY = summaryY - 2;

    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("DEDUCTIONS", dedX, dedY);

    const dedRows = [
      ...data.deductions,
      { name: "Total Deductions",        amount: data.total_deductions, bold: true },
      { name: "Net Due to Landlord",     amount: data.net_amount,       bold: true, green: true },
    ];

    dedRows.forEach((row: DeductionRow, i) => {
      const y = dedY + 4 + i * rowH;
      doc.setFillColor(i % 2 === 0 ? 240 : 250, 253, 240);
      doc.rect(dedX, y, 90, rowH, "F");
      doc.setDrawColor(180, 180, 180);
      doc.rect(dedX, y, 90, rowH, "S");

      doc.setFont("helvetica", row.bold ? "bold" : "normal");
      doc.setFontSize(8);
      doc.setTextColor(0, 0, 0);
      doc.text(row.name, dedX + 2, y + 4.5);
      doc.setFont("helvetica", "bold");
      if (row.green) doc.setTextColor(22, 163, 74);
      doc.text(f(row.amount), dedX + 88, y + 4.5, { align: "right" });
      doc.setTextColor(0, 0, 0);
    });
  }

  // ── Footer ──────────────────────────────────────────────────────────────────
  doc.setFontSize(7);
  doc.setFont("helvetica", "italic");
  doc.setTextColor(140, 140, 140);
  const generatedOn = format(new Date(), 'dd/MM/yy HH:mm');
  doc.text(`Generated: ${generatedOn}`, 10, pageHeight - 5);
  if (company?.company_name) {
    doc.text(`${company.company_name}  —  Confidential`, pageWidth - 10, pageHeight - 5, { align: "right" });
  }

  return doc;
};

export const downloadPropertyStatementPDF = async (
  propertyId: string,
  monthDate: Date,
  currency: CurrencyCode = "KES"
) => {
  const data = await generatePropertyStatementData(propertyId, monthDate);
  if (!data) return;
  const doc = await generatePropertyStatementPDF(data, currency);
  doc.save(`statement_${data.property_name.replace(/\s+/g, "_")}_${data.month_label.replace(/\s+/g, "_")}.pdf`);
};

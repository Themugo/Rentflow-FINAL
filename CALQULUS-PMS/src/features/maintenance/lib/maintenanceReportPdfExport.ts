import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatDate } from "@/shared/lib/dateFormat";
import { CurrencyCode } from "@/shared/hooks/useCurrency";
import { createCurrencyFormatter, fetchCompanySettings } from "@/shared/lib/pdf/companyPdfHeader";

interface MaintenanceRequest {
  id: string;
  title: string;
  description: string;
  property_name: string;
  unit_number: string | null;
  tenant_name: string;
  status: string;
  priority: string;
  category: string;
  assigned_to: string | null;
  expected_completion_date: string | null;
  completion_date: string | null;
  budget: number | null;
  requested_date: string;
  created_at: string;
}

const getPriorityLabel = (priority: string): string => {
  const labels: Record<string, string> = {
    low: "Low",
    medium: "Medium",
    high: "High",
    urgent: "Urgent",
  };
  return labels[priority] || priority;
};

const getStatusLabel = (status: string): string => {
  const labels: Record<string, string> = {
    open: "Open",
    in_progress: "In Progress",
    completed: "Completed",
    cancelled: "Cancelled",
  };
  return labels[status] || status;
};

export const generateMaintenanceReportPDF = async (
  requests: MaintenanceRequest[],
  currency: CurrencyCode = "KES"
): Promise<jsPDF> => {
  const doc = new jsPDF({ orientation: "landscape" });
  const formatCurrency = createCurrencyFormatter(currency);
  const pageWidth = doc.internal.pageSize.getWidth();
  const companySettings = await fetchCompanySettings();

  let yPos = 14;
  let logoWidth = 0;

  // Company Header with Logo
  if (companySettings) {
    if (companySettings.logo_url) {
      try {
        const response = await fetch(companySettings.logo_url);
        const blob = await response.blob();
        const base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });
        
        const img = new Image();
        img.src = base64;
        await new Promise((resolve) => { img.onload = resolve; });
        const aspectRatio = img.width / img.height;
        const logoHeight = 16;
        logoWidth = logoHeight * aspectRatio;
        
        doc.addImage(base64, "PNG", 14, yPos - 4, logoWidth, logoHeight);
      } catch {
      }
    }

    const textStartX = logoWidth > 0 ? 14 + logoWidth + 6 : 14;
    
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(companySettings.company_name, textStartX, yPos);
    
    if (logoWidth > 0) {
      yPos = Math.max(yPos, 14 + 16 + 2);
    }
    yPos += 8;
  }

  // Report Title
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("MAINTENANCE ACTIVE REPORT", pageWidth / 2, yPos, { align: "center" });
  yPos += 6;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  doc.text(`Generated: ${formatDate(new Date().toISOString())}`, pageWidth / 2, yPos, { align: "center" });
  doc.setTextColor(0, 0, 0);
  yPos += 10;

  // Filter active requests
  const activeRequests = requests.filter(
    (r) => r.status === "open" || r.status === "in_progress"
  );

  // Calculate statistics
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const overdueRequests = activeRequests.filter((r) => {
    if (!r.expected_completion_date) return false;
    const dueDate = new Date(r.expected_completion_date);
    return dueDate < today;
  });

  const dueSoonRequests = activeRequests.filter((r) => {
    if (!r.expected_completion_date) return false;
    const dueDate = new Date(r.expected_completion_date);
    const threeDaysFromNow = new Date(today);
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
    return dueDate >= today && dueDate <= threeDaysFromNow;
  });

  const urgentRequests = activeRequests.filter(
    (r) => r.priority === "urgent" || r.priority === "high"
  );

  const totalBudget = activeRequests.reduce(
    (sum, r) => sum + (r.budget || 0),
    0
  );

  const completedRequests = requests.filter((r) => r.status === "completed");
  const completionRate = requests.length > 0
    ? Math.round((completedRequests.length / requests.length) * 100)
    : 0;

  // Summary Statistics Box
  doc.setFillColor(248, 250, 252);
  doc.rect(14, yPos, pageWidth - 28, 28, "F");
  doc.setDrawColor(226, 232, 240);
  doc.rect(14, yPos, pageWidth - 28, 28, "S");

  const statWidth = (pageWidth - 28) / 5;
  const stats = [
    { label: "Active Requests", value: activeRequests.length.toString(), color: [59, 130, 246] },
    { label: "Overdue", value: overdueRequests.length.toString(), color: [239, 68, 68] },
    { label: "Due Soon (3 days)", value: dueSoonRequests.length.toString(), color: [245, 158, 11] },
    { label: "High Priority", value: urgentRequests.length.toString(), color: [249, 115, 22] },
    { label: "Total Budget", value: formatCurrency(totalBudget), color: [34, 197, 94] },
  ];

  stats.forEach((stat, index) => {
    const x = 14 + statWidth * index + statWidth / 2;
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(stat.color[0], stat.color[1], stat.color[2]);
    doc.text(stat.value, x, yPos + 12, { align: "center" });
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 100);
    doc.text(stat.label.toUpperCase(), x, yPos + 20, { align: "center" });
  });

  doc.setTextColor(0, 0, 0);
  yPos += 36;

  // Completion Rate
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`Overall Completion Rate: ${completionRate}%`, 14, yPos);
  yPos += 8;

  // Sort active requests by priority and due date
  const sortedRequests = [...activeRequests].sort((a, b) => {
    const aOverdue = a.expected_completion_date && new Date(a.expected_completion_date) < today;
    const bOverdue = b.expected_completion_date && new Date(b.expected_completion_date) < today;
    if (aOverdue && !bOverdue) return -1;
    if (!aOverdue && bOverdue) return 1;

    const priorityOrder: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
    if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    }

    if (a.expected_completion_date && b.expected_completion_date) {
      return new Date(a.expected_completion_date).getTime() - new Date(b.expected_completion_date).getTime();
    }
    return 0;
  });

  // Helper to calculate overdue status
  const getDueDateInfo = (dueDate: string | null) => {
    if (!dueDate) return { text: "No due date", isOverdue: false };
    const due = new Date(dueDate);
    const diffDays = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) {
      return { text: `${Math.abs(diffDays)} day(s) overdue`, isOverdue: true };
    } else if (diffDays === 0) {
      return { text: "Due today", isOverdue: false };
    } else if (diffDays <= 3) {
      return { text: `Due in ${diffDays} day(s)`, isOverdue: false };
    } else {
      return { text: formatDate(dueDate), isOverdue: false };
    }
  };

  // Requests Table
  autoTable(doc, {
    startY: yPos,
    head: [["Task", "Property", "Priority", "Status", "Due Date", "Budget", "Assigned To", "Action Required"]],
    body: sortedRequests.map((req) => {
      const dueDateInfo = getDueDateInfo(req.expected_completion_date);
      let actionRequired = "";
      
      if (req.status === "open" && !req.assigned_to) {
        actionRequired = "Assign technician";
      } else if (req.status === "open" && req.assigned_to) {
        actionRequired = "Start work";
      } else if (req.status === "in_progress") {
        actionRequired = dueDateInfo.isOverdue ? "Complete urgently" : "Continue work";
      }
      
      return [
        req.title,
        `${req.property_name}${req.unit_number ? ` - ${req.unit_number}` : ""}`,
        getPriorityLabel(req.priority),
        getStatusLabel(req.status),
        dueDateInfo.text,
        req.budget ? formatCurrency(req.budget) : "-",
        req.assigned_to || "Unassigned",
        actionRequired,
      ];
    }),
    theme: "striped",
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 8,
    },
    styles: {
      fontSize: 8,
      cellPadding: 4,
    },
    columnStyles: {
      0: { cellWidth: 45 },
      1: { cellWidth: 40 },
      2: { cellWidth: 22 },
      3: { cellWidth: 25 },
      4: { cellWidth: 35 },
      5: { cellWidth: 28 },
      6: { cellWidth: 30 },
      7: { cellWidth: 35 },
    },
    didParseCell: (data) => {
      // Highlight overdue rows
      if (data.section === "body") {
        const rowData = sortedRequests[data.row.index];
        if (rowData && rowData.expected_completion_date) {
          const due = new Date(rowData.expected_completion_date);
          if (due < today) {
            data.cell.styles.fillColor = [254, 242, 242];
          }
        }
        
        // Color priority column
        if (data.column.index === 2) {
          const priority = rowData?.priority;
          if (priority === "urgent") {
            data.cell.styles.textColor = [153, 27, 27];
            data.cell.styles.fontStyle = "bold";
          } else if (priority === "high") {
            data.cell.styles.textColor = [194, 65, 12];
            data.cell.styles.fontStyle = "bold";
          }
        }
        
        // Color due date column for overdue
        if (data.column.index === 4 && data.cell.text[0]?.includes("overdue")) {
          data.cell.styles.textColor = [220, 38, 38];
          data.cell.styles.fontStyle = "bold";
        }
      }
    },
  });

  // Footer
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.text(
    `Maintenance Active Report - Page 1 | ${companySettings?.company_name || "CALQULUS PMS"}`,
    pageWidth / 2,
    pageHeight - 10,
    { align: "center" }
  );
  doc.setTextColor(0, 0, 0);

  return doc;
};

export const downloadMaintenanceReportPDF = async (
  requests: MaintenanceRequest[],
  currency: CurrencyCode = "KES"
) => {
  const doc = await generateMaintenanceReportPDF(requests, currency);
  doc.save(`maintenance_active_report_${new Date().toISOString().split("T")[0]}.pdf`);
};

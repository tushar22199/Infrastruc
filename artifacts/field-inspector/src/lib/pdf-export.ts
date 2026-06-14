import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { Inspection, DashboardSummary } from "@workspace/api-client-react";

// Corporate palette — Navy headers, Slate accents
const NAVY: [number, number, number] = [15, 40, 80];
const SLATE: [number, number, number] = [38, 55, 78];
const LIGHT_SLATE: [number, number, number] = [240, 244, 250];
const WHITE: [number, number, number] = [255, 255, 255];
const MUTED: [number, number, number] = [110, 125, 145];

function healthColor(score: number): [number, number, number] {
  if (score > 75) return [22, 163, 74];
  if (score > 50) return [202, 138, 4];
  return [185, 28, 28];
}

function healthLabel(score: number): string {
  if (score > 75) return "GOOD";
  if (score > 50) return "FAIR";
  return "CRITICAL";
}

export function exportAuditReport(summary: DashboardSummary, inspections: Inspection[]) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 14;
  const usableWidth = pageWidth - marginX * 2;
  const now = new Date();
  const generatedStr = format(now, "yyyy-MM-dd HH:mm");
  const totalPagesPlaceholder = "{total_pages_count_string}";

  // ── Page 1: Navy header bar ──────────────────────────────────────────────
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, pageWidth, 38, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.setTextColor(...WHITE);
  doc.text("INFRASTRUCTURE AUDIT REPORT", marginX, 16);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(175, 205, 240);
  doc.text(`Generated: ${generatedStr}`, marginX, 26);
  doc.text(
    "INTELLIGENT FIELD INSPECTION & INFRASTRUCTURE AUDITOR",
    pageWidth - marginX,
    26,
    { align: "right" }
  );
  doc.text("CONFIDENTIAL — INTERNAL USE ONLY", pageWidth - marginX, 33, {
    align: "right",
  });

  // ── Key Metrics Block ────────────────────────────────────────────────────
  const metricsY = 43;
  const metricsH = 34;
  const halfW = (usableWidth - 4) / 2;

  // Left box — Total Active Logs
  doc.setFillColor(...SLATE);
  doc.roundedRect(marginX, metricsY, halfW, metricsH, 2, 2, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(160, 190, 225);
  doc.text("TOTAL ACTIVE LOGS", marginX + 4, metricsY + 9);

  doc.setFontSize(24);
  doc.setTextColor(...WHITE);
  doc.text(String(summary.activeIssues), marginX + 4, metricsY + 24);

  doc.setFontSize(8);
  doc.setTextColor(160, 190, 225);
  doc.text(`of ${summary.totalLogs} total in report`, marginX + 4, metricsY + 31);

  // Right box — Regional Health Score
  const rightX = marginX + halfW + 4;
  const score = summary.regionalHealthScore;
  const hColor = healthColor(score);
  const label = healthLabel(score);
  const accentText: [number, number, number] =
    score > 50 && score <= 75 ? [255, 248, 195] : WHITE;

  doc.setFillColor(...hColor);
  doc.roundedRect(rightX, metricsY, halfW, metricsH, 2, 2, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...accentText);
  doc.text("REGIONAL HEALTH SCORE", rightX + 4, metricsY + 9);

  doc.setFontSize(24);
  doc.text(`${score}`, rightX + 4, metricsY + 24);

  doc.setFontSize(13);
  doc.text("/ 100", rightX + 4 + doc.getTextWidth(`${score}`) + 2, metricsY + 24);

  doc.setFontSize(8);
  doc.text(`STATUS: ${label}`, rightX + 4, metricsY + 31);

  // ── Section divider ──────────────────────────────────────────────────────
  const tableStartY = metricsY + metricsH + 9;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...SLATE);
  doc.text("INSPECTION LOG", marginX, tableStartY - 2);

  doc.setDrawColor(180, 195, 215);
  doc.setLineWidth(0.4);
  doc.line(marginX, tableStartY, pageWidth - marginX, tableStartY);

  // ── Column widths — explicit to prevent clipping ─────────────────────────
  const colW = [
    usableWidth * 0.27, // Title
    usableWidth * 0.18, // Issue Type
    usableWidth * 0.10, // Severity
    usableWidth * 0.11, // Status
    usableWidth * 0.16, // Location
    usableWidth * 0.18, // Logged
  ];

  // ── Inspection table ─────────────────────────────────────────────────────
  autoTable(doc, {
    startY: tableStartY + 2,
    margin: { left: marginX, right: marginX },
    head: [["Title", "Issue Type", "Severity", "Status", "Location", "Logged"]],
    body: inspections.map((i) => [
      i.title,
      i.issueType,
      i.severity,
      i.status,
      i.geometry.type === "Point"
        ? `${i.latitude.toFixed(4)}, ${i.longitude.toFixed(4)}`
        : `${i.geometry.type} · ${(i.geometry.coordinates as unknown[]).length} pts`,
      format(new Date(i.createdAt), "yyyy-MM-dd HH:mm"),
    ]),
    styles: {
      fontSize: 8.5,
      cellPadding: { top: 3, bottom: 3, left: 3, right: 3 },
      overflow: "linebreak",
      font: "helvetica",
      lineColor: [215, 225, 238],
      lineWidth: 0.25,
      textColor: [30, 40, 55],
    },
    headStyles: {
      fillColor: NAVY,
      textColor: WHITE,
      fontStyle: "bold",
      fontSize: 7.5,
      halign: "left",
      cellPadding: { top: 4, bottom: 4, left: 3, right: 3 },
    },
    alternateRowStyles: {
      fillColor: LIGHT_SLATE,
    },
    columnStyles: {
      0: { cellWidth: colW[0] },
      1: { cellWidth: colW[1] },
      2: { cellWidth: colW[2] },
      3: { cellWidth: colW[3] },
      4: { cellWidth: colW[4], font: "courier", fontSize: 7.5 },
      5: { cellWidth: colW[5], font: "courier", fontSize: 7.5 },
    },
    didDrawPage: (data) => {
      const pageNum = data.pageNumber;

      // Thin navy header on continuation pages
      if (pageNum > 1) {
        doc.setFillColor(...NAVY);
        doc.rect(0, 0, pageWidth, 12, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.5);
        doc.setTextColor(...WHITE);
        doc.text("INFRASTRUCTURE AUDIT REPORT — CONTINUED", marginX, 8);
        doc.text(generatedStr, pageWidth - marginX, 8, { align: "right" });
      }

      // Footer rule
      doc.setDrawColor(200, 212, 228);
      doc.setLineWidth(0.3);
      doc.line(marginX, pageHeight - 13, pageWidth - marginX, pageHeight - 13);

      // Footer: Page X of Y (centre) + export timestamp (right)
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(...MUTED);
      doc.text(
        `Page ${pageNum} of ${totalPagesPlaceholder}`,
        pageWidth / 2,
        pageHeight - 8,
        { align: "center" }
      );
      doc.text(
        `Exported ${generatedStr}  ·  CONFIDENTIAL`,
        pageWidth - marginX,
        pageHeight - 8,
        { align: "right" }
      );
    },
  });

  // Stamp actual total page count into every placeholder
  if (typeof (doc as any).putTotalPages === "function") {
    (doc as any).putTotalPages(totalPagesPlaceholder);
  }

  doc.save(`audit-report-${format(now, "yyyy-MM-dd")}.pdf`);
}

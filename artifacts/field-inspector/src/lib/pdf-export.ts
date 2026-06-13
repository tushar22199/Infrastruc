import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { Inspection, DashboardSummary } from "@workspace/api-client-react";

export function exportAuditReport(summary: DashboardSummary, inspections: Inspection[]) {
  const doc = new jsPDF();
  
  doc.setFontSize(18);
  doc.setTextColor(40);
  doc.text("INFRASTRUCTURE AUDIT REPORT", 14, 22);
  
  doc.setFontSize(11);
  doc.setTextColor(100);
  doc.text(`Generated on: ${format(new Date(), "PPpp")}`, 14, 30);
  
  doc.setFontSize(14);
  doc.setTextColor(40);
  doc.text("Summary Metrics", 14, 45);
  
  doc.setFontSize(11);
  doc.setTextColor(80);
  doc.text(`Total Active Issues: ${summary.activeIssues}`, 14, 53);
  doc.text(`Regional Health Score: ${summary.regionalHealthScore}/100`, 14, 60);
  
  autoTable(doc, {
    startY: 70,
    head: [['Title', 'Type', 'Severity', 'Status', 'Coordinates']],
    body: inspections.map(i => [
      i.title,
      i.issueType,
      i.severity,
      i.status,
      `${i.latitude.toFixed(4)}, ${i.longitude.toFixed(4)}`
    ]),
    theme: 'grid',
    headStyles: { fillColor: [40, 40, 40] },
    styles: { fontSize: 10, cellPadding: 4 }
  });
  
  doc.save(`audit-report-${format(new Date(), "yyyy-MM-dd")}.pdf`);
}

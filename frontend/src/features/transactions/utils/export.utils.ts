import { formatMoney } from "@/utils/money";
import dayjs from "dayjs";
import type { Transaction } from "@/types";

// Parse amount (backend may return string)
function parseAmount(amount: number | string): number {
  return typeof amount === "string" ? parseFloat(amount) : amount;
}

export function exportToCSV(
  transactions: Transaction[],
  filename?: string,
): void {
  const headers = [
    "Transaction ID",
    "Amount",
    "Payment Method",
    "Status",
    "Risk Score",
    "IP Address",
    "Device ID",
    "Date",
  ];

  const rows = transactions.map((t) => [
    t.id,
    parseAmount(t.amount).toString(),
    t.payment_method,
    t.status.toUpperCase(),
    (t.risk_score ?? 0).toString(),
    t.ip_address,
    t.device_id,
    dayjs(t.created_at).format("YYYY-MM-DD HH:mm:ss"),
  ]);

  const csvContent = [
    headers.join(","),
    ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
  ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);

  link.setAttribute("href", url);
  link.setAttribute(
    "download",
    filename || `transactions_${dayjs().format("YYYY-MM-DD")}.csv`,
  );
  link.style.visibility = "hidden";

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function generatePDFReport(transactions: Transaction[]): void {
  const printWindow = window.open("", "_blank");
  if (!printWindow) return;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Transaction Report - ${dayjs().format("YYYY-MM-DD")}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; }
        h1 { color: #0ea5e9; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { border: 1px solid #e5e5e5; padding: 8px; text-align: left; font-size: 12px; }
        th { background-color: #f5f5f5; }
        .success { color: #22c55e; }
        .flagged { color: #f59e0b; }
        .blocked { color: #ef4444; }
        .summary { margin-top: 20px; padding: 15px; background: #f5f5f5; border-radius: 8px; }
      </style>
    </head>
    <body>
      <h1>Transaction Report</h1>
      <p>Generated on: ${dayjs().format("MMMM DD, YYYY HH:mm")}</p>
      
      <div class="summary">
        <strong>Summary:</strong> ${transactions.length} transactions | 
        Success: ${transactions.filter((t) => t.status.toUpperCase() === "SUCCESS").length} |
        Flagged: ${transactions.filter((t) => t.status.toUpperCase() === "FLAGGED").length} |
        Blocked: ${transactions.filter((t) => t.status.toUpperCase() === "BLOCKED").length}
      </div>
      
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Amount</th>
            <th>Method</th>
            <th>Status</th>
            <th>Risk</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>
          ${transactions
            .map(
              (t) => `
            <tr>
              <td>${t.id.slice(0, 12)}...</td>
              <td>${formatMoney(parseAmount(t.amount))}</td>
              <td>${t.payment_method}</td>
              <td class="${t.status.toLowerCase()}">${t.status.toUpperCase()}</td>
              <td>${t.risk_score ?? 0}</td>
              <td>${dayjs(t.created_at).format("MMM DD, YYYY HH:mm")}</td>
            </tr>
          `,
            )
            .join("")}
        </tbody>
      </table>
    </body>
    </html>
  `;

  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.print();
}

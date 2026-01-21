/**
 * CSV Export Utility
 * Provides functions to generate and download CSV files
 */

export interface CSVColumn<T> {
  header: string;
  accessor: (item: T) => string | number | null | undefined;
}

/**
 * Escape a value for CSV format
 * Handles quotes, commas, and newlines
 */
function escapeCSVValue(value: string | number | null | undefined): string {
  if (value === null || value === undefined) {
    return "";
  }
  
  const stringValue = String(value);
  
  // If the value contains a comma, quote, or newline, wrap it in quotes
  if (stringValue.includes(",") || stringValue.includes('"') || stringValue.includes("\n")) {
    // Escape quotes by doubling them
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  
  return stringValue;
}

/**
 * Generate CSV content from data
 */
export function generateCSV<T>(data: T[], columns: CSVColumn<T>[]): string {
  // Generate header row
  const headerRow = columns.map(col => escapeCSVValue(col.header)).join(",");
  
  // Generate data rows
  const dataRows = data.map(item => 
    columns.map(col => escapeCSVValue(col.accessor(item))).join(",")
  );
  
  return [headerRow, ...dataRows].join("\n");
}

/**
 * Download CSV content as a file
 */
export function downloadCSV(content: string, filename: string): void {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  
  link.href = url;
  link.download = filename;
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Generate and download CSV in one step
 */
export function exportToCSV<T>(
  data: T[], 
  columns: CSVColumn<T>[], 
  filename: string
): void {
  const content = generateCSV(data, columns);
  downloadCSV(content, filename);
}

/**
 * Flatten nested answers from application/RSVP forms for CSV export
 */
export function flattenAnswers(
  answers: Array<{ questionId?: string; question_id?: string; question?: string; answer: string | string[] }>,
  questions?: Array<{ id: string; question: string }>
): Record<string, string> {
  const result: Record<string, string> = {};
  
  answers.forEach((answer, index) => {
    const questionId = answer.questionId || answer.question_id;
    const questionText = answer.question || 
      questions?.find(q => q.id === questionId)?.question || 
      `Question ${index + 1}`;
    
    const answerValue = Array.isArray(answer.answer) 
      ? answer.answer.join("; ") 
      : answer.answer;
    
    result[questionText] = answerValue;
  });
  
  return result;
}

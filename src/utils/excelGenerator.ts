export interface CSVRecord {
  studentName: string;
  rollNumber: string;
  subject: string;
  assessmentName: string;
  marksObtained: number;
  totalMarks: number;
  percentage: number;
  grade: string;
  feedback: string;
}

export const downloadAsExcel = (records: CSVRecord[], filename = 'classwise_assessment_report.csv') => {
  const headers = [
    'Student Name',
    'Roll Number',
    'Subject',
    'Assessment Name',
    'Marks Obtained',
    'Total Marks',
    'Percentage',
    'Grade',
    'AI Feedback'
  ];

  const escapeCSVField = (val: any) => {
    if (val === null || val === undefined) return '';
    const str = String(val).replace(/"/g, '""');
    if (str.includes(',') || str.includes('\n') || str.includes('"')) {
      return `"${str}"`;
    }
    return str;
  };

  const rows = records.map(r => [
    r.studentName,
    r.rollNumber,
    r.subject,
    r.assessmentName,
    r.marksObtained,
    r.totalMarks,
    r.percentage + '%',
    r.grade,
    r.feedback
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(escapeCSVField).join(','))
  ].join('\n');

  const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export interface CoverageRow {
  province: string;
  program: string;
  insurer?: string;
  disciplines: string[];
  rail: 'cdanet' | 'eclaims' | 'portal';
  status: 'supported' | 'sandbox' | 'todo';
  notes?: string;
}

export interface CoverageData {
  updatedAt: string;
  rows: CoverageRow[];
}

// Valid province codes (including special codes for national/federal programs)
const VALID_PROVINCES = ['AB', 'BC', 'MB', 'NB', 'NL', 'NS', 'NT', 'NU', 'ON', 'PE', 'QC', 'SK', 'YT', 'NATIONAL', 'FEDERAL', 'ALL', 'SPECIAL'];
const VALID_RAILS = ['cdanet', 'eclaims', 'portal'];
const VALID_STATUSES = ['supported', 'sandbox', 'todo'];

export function normalizeRow(row: any): CoverageRow | null {
  try {
    // Normalize province code
    const province = (row.province || row.Province || '').toString().toUpperCase().trim();
    if (!VALID_PROVINCES.includes(province)) {
      console.warn(`Invalid province code: ${province}`);
      return null;
    }

    // Get program/insurer
    const program = (row.program || row.Program || row['Program/Insurer'] || '').toString().trim();
    const insurer = (row.insurer || row.Insurer || '').toString().trim() || undefined;

    // Parse disciplines (could be string with semicolon or comma separator)
    let disciplines: string[] = [];
    const disciplineField = row.disciplines || row.Disciplines || row['Discipline(s)'] || '';
    if (Array.isArray(disciplineField)) {
      disciplines = disciplineField.map(d => d.toString().trim()).filter(Boolean);
    } else if (typeof disciplineField === 'string') {
      disciplines = disciplineField
        .split(/[;,]/)
        .map(d => d.trim())
        .filter(Boolean);
    }

    // Normalize rail
    const railRaw = (row.rail || row.Rail || '').toString().toLowerCase().trim();
    let rail: 'cdanet' | 'eclaims' | 'portal';
    if (railRaw.includes('cdanet') || railRaw.includes('cda')) {
      rail = 'cdanet';
    } else if (railRaw.includes('eclaims') || railRaw.includes('telus')) {
      rail = 'eclaims';
    } else if (railRaw.includes('portal')) {
      rail = 'portal';
    } else if (VALID_RAILS.includes(railRaw as any)) {
      rail = railRaw as 'cdanet' | 'eclaims' | 'portal';
    } else {
      console.warn(`Invalid rail: ${railRaw}`);
      return null;
    }

    // Normalize status
    const statusRaw = (row.status || row.Status || '').toString().toLowerCase().trim();
    let status: 'supported' | 'sandbox' | 'todo';
    if (statusRaw.includes('support')) {
      status = 'supported';
    } else if (statusRaw.includes('sandbox')) {
      status = 'sandbox';
    } else if (statusRaw.includes('todo') || statusRaw.includes('to-do')) {
      status = 'todo';
    } else if (VALID_STATUSES.includes(statusRaw as any)) {
      status = statusRaw as 'supported' | 'sandbox' | 'todo';
    } else {
      console.warn(`Invalid status: ${statusRaw}`);
      return null;
    }

    // Get notes
    const notes = (row.notes || row.Notes || '').toString().trim() || undefined;

    return {
      province,
      program,
      insurer,
      disciplines,
      rail,
      status,
      notes
    };
  } catch (error) {
    console.error('Error normalizing coverage row:', error);
    return null;
  }
}

export function loadCoverageData(): CoverageData {
  const docsPath = join(process.cwd(), 'docs');
  const jsonPath = join(docsPath, 'coverage_matrix.json');
  const csvPath = join(docsPath, 'coverage_matrix.csv');

  // Try JSON first
  if (existsSync(jsonPath)) {
    try {
      const jsonContent = readFileSync(jsonPath, 'utf-8');
      const data = JSON.parse(jsonContent);
      
      // Handle different JSON structures
      let rawRows: any[] = [];
      if (Array.isArray(data)) {
        rawRows = data;
      } else if (data.rows && Array.isArray(data.rows)) {
        rawRows = data.rows;
      } else if (data.data && Array.isArray(data.data)) {
        rawRows = data.data;
      }
      
      // Normalize all rows
      const normalizedRows = rawRows
        .map(normalizeRow)
        .filter((row): row is CoverageRow => row !== null);

      return {
        updatedAt: data.updatedAt || new Date().toISOString(),
        rows: normalizedRows
      };
    } catch (error) {
      console.error('Error loading coverage JSON:', error);
    }
  }

  // Try CSV fallback
  if (existsSync(csvPath)) {
    try {
      const csvContent = readFileSync(csvPath, 'utf-8');
      const rows = parseSimpleCSV(csvContent);
      const normalizedRows = rows
        .map(normalizeRow)
        .filter((row): row is CoverageRow => row !== null);

      return {
        updatedAt: new Date().toISOString(),
        rows: normalizedRows
      };
    } catch (error) {
      console.error('Error loading coverage CSV:', error);
    }
  }

  // Return placeholder data if neither file exists
  console.warn('No coverage matrix file found, returning placeholder data');
  return {
    updatedAt: new Date().toISOString(),
    rows: [
      {
        province: 'ON',
        program: 'WSIB',
        disciplines: ['Physiotherapy', 'Chiropractic', 'Massage Therapy'],
        rail: 'portal',
        status: 'todo',
        notes: 'Ontario Workers Safety Insurance Board - portal automation needed'
      },
      {
        province: 'AB',
        program: 'Alberta Blue Cross',
        disciplines: ['Dental', 'Vision'],
        rail: 'cdanet',
        status: 'sandbox',
        notes: 'CDAnet integration in testing phase'
      },
      {
        province: 'QC',
        program: 'RAMQ',
        disciplines: ['Medical', 'Dental'],
        rail: 'portal',
        status: 'todo',
        notes: 'Quebec health insurance plan - requires French language support'
      },
      {
        province: 'BC',
        program: 'Pacific Blue Cross',
        disciplines: ['Physiotherapy', 'Psychology'],
        rail: 'eclaims',
        status: 'sandbox',
        notes: 'TELUS eClaims integration ready for testing'
      }
    ]
  };
}

// Simple CSV parser (no external dependencies)
function parseSimpleCSV(csvContent: string): any[] {
  const lines = csvContent.trim().split('\n');
  if (lines.length < 2) return [];

  // Parse header
  const header = lines[0].split(',').map(h => h.trim().replace(/^["']|["']$/g, ''));
  
  // Parse rows
  const rows: any[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim().replace(/^["']|["']$/g, ''));
    const row: any = {};
    header.forEach((key, index) => {
      row[key] = values[index] || '';
    });
    rows.push(row);
  }

  return rows;
}

export function exportToCSV(rows: CoverageRow[]): string {
  const header = 'Province,Program/Insurer,Disciplines,Rail,Status,Notes\n';
  const csvRows = rows.map(row => {
    const disciplines = row.disciplines.join('; ');
    const program = row.insurer ? `${row.program} (${row.insurer})` : row.program;
    const notes = row.notes || '';
    
    // Escape values that might contain commas
    const escapeCSV = (val: string) => val.includes(',') ? `"${val}"` : val;
    
    return [
      row.province,
      escapeCSV(program),
      escapeCSV(disciplines),
      row.rail,
      row.status,
      escapeCSV(notes)
    ].join(',');
  });

  return header + csvRows.join('\n');
}
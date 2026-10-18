import ExcelJS from 'exceljs';
import { fromBuffer } from 'yauzl';
import { HttpError } from './auth';

export const importColumns = {
  employees: ['code','name','email','position','level','joinDate','exitDate','experience','location','jlpt','status','participationRate'],
  projects: ['code','name','customer','pmCode','startDate','endDate','status','contractedMm','forecastMm'],
  planned: ['employeeCode','projectCode','month','mm'],
  actual: ['employeeCode','projectCode','month','mm'],
} as const;
export type ImportKind = keyof typeof importColumns;
export type ExcelRow = Record<string, string | number | null>;
export const MAX_UPLOAD = 2 * 1024 * 1024;
const invalid = (message: string) => new HttpError(400, message);

// Fully stream every entry before the workbook parser allocates XML structures.
export async function checkArchive(buffer: Buffer) {
  if (!buffer.length || buffer.length > MAX_UPLOAD) throw invalid('File XLSX tối đa 2 MiB');
  await new Promise<void>((resolve, reject) => {
    fromBuffer(buffer, { lazyEntries: true, validateEntrySizes: true }, (error, zip) => {
      if (error || !zip) return reject(invalid('File XLSX/ZIP không hợp lệ'));
      let count = 0, bytes = 0; const names = new Set<string>(); let settled = false;
      const fail = () => { if (!settled) { settled = true; zip.close(); reject(invalid('XLSX không an toàn hoặc vượt giới hạn giải nén')); } };
      zip.on('error', fail);
      zip.on('end', () => { if (!settled) { settled = true; resolve(); } });
      zip.on('entry', entry => {
        if (++count > 128 || names.has(entry.fileName) || /vbaProject|externalLinks|embeddings|activeX/i.test(entry.fileName) || entry.generalPurposeBitFlag & 1 || entry.uncompressedSize > 8*1024*1024 || entry.uncompressedSize > Math.max(1,entry.compressedSize)*200) return fail();
        names.add(entry.fileName);
        if (entry.fileName.endsWith('/')) return zip.readEntry();
        zip.openReadStream(entry, (err, stream) => {
          if (err || !stream) return fail();
          const chunks: Buffer[] = []; let entryBytes=0;
          stream.on('error',fail);
          stream.on('data',(chunk: Buffer) => {
            bytes+=chunk.length; entryBytes+=chunk.length;
            if(bytes>16*1024*1024 || entryBytes>8*1024*1024){stream.destroy();fail();return;}
            if (/\.xml$|\.rels$/i.test(entry.fileName)) chunks.push(chunk);
          });
          stream.on('end',()=>{
            if(settled)return;
            if(chunks.length && /<!DOCTYPE|<!ENTITY|TargetMode\s*=\s*["']External["']|<f(?:\s|>)/i.test(Buffer.concat(chunks).toString('utf8')))return fail();
            zip.readEntry();
          });
        });
      });
      zip.readEntry();
    });
  });
}

export async function parseImport(buffer: Buffer, kind: ImportKind): Promise<ExcelRow[]> {
  await checkArchive(buffer);
  const book = new ExcelJS.Workbook();
  try { await book.xlsx.load(buffer as unknown as Parameters<typeof book.xlsx.load>[0]); } catch { throw invalid('Không đọc được XLSX'); }
  if(book.worksheets.some(s=>!['Data','HuongDan'].includes(s.name)))throw invalid('Chỉ nhận sheet Data và HuongDan');
  const sheet = book.getWorksheet('Data');
  if (!sheet || sheet.rowCount > 201 || sheet.columnCount > 20) throw invalid('Cần sheet Data, tối đa 200 dòng dữ liệu và 20 cột');
  const headers: string[] = [];
  sheet.getRow(1).eachCell({includeEmpty:true},cell=>headers.push(typeof cell.value==='string'?cell.value.trim():''));
  const expected: readonly string[] = importColumns[kind];
  if(headers.length!==expected.length || new Set(headers).size!==headers.length || headers.some(h=>!expected.includes(h)))throw invalid(`Header cần đúng: ${expected.join(', ')}`);
  const rows: ExcelRow[]=[];
  for(let n=2;n<=sheet.rowCount;n++){
    const row: ExcelRow={};let populated=false;
    headers.forEach((header,i)=>{
      const value=sheet.getRow(n).getCell(i+1).value;
      if(value===null || value===undefined || value===''){row[header]=null;return;}
      populated=true;
      if(value instanceof Date && /Date$/.test(header) && !Number.isNaN(value.getTime()))row[header]=value.toISOString().slice(0,10);
      else if(typeof value==='string' && value.length<=500)row[header]=value.trim();
      else if(typeof value==='number' && Number.isFinite(value))row[header]=value;
      else throw invalid(`Dòng ${n}, cột ${header}: chỉ nhận giá trị, không nhận công thức/liên kết/đối tượng`);
    });
    // Blank interior rows would make displayed row errors ambiguous.
    if(!populated)throw invalid(`Dòng ${n} trống: xóa dòng trống trước khi nhập`);
    rows.push(row);
  }
  if(!rows.length)throw invalid('File chưa có dữ liệu');
  return rows;
}

export function addDataSheet(book: ExcelJS.Workbook, name: string, columns: readonly string[], rows: ExcelRow[]) {
  const sheet=book.addWorksheet(name,{views:[{state:'frozen',ySplit:1}]});
  sheet.columns=columns.map(key=>({header:key,key,width:/name|customer|email|message|warning/i.test(key)?32:20}));
  rows.forEach(row=>{
    const added=sheet.addRow(row);
    columns.forEach((key,i)=>{
      const cell=added.getCell(i+1);
      // Explicit text prevents spreadsheet formula injection, including names beginning '='.
      if(typeof row[key]==='string')cell.value=row[key];
      if(typeof row[key]==='number')cell.numFmt=/utilization|Rate|probability/i.test(key)?'0.0%':'0.0000';
      if(typeof row[key]==='number' && /headcount|level|nominalHires|missingCapacity|missingDemand|missingProbability/i.test(key))cell.numFmt='0';
      if(typeof row[key]==='string' && /Date$/.test(key) && /^\d{4}-\d{2}-\d{2}$/.test(row[key] as string)){cell.value=new Date(`${row[key]}T00:00:00Z`);cell.numFmt='dd/mm/yyyy';}
    });
  });
  sheet.autoFilter={from:{row:1,column:1},to:{row:Math.max(1,sheet.rowCount),column:columns.length}};
  sheet.getRow(1).height=30;
  sheet.getRow(1).eachCell(cell=>{cell.font={bold:true,color:{argb:'FFFFFFFF'}};cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF102A4B'}};cell.alignment={vertical:'middle',wrapText:true};});
  return sheet;
}
export async function workbookBuffer(sheets: {name:string;columns:readonly string[];rows:ExcelRow[]}[], notes: string[]) {
  const book=new ExcelJS.Workbook();book.creator='DX Service IT-RMS';book.created=new Date();
  sheets.forEach(s=>addDataSheet(book,s.name,s.columns,s.rows));
  const guide=book.addWorksheet('HuongDan');guide.columns=[{header:'Hướng dẫn và định nghĩa',key:'note',width:110}];
  notes.forEach(note=>{const row=guide.addRow({note});row.alignment={wrapText:true,vertical:'top'};row.height=45;});
  return Buffer.from(await book.xlsx.writeBuffer());
}
export async function importTemplate(kind: ImportKind) {
  return workbookBuffer([{name:'Data',columns:importColumns[kind],rows:[]}],[
    `Loại dữ liệu: ${kind}. Giữ nguyên header. Mỗi file tối đa 200 dòng. Không có công thức, macro, hyperlink.`,
    'Ngày: YYYY-MM-DD hoặc ô ngày Excel. Tháng: văn bản YYYY-MM. MM là số không âm, tối đa 4 số thập phân; không bỏ trống ô bắt buộc.',
    'code/employeeCode/projectCode/pmCode dùng mã nghiệp vụ, không dùng ID nội bộ. pmCode và exitDate có thể trống. Mã đã có sẽ cập nhật; không đổi mã bằng import.',
    'Employee: position PM/BrSE/TL/Developer/Tester; level 1–6; location ONSITE/OFFSHORE; jlpt N1–N5/NONE; status ACTIVE/PROBATION/ON_LEAVE/RESIGNED; participationRate 0–1.',
    'Project: status PIPELINE/CONFIRMED/ACTIVE/COMPLETED/CANCELLED. pmCode phải thuộc PM còn làm việc. Planned/Actual: employeeCode, projectCode, month, mm; 0 khác chưa nhập.',
    'Preview bắt buộc trước khi ghi; token hết hạn sau 10 phút. Toàn file ghi cùng transaction/audit. Allocation quá capacity được phép; kiểm tra cảnh báo ở Allocation Matrix.',
  ]);
}

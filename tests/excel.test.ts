import { describe,expect,it } from 'vitest';
import ExcelJS from 'exceljs';
import { importTemplate, parseImport, checkArchive, workbookBuffer, importColumns } from '../src/lib/excel';
import { redactAudit, auditFilter } from '../src/lib/reporting';

describe('XLSX boundary and typed output',()=>{
  it('creates a frozen/filterable template with exact headers and guide',async()=>{
    const book=new ExcelJS.Workbook();await book.xlsx.load(await importTemplate('planned') as never);
    expect(book.getWorksheet('Data')!.getRow(1).values).toEqual([undefined,...importColumns.planned]);expect(book.getWorksheet('Data')!.views[0].state).toBe('frozen');expect(book.getWorksheet('HuongDan')).toBeTruthy();
  });
  it('round-trips numbers, zero and literal names that begin with equals',async()=>{
    const data=[{employeeCode:'=literal',projectCode:'DX-1',month:'2026-10',mm:0}];
    const buffer=await workbookBuffer([{name:'Data',columns:importColumns.planned,rows:data}],[]);
    expect(await parseImport(buffer,'planned')).toEqual(data);
  });
  it('rejects formula cells even when they contain a cached result',async()=>{
    const book=new ExcelJS.Workbook();const s=book.addWorksheet('Data');s.addRow(importColumns.planned);s.addRow(['DX-1','P-1','2026-10',{formula:'1+1',result:2}]);
    await expect(parseImport(Buffer.from(await book.xlsx.writeBuffer()),'planned')).rejects.toThrow();
  });
  it('rejects hyperlinks, foreign sheets, duplicate/missing headers',async()=>{
    const book=new ExcelJS.Workbook();const s=book.addWorksheet('Data');s.addRow(importColumns.planned);s.addRow([{text:'DX-1',hyperlink:'https://example.test'},'P-1','2026-10',1]);
    await expect(parseImport(Buffer.from(await book.xlsx.writeBuffer()),'planned')).rejects.toThrow();
    s.getCell('A2').value='DX-1';book.addWorksheet('Unknown');await expect(parseImport(Buffer.from(await book.xlsx.writeBuffer()),'planned')).rejects.toThrow('Chỉ nhận');
    book.removeWorksheet('Unknown');s.getCell('B1').value='employeeCode';await expect(parseImport(Buffer.from(await book.xlsx.writeBuffer()),'planned')).rejects.toThrow('Header');
  });
  it('rejects invalid ZIP, oversize uploads, empty workbooks and >200 rows',async()=>{
    await expect(checkArchive(Buffer.from('not xlsx'))).rejects.toThrow();await expect(checkArchive(Buffer.alloc(2*1024*1024+1))).rejects.toThrow();
    await expect(parseImport(await importTemplate('planned'),'planned')).rejects.toThrow('chưa có dữ liệu');
    const rows=Array.from({length:201},(_,i)=>({employeeCode:`DX-${i}`,projectCode:'P1',month:'2026-10',mm:1}));
    await expect(parseImport(await workbookBuffer([{name:'Data',columns:importColumns.planned,rows}],[]),'planned')).rejects.toThrow('200');
  });
  it('preserves blank MM rather than coercing it into zero',async()=>{
    const rows=await parseImport(await workbookBuffer([{name:'Data',columns:importColumns.actual,rows:[{employeeCode:'DX-1',projectCode:'P1',month:'2026-10',mm:null}]}],[]),'actual');expect(rows[0].mm).toBeNull();
  });
  it('rejects a highly compressed XML payload before the workbook parser',async()=>{
    const book=new ExcelJS.Workbook();book.addWorksheet('Data').getCell('A1').value='A'.repeat(1024*1024);
    await expect(checkArchive(Buffer.from(await book.xlsx.writeBuffer()))).rejects.toThrow('giới hạn giải nén');
  });
  it('writes numeric dates and returns ISO date-only inputs',async()=>{
    const row={code:'DX-1',name:'Demo',email:'demo@example.test',position:'PM',level:1,joinDate:'2026-10-01',exitDate:null,experience:2,location:'ONSITE',jlpt:'N2',status:'ACTIVE',participationRate:1};
    const buffer=await workbookBuffer([{name:'Data',columns:importColumns.employees,rows:[row]}],[]);const book=new ExcelJS.Workbook();await book.xlsx.load(buffer as never);expect(book.getWorksheet('Data')!.getCell('F2').value).toBeInstanceOf(Date);expect(await parseImport(buffer,'employees')).toEqual([row]);
  });
  it('redacts sensitive audit keys recursively without losing business values',()=>{expect(redactAudit({passwordHash:'bad',nested:{token:'bad',mm:1},list:[{secret:'bad'}]})).toEqual({passwordHash:'[Đã ẩn]',nested:{token:'[Đã ẩn]',mm:1},list:[{secret:'[Đã ẩn]'}]});});
  it('validates audit ranges and bounded page numbers',()=>{expect(auditFilter.safeParse({from:'2026-10-20',to:'2026-10-01'}).success).toBe(false);expect(auditFilter.safeParse({page:0}).success).toBe(false);expect(auditFilter.parse({}).page).toBe(1);});
});

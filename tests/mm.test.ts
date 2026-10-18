import { describe, it, expect } from 'vitest';
import { availableWorkingDays, mmSummary, roundMm } from '../src/lib/mm';
describe('MM business rules',()=>{
  it('capacity, multiple allocations, available and utilization are distinct',()=>{expect(mmSummary(18,20,[0.4,0.3])).toEqual({capacity:0.9,allocated:0.7,available:0.2,utilization:0.7/0.9,overallocated:false});});
  it('allows overload and preserves negative available',()=>{expect(mmSummary(20,20,[0.8,0.5])).toMatchObject({allocated:1.3,available:-0.3,overallocated:true});});
  it('zero capacity gives null utilization and still detects overload',()=>{expect(mmSummary(0,20,[0.1])).toMatchObject({capacity:0,utilization:null,overallocated:true});expect(mmSummary(0,20,[]).overallocated).toBe(false);});
  it.each([[-1,20,[]],[1,0,[]],[1,20,[-0.1]],[NaN,20,[]],[1,20,[Infinity]]] as [number,number,number[]][])('rejects invalid input %j %j %j',(a,b,c)=>expect(()=>mmSummary(a,b,c)).toThrow());
  it('uses persisted 4-place precision without accumulating floating point noise',()=>{expect(mmSummary(20,20,[0.1,0.2]).allocated).toBe(0.3);expect(roundMm(0.12345)).toBe(0.1235);expect(mmSummary(1,3,[]).capacity).toBe(0.3333);});
  it('subtracts holidays and leave; join/exit dates and participation bound capacity',()=>{
    const days=[{date:'2026-10-01',workingFraction:1},{date:'2026-10-02',workingFraction:1},{date:'2026-10-03',workingFraction:0},{date:'2026-10-04',workingFraction:1},{date:'2026-10-05',workingFraction:1}];
    expect(availableWorkingDays(days,[{date:'2026-10-02',fraction:0.5},{date:'2026-10-03',fraction:1}],'2026-10-02','2026-10-04',0.8)).toBe(1.2);
  });
  it('does not double subtract overlapping unavailable time',()=>{expect(availableWorkingDays([{date:'2026-10-01',workingFraction:0.5}],[{date:'2026-10-01',fraction:0.5},{date:'2026-10-01',fraction:0.5}],'2020-01-01',null,1)).toBe(0);});
  it('future capacity after exit is zero',()=>{expect(availableWorkingDays([{date:'2027-01-01',workingFraction:1}],[],'2020-01-01','2026-12-31',1)).toBe(0);});
  it('rejects duplicate calendar dates and invalid rates',()=>{expect(()=>availableWorkingDays([{date:'2026-01-01',workingFraction:1},{date:'2026-01-01',workingFraction:1}],[],'2020-01-01',null,1)).toThrow();expect(()=>availableWorkingDays([],[],'2020-01-01',null,1.1)).toThrow();});
});

import { describe, expect, it } from 'vitest';
import { matchResources, matchesJlpt } from '../src/lib/capability-matching';
import { resourceFilterSchema, requirementSchema, skillSchema } from '../src/lib/capability-validation';
import type { CapabilityEmployee, CatalogSkill, ResourceFilters } from '../src/lib/capability-types';
const catalog: CatalogSkill[] = [{id:'ts',name:'TypeScript',category:'LANGUAGE',active:true,version:1},{id:'react',name:'React',category:'FRAMEWORK',active:true,version:1},{id:'old',name:'Archived',category:'AI_TOOLS',active:false,version:1}];
const base: CapabilityEmployee = {id:'e1',code:'E01',name:'Demo An',position:'Developer',location:'OFFSHORE',level:4,jlpt:'N2',status:'ACTIVE',joinDate:'2020-01-01',exitDate:null,capacity:1,available:0.6,allocated:0.4,ratings:[{skillId:'ts',proficiency:4,active:true,version:1},{skillId:'react',proficiency:3,active:true,version:1}]};
const employees: CapabilityEmployee[] = [base,{...base,id:'e2',code:'E02',level:3,jlpt:'N3',available:0,allocated:1,ratings:[{skillId:'ts',proficiency:3,active:true,version:1}]},{...base,id:'e3',code:'E03',level:6,jlpt:'N1',capacity:null,available:null,ratings:[{skillId:'ts',proficiency:5,active:false,version:2},{skillId:'old',proficiency:5,active:true,version:1}]},{...base,id:'e4',code:'E04',position:'TL',jlpt:'N1',available:-0.2,allocated:1.2},{...base,id:'e5',code:'E05',exitDate:'2026-09-30',status:'RESIGNED'},{...base,id:'e6',code:'E06',joinDate:'2026-11-01'}];
const filters: ResourceFilters = {month:'2026-10',query:'',position:'',location:'',minLevel:1,maxLevel:6,jlpt:'ANY',mode:'ALL',skills:[],availability:'ANY',minAvailableMm:0};
const ids=(f:Partial<ResourceFilters>,requirements:{skillId:string;minProficiency:number}[]=[])=>matchResources(employees,catalog,{...filters,...f},requirements).map(r=>r.employee.id);
describe('Capability matching rules',()=>{
  it('ALL enforces per-skill proficiency and missing skills do not match',()=>{expect(ids({skills:[{skillId:'ts',minProficiency:3},{skillId:'react',minProficiency:3}]})).toEqual(['e1','e4']);});
  it('ANY returns at least one manual skill, while project requirements always use AND',()=>{const skills=[{skillId:'ts',minProficiency:3},{skillId:'react',minProficiency:3}];expect(ids({skills,mode:'ANY'})).toEqual(['e1','e2','e4']);expect(ids({skills,mode:'ANY'},[{skillId:'react',minProficiency:3}])).toEqual(['e1','e4']);});
  it('inactive ratings and archived catalog never provide evidence',()=>{expect(ids({skills:[{skillId:'old',minProficiency:1}]})).toEqual([]);expect(ids({skills:[{skillId:'ts',minProficiency:5}]})).toEqual([]);});
  it('AVAILABLE excludes unknown capacity, zero availability and overload',()=>{expect(ids({availability:'AVAILABLE',minAvailableMm:0})).toEqual(['e1']);expect(ids({availability:'AVAILABLE',minAvailableMm:0.6001})).toEqual([]);});
  it('ANY zero threshold retains unknown and negative capacity; KNOWN excludes only unknown',()=>{expect(ids({})).toEqual(['e1','e2','e4','e3']);expect(ids({availability:'KNOWN'})).toEqual(['e1','e2','e4']);});
  it('positive minimum always requires known available MM',()=>{expect(ids({minAvailableMm:0.1})).toEqual(['e1']);});
  it('combines level, position, location, name/code and JLPT filters',()=>{expect(ids({minLevel:4,maxLevel:5,position:'Developer',location:'OFFSHORE',jlpt:'N2',query:'E01'})).toEqual(['e1']);expect(ids({location:'ONSITE'})).toEqual([]);});
  it('JLPT minimum follows N1 > N2 > N3 > N4 > N5; NONE is exact',()=>{expect(matchesJlpt('N1','N2')).toBe(true);expect(matchesJlpt('N3','N2')).toBe(false);expect(matchesJlpt('NONE','N5')).toBe(false);expect(matchesJlpt('NONE','NONE')).toBe(true);expect(matchesJlpt('N1','NONE')).toBe(false);expect(matchesJlpt('NONE','ANY')).toBe(true);});
  it('uses employment dates for historical months without conflating proficiency and employee level',()=>{expect(ids({query:'E05'})).toEqual([]);const result=matchResources(employees,catalog,{...filters,month:'2026-09',query:'E05'});expect(result).toHaveLength(1);expect(ids({minLevel:6})).toEqual(['e3']);});
  it('does not mutate inputs and applies deterministic availability ordering',()=>{const snapshot=JSON.stringify(employees);const result=matchResources(employees,catalog,filters);expect(result.map(r=>r.employee.code)).toEqual(['E01','E02','E04','E03']);expect(JSON.stringify(employees)).toBe(snapshot);});
  it('rejects invalid filters, duplicate criteria and invalid requirement MM/proficiency',()=>{
    expect(resourceFilterSchema.safeParse({...filters,minLevel:5,maxLevel:2}).success).toBe(false);
    expect(resourceFilterSchema.safeParse({...filters,skills:[{skillId:'ts',minProficiency:3},{skillId:'ts',minProficiency:4}]}).success).toBe(false);
    expect(resourceFilterSchema.safeParse({...filters,minAvailableMm:Infinity}).success).toBe(false);
    for(const requiredMm of [-1,0.12345,NaN])expect(requirementSchema.safeParse({projectId:'p',skillId:'s',minProficiency:3,requiredMm,active:true,expectedVersion:null}).success).toBe(false);
    expect(requirementSchema.safeParse({projectId:'p',skillId:'s',minProficiency:6,requiredMm:0,active:true,expectedVersion:null}).success).toBe(false);
  });
  it('normalizes skill whitespace and requires an explicit update revision',()=>{expect(skillSchema.parse({name:'  TypeScript   Advanced  ',category:'LANGUAGE',active:true,expectedVersion:null}).name).toBe('TypeScript Advanced');expect(skillSchema.safeParse({id:'s',name:'Name',category:'LANGUAGE',active:true,expectedVersion:null}).success).toBe(false);});
});

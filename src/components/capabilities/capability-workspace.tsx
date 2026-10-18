'use client';
import { useState } from 'react';
import { PageHeading } from '@/components/page-heading';
import { Button } from '@/components/ui/button';
import { SkillMatrix } from './skill-matrix';
import { SkillCatalog } from './skill-catalog';
import { ResourceSearch } from './resource-search';
import type { CapabilityData } from '@/lib/capability-types';
export function CapabilityWorkspace({data,canEdit,initialTab,initialProject,initialEmployee}:{data:CapabilityData;canEdit:boolean;initialTab:string;initialProject?:string;initialEmployee?:string}) {
  const [tab,setTab]=useState(initialTab);
  return <><PageHeading eyebrow="CAPABILITY MANAGEMENT" title="Năng lực & kỹ năng" description="Kết nối năng lực hiện tại với nhu cầu dự án và nguồn lực khả dụng theo tháng."/><form className="panel mb-5 flex flex-wrap items-end gap-3 p-4"><label className="field">Tháng đối chiếu Capacity<input type="month" name="month" min="1900-01" max="2199-12" defaultValue={data.month} required/></label><input type="hidden" name="tab" value={tab}/>{initialProject&&<input type="hidden" name="project" value={initialProject}/>}<Button type="submit" variant="outline">Xem tháng</Button><p className="ml-auto text-[11px] text-muted-foreground">Hồ sơ kỹ năng hiện tại · Capacity theo tháng đã chọn</p></form><div className="mb-6 flex flex-wrap gap-2">{[['matrix','Skill Matrix'],['search','Tìm nhân sự'],['catalog','Danh mục kỹ năng']].map(([key,label])=><Button key={key} variant={tab===key?'default':'outline'} onClick={()=>setTab(key)}>{label}</Button>)}</div>{tab==='matrix'&&<SkillMatrix data={data} canEdit={canEdit} initialEmployee={initialEmployee}/>} {tab==='search'&&<ResourceSearch data={data} initialProject={initialProject}/>} {tab==='catalog'&&<SkillCatalog data={data} canEdit={canEdit}/>}</>;
}

// Rebuild the operational additions from the six required native Lens panels.
import { readFile, writeFile } from 'node:fs/promises';
const file = new URL('../kibana/dashboard.ndjson', import.meta.url);
const objects = (await readFile(file, 'utf8')).trim().split('\n').map(JSON.parse).filter((o) => o.type);
const dashboard = objects.find((o) => o.type === 'dashboard');
const original = JSON.parse(dashboard.attributes.panelsJSON).filter((p) => Number(p.panelIndex) <= 13);
const panels = [], references = [];
const business = 'service.name: "bevstack-ecommerce-api" and labels.catalog_item: *';
const success = 'http.response.status_code >= 200 and http.response.status_code < 400';
const layerOf = (p) => Object.values(p.embeddableConfig.attributes.state.datasourceStates.formBased.layers)[0];
const stateOf = (p) => p.embeddableConfig.attributes.state;
const grid = (p, x,y,w,h) => { p.gridData = {x,y,w,h,i:p.panelIndex}; return p; };
const count = (label, filter) => ({label,dataType:'number',operationType:'count',isBucketed:false,scale:'ratio',sourceField:'___records___',params:{emptyAsNull:false},customLabel:true,...(filter?{filter:{query:filter,language:'kuery'}}:{})});
function math(columns,id,operation,sourceField,formula,label,filter,percentile) {
  columns[id+'X0']={label:'Cálculo '+label,dataType:'number',operationType:operation,isBucketed:false,scale:'ratio',sourceField,params:{emptyAsNull:true,...(percentile?{percentile}: {})},...(filter?{filter:{query:filter,language:'kuery'}}:{})};
  columns[id+'X2']={label:'Cálculo '+label,dataType:'number',operationType:'math',isBucketed:false,scale:'ratio',references:[id+'X0'],params:{tinymathAst:{type:'function',name:'divide',args:[id+'X0',1000000],location:{min:0,max:formula.length},text:formula}}};
  columns[id]={label,dataType:'number',operationType:'formula',isBucketed:false,scale:'ratio',customLabel:true,references:[id+'X2'],params:{formula,isFormulaBroken:false,format:{id:'number',params:{decimals:0,suffix:' ms'}}}};
}
function rate(columns,id,query,label){
  const formula=`count(kql='${query}') / count()`;
  columns[id+'X0']=count('Numerador',query); columns[id+'X1']=count('Denominador');
  columns[id+'X2']={label:'Cálculo '+label,dataType:'number',operationType:'math',isBucketed:false,scale:'ratio',references:[id+'X0',id+'X1'],params:{tinymathAst:{type:'function',name:'divide',args:[id+'X0',id+'X1'],location:{min:0,max:formula.length},text:formula}}};
  columns[id]={label,dataType:'number',operationType:'formula',isBucketed:false,scale:'ratio',customLabel:true,references:[id+'X2'],params:{formula,isFormulaBroken:false,format:{id:'percent',params:{decimals:1}}}};
}
function addLens(id,title,view,columns,order,type,visualization,query,x,y,w,h,description='') {
  const layerId='operational-'+id, index=String(id);
  const visualizationJSON=typeof visualization==='function'?visualization(layerId):{layerId,layerType:'data',...visualization};
  panels.push(grid({version:'8.19.5',type:'lens',panelIndex:index,title,embeddableConfig:{attributes:{title,description,visualizationType:type,type:'lens',references:[{type:'index-pattern',id:view,name:'indexpattern-datasource-layer-'+layerId}],state:{visualization:visualizationJSON,query:{query,language:'kuery'},filters:[],datasourceStates:{formBased:{layers:{[layerId]:{columns,columnOrder:order,incompleteColumns:{}}}},textBased:{layers:{}}},internalReferences:[],adHocDataViews:{}}},enhancements:{}}},x,y,w,h));
}
function terms(label,field,orderBy,alpha=false){return {label,dataType:'string',operationType:'terms',isBucketed:true,scale:'ordinal',sourceField:field,params:{size:50,orderBy:alpha?{type:'alphabetical'}:{type:'column',columnId:orderBy},orderDirection:alpha?'asc':'desc',otherBucket:false,missingBucket:false,parentFormat:{id:'terms'},include:[],exclude:[],includeIsRegex:false,excludeIsRegex:false},customLabel:true};}
function markdown(id,title,markdown,y,h){
  const savedId='bevstack-guide-'+id;
  objects.splice(0,0,{type:'visualization',id:savedId,attributes:{title,visState:JSON.stringify({title,type:'markdown',params:{markdown,fontSize:12,openLinksInNewTab:false},aggs:[]}),uiStateJSON:'{}',description:'Guía operativa de la simulación',kibanaSavedObjectMeta:{searchSourceJSON:JSON.stringify({query:{language:'kuery',query:''},filter:[]})}},references:[]});
  panels.push(grid({version:'8.19.5',type:'visualization',panelIndex:String(id),panelRefName:'panel_'+id,title,embeddableConfig:{enhancements:{}}},0,y,48,h));
  references.push({type:'visualization',id:savedId,name:'panel_'+id});
}
// Remove a previous generated guide before recreating it.
for(let i=objects.length-1;i>=0;i--)if(objects[i].type==='visualization'&&objects[i].id.startsWith('bevstack-guide-'))objects.splice(i,1);
markdown(100,'Cómo decidir y escalar',`**1. Verifique la frescura antes de interpretar un “up”.** Señales con más de 45 s y evaluador sin actualizar: estado desconocido; compruebe el servicio directamente. Una tabla vacía no garantiza salud.\n\n**2. Atienda P1 → P2 → P3.** P1: caída confirmada o 5xx generalizados. Tech restaura; Account Management valida marcas, impacto y comunicación. P2: degradación o pérdida de observabilidad. P3: revisión de 4xx o tráfico esperado. Son prioridades técnicas propuestas, pendientes de validar con impacto y urgencia comerciales.\n\n**3. Consulte evidencia y siguiente paso.** Alertas: ventana móvil de 5 min, evaluación cada 10 s y confirmación; datos insuficientes no resuelven alertas. Los gráficos usan el intervalo del selector. La cola refleja la última evaluación, no el historial completo.`,0,10);
for(const [i,p] of original.entries()){
  const a=p.embeddableConfig.attributes,s=stateOf(p),l=layerOf(p);
  delete s.visualization.palette;
  if(i!==0&&i!==1&&i!==7)s.query={query:business,language:'kuery'};
  else s.query={query:'monitor.id: "bevstack-api-health"',language:'kuery'};
  if(s.visualization.fittingFunction)s.visualization.fittingFunction='None';
  for(const c of Object.values(l.columns)){
    if(c.operationType==='date_histogram')c.params={...c.params,interval:'1m',includeEmptyRows:true};
    if(c.operationType==='count')c.params.emptyAsNull=true;
  }
  if(i===0){p.title=a.title='Último estado reportado · verificar fecha';grid(p,0,10,12,7);}
  if(i===1){p.title=a.title='Chequeos up en el periodo · no es SLA';grid(p,12,10,12,7);}
  if(i===2){p.title=a.title='Peticiones de catálogo · n';grid(p,0,43,12,7);}
  if(i===3){p.title=a.title='Errores de servidor · 5xx';const id=s.visualization.metricAccessor;l.columns={};rate(l.columns,id,'http.response.status_code >= 500','5xx / peticiones');l.columnOrder=Object.keys(l.columns);grid(p,12,43,12,7);}
  if(i===4){p.title=a.title='p95 de respuestas exitosas';const id=s.visualization.metricAccessor;l.columns={};math(l.columns,id,'percentile','event.duration',`percentile(event.duration, percentile=95, kql='${success}') / 1000000`,'p95 exitosas',success,95);l.columnOrder=Object.keys(l.columns);grid(p,36,43,12,7);}
  if(i===5){a.description='Peticiones agrupadas por tipo del catálogo. No son cantidades de tickets ni incidentes reales.';grid(p,0,50,24,12);}
  if(i===6){a.description='Media de todas las respuestas. Comparar con p50/p95 de exitosas y detalle por ruta; los errores rápidos pueden reducir esta media.';grid(p,24,50,24,12);}
  if(i===7)grid(p,0,74,24,12);
  if(i===8){const dateId=l.columnOrder.find(id=>l.columns[id].operationType==='date_histogram');const date=l.columns[dateId];l.columns={[dateId]:date};rate(l.columns,'serverRate','http.response.status_code >= 500','5xx');rate(l.columns,'clientRate','http.response.status_code >= 400 and http.response.status_code < 500','4xx');l.columnOrder=Object.keys(l.columns);s.visualization.layers[0].accessors=['serverRate','clientRate'];s.visualization.layers[0].yConfig=[{forAccessor:'serverRate',color:'#BD271E'},{forAccessor:'clientRate',color:'#B88D35'}];grid(p,24,74,24,12);}
  if(i===9)grid(p,0,86,16,13);
  if(i===10)grid(p,16,86,16,13);
  if(i===11)grid(p,32,86,16,13);
  if(i===12){
    const c={c23:l.columns.c23,c24:l.columns.c24,c22:count('n total')};
    math(c,'mean','average','event.duration','average(event.duration) / 1000000','Media todas');
    c.successN=count('n exitosas',success);
    math(c,'routeP95','percentile','event.duration',`percentile(event.duration, percentile=95, kql='${success}') / 1000000`,'p95 exitosas',success,95);
    rate(c,'route5xx','http.response.status_code >= 500','5xx');
    rate(c,'route4xx','http.response.status_code >= 400 and http.response.status_code < 500','4xx');
    l.columns=c;l.columnOrder=['c23','c24',...Object.keys(c).filter(id=>!['c23','c24'].includes(id))];
    s.visualization.columns=['c23','c24','c22','mean','successN','routeP95','route5xx','route4xx'].map(columnId=>({columnId,isTransposed:false}));
    a.description='p95 de respuestas exitosas: interpretar con n exitosas; mínimo operativo 50 por ruta y ventana de 5 min. Media global no reemplaza análisis por ruta.';grid(p,0,99,48,16);
  }
  panels.push(p);
}
for(const [id,title,view,query,x] of [
 [101,'Último chequeo Heartbeat · UTC','bevstack-heartbeat','monitor.id: "bevstack-api-health"',24],
 [102,'Último log de API · UTC','bevstack-api-logs','service.name: "bevstack-ecommerce-api"',36],
 [103,'Última evaluación · UTC','bevstack-monitoring-current','',0],
])addLens(id,title,view,{latest:{label:'Última señal',dataType:'date',operationType:'max',isBucketed:false,scale:'interval',sourceField:'@timestamp',params:{format:{id:'date',params:{pattern:'YYYY-MM-DD HH:mm:ss'}}},customLabel:true}},['latest'],'lnsMetric',{metricAccessor:'latest'},query,x,id===103?17:10,id===103?48:12,7);
const alertColumns={};
const fields=[['priority','Prioridad'],['title','Señal'],['evidence','Evidencia'],['owner','Responsable'],['action','Siguiente paso']];
for(const [field,label]of fields)alertColumns[field]=terms(label,'alert.'+field,'n',true);
alertColumns.n=count('Reglas activas');
addLens(104,'Alertas activas · prioridad técnica provisional','bevstack-monitoring-current',alertColumns,[...fields.map(f=>f[0]),'n'],'lnsDatatable',(layerId)=>({layerId,layerType:'data',columns:[...fields.map(([columnId])=>({columnId,isTransposed:false,width:({priority:90,title:280,evidence:380,owner:230,action:760})[columnId]})),{columnId:'n',hidden:true}],rowHeight:'auto',headerRowHeight:'auto',sorting:{columnId:'priority',direction:'asc'}}),'alert.active: true',0,24,48,19,'Si no hay filas, comprobar primero las fechas de las tres fuentes. Consultar documentos correlacionados e historial en Discover.');
const cc={};rate(cc,'rate','http.response.status_code >= 400 and http.response.status_code < 500','4xx / peticiones');
addLens(105,'Errores de cliente · 4xx','bevstack-api-logs',cc,Object.keys(cc),'lnsMetric',{metricAccessor:'rate'},business,24,43,12,7);
const date={label:'Tiempo',dataType:'date',operationType:'date_histogram',sourceField:'@timestamp',isBucketed:true,scale:'interval',params:{interval:'1m',includeEmptyRows:true,dropPartials:false},customLabel:true};
const pc={date};
for(const n of [50,95])math(pc,'p'+n,'percentile','event.duration',`percentile(event.duration, percentile=${n}, kql='${success}') / 1000000`,'p'+n+' exitosas',success,n);
const xy=structuredClone(stateOf(original[6]).visualization);xy.fittingFunction='None';xy.layers[0].xAccessor='date';xy.layers[0].accessors=['p50','p95'];xy.layers[0].yConfig=[{forAccessor:'p50',color:'#6092C0'},{forAccessor:'p95',color:'#A864C1'}];
addLens(106,'Latencia exitosa · p50 y p95','bevstack-api-logs',pc,Object.keys(pc),'lnsXY',(id)=>({...xy,layers:xy.layers.map(l=>({...l,layerId:id}))}),business,0,62,48,12,'Percentiles aproximados por intervalo; validar mínimo n=50 exitosas por ruta en la cola y la tabla. No se interpola sobre huecos.');
markdown(107,'Reglas y atención',`**P1:** 2 chequeos distintos down recientes; o ≥30% 5xx con n≥100 en 5 min, confirmado en 2 evaluaciones. **P2:** logs/Heartbeat sin actualizar >45 s; 5xx por ruta ≥10% con n≥50; p95 exitosas sobre objetivo con n exitosas≥50. **P3:** 4xx por ruta ≥30% con n≥50; tráfico esperado ausente >60 s.\n\n**Control de ruido:** 2 evaluaciones para activar y recuperar, salvo disponibilidad que exige 2 chequeos distintos. Recuperación: 5xx global <15%; 5xx por ruta <8%; 4xx por ruta <24%; latencia ≤80% del objetivo. Una caída agrupa sus síntomas; se guarda una transición por cambio. Sin datos no se declara recuperación.\n\n**Objetivos provisionales de p95:** pagos 1500 ms; pedidos 1200; inventario 350; envíos 500; tienda nueva 1000; configuraciones 750. El 5% 5xx y 15% 4xx de la simulación no son objetivos de calidad para producción.\n\n**Atención:** Tech verifica y restaura; Account Management valida alcance y urgencia por marca, actualiza al cliente y coordina seguimiento. Crear o actualizar un incidente tras validación humana; fallos repetidos se investigan como problema. Ver docs/fase-3-alertas.md.`,115,14);
const layout={0:[0,8],10:[8,6],17:[14,4],24:[18,13],43:[31,6],50:[37,11],62:[48,10],74:[58,11],86:[69,12],99:[81,13],115:[94,12]};
for(const p of panels){const adjusted=layout[p.gridData.y];if(adjusted){p.gridData.y=adjusted[0];p.gridData.h=adjusted[1];}}
for(const p of panels)if(p.type==='lens')for(const ref of p.embeddableConfig.attributes.references)references.push({...ref,name:p.panelIndex+':'+ref.name});
dashboard.attributes.panelsJSON=JSON.stringify(panels);
dashboard.attributes.title='Bevstack · Salud y atención del servicio (Fase 3)';
dashboard.attributes.description='Monitoreo de API: prioridad técnica, responsables, siguiente paso, frescura, percentiles, errores y disponibilidad. Umbrales provisionales de simulación.';
dashboard.references=references;
if(!objects.some(o=>o.id==='bevstack-monitoring-current'&&o.type==='index-pattern'))objects.unshift({id:'bevstack-monitoring-current',type:'index-pattern',attributes:{name:'Alertas operativas actuales',title:'bevstack-monitoring-current',timeFieldName:'@timestamp'},references:[]});
await writeFile(file,objects.map(o=>JSON.stringify(o)).join('\n')+'\n');
console.log(`Dashboard: ${panels.length} paneles, 3 data views, 2 guías operativas`);

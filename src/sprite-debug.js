// Only imported by the development preview / explicitly enabled local QA panel.
import { POSES } from './sprite-art.js';
export function attachSpriteControls(container, cat, stage, { wake = () => cat.setLonely(0), heartRain = () => cat.celebrate() } = {}) {
  container.classList.add('tools');
  const hold=document.createElement('input'); hold.type='checkbox';
  const holdLabel=document.createElement('label'); holdLabel.append(hold,' 固定姿势');
  const actions = {
    '挥手':() => { wake(); cat.wave(); },
    '托腮 / 抚摸':() => { wake(); cat.petTick(); },
    '欢呼':() => { wake(); cat.celebrate(); },
    '抱尾巴':() => cat.setLonely(3),
    '撒娇':() => cat.setLonely(1),
    '害羞':() => { wake(); cat.react('cheek'); },
    '睡眠':() => cat.setLonely(5),
    '叫醒':() => { wake(); cat.wave(); },
    '心雨':() => { wake(); heartRain(); },
    '待机':() => { wake(); cat.expressionTime=0; },
  };
  for (const [name,action] of Object.entries(actions)) {
    const button=document.createElement('button'); button.type='button'; button.textContent=name;
    button.addEventListener('click',() => { action(); if(hold.checked && cat.temporaryPose) cat.temporaryPose.remaining=600; }); container.append(button);
  }
  const label=document.createElement('label'), checkbox=document.createElement('input'); checkbox.type='checkbox';
  label.append(checkbox,' 持续说话'); container.append(label,holdLabel);
  const status=document.createElement('output'); container.append(status);
  const check=document.createElement('button'); check.type='button'; check.textContent='校验命中区域';
  const report=document.createElement('output');
  check.addEventListener('click',() => {
    const config=POSES[stage.pose];
    const checks=config.zones.map(region => {
      const [x,y,w,h]=region.ellipse ?? region.rect ?? [];
      const center=region.polygon ? {x:region.polygon.reduce((s,p)=>s+p[0],0)/region.polygon.length,y:region.polygon.reduce((s,p)=>s+p[1],0)/region.polygon.length}
        : region.ellipse ? {x,y} : {x:x+w/2,y:y+h/2};
      const point=stage.pointAt({x:center.x/1024,y:center.y/1536});
      return {expected:region.zone,actual:stage.zoneAt(point)?.zone??null};
    });
    checks.push({expected:null,actual:stage.zoneAt(stage.pointAt({x:.01,y:.01}))?.zone??null});
    report.dataset.checks=JSON.stringify(checks);
    report.textContent=`${stage.pose} 命中校验 ${checks.filter(x=>x.expected===x.actual).length}/${checks.length}`;
  });
  container.append(check,report);
  const update=() => { status.textContent=`${stage.pose} → ${cat.pose} / 已加载 ${stage.loaded.join(', ')}`; };
  const timer=setInterval(update,200);
  addEventListener('pagehide',() => clearInterval(timer),{once:true});
  return { get holding() { return hold.checked; }, get talking() { return checkbox.checked; } };
}

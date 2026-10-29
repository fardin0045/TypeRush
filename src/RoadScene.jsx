import React, {useEffect, useRef} from 'react';

// A lightweight perspective renderer. World distance is projected into the
// chase camera; opponent distance always comes from the typing simulation.
export default function RoadScene({race,count,reduced}) {
  const canvas=useRef(null), current=useRef({race,reduced});
  current.current={race,reduced};
  useEffect(()=>{
    const element=canvas.current, ctx=element.getContext('2d');
    let frame, previous=0, travel=0, smoothPlayer=0, smoothBots=[0,0,0];
    const draw=(now)=>{
      const {race:s,reduced:quiet}=current.current;
      const dt=Math.min(.05,(now-previous)/1000||0);previous=now;
      const w=element.clientWidth,h=element.clientHeight,dpr=Math.min(devicePixelRatio||1,2);
      if(element.width!==Math.round(w*dpr)||element.height!==Math.round(h*dpr)){element.width=Math.round(w*dpr);element.height=Math.round(h*dpr);}
      ctx.setTransform(dpr,0,0,dpr,0,0);
      const horizon=h*.43;
      if(s.status==='ready'||s.status==='countdown'){smoothPlayer=0;smoothBots=[0,0,0];travel=0;}
      const previousPlayer=smoothPlayer;
      smoothPlayer+=(s.cursor-smoothPlayer)*Math.min(1,dt*8);
      if(!quiet&&s.status==='racing')travel+=(smoothPlayer-previousPlayer)*1.8+dt*2;
      const sky=ctx.createLinearGradient(0,0,0,horizon);sky.addColorStop(0,'#183951');sky.addColorStop(.55,'#759aa3');sky.addColorStop(1,'#efc7a0');ctx.fillStyle=sky;ctx.fillRect(0,0,w,h);
      const sun=ctx.createRadialGradient(w*.81,h*.28,8,w*.81,h*.28,w*.22);sun.addColorStop(0,'#fff1c8aa');sun.addColorStop(1,'#ffd2ab00');ctx.fillStyle=sun;ctx.fillRect(0,0,w,horizon);
      function poly(points,fill){ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fillStyle=fill;ctx.fill();}
      poly([[0,horizon],[0,h*.34],[w*.12,h*.29],[w*.23,h*.36],[w*.37,h*.32],[w*.52,horizon]],'#486474');
      poly([[w*.4,horizon],[w*.64,h*.33],[w*.76,h*.26],[w*.9,h*.34],[w,h*.28],[w,horizon]],'#586a71');
      ctx.fillStyle='#354f36';ctx.fillRect(0,horizon,w,h-horizon);
      poly([[0,horizon+30],[w*.15,horizon-34],[w*.38,horizon],[w*.55,h],[0,h]],'#49653c');
      poly([[w*.57,horizon],[w*.87,horizon-26],[w,horizon+25],[w,h],[w*.45,h]],'#3d5b32');
      const project=(z,lane)=>{const scale=1/(1+z*.035);return {x:w*.5+(lane+.25)*w*.86*scale,y:horizon+(h-horizon)*scale,scale};};
      const nearL=project(0,-1),nearR=project(0,1),farL=project(900,-1),farR=project(900,1);
      poly([[farL.x,farL.y],[farR.x,farR.y],[nearR.x,h],[nearL.x,h]],'#394247');
      for(let z=880;z>=0;z-=8){const phase=((z+travel)%24)<12,a=project(z,-1),b=project(z,1),c=project(z+8,1),d=project(z+8,-1);if(phase)poly([[a.x,a.y],[b.x,b.y],[c.x,c.y],[d.x,d.y]],'#3e474b');}
      for(let lane of [-1,-.5,0,.5,1]){
        if(Math.abs(lane)===1){const a=project(0,lane),b=project(900,lane);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.strokeStyle='#eee8d0';ctx.lineWidth=3;ctx.stroke();}
        else for(let z=0;z<800;z+=22){let distance=(z-travel%22+22);const a=project(distance,lane-.007),b=project(distance,lane+.007),c=project(distance+10,lane+.007),d=project(distance+10,lane-.007);poly([[a.x,a.y],[b.x,b.y],[c.x,c.y],[d.x,d.y]],'#e6e4d3');}
      }
      // Alternating kerbs, metal guardrails, trees and lamps recede to the horizon.
      for(let z=650;z>0;z-=18){const distance=z-travel%18;for(const side of [-1,1]){const a=project(distance,side*1.04),b=project(distance+10,side*1.04),c=project(distance+10,side*1.1),d=project(distance,side*1.1);poly([[a.x,a.y],[b.x,b.y],[c.x,c.y],[d.x,d.y]],z%36?'#ddd9bc':'#bc6655');}}
      for(const side of [-1,1]){
        const a=project(0,side*1.13),b=project(900,side*1.13);ctx.strokeStyle='#b1bfc0';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(a.x,a.y-35);ctx.lineTo(b.x,b.y-1);ctx.stroke();
        for(let z=500;z>=8;z-=20){const p=project(z-travel%20,side*1.13);ctx.fillStyle='#adb8b7';ctx.fillRect(p.x,p.y-40*p.scale,5*p.scale,40*p.scale);}
        for(let z=620;z>=15;z-=55){const p=project(z-travel%55,side*1.48);const size=190*p.scale;ctx.fillStyle='#4b4938';ctx.fillRect(p.x-4*p.scale,p.y-size*.7,8*p.scale,size*.7);poly([[p.x,p.y-size],[p.x-size*.28,p.y-size*.35],[p.x+size*.28,p.y-size*.35]],'#203f30');poly([[p.x,p.y-size*.8],[p.x-size*.36,p.y-size*.16],[p.x+size*.36,p.y-size*.16]],'#2d5135');}
      }
      const finishZ=Math.max(0,(s.text.length-smoothPlayer)*5);
      const finish=project(finishZ,0),left=project(finishZ,-1),right=project(finishZ,1);
      const archHeight=220*finish.scale;
      ctx.fillStyle='#cfdbd9';ctx.fillRect(left.x-4*finish.scale,finish.y-archHeight,8*finish.scale,archHeight);ctx.fillRect(right.x-4*finish.scale,finish.y-archHeight,8*finish.scale,archHeight);
      ctx.fillStyle='#182d32';ctx.fillRect(left.x,finish.y-archHeight,right.x-left.x,36*finish.scale);
      ctx.font=`bold ${Math.max(7,18*finish.scale)}px Arial`;ctx.textAlign='center';ctx.fillStyle='#f0efdb';ctx.fillText('T Y P E R U S H  /  F I N I S H',(left.x+right.x)/2,finish.y-archHeight+24*finish.scale);
      function car(x,y,size,color,label,player=false){ctx.save();ctx.translate(x,y);ctx.scale(size,size);
        ctx.fillStyle='#0a151a88';ctx.beginPath();ctx.ellipse(0,7,104,19,0,0,Math.PI*2);ctx.fill();
        ctx.fillStyle='#10181d';ctx.fillRect(-91,-39,24,49);ctx.fillRect(67,-39,24,49);
        const paint=ctx.createLinearGradient(0,-150,0,4);paint.addColorStop(0,'#fff0a5');paint.addColorStop(.2,color);paint.addColorStop(.7,color);paint.addColorStop(1,'#675022');
        ctx.fillStyle=paint;ctx.beginPath();ctx.moveTo(-88,0);ctx.quadraticCurveTo(-103,-37,-83,-69);ctx.lineTo(-66,-126);ctx.quadraticCurveTo(-54,-147,0,-149);ctx.quadraticCurveTo(54,-147,66,-126);ctx.lineTo(83,-69);ctx.quadraticCurveTo(103,-37,88,0);ctx.closePath();ctx.fill();
        poly([[-60,-121],[60,-121],[74,-69],[-74,-69]],'#152a35');
        ctx.strokeStyle='#ffffff55';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-57,-119);ctx.lineTo(57,-119);ctx.stroke();
        ctx.fillStyle='#15232a';ctx.fillRect(-87,-65,174,7);ctx.fillRect(-96,-7,192,10);
        ctx.fillStyle='#ff4c4b';ctx.shadowBlur=player?12:0;ctx.shadowColor='#ff3a28';ctx.fillRect(-83,-48,39,11);ctx.fillRect(44,-48,39,11);ctx.shadowBlur=0;
        ctx.fillStyle='#dfded1';ctx.fillRect(-30,-33,60,17);ctx.fillStyle='#162c32';ctx.font='bold 9px Arial';ctx.fillText('TYPERUSH',0,-21);
        ctx.fillStyle='#12212a';ctx.fillRect(-68,-2,30,6);ctx.fillRect(38,-2,30,6);
        if(!player){ctx.fillStyle='#091721d9';ctx.fillRect(-43,-178,86,21);ctx.fillStyle='#f3f5e8';ctx.font='bold 11px Arial';ctx.fillText(label,0,-163);}ctx.restore();}
      if(!['Practice','Time trial'].includes(s.mode)){
        const lanes=[-.75,.25,.75],colours=['#b6a2f5','#e9edef','#62c6ec'];
        s.bots.map((bot,i)=>{smoothBots[i]+=(bot.cursor-smoothBots[i])*Math.min(1,dt*8);return {i,z:Math.max(0,65+(smoothBots[i]-smoothPlayer)*5)};}).sort((a,b)=>b.z-a.z).forEach(({i,z})=>{const p=project(z,lanes[i]);car(p.x,p.y,Math.max(.09,p.scale*w/1350),colours[i],s.bots[i].name);});
      }
      car(w*.5,h*.87,Math.min(w/1050,h/650),'#f9c932','YOU',true);
      frame=requestAnimationFrame(draw);
    };frame=requestAnimationFrame(draw);return()=>cancelAnimationFrame(frame);
  },[]);
  return <section className="road-scene" aria-label="Live race circuit"><canvas ref={canvas} aria-label="Behind-the-car view of the four-lane racing road"/><div className="circuit-label">COASTLINE RUN <span>01 / 01 · DRY ROAD</span></div><div className="race-mini-map">{[{name:'YOU',cursor:race.cursor},...(!['Practice','Time trial'].includes(race.mode)?race.bots:[])].map((car,i)=><div key={car.name}><span>{car.name}</span><div><i style={{width:`${car.cursor/race.text.length*100}%`,background:['#f9ce4b','#baa3f4','#e4e9e7','#6ad0ef'][i]}}/></div><b className="lane-progress">{Math.floor(car.cursor/race.text.length*100)}%</b></div>)}</div>{count!==null&&<div className="road-countdown" role="status"><strong>{count||'GO!'}</strong><span>FIND YOUR RHYTHM</span></div>}{race.status==='paused'&&<div className="road-countdown"><strong>Paused</strong><span>PRESS ESC TO RESUME</span></div>}</section>;
}

// Satu sumber kamera + MediaPipe (tangan dan tubuh) untuk seluruh Arena. Semua diproses di perangkat.
import {settings} from "./settings.mjs";

export const vision={active:false,video:null,hand:null,pose:null,poseWorld:null,fps:0,handAt:0,poseAt:0};
const listeners=new Set();
export const onVision=f=>{listeners.add(f);return()=>listeners.delete(f);};

let stream=null, handTask=null, poseTask=null, tasks=null, raf=0, lastVideoTime=-1, flip=0, frames=0, fpsAt=0;
const asset=name=>new URL("./vendor/"+name,import.meta.url).href;

function loadTasks(){
  tasks??=import("./vendor/vision_bundle.mjs").then(async m=>({m,runtime:await m.FilesetResolver.forVisionTasks(asset("wasm"))}));
  return tasks;
}
async function create(kind,options){
  const {m,runtime}=await loadTasks();
  const Task=kind==="hand"?m.HandLandmarker:m.PoseLandmarker;
  const file=kind==="hand"?"hand_landmarker.task":"pose_landmarker_lite.task";
  for(const delegate of ["GPU","CPU"]){
    try{return await Task.createFromOptions(runtime,{baseOptions:{modelAssetPath:asset(file),delegate},runningMode:"VIDEO",...options});}
    catch(e){if(delegate==="CPU")throw e;}
  }
}
async function ensureHand(){handTask??=await create("hand",{numHands:1,minHandDetectionConfidence:.45,minHandPresenceConfidence:.45,minTrackingConfidence:.45});}
async function ensurePose(){poseTask??=await create("pose",{numPoses:1,minPoseDetectionConfidence:.5,minTrackingConfidence:.5});}

async function openStream(){
  const id=settings.get("deviceId");
  stream=await navigator.mediaDevices.getUserMedia({audio:false,video:{
    ...(id?{deviceId:{exact:id}}:{facingMode:"user"}),width:{ideal:960},height:{ideal:540},frameRate:{ideal:30}}});
  vision.video.srcObject=stream;await vision.video.play();
}

export async function startVision(video){
  if(!navigator.mediaDevices?.getUserMedia)throw Object.assign(new Error("insecure"),{name:"Insecure"});
  vision.video=video;
  await ensureHand();
  if(settings.get("body"))await ensurePose().catch(e=>console.warn("Model tubuh gagal dimuat",e));
  await openStream();
  vision.active=true;lastVideoTime=-1;
  cancelAnimationFrame(raf);raf=requestAnimationFrame(loop);
}
export function stopVision(){
  cancelAnimationFrame(raf);
  stream?.getTracks().forEach(t=>t.stop());stream=null;
  if(vision.video)vision.video.srcObject=null;
  Object.assign(vision,{active:false,hand:null,pose:null,poseWorld:null,fps:0});
  listeners.forEach(f=>f(vision,performance.now()));
}

function loop(now){
  if(!vision.active)return;
  raf=requestAnimationFrame(loop);
  const v=vision.video;
  if(v.readyState<2||v.currentTime===lastVideoTime)return;
  lastVideoTime=v.currentTime;
  const wantPose=settings.get("body")&&poseTask;
  // Saat dua model aktif, bergantian per frame agar tetap ringan.
  flip^=1;
  try{
    if(handTask&&(!wantPose||flip)){
      const r=handTask.detectForVideo(v,now);vision.hand=r.landmarks?.[0]||null;if(vision.hand)vision.handAt=now;
    }
    if(wantPose&&(!handTask||!flip)){
      const r=poseTask.detectForVideo(v,now);vision.pose=r.landmarks?.[0]||null;vision.poseWorld=r.worldLandmarks?.[0]||null;if(vision.pose)vision.poseAt=now;
    }
    if(!wantPose){vision.pose=vision.poseWorld=null;}
  }catch(e){console.warn("Pelacakan berhenti",e);stopVision();return;}
  frames++;if(now-fpsAt>1000){vision.fps=frames;frames=0;fpsAt=now;}
  listeners.forEach(f=>f(vision,now));
}

settings.on(async(k,v)=>{
  if(!vision.active)return;
  if(k==="deviceId"){stream?.getTracks().forEach(t=>t.stop());try{await openStream();}catch(e){console.warn(e);}}
  if(k==="body"&&v)ensurePose().catch(e=>console.warn("Model tubuh gagal dimuat",e));
});

// Untuk uji otomatis/rekaman: suntikkan satu frame hasil pelacakan.
export function emitVision(frame){Object.assign(vision,frame);listeners.forEach(f=>f(vision,performance.now()));}

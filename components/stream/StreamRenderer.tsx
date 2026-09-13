"use client";

import { animate, AnimatePresence, motion, useMotionValue, useReducedMotion, useTransform } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { brandLogo, brandName } from "../../app/data/branding";
import { StreamPublicState, StreamTeamStanding, StreamWinner } from "../../app/stream/types";

function AnimatedNumber({ value }: { value: number }) {
  const current = useMotionValue(value);
  const rounded = useTransform(current, (latest) => Math.round(latest));
  useEffect(() => { const controls = animate(current, value, { duration: 0.9, ease: "easeOut" }); return controls.stop; }, [current, value]);
  return <motion.span>{rounded}</motion.span>;
}

function Brand({ eventTitle }: { eventTitle: string }) {
  return <div className="absolute left-[4%] top-[5%] z-20 flex items-center gap-[1vw]">
    <img src={brandLogo} alt={brandName} className="h-[clamp(28px,5vw,82px)] w-auto object-contain" />
    <div><p className="text-[clamp(9px,1vw,16px)] font-bold uppercase tracking-[0.28em] text-primary-200">Digital Stage</p><p className="text-[clamp(14px,2vw,32px)] font-bold text-white">{eventTitle}</p></div>
  </div>;
}

function Frame({ eventTitle, children, urgent = false }: { eventTitle: string; children: React.ReactNode; urgent?: boolean }) {
  return <div className={`relative h-full w-full overflow-hidden bg-[#080817] text-white ${urgent ? "bg-[#21040f]" : ""}`}>
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_20%,rgba(124,58,237,.28),transparent_31%),radial-gradient(circle_at_82%_75%,rgba(99,102,241,.24),transparent_36%),linear-gradient(135deg,#090817,#14102a_55%,#090817)]" />
    <div className="absolute -right-[12%] -top-[22%] h-[70%] w-[50%] rounded-full border border-white/10" />
    <div className="absolute -bottom-[30%] -left-[8%] h-[65%] w-[55%] rounded-full border border-primary-400/15" />
    <Brand eventTitle={eventTitle} />
    <div className="absolute bottom-[4%] left-[4%] right-[4%] h-px bg-gradient-to-r from-transparent via-primary-400/60 to-transparent" />
    <div className="relative z-10 flex h-full items-center justify-center px-[6%] pb-[5%] pt-[13%]">{children}</div>
  </div>;
}

const enter = { initial: { opacity: 0, y: 26, filter: "blur(10px)", scale: 0.98 }, animate: { opacity: 1, y: 0, filter: "blur(0px)", scale: 1 }, exit: { opacity: 0, y: -18, filter: "blur(8px)" } };

function IdleScene({ eventTitle, message }: { eventTitle: string; message: string }) {
  return <Frame eventTitle={eventTitle}><motion.div {...enter} className="text-center">
    <img src={brandLogo} alt="" className="mx-auto mb-[3vh] h-[clamp(72px,14vw,220px)] w-auto" />
    <h1 className="text-[clamp(32px,6vw,96px)] font-black tracking-tight">{eventTitle}</h1>
    <p className="mt-[2vh] text-[clamp(13px,1.8vw,30px)] text-primary-100/80">{message}</p>
  </motion.div></Frame>;
}

function AnnouncementScene({ payload }: { payload: Extract<StreamPublicState["scene"]["payload"], { type: "announcement" }> }) {
  return <Frame eventTitle={payload.eventTitle} urgent={payload.urgent}><motion.div {...enter} className="max-w-[82%] text-center">
    <div className={`mx-auto mb-[3vh] w-fit rounded-full px-[1.5vw] py-[.6vh] text-[clamp(10px,1.2vw,20px)] font-black uppercase tracking-[.3em] ${payload.urgent ? "bg-red-500 text-white" : "bg-primary-500/20 text-primary-200"}`}>{payload.urgent ? "Important announcement" : "Announcement"}</div>
    <h1 className="text-[clamp(32px,6vw,96px)] font-black leading-[1.02]">{payload.title}</h1>
    <p className="mx-auto mt-[4vh] max-w-[90%] whitespace-pre-wrap text-[clamp(16px,2.5vw,42px)] leading-snug text-white/80">{payload.message}</p>
  </motion.div></Frame>;
}

function LiveScene({ payload }: { payload: Extract<StreamPublicState["scene"]["payload"], { type: "live" }> }) {
  const progress = payload.total ? Math.round((payload.finished / payload.total) * 100) : 0;
  return <Frame eventTitle={payload.eventTitle}><motion.div {...enter} className="grid w-full grid-cols-[1.1fr_.9fr] items-center gap-[5vw]">
    <div><div className="mb-[2vh] flex items-center gap-[1vw] text-[clamp(12px,1.5vw,24px)] font-black uppercase tracking-[.2em] text-red-300"><span className="h-[.8em] w-[.8em] rounded-full bg-red-500 shadow-[0_0_24px_#ef4444]" />Now on stage</div>
      <h1 className="text-[clamp(38px,6vw,100px)] font-black leading-none">{payload.program}</h1><p className="mt-[2vh] text-[clamp(16px,2vw,34px)] font-bold text-primary-300">{payload.category}</p></div>
    <div className="rounded-[2vw] border border-white/10 bg-white/[.07] p-[3vw] backdrop-blur-xl"><p className="text-[clamp(10px,1vw,16px)] uppercase tracking-[.25em] text-white/50">Participant</p><h2 className="mt-[1vh] text-[clamp(24px,3.4vw,58px)] font-black leading-tight">{payload.participantName}</h2><div className="mt-[2vh] flex flex-wrap gap-[1vw] text-[clamp(12px,1.3vw,22px)] text-white/70">{payload.chestNo && <span>Code {payload.chestNo}</span>}{payload.teamName && <span>• {payload.teamName}</span>}</div>
      <div className="mt-[4vh]"><div className="mb-[1vh] flex justify-between text-[clamp(10px,1vw,16px)]"><span>Program progress</span><span>{payload.finished} / {payload.total}</span></div><div className="h-[1.1vh] overflow-hidden rounded-full bg-white/10"><motion.div initial={{ width: 0 }} animate={{ width: `${progress}%` }} transition={{ duration: 1 }} className="h-full rounded-full bg-gradient-to-r from-primary-500 to-violet-400" /></div></div></div>
  </motion.div></Frame>;
}

function NextScene({ payload }: { payload: Extract<StreamPublicState["scene"]["payload"], { type: "next" }> }) {
  return <Frame eventTitle={payload.eventTitle}><motion.div {...enter} className="text-center"><p className="text-[clamp(13px,1.6vw,26px)] font-black uppercase tracking-[.42em] text-primary-300">Up next</p><h1 className="mx-auto mt-[4vh] max-w-[90vw] text-[clamp(42px,7vw,118px)] font-black leading-none">{payload.program}</h1><p className="mt-[4vh] text-[clamp(18px,2.5vw,42px)] font-bold text-white/65">{payload.category}</p></motion.div></Frame>;
}

function ScoreboardScene({ eventTitle, teams }: { eventTitle: string; teams: StreamTeamStanding[] }) {
  return <Frame eventTitle={eventTitle}><div className="w-full"><motion.div {...enter} className="mb-[3vh] flex items-end justify-between"><div><p className="text-[clamp(10px,1.2vw,18px)] font-black uppercase tracking-[.3em] text-primary-300">Live standings</p><h1 className="text-[clamp(30px,4vw,68px)] font-black">Team scoreboard</h1></div><p className="text-[clamp(11px,1vw,16px)] text-white/45">Announced results only</p></motion.div>
    <motion.div layout className="grid max-h-[57vh] grid-cols-2 gap-[1.2vh_1.2vw] overflow-hidden">{teams.length ? teams.map((team) => <motion.div layout key={team.name} transition={{ layout: { duration: .7, type: "spring" } }} className="flex items-center rounded-[1vw] border border-white/10 bg-white/[.06] px-[1.4vw] py-[1.1vh]"><span className={`mr-[1.2vw] flex h-[clamp(28px,3.5vw,58px)] w-[clamp(28px,3.5vw,58px)] items-center justify-center rounded-full font-black ${team.rank === 1 ? "bg-amber-300 text-amber-950" : team.rank === 2 ? "bg-slate-300 text-slate-900" : team.rank === 3 ? "bg-orange-400 text-orange-950" : "bg-white/10 text-white/70"}`}>{team.rank}</span><div className="min-w-0 flex-1"><p className="truncate text-[clamp(14px,1.7vw,28px)] font-bold">{team.name}</p><p className="text-[clamp(9px,.8vw,13px)] text-white/40">{team.shortName}</p></div><p className="ml-[1vw] text-[clamp(20px,2.5vw,42px)] font-black text-primary-300"><AnimatedNumber value={team.points} /><span className="ml-1 text-[.42em] uppercase text-white/40">pts</span></p></motion.div>) : <div className="col-span-2 py-[12vh] text-center text-[clamp(18px,2.5vw,40px)] text-white/50">Standings will appear after results are announced</div>}</motion.div>
  </div></Frame>;
}

function Winners({ winners, rank }: { winners: StreamWinner[]; rank: number }) {
  const current = winners.filter((winner) => winner.rank === rank);
  const color = rank === 1 ? "text-amber-300" : rank === 2 ? "text-slate-200" : "text-orange-300";
  return <motion.div key={rank} {...enter} className="text-center"><p className={`text-[clamp(18px,2.5vw,42px)] font-black uppercase tracking-[.2em] ${color}`}>{rank === 1 ? "Winner" : `${rank}${rank === 2 ? "nd" : "rd"} place`}</p><div className="mt-[3vh] space-y-[2vh]">{current.map((winner, index) => <div key={`${winner.name}-${index}`}><h2 className="text-[clamp(32px,5vw,82px)] font-black leading-none">{winner.name}</h2><p className="mt-[1.5vh] text-[clamp(14px,1.8vw,30px)] text-white/60">{winner.team}{winner.grade && ` • Grade ${winner.grade}`}</p></div>)}</div></motion.div>;
}

function ResultScene({ payload, startedAt, duration }: { payload: Extract<StreamPublicState["scene"]["payload"], { type: "result" }>; startedAt: string; duration: number }) {
  const reduced = useReducedMotion();
  const ranks = useMemo(() => [2, 1].filter((rank) => payload.winners.some((winner) => winner.rank === rank)), [payload.winners]);
  const [phase, setPhase] = useState(0);
  const phases = 2 + ranks.length;
  useEffect(() => {
    const update = () => { const elapsed = Math.max(0, Date.now() - new Date(startedAt).getTime()); setPhase(Math.min(phases - 1, Math.floor((elapsed / Math.max(1, duration * 1000)) * phases))); };
    update(); const timer = window.setInterval(update, reduced ? 1_000 : 250); return () => window.clearInterval(timer);
  }, [duration, phases, reduced, startedAt]);
  const showingRank = phase > 0 && phase <= ranks.length ? ranks[phase - 1] : null;
  const confetti = showingRank === 1 || phase === phases - 1;
  return <Frame eventTitle={payload.eventTitle}><div className="w-full text-center"><AnimatePresence mode="wait">
    {phase === 0 && <motion.div key="intro" {...enter}><p className="text-[clamp(13px,1.6vw,26px)] font-black uppercase tracking-[.4em] text-primary-300">Official result</p><h1 className="mx-auto mt-[4vh] max-w-[90%] text-[clamp(38px,6vw,100px)] font-black leading-none">{payload.program}</h1><p className="mt-[3vh] text-[clamp(16px,2vw,34px)] text-white/60">{payload.category}</p></motion.div>}
    {showingRank && <Winners key={`rank-${showingRank}`} winners={payload.winners} rank={showingRank} />}
    {phase === phases - 1 && <motion.div key="podium" {...enter}><p className="mb-[3vh] text-[clamp(12px,1.4vw,24px)] font-black uppercase tracking-[.35em] text-primary-300">Podium</p><div className="mx-auto grid max-w-[90%] grid-cols-2 items-end gap-[1.5vw]">{[2,1].map((rank) => <div key={rank} className={`rounded-t-[1.5vw] border border-white/10 bg-white/[.07] p-[2vw] ${rank === 1 ? "pb-[7vh] pt-[4vh]" : "pb-[4vh]"}`}><p className="text-[clamp(24px,3vw,52px)] font-black">#{rank}</p>{payload.winners.filter((winner) => winner.rank === rank).map((winner) => <div key={winner.name} className="mt-[1vh]"><p className="text-[clamp(12px,1.5vw,25px)] font-bold">{winner.name}</p><p className="text-[clamp(9px,.9vw,15px)] text-white/45">{winner.team}</p></div>)}</div>)}</div></motion.div>}
  </AnimatePresence>{confetti && !reduced && <div className="pointer-events-none absolute inset-0 overflow-hidden">{Array.from({ length: 24 }, (_, index) => <motion.span key={index} initial={{ y: "-10vh", x: `${(index * 37) % 100}vw`, rotate: 0, opacity: 1 }} animate={{ y: "105vh", rotate: 540, opacity: .2 }} transition={{ duration: 2.4 + (index % 5) * .2, delay: (index % 8) * .08 }} className={`absolute h-[1.2vh] w-[.7vw] ${index % 3 === 0 ? "bg-primary-400" : index % 3 === 1 ? "bg-amber-300" : "bg-violet-400"}`} />)}</div>}</div></Frame>;
}

export default function StreamRenderer({ state, className = "" }: { state: StreamPublicState; className?: string }) {
  const payload = state.scene.payload;
  return <div className={`aspect-video w-full overflow-hidden bg-black font-public-sans ${className}`}><AnimatePresence mode="wait">
    <motion.div key={state.scene.key} className="h-full w-full" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: .65 }}>
      {payload.type === "idle" && <IdleScene eventTitle={payload.eventTitle} message={state.enabled ? payload.message : "Stream is currently offline"} />}
      {payload.type === "announcement" && <AnnouncementScene payload={payload} />}
      {payload.type === "live" && <LiveScene payload={payload} />}
      {payload.type === "next" && <NextScene payload={payload} />}
      {payload.type === "scoreboard" && <ScoreboardScene eventTitle={payload.eventTitle} teams={payload.teams} />}
      {payload.type === "result" && <ResultScene payload={payload} startedAt={state.scene.startedAt} duration={state.scene.durationSeconds} />}
    </motion.div>
  </AnimatePresence></div>;
}


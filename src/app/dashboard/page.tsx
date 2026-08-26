import { AppShell } from "@/components/AppShell";
import { Avatar } from "@/components/Avatar";
import { Chart } from "@/components/Chart";
import { Activity, ArrowUpRight, FileText, MapPin, MessageCircle, MoreHorizontal, Phone, Plus, Radio, Users } from "lucide-react";
import Link from "next/link";

export default function Dashboard() {
  return <AppShell title="Good morning, Alex" subtitle="Here’s what’s happening across your workspace."><div className="page dashboard-page">
    <div className="welcome"><div><span className="eyebrow">Wednesday, August 26</span><h2>Keep the momentum going.</h2><p>Your team exchanged 1,248 messages this week — 18% more than last week.</p></div><button className="primary"><Plus size={18}/> Start a conversation</button></div>
    <section className="metric-grid">
      <div className="metric"><span className="metric-icon coral"><MessageCircle/></span><div><small>Messages today</small><strong>248</strong><em>↗ 12.4%</em></div></div>
      <div className="metric"><span className="metric-icon blue"><Users/></span><div><small>Team online</small><strong>18 <i>/ 24</i></strong><em>75% active</em></div></div>
      <div className="metric"><span className="metric-icon violet"><Phone/></span><div><small>Calls this week</small><strong>32</strong><em>↗ 8.2%</em></div></div>
      <div className="metric"><span className="metric-icon green"><Radio/></span><div><small>Connection</small><strong className="status-word">Excellent</strong><em><i className="pulse"/> 42 ms latency</em></div></div>
    </section>
    <div className="dashboard-grid"><section className="card activity-chart"><div className="card-head"><div><h3>Message activity</h3><p>Messages sent across your workspace</p></div><button className="select-btn">Last 7 days⌄</button></div><Chart/></section>
    <section className="card live-now"><div className="card-head"><div><h3>Live now</h3><p>Active teammates</p></div><span className="live-pill"><i/> 18 online</span></div><div className="people-stack">{[["MR","coral"],["LC","blue"],["AH","gold"],["NO","violet"],["EW","green"]].map(([a,c])=><Avatar key={a} initials={a} color={c} online/>)}<span className="avatar avatar-more">+13</span></div><p className="quiet">Most of your team is online right now.</p><Link className="text-link" href="/chat">View all teammates <ArrowUpRight size={16}/></Link></section></div>
    <div className="dashboard-grid bottom"><section className="card recent"><div className="card-head"><div><h3>Recent activity</h3><p>Latest updates from your team</p></div><button className="plain">View all</button></div>{[
      [MessageCircle,"Maya sent a message in Design team","“The new flow looks great ✨”","2 min ago","coral"],
      [FileText,"Amelia updated Q3 Product Strategy","3 new edits","24 min ago","blue"],
      [Phone,"Team sync call ended","6 participants · 38 minutes","1 hour ago","violet"],
      [MapPin,"Downtown delivery completed","8.4 km · 42 minutes","Yesterday","green"]
    ].map(([Icon,t,d,time,color]:any)=><div className="activity-row" key={t}><span className={`tiny-icon ${color}`}><Icon size={17}/></span><div><strong>{t}</strong><small>{d}</small></div><time>{time}</time><MoreHorizontal size={18}/></div>)}</section>
    <section className="card quick"><div className="card-head"><div><h3>Quick actions</h3><p>Jump right back in</p></div></div><Link href="/chat/design-team"><MessageCircle/><span><strong>New message</strong><small>Start a conversation</small></span><ArrowUpRight/></Link><Link href="/call/team-sync"><Phone/><span><strong>Start a call</strong><small>Audio or video</small></span><ArrowUpRight/></Link><Link href="/collab/new"><FileText/><span><strong>Create document</strong><small>Collaborate in real time</small></span><ArrowUpRight/></Link><Link href="/tracking"><MapPin/><span><strong>Share location</strong><small>Start live tracking</small></span><ArrowUpRight/></Link></section></div>
  </div></AppShell>;
}

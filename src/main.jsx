import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

const initialProcesses = [
  { id: 'P1', arrival: 0, burst: 6, color: 'yellow' },
  { id: 'P2', arrival: 1, burst: 3, color: 'blue' },
  { id: 'P3', arrival: 2, burst: 8, color: 'pink' },
  { id: 'P4', arrival: 3, burst: 4, color: 'green' },
];
const algorithms = ['FCFS', 'SJF', 'SRTF', 'RR'];
const colors = ['yellow', 'blue', 'pink', 'green'];
const methodBriefs = {
  FCFS: ['Runs jobs in arrival order; each runs to completion.', 'Simple; long jobs can delay shorter jobs.'],
  SJF: ['Runs the shortest ready job to completion.', 'Can lower average waiting; long jobs may wait.'],
  SRTF: ['Runs the ready job with least time remaining.', 'Preempts it when a shorter job arrives.'],
  RR: ['Gives each ready job a turn up to the quantum.', 'Smaller quanta improve response but add switches.'],
};

function calculateSchedule(processes, algorithm, quantum) {
  const ordered = processes.map((process, index) => ({ ...process, index, remaining: process.burst, firstStart: null, completion: null }))
    .sort((a, b) => a.arrival - b.arrival || a.index - b.index);
  const segments = [];
  const append = (process, start, end) => {
    if (end <= start) return;
    const previous = segments.at(-1);
    if (previous?.processId === (process?.id ?? null) && previous.end === start) previous.end = end;
    else segments.push({ processId: process?.id ?? null, label: process?.id ?? 'IDLE', color: process?.color ?? 'idle', start, end });
  };
  let time = 0;
  if (algorithm === 'FCFS' || algorithm === 'SJF') {
    const ready = [];
    let next = 0;
    while (next < ordered.length || ready.length) {
      if (!ready.length && next < ordered.length && time < ordered[next].arrival) {
        append(null, time, ordered[next].arrival);
        time = ordered[next].arrival;
      }
      while (next < ordered.length && ordered[next].arrival <= time) ready.push(ordered[next++]);
      ready.sort((a, b) => algorithm === 'SJF'
        ? a.burst - b.burst || a.arrival - b.arrival || a.index - b.index
        : a.arrival - b.arrival || a.index - b.index);
      const process = ready.shift();
      process.firstStart = time;
      append(process, time, time + process.burst);
      time += process.burst;
      process.remaining = 0;
      process.completion = time;
    }
  } else if (algorithm === 'SRTF') {
    const unfinished = new Set(ordered);
    while (unfinished.size) {
      const ready = [...unfinished].filter(process => process.arrival <= time && process.remaining > 0)
        .sort((a, b) => a.remaining - b.remaining || a.arrival - b.arrival || a.index - b.index);
      if (!ready.length) {
        const nextArrival = Math.min(...[...unfinished].map(process => process.arrival));
        append(null, time, nextArrival);
        time = nextArrival;
        continue;
      }
      const process = ready[0];
      process.firstStart ??= time;
      append(process, time, time + 1);
      process.remaining -= 1;
      time += 1;
      if (process.remaining === 0) {
        process.completion = time;
        unfinished.delete(process);
      }
    }
  } else {
    const queue = [];
    let next = 0;
    while (next < ordered.length || queue.length) {
      if (!queue.length && next < ordered.length && time < ordered[next].arrival) {
        append(null, time, ordered[next].arrival);
        time = ordered[next].arrival;
      }
      while (next < ordered.length && ordered[next].arrival <= time) queue.push(ordered[next++]);
      const process = queue.shift();
      process.firstStart ??= time;
      const slice = Math.min(quantum, process.remaining);
      append(process, time, time + slice);
      time += slice;
      process.remaining -= slice;
      while (next < ordered.length && ordered[next].arrival <= time) queue.push(ordered[next++]);
      if (process.remaining > 0) queue.push(process);
      else process.completion = time;
    }
  }
  const results = ordered.slice().sort((a, b) => a.index - b.index).map(process => {
    const turnaround = process.completion - process.arrival;
    return { ...process, turnaround, waiting: turnaround - process.burst, response: process.firstStart - process.arrival };
  });
  const average = field => results.length ? results.reduce((sum, process) => sum + process[field], 0) / results.length : 0;
  return { results, segments, makespan: time, averages: { waiting: average('waiting'), turnaround: average('turnaround'), response: average('response') } };
}

function App() {
  const [algorithm, setAlgorithm] = useState('FCFS');
  const [processes, setProcesses] = useState(initialProcesses);
  const [quantum, setQuantum] = useState(2);
  const [nextId, setNextId] = useState(5);
  const [playing, setPlaying] = useState(false);
  const [now, setNow] = useState(0);
  const validProcesses = processes.every(process => Number.isInteger(process.arrival) && process.arrival >= 0 && Number.isInteger(process.burst) && process.burst > 0);
  const schedule = useMemo(() => validProcesses
    ? calculateSchedule(processes, algorithm, quantum)
    : { results: [], segments: [], makespan: 0, averages: { waiting: 0, turnaround: 0, response: 0 } }, [processes, algorithm, quantum, validProcesses]);

  useEffect(() => {
    if (!playing) return undefined;
    const step = Math.max(1, Math.ceil(schedule.makespan / 70));
    const timer = window.setInterval(() => setNow(value => Math.min(schedule.makespan, value + step)), 350);
    return () => window.clearInterval(timer);
  }, [playing, schedule.makespan]);
  useEffect(() => { if (playing && now >= schedule.makespan) setPlaying(false); }, [playing, now, schedule.makespan]);

  const updateProcess = (id, field, value) => {
    setPlaying(false);
    setNow(0);
    if (value === '') {
      setProcesses(current => current.map(process => process.id === id ? { ...process, [field]: '' } : process));
      return;
    }
    const number = Number(value);
    if (!Number.isInteger(number) || number < 0 || number > 99 || (field === 'burst' && number === 0)) return;
    setProcesses(current => current.map(process => process.id === id ? { ...process, [field]: number } : process));
  };
  const addProcess = () => {
    if (processes.length >= 8) return;
    setPlaying(false);
    setProcesses(current => [...current, { id: `P${nextId}`, arrival: 0, burst: 4, color: colors[(nextId - 1) % colors.length] }]);
    setNextId(id => id + 1);
    setNow(0);
  };
  const removeProcess = id => { setPlaying(false); setProcesses(current => current.filter(process => process.id !== id)); setNow(0); };
  const maxTime = Math.max(schedule.makespan, 1);
  const tickStep = Math.max(1, Math.ceil(maxTime / 8));
  const ticks = Array.from({ length: Math.floor(maxTime / tickStep) + 1 }, (_, index) => index * tickStep);
  if (ticks.at(-1) !== maxTime) ticks.push(maxTime);

  return <main className="shell app-shell">
    <header className="topbar"><a className="brand" href="#top" aria-label="RTOS Lab home"><span className="brand-mark">R</span><span>RTOS<span className="brand-light">.LAB</span></span></a><div className="top-meta"><span className="live-dot"/> SYSTEMS PLAYGROUND <span className="meta-divider">/</span> MODULE 04</div><a className="top-link" href="#concept">THE CONCEPT <span aria-hidden="true">↘</span></a></header>
    <section className="hero" id="top"><div className="hero-copy"><div className="eyebrow"><span>01</span> OPERATING SYSTEMS / CPU SCHEDULING</div><h1>EVERY<br/>TICK <span>COUNTS.</span></h1><p className="hero-intro">An interactive look at how an operating system decides what runs next when time itself is a requirement.</p><a className="hero-jump" href="#simulator">JUMP INTO THE SIMULATOR <span>↓</span></a></div><div className="hero-art" aria-label="Illustration of a system clock"><div className="art-note note-one">CPU<br/>SCHEDULING <span>!</span></div><div className="clock-face"><div className="clock-ring"><div className="clock-center"/><div className="clock-hand hand-long"/><div className="clock-hand hand-short"/><span className="clock-label">T−00:08</span></div><span className="clock-tick tick-a"/><span className="clock-tick tick-b"/><span className="clock-tick tick-c"/><span className="clock-tick tick-d"/></div><div className="art-note note-two">PROCESS<br/><strong>IN MOTION</strong></div><div className="art-orbit orbit-one"/><div className="art-orbit orbit-two"/><div className="art-sticker">ON<br/>TIME<br/><span>✓</span></div></div><div className="hero-index"><span>FIG 04.1</span><span>CPU TIME ALLOCATION</span></div></section>

    <section className="sim-section app-sim" id="simulator">
      <div className="section-heading"><div><div className="eyebrow"><span>02</span> THE SCHEDULER, LIVE</div><h2>Mission control<span className="period">.</span></h2></div></div>
      <div className="algorithm-bar"><span className="panel-kicker">ALGORITHM</span><div className="algorithm-tabs">{algorithms.map(name => <button key={name} className={algorithm === name ? 'selected' : ''} onClick={() => { setPlaying(false); setAlgorithm(name); setNow(0); }}>{name}</button>)}</div><div className="method-brief"><p>{methodBriefs[algorithm][0]}</p><p>{methodBriefs[algorithm][1]}</p></div>{algorithm === 'RR' && <label className="quantum-control">TIME QUANTUM <input type="number" min="1" max="99" value={quantum} onChange={event => { const value = Number(event.target.value); if (Number.isInteger(value) && value > 0 && value <= 99) { setPlaying(false); setQuantum(value); setNow(0); } }} /> ms</label>}</div>
      <div className="sim-layout"><div className="sim-main panel">
        <div className="panel-head"><div><span className="panel-kicker">GANTT CHART</span><span className="panel-sub">Block width represents CPU time</span></div><div className="live-badge"><span className="live-dot"/>{playing ? 'RUNNING' : 'READY'}</div></div>
        {!validProcesses && <p className="input-error">Arrival must be 0 or more; burst must be at least 1.</p>}
        <div className="gantt-scroll"><div className="gantt-chart"><div className="gantt-blocks">{schedule.segments.map((segment, index) => <div key={`${segment.start}-${index}`} className={`gantt-block ${segment.color} ${segment.color === 'idle' ? 'idle-block' : ''}`} style={{ width: `${(segment.end - segment.start) / maxTime * 100}%` }} title={`${segment.label}: ${segment.start} to ${segment.end}`}><strong>{segment.label}</strong><span>{segment.end - segment.start} ms</span><i className="block-start">{segment.start}</i><i className="block-end">{segment.end}</i></div>)}{schedule.segments.length === 0 && <div className="empty-chart">Add a process to show the schedule.</div>}<div className="gantt-cursor" style={{ left: `${Math.min(now / maxTime * 100, 100)}%` }}/></div><div className="gantt-axis">{ticks.map((tick, index) => <span key={`${tick}-${index}`} style={{ left: `${tick / maxTime * 100}%` }}>{tick}</span>)}</div></div></div>
        <div className="sim-controls"><div className="play-controls"><button className="button-primary" disabled={!validProcesses || !schedule.makespan} onClick={() => { if (now >= schedule.makespan) setNow(0); setPlaying(!playing); }}><span>{playing ? 'Ⅱ' : '▶'}</span>{playing ? 'PAUSE' : 'PLAY'}</button><button className="icon-button" onClick={() => { setPlaying(false); setNow(0); }} aria-label="Reset schedule">↺</button></div><span className="schedule-end">TOTAL TIME <strong>{schedule.makespan} ms</strong></span></div>
      </div><aside className="sim-side"><div className="queue-card panel process-inputs"><div className="queue-head"><span className="panel-kicker">PROCESSES</span><span className="queue-count">{processes.length} / 8</span></div><div className="process-legend"><span>PROCESS</span><span>ARRIVAL</span><span>BURST</span><span></span></div>{processes.map(process => <div className="process-input-row" key={process.id}><div className="process-input-name"><i className={`task-dot ${process.color}`}/><strong>{process.id}</strong><button className="remove-task" onClick={() => removeProcess(process.id)} aria-label={`Remove ${process.id}`}>×</button></div><input aria-label={`${process.id} arrival time`} type="number" min="0" max="99" value={process.arrival} onChange={event => updateProcess(process.id,'arrival',event.target.value)}/><input aria-label={`${process.id} burst time`} type="number" min="1" max="99" value={process.burst} onChange={event => updateProcess(process.id,'burst',event.target.value)}/><span className="input-unit">ms</span></div>)}<button className="add-task" disabled={processes.length >= 8} onClick={addProcess}>＋ ADD PROCESS</button></div>
        <div className="metric-card panel metrics-card"><div className="panel-kicker">AVERAGE TIMES</div><div className="average-metric"><span>WAITING</span><strong>{schedule.averages.waiting.toFixed(2)}<small> ms</small></strong></div><div className="average-metric"><span>TURNAROUND</span><strong>{schedule.averages.turnaround.toFixed(2)}<small> ms</small></strong></div><div className="average-metric"><span>RESPONSE</span><strong>{schedule.averages.response.toFixed(2)}<small> ms</small></strong></div></div>
      </aside></div>
      <div className="results-panel panel"><div className="results-heading"><span className="panel-kicker">PROCESS TIMES</span><span className="queue-count">All times in ms</span></div><div className="results-scroll"><table className="results-table"><thead><tr><th>PROCESS</th><th>AT</th><th>BT</th><th>CT</th><th>TAT</th><th>WT</th><th>RT</th></tr></thead><tbody>{schedule.results.map(process => <tr key={process.id}><th><i className={`task-dot ${process.color}`}/>{process.id}</th><td>{process.arrival}</td><td>{process.burst}</td><td>{process.completion}</td><td>{process.turnaround}</td><td>{process.waiting}</td><td>{process.response}</td></tr>)}</tbody></table></div><div className="formula-note"><strong>CT</strong> completion · <strong>TAT = CT − AT</strong> turnaround · <strong>WT = TAT − BT</strong> waiting · <strong>RT = first start − AT</strong> response</div></div>
    </section>

    <section className="concept-section" id="concept"><div className="concept-title"><div className="eyebrow"><span>03</span> THE BIG IDEA</div><h2>Who runs<br/><span>next?</span></h2><div className="concept-stamp">CPU<br/>TIME<br/>≠ INFINITE</div></div><div className="concept-copy"><h3>What is CPU scheduling?</h3><p>An operating system scheduler chooses which ready process gets CPU time. The scheduling policy affects how long processes wait, how soon they first run, and when they finish.</p><div className="concept-facts"><div><span>01 / ARRIVAL</span><strong>When a process is ready</strong></div><div><span>02 / BURST</span><strong>CPU time it needs</strong></div><div><span>03 / QUANTUM</span><strong>RR time slice</strong></div></div></div></section>
    <section className="usecase"><div className="usecase-label"><span>04 / IN THE FIELD</span><span className="satellite-icon">✳</span></div><div><h3>Telemetry, millions of miles out.</h3><p>Satellite computers schedule sensor sampling, telemetry encoding, and communication work while operating remotely. FCFS, SJF, SRTF, and Round Robin help compare CPU allocation and responsiveness. Safety-critical onboard tasks also need deadline-aware scheduling and timing guarantees.</p></div><span className="case-number">CASE<br/>STUDY<br/><b>01</b></span></section>
    <footer className="footer"><a className="brand" href="#top"><span className="brand-mark">R</span><span>RTOS<span className="brand-light">.LAB</span></span></a><span>BUILT FOR THE SPACE BETWEEN TICKS.</span><a href="#top">BACK TO TOP ↑</a></footer>
  </main>;
}

createRoot(document.getElementById('root')).render(<App />);

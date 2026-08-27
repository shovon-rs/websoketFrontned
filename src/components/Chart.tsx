interface ChartProps {
  data: { date: string; count: number }[];
}

const WIDTH = 700;
const HEIGHT = 180;
const BOTTOM_PAD = 25;

export function Chart({ data }: ChartProps) {
  const max = Math.max(1, ...data.map((d) => d.count));
  const stepX = data.length > 1 ? WIDTH / (data.length - 1) : 0;
  const points = data.map((d, i) => [i * stepX, HEIGHT - (d.count / max) * HEIGHT] as const);

  const linePath = points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L${WIDTH} ${HEIGHT + BOTTOM_PAD} L0 ${HEIGHT + BOTTOM_PAD} Z`;

  const yLabels = [max, Math.round(max * 0.75), Math.round(max * 0.5), Math.round(max * 0.25), 0];
  const xLabels = data.map((d) => new Date(`${d.date}T00:00:00`).toLocaleDateString(undefined, { weekday: "short" }));

  return <div className="chart" aria-label="Message activity chart">
    <div className="y-labels">{yLabels.map((v, i) => <span key={i}>{v}</span>)}</div>
    <div className="chart-body">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT + BOTTOM_PAD}`} preserveAspectRatio="none">
        <defs><linearGradient id="area" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ff6b4a" stopOpacity=".24"/><stop offset="1" stopColor="#ff6b4a" stopOpacity="0"/></linearGradient></defs>
        <path className="area" d={areaPath}/>
        <path className="line" d={linePath}/>
      </svg>
      <div className="x-labels">{xLabels.map((l, i) => <span key={i}>{l}</span>)}</div>
    </div>
  </div>;
}

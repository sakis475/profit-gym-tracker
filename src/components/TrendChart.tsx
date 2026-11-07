import { useLayoutEffect, useRef, useState } from 'react'
import { Box, Paper, Typography, useTheme } from '@mui/material'

export type TrendPoint = {
    // Timestamp for a line, ignored for bars (they are evenly spaced in the given order)
    x: number
    y: number
    label: string
}

type Props = {
    points: TrendPoint[]
    kind?: 'line' | 'bar'
    height?: number
    formatValue: (y: number) => string
    // Short label under the x axis
    formatTick: (p: TrendPoint) => string
    ariaLabel: string
    // A dashed horizontal line, e.g. a goal
    reference?: { value: number; label: string }
}

const MARGIN = { top: 12, right: 16, bottom: 28, left: 48 }
// Below this many points every point gets a marker, above it only the hovered one
const MAX_MARKERS = 30
const MIN_TICK_SPACING = 64

function niceStep(range: number, count: number) {
    const raw = range / count
    const magnitude = 10 ** Math.floor(Math.log10(raw))
    const n = raw / magnitude
    return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * magnitude
}

function niceTicks(lo: number, hi: number, count = 4) {
    if (lo === hi) {
        hi = lo + 1
        lo = Math.max(0, lo - 1)
    }
    const step = niceStep(hi - lo, count)
    const ticks: number[] = []
    for (let v = Math.floor(lo / step) * step; v <= Math.ceil(hi / step) * step + step / 2; v += step) {
        ticks.push(Number(v.toFixed(6)))
    }
    return ticks
}

// Indexes of the points to put an x label under, at least MIN_TICK_SPACING apart
function tickIndexes(xs: number[]) {
    const picked: number[] = []
    for (const [i, x] of xs.entries()) {
        if (picked.length === 0 || x - xs[picked[picked.length - 1]] >= MIN_TICK_SPACING) picked.push(i)
    }
    // Prefer showing the last point over the one just before it
    const last = xs.length - 1
    if (picked.length > 1 && picked[picked.length - 1] !== last && xs[last] - xs[picked[picked.length - 1]] < MIN_TICK_SPACING) {
        picked[picked.length - 1] = last
    }
    return picked
}

// A bar with its top corners rounded, sitting on the baseline
function barPath(x: number, y: number, w: number, h: number) {
    const r = Math.min(4, w / 2, h)
    return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`
}

export default function TrendChart({ points, kind = 'line', height = 220, formatValue, formatTick, ariaLabel, reference }: Props) {
    const theme = useTheme()
    const ref = useRef<HTMLDivElement>(null)
    const [width, setWidth] = useState(0)
    const [hover, setHover] = useState<number | null>(null)

    useLayoutEffect(() => {
        const el = ref.current
        if (!el) return
        const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
        observer.observe(el)
        return () => observer.disconnect()
    }, [])

    const plotW = Math.max(0, width - MARGIN.left - MARGIN.right)
    const plotH = height - MARGIN.top - MARGIN.bottom

    // The reference line is kept inside the scale
    const ys = [...points.map((p) => p.y), ...(reference ? [reference.value] : [])]
    // Bars encode size by length so they start at zero, a line can zoom in on the change
    const ticks = niceTicks(kind === 'bar' ? 0 : Math.min(...ys), Math.max(...ys))
    const yMin = ticks[0]
    const yMax = ticks[ticks.length - 1]
    const sy = (y: number) => MARGIN.top + plotH - ((y - yMin) / (yMax - yMin)) * plotH

    const band = plotW / Math.max(1, points.length)
    const xMin = points[0]?.x ?? 0
    const xMax = points[points.length - 1]?.x ?? 0
    const sx = (p: TrendPoint, i: number) =>
        kind === 'bar'
            ? MARGIN.left + band * (i + 0.5)
            : MARGIN.left + (xMax === xMin ? plotW / 2 : ((p.x - xMin) / (xMax - xMin)) * plotW)

    const xs = points.map(sx)
    const color = theme.palette.primary.main
    const surface = theme.palette.background.paper

    function handlePointer(e: React.PointerEvent<SVGSVGElement>) {
        const px = e.clientX - e.currentTarget.getBoundingClientRect().left
        let nearest = 0
        for (const [i, x] of xs.entries()) if (Math.abs(x - px) < Math.abs(xs[nearest] - px)) nearest = i
        setHover(nearest)
    }

    const hovered = hover !== null ? points[hover] : null

    return (
        <Box ref={ref} sx={{ position: 'relative', width: '100%', height }}>
            {width > 0 && points.length > 0 && (
                <svg
                    width={width}
                    height={height}
                    role="img"
                    aria-label={ariaLabel}
                    onPointerMove={handlePointer}
                    onPointerDown={handlePointer}
                    onPointerLeave={() => setHover(null)}
                    style={{ display: 'block', touchAction: 'pan-y' }}
                >
                    {ticks.map((t) => (
                        <g key={t}>
                            <line
                                x1={MARGIN.left}
                                x2={MARGIN.left + plotW}
                                y1={sy(t)}
                                y2={sy(t)}
                                stroke={theme.palette.divider}
                                strokeDasharray={t === yMin ? undefined : '2 4'}
                            />
                            <text
                                x={MARGIN.left - 8}
                                y={sy(t)}
                                textAnchor="end"
                                dominantBaseline="middle"
                                fontSize={12}
                                fill={theme.palette.text.secondary}
                            >
                                {formatValue(t)}
                            </text>
                        </g>
                    ))}

                    {tickIndexes(xs).map((i) => (
                        <text
                            key={i}
                            x={xs[i]}
                            y={height - 8}
                            textAnchor={kind === 'bar' ? 'middle' : i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle'}
                            fontSize={12}
                            fill={theme.palette.text.secondary}
                        >
                            {formatTick(points[i])}
                        </text>
                    ))}

                    {reference && (
                        <g>
                            <line
                                x1={MARGIN.left}
                                x2={MARGIN.left + plotW}
                                y1={sy(reference.value)}
                                y2={sy(reference.value)}
                                stroke={theme.palette.text.secondary}
                                strokeDasharray="6 4"
                            />
                            <text
                                x={MARGIN.left + plotW}
                                y={sy(reference.value) - 6}
                                textAnchor="end"
                                fontSize={12}
                                fill={theme.palette.text.secondary}
                            >
                                {reference.label}
                            </text>
                        </g>
                    )}

                    {kind === 'bar' ? (
                        points.map((p, i) => {
                            // A 2px gap between neighbours, never wider than 32px
                            const w = Math.max(1, Math.min(32, band - 2))
                            const h = sy(yMin) - sy(p.y)
                            return (
                                <path
                                    key={i}
                                    d={barPath(xs[i] - w / 2, sy(p.y), w, h)}
                                    fill={color}
                                    opacity={hover === null || hover === i ? 1 : 0.5}
                                />
                            )
                        })
                    ) : (
                        <>
                            {hovered && (
                                <line
                                    x1={xs[hover!]}
                                    x2={xs[hover!]}
                                    y1={MARGIN.top}
                                    y2={MARGIN.top + plotH}
                                    stroke={theme.palette.text.secondary}
                                    strokeOpacity={0.4}
                                />
                            )}
                            <polyline
                                points={points.map((p, i) => `${xs[i]},${sy(p.y)}`).join(' ')}
                                fill="none"
                                stroke={color}
                                strokeWidth={2}
                                strokeLinejoin="round"
                                strokeLinecap="round"
                            />
                            {points.map((p, i) =>
                                points.length <= MAX_MARKERS || hover === i ? (
                                    <circle
                                        key={i}
                                        cx={xs[i]}
                                        cy={sy(p.y)}
                                        r={hover === i ? 6 : 4}
                                        fill={color}
                                        stroke={surface}
                                        strokeWidth={2}
                                    />
                                ) : null
                            )}
                        </>
                    )}
                </svg>
            )}

            {hovered && (
                <Paper
                    elevation={3}
                    sx={{
                        position: 'absolute',
                        pointerEvents: 'none',
                        px: 1.5,
                        py: 0.75,
                        // Kept inside the chart so it is not cut off at the edges
                        left: Math.min(Math.max(xs[hover!], 70), width - 70),
                        top: Math.max(sy(hovered.y) - 12, 0),
                        transform: 'translate(-50%, -100%)',
                        whiteSpace: 'nowrap',
                    }}
                >
                    <Typography variant="caption" color="text.secondary" component="div">
                        {hovered.label}
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {formatValue(hovered.y)}
                    </Typography>
                </Paper>
            )}
        </Box>
    )
}

import {
  formatKnowledgeGraphLabel,
  getKnowledgeGraphLabelPlacement,
  type KnowledgeGraph as KnowledgeGraphModel,
} from "../../visualization/chart-model";

export function KnowledgeGraph({ graph, sourceStatus }: { graph: KnowledgeGraphModel; sourceStatus: string }) {
  if (!graph.nodes.length) return <div className="dream-chart-state"><b>{sourceStatus === "live" || sourceStatus === "stale" ? "No indexed graph" : `Knowledge ${sourceStatus}`}</b></div>;
  const byId = new Map(graph.nodes.map((node) => [node.id, node]));
  return (
    <svg className="dream-knowledge-graph" viewBox="0 0 100 100" role="img" aria-label={`${graph.nodes.length} knowledge nodes and ${graph.edges.length} verified relations`}>
      <g className="dream-knowledge-graph__edges">{graph.edges.map((edge) => {
        const source = byId.get(edge.source); const target = byId.get(edge.target);
        return source && target ? <line key={`${edge.source}-${edge.target}`} x1={source.x} y1={source.y} x2={target.x} y2={target.y} /> : null;
      })}</g>
      <g>{graph.nodes.map((node) => {
        const label = getKnowledgeGraphLabelPlacement(node);
        return <g key={node.id} className={`dream-knowledge-node dream-knowledge-node--${node.kind}`} tabIndex={0} aria-label={`${node.kind}: ${node.label}; ${node.status}`}><circle cx={node.x} cy={node.y} r={node.kind === "project" ? 4.5 : 2.2} /><text className="dream-knowledge-node__label" x={label.x} y={label.y} textAnchor={label.textAnchor}>{formatKnowledgeGraphLabel(node.label)}</text><title>{node.label} · {node.status}</title></g>;
      })}</g>
    </svg>
  );
}

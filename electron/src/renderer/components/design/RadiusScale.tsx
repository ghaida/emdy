export function RadiusScale({ rounded }: { rounded: Record<string, string> }) {
  return (
    <div className="design-scale design-scale--radius">
      {Object.entries(rounded).map(([name, value]) => (
        <div className="design-radius-item" key={name}>
          <div className="design-radius-square" style={{ borderRadius: value }} />
          <div className="design-token-name">{name}</div>
          <div className="design-token-value">{value}</div>
        </div>
      ))}
    </div>
  );
}

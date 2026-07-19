import { isValidCssColor } from '../../lib/design-md';

export function ComponentTable({ components }: { components: Record<string, Record<string, string>> }) {
  return (
    <div className="design-components">
      {Object.entries(components).map(([name, props]) => (
        <div className="design-component" key={name}>
          <div className="design-component-name">{name}</div>
          <table className="design-component-table">
            <tbody>
              {Object.entries(props).map(([prop, value]) => (
                <tr key={prop}>
                  <td className="design-token-name">{prop}</td>
                  <td className="design-token-value">
                    {isValidCssColor(value) && (
                      <span className="design-mini-swatch" style={{ backgroundColor: value }} />
                    )}
                    {value}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

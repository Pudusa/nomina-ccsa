interface IconProps {
  name: string;
  className?: string;
  filled?: boolean;
}

/** Icono Material Symbols Outlined, el mismo conjunto que usan los diseños de Stitch. */
export function Icon({ name, className = '', filled = false }: IconProps) {
  return (
    <span
      className={`material-symbols-outlined ${className}`}
      aria-hidden="true"
      style={filled ? { fontVariationSettings: "'FILL' 1" } : undefined}
    >
      {name}
    </span>
  );
}

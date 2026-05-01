export function HamburgerButton({ onClick }: { onClick: () => void }) {
  return (
    <button className="pg-hamburger" onClick={onClick} aria-label="Open menu" type="button">
      <span className="pg-hamburger-lines" aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
    </button>
  );
}


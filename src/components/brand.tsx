/** Shared Humor Project family mark, with Chain Studio's own wordmark. */
export function Brand({
  href,
  onClick,
}: {
  href?: string;
  onClick?: () => void;
}) {
  const content = (
    <>
      <span className="brand-icon" aria-hidden="true">
        h<span>.</span>
      </span>
      <span className="brand-copy">
        <span>
          chain<span className="brand-light">studio</span>
          <span className="brand-dot">.</span>
        </span>
        <small>THE HUMOR PROJECT</small>
      </span>
    </>
  );
  return href ? (
    <a
      className="brand"
      href={href}
      aria-label="Chain Studio · The Humor Project"
    >
      {content}
    </a>
  ) : (
    <button
      className="brand"
      onClick={onClick}
      aria-label="Chain Studio · The Humor Project"
    >
      {content}
    </button>
  );
}

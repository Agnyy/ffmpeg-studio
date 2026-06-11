type CompBreadcrumb = {
  id: string;
  name: string;
};

type CompBreadcrumbsProps = {
  crumbs: CompBreadcrumb[];
  canGoBack: boolean;
  onNavigate: (compositionId: string) => void;
  onBack: () => void;
};

export default function CompBreadcrumbs({
  crumbs,
  canGoBack,
  onNavigate,
  onBack,
}: CompBreadcrumbsProps) {
  if (crumbs.length <= 1 && !canGoBack) {
    return null;
  }

  return (
    <div className="comp-breadcrumbs">
      {canGoBack && (
        <button
          type="button"
          className="comp-breadcrumbs-back btn btn-secondary btn-sm"
          onClick={onBack}
          title="Back to parent composition"
        >
          ← Back
        </button>
      )}
      <nav className="comp-breadcrumbs-trail" aria-label="Composition path">
        {crumbs.map((crumb, index) => {
          const isLast = index === crumbs.length - 1;
          return (
            <span key={crumb.id} className="comp-breadcrumbs-item">
              {index > 0 && <span className="comp-breadcrumbs-sep">›</span>}
              {isLast ? (
                <span className="comp-breadcrumbs-current">{crumb.name}</span>
              ) : (
                <button
                  type="button"
                  className="comp-breadcrumbs-link"
                  onClick={() => onNavigate(crumb.id)}
                >
                  {crumb.name}
                </button>
              )}
            </span>
          );
        })}
      </nav>
    </div>
  );
}

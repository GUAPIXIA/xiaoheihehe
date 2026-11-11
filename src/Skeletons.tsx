// Shape-matching skeletons for the first paint of the feed and the comment list.
// They are decorative only; the caller keeps a visually hidden status text for screen readers.

export function FeedSkeleton() {
  return <div className="skeleton-feed" aria-hidden="true">
    {[0, 1, 2].map(index => <div className="skeleton-card" key={index}>
      <div className="skeleton-user"><span className="skeleton skeleton-avatar" /><span className="skeleton skeleton-author" /></div>
      <div className="skeleton skeleton-title" />
      <div className="skeleton skeleton-text" />
      <div className="skeleton skeleton-text short" />
      {index !== 1 && <div className="skeleton skeleton-cover" />}
      <div className="skeleton-foot"><span className="skeleton skeleton-meta" /><span className="skeleton skeleton-actions" /></div>
    </div>)}
  </div>;
}

export function CommentsSkeleton() {
  return <div className="skeleton-comments" aria-hidden="true">
    {[0, 1, 2].map(index => <div className="skeleton-comment" key={index}>
      <span className="skeleton comment-avatar-skeleton" />
      <div className="skeleton-comment-body">
        <span className="skeleton skeleton-author" />
        <span className="skeleton skeleton-text" />
        <span className="skeleton skeleton-text short" />
        <span className="skeleton skeleton-meta" />
      </div>
    </div>)}
  </div>;
}
